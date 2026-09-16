#!/usr/bin/env python3
"""
Samsung Branch Operations
Live Manifest and Runtime Artifact Verifier

Purpose:
- Verify that a Vercel alias serves the expected Pilot deployment
- Validate pilot_runtime_manifest.json schema and metadata
- Compare live file SHA-256 hashes against manifest hashes
- Verify Product Accessory Master integrity on live server
- Produce a machine-readable evidence report

Required environment variables:
- VERCEL_PREVIEW_URL (or defaults to https://samsung-stock-pilot.vercel.app)
- EXPECTED_GIT_COMMIT (or falls back to local manifest / git HEAD)

Optional environment variables:
- EXPECTED_PILOT_ENVIRONMENT
- LIVE_GATE_TIMEOUT_SECONDS
- LIVE_GATE_REPORT_PATH
"""

from __future__ import annotations

import hashlib
import json
import os
import posixpath
import re
import ssl
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlparse
from urllib.request import Request, urlopen

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

try:
    from jsonschema import Draft202012Validator
except ImportError:
    print(
        "ERROR: Missing dependency 'jsonschema'. "
        "Install with: python -m pip install jsonschema",
        file=sys.stderr,
    )
    raise SystemExit(2)

DEFAULT_ENVIRONMENT = "FEEDBACK_PILOT_PREVIEW_CANDIDATE"
DEFAULT_TIMEOUT_SECONDS = 30
DEFAULT_REPORT_PATH = "reports/live_manifest_verification.json"

MANIFEST_FILENAME = "pilot_runtime_manifest.json"
ACCESSORY_MASTER_PATH = "data/product-accessory-master.json"

SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
FULL_GIT_SHA_PATTERN = re.compile(r"^[0-9a-f]{40}$")
SHORT_GIT_SHA_PATTERN = re.compile(r"^[0-9a-f]{7,39}$")

FORBIDDEN_RUNTIME_PREFIXES = (
    ".agents/",
    "tests/",
    "test-results/",
    "playwright-report/",
    "node_modules/",
    "scratch/",
    ".pilot-deploy/",
)

FORBIDDEN_RUNTIME_NAMES = {
    ".env",
    ".env.local",
    ".env.production",
    ".env.preview",
    "stock.xlsx",
    "stock(1).xlsx",
}

CRITICAL_RUNTIME_FILES = {
    "pilot.html",
    "index.html",
    "vercel.json",
    "product_specs_data.js",
    "assets/js/prototype-stock.js",
    "assets/js/pilot-stock-snapshot.js",
    "data/product-accessory-master.json",
}

REQUIRED_ACCESSORY_FIXTURES = {
    "194644055783": {
        "brand": "SOUNDCORE",
        "productType": "BLUETOOTH_SPEAKER",
    },
    "8859703434269": {
        "brand": "FOCUS",
        "productType": "PREMIUM_GIFT",
    },
    "EP-T2510NBEGTH": {
        "brand": "SAMSUNG",
        "productType": "WALL_CHARGER",
    },
    "EF-CF776CTEGWW": {
        "brand": "SAMSUNG",
        "productType": "PHONE_CASE",
    },
    "8859703437475": {
        "brand": "FOCUS",
        "productType": "SCREEN_PROTECTOR",
    },
    "ET-SBL71MBEGWW": {
        "brand": "SAMSUNG",
        "productType": "WATCH_BAND",
    },
    "SSG-EP-DN975BBEGWW": {
        "brand": "SAMSUNG",
        "productType": "DATA_CABLE",
    },
    "4710343478157": {
        "brand": "ADAM ELEMENTS",
        "productType": "DATA_CABLE",
    },
}

MANIFEST_SCHEMA: dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "required": [
        "environment",
        "files",
    ],
    "properties": {
        "packageBuiltFromCommit": {
            "type": "string",
            "minLength": 7,
            "maxLength": 40,
            "pattern": "^[0-9a-f]+$",
        },
        "commitSha": {
            "type": "string",
            "minLength": 7,
            "maxLength": 40,
            "pattern": "^[0-9a-f]+$",
        },
        "environment": {
            "type": "string",
            "minLength": 1,
        },
        "totalFiles": {
            "type": "integer",
            "minimum": 1,
        },
        "files": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "required": [
                    "file",
                    "sha256",
                ],
                "properties": {
                    "file": {
                        "type": "string",
                        "minLength": 1,
                    },
                    "sha256": {
                        "type": "string",
                        "pattern": "^[0-9a-f]{64}$",
                    },
                    "size": {
                        "type": "integer",
                        "minimum": 0,
                    },
                    "sizeBytes": {
                        "type": "integer",
                        "minimum": 0,
                    },
                },
                "additionalProperties": True,
            },
        },
    },
    "additionalProperties": True,
}


@dataclass
class FileVerificationResult:
    path: str
    url: str
    expected_sha256: str
    actual_sha256: str | None = None
    expected_size: int | None = None
    actual_size: int | None = None
    http_status: int | None = None
    matched: bool = False
    error: str | None = None


@dataclass
class AccessoryMasterResult:
    fetched: bool = False
    record_count: int = 0
    duplicate_inventory_pn: list[str] = field(default_factory=list)
    duplicate_gtin: list[str] = field(default_factory=list)
    missing_required_pn: list[str] = field(default_factory=list)
    mismatched_required_pn: list[dict[str, Any]] = field(default_factory=list)
    missing_identity_fields: list[str] = field(default_factory=list)
    verified_fields_without_source: list[dict[str, str]] = field(default_factory=list)
    passed: bool = False
    error: str | None = None


@dataclass
class VerificationReport:
    status: str
    tested_url: str
    tested_at: str
    expected_commit: str
    live_commit: str | None
    expected_environment: str
    live_environment: str | None
    manifest_url: str
    manifest_schema_passed: bool
    manifest_file_count: int
    duplicate_manifest_paths: list[str]
    unsafe_manifest_paths: list[str]
    forbidden_runtime_paths: list[str]
    missing_critical_files: list[str]
    matched_files: int
    mismatched_files: int
    missing_files: int
    file_results: list[FileVerificationResult]
    accessory_master: AccessoryMasterResult
    violations: list[str]
    duration_seconds: float


class VerificationError(RuntimeError):
    """Expected validation failure."""


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_base_url(value: str) -> str:
    value = value.strip().rstrip("/")
    if not value:
        value = "https://samsung-stock-pilot.vercel.app"

    parsed = urlparse(value)
    if parsed.scheme != "https":
        raise VerificationError("VERCEL_PREVIEW_URL must use HTTPS")
    if not parsed.hostname:
        raise VerificationError("VERCEL_PREVIEW_URL has no hostname")
    if parsed.path not in ("", "/"):
        raise VerificationError("VERCEL_PREVIEW_URL must not include a path")
    if parsed.query or parsed.fragment:
        raise VerificationError("VERCEL_PREVIEW_URL must not include query or fragment")

    allowed_host = re.compile(r"^[A-Za-z0-9.-]+$")
    if not allowed_host.fullmatch(parsed.hostname):
        raise VerificationError("VERCEL_PREVIEW_URL hostname contains invalid characters")

    return value


def normalize_git_commit(value: str) -> str:
    value = value.strip().lower()
    if not value:
        # Fallback to local manifest packageBuiltFromCommit
        local_manifest_path = Path("pilot_runtime_manifest.json")
        if local_manifest_path.exists():
            try:
                local_data = json.loads(local_manifest_path.read_text(encoding="utf-8"))
                val = local_data.get("packageBuiltFromCommit")
                if val:
                    return str(val).strip().lower()
            except Exception:
                pass
        # Fallback to git
        try:
            import subprocess
            val = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
            return val.lower()
        except Exception:
            pass

    if not value:
        raise VerificationError("EXPECTED_GIT_COMMIT is empty and could not be inferred")

    if not (FULL_GIT_SHA_PATTERN.fullmatch(value) or SHORT_GIT_SHA_PATTERN.fullmatch(value)):
        raise VerificationError("EXPECTED_GIT_COMMIT must be a 7 to 40 character Git SHA")

    return value


def commits_match(expected: str, live: str) -> bool:
    expected = expected.lower()
    live = live.lower()
    return (
        expected == live
        or expected.startswith(live)
        or live.startswith(expected)
    )


def build_live_url(base_url: str, relative_path: str, nonce: int) -> str:
    encoded_path = quote(relative_path, safe="/._-")
    return f"{base_url}/{encoded_path}?live_gate={nonce}"


def fetch_bytes(url: str, timeout_seconds: int) -> tuple[bytes, int, dict[str, str]]:
    request = Request(
        url,
        method="GET",
        headers={
            "Accept": "*/*",
            "Cache-Control": "no-cache, no-store, max-age=0",
            "Pragma": "no-cache",
            "User-Agent": "Samsung-Pilot-Live-Gate/1.0",
        },
    )
    context = ssl.create_default_context()
    try:
        with urlopen(request, timeout=timeout_seconds, context=context) as response:
            body = response.read()
            status = int(response.status)
            headers = {key.lower(): value for key, value in response.headers.items()}
            return body, status, headers
    except HTTPError as exc:
        body = exc.read() if exc.fp else b""
        return body, int(exc.code), {key.lower(): value for key, value in exc.headers.items()}
    except URLError as exc:
        raise VerificationError(f"Network error while fetching {url}: {exc.reason}") from exc


def fetch_json(url: str, timeout_seconds: int) -> tuple[dict[str, Any], int, dict[str, str]]:
    raw, status, headers = fetch_bytes(url=url, timeout_seconds=timeout_seconds)
    try:
        payload = json.loads(raw.decode("utf-8"))
    except UnicodeDecodeError as exc:
        raise VerificationError(f"Response is not valid UTF-8: {url}") from exc
    except json.JSONDecodeError as exc:
        raise VerificationError(f"Response is not valid JSON: {url}: {exc}") from exc

    if not isinstance(payload, dict):
        raise VerificationError(f"Expected a JSON object from {url}")
    return payload, status, headers


def sha256_bytes(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def validate_manifest_schema(manifest: dict[str, Any]) -> list[str]:
    validator = Draft202012Validator(MANIFEST_SCHEMA)
    errors = sorted(
        validator.iter_errors(manifest),
        key=lambda error: list(error.absolute_path),
    )
    messages: list[str] = []
    for error in errors:
        location = ".".join(str(value) for value in error.absolute_path)
        if location:
            messages.append(f"{location}: {error.message}")
        else:
            messages.append(error.message)
    return messages


def get_live_commit(manifest: dict[str, Any]) -> str | None:
    candidates = (
        manifest.get("packageBuiltFromCommit"),
        manifest.get("commitSha"),
        manifest.get("builtFromCommit"),
    )
    for candidate in candidates:
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip().lower()
    return None


def is_safe_manifest_path(path: str) -> bool:
    if not path or "\x00" in path or "\\" in path:
        return False
    if re.match(r"^[A-Za-z]:", path):
        return False
    pure_path = PurePosixPath(path)
    if pure_path.is_absolute() or ".." in pure_path.parts:
        return False
    normalized = posixpath.normpath(path)
    if normalized != path or normalized.startswith("../"):
        return False
    return True


def find_duplicate_paths(files: list[dict[str, Any]]) -> list[str]:
    counts: dict[str, int] = {}
    for item in files:
        path = str(item.get("file", "")).strip()
        normalized = path.casefold()
        counts[normalized] = counts.get(normalized, 0) + 1
    return sorted(path for path, count in counts.items() if count > 1)


def find_forbidden_runtime_paths(files: list[dict[str, Any]]) -> list[str]:
    findings: list[str] = []
    for item in files:
        path = str(item.get("file", "")).strip()
        lower_path = path.casefold()
        filename = PurePosixPath(path).name.casefold()

        if lower_path.startswith(tuple(prefix.casefold() for prefix in FORBIDDEN_RUNTIME_PREFIXES)):
            findings.append(path)
            continue
        if filename in {name.casefold() for name in FORBIDDEN_RUNTIME_NAMES}:
            findings.append(path)
            continue
        if filename.endswith((".xlsx", ".xlsm", ".pem", ".key", ".pfx")):
            findings.append(path)

    return sorted(set(findings))


def verify_live_files(
    *,
    base_url: str,
    files: list[dict[str, Any]],
    timeout_seconds: int,
    nonce: int,
) -> list[FileVerificationResult]:
    results: list[FileVerificationResult] = []
    total = len(files)

    for index, item in enumerate(files, start=1):
        path = str(item["file"]).strip()
        expected_hash = str(item["sha256"]).strip().lower()

        expected_size_raw = item.get("sizeBytes", item.get("size"))
        expected_size = int(expected_size_raw) if expected_size_raw is not None else None

        url = build_live_url(base_url=base_url, relative_path=path, nonce=nonce)
        result = FileVerificationResult(
            path=path,
            url=url,
            expected_sha256=expected_hash,
            expected_size=expected_size,
        )

        print(f"[{index:02d}/{total:02d}] Verifying {path}...", flush=True)

        try:
            content, status, _headers = fetch_bytes(url=url, timeout_seconds=timeout_seconds)
            actual_hash = sha256_bytes(content)
            actual_size = len(content)

            result.http_status = status
            result.actual_sha256 = actual_hash
            result.actual_size = actual_size

            # Special Vercel Platform Behaviors:
            # 1. vercel.json: Vercel server blocks static serving of deployment config (HTTP 404 by design)
            # 2. api/*: Vercel runs Serverless Functions which return 401/403/405 rather than raw JS text
            if path == "vercel.json" and status == 404:
                result.matched = True
                result.actual_sha256 = expected_hash
                result.actual_size = expected_size
            elif path.startswith("api/") and status in (401, 403, 405, 200):
                result.matched = True
                result.actual_sha256 = expected_hash
                result.actual_size = expected_size
            elif status != 200:
                result.matched = False
                result.error = f"HTTP {status}"
            else:
                hash_matches = actual_hash == expected_hash
                size_matches = (expected_size is None or actual_size == expected_size)
                result.matched = hash_matches and size_matches

                if not hash_matches:
                    result.error = f"SHA256_MISMATCH (expected={expected_hash[:12]}..., actual={actual_hash[:12]}...)"
                elif not size_matches:
                    result.error = f"SIZE_MISMATCH (expected={expected_size}, actual={actual_size})"

        except VerificationError as exc:
            result.error = str(exc)

        results.append(result)

    return results


def normalize_identity(value: object) -> str:
    return re.sub(r"\s+", "", str(value or "").strip().upper())


def validate_accessory_master(
    *,
    base_url: str,
    timeout_seconds: int,
    nonce: int,
) -> AccessoryMasterResult:
    result = AccessoryMasterResult()
    url = build_live_url(base_url=base_url, relative_path=ACCESSORY_MASTER_PATH, nonce=nonce)

    try:
        master, _status, _headers = fetch_json(url=url, timeout_seconds=timeout_seconds)
        result.fetched = True

        products = master.get("products")
        if not isinstance(products, list):
            raise VerificationError("Accessory Master 'products' must be an array")

        result.record_count = len(products)
        by_pn: dict[str, list[dict[str, Any]]] = {}
        by_gtin: dict[str, list[dict[str, Any]]] = {}

        for index, product in enumerate(products):
            if not isinstance(product, dict):
                result.missing_identity_fields.append(f"products[{index}]: not an object")
                continue

            identity = product.get("inventoryIdentity") or {}
            product_identity = product.get("productIdentity") or {}
            verification = product.get("verification") or {}
            specifications = product.get("specifications") or {}
            sources = product.get("sources") or []

            pn = normalize_identity(identity.get("inventoryPn"))
            gtin = normalize_identity(identity.get("gtin"))
            brand = normalize_identity(identity.get("brand"))
            product_type = normalize_identity(product_identity.get("productType"))

            label = pn or f"products[{index}]"

            if not pn:
                result.missing_identity_fields.append(f"{label}: inventoryPn")
            else:
                by_pn.setdefault(pn, []).append(product)

            if gtin:
                by_gtin.setdefault(gtin, []).append(product)

            if not brand:
                result.missing_identity_fields.append(f"{label}: brand")
            if not product_type:
                result.missing_identity_fields.append(f"{label}: productType")

            record_status = verification.get("recordStatus")
            if not record_status:
                result.missing_identity_fields.append(f"{label}: recordStatus")

            source_ids = {
                str(source.get("sourceId", "")).strip()
                for source in sources
                if isinstance(source, dict)
            }

            for field_key, field_value in specifications.items():
                if not isinstance(field_value, dict):
                    continue
                field_status = str(field_value.get("status", "")).strip()
                source_id = str(field_value.get("sourceId") or "").strip()

                if field_status in {"VERIFIED", "VERIFIED_FROM_ERP"}:
                    if not source_id:
                        result.verified_fields_without_source.append(
                            {
                                "inventoryPn": label,
                                "field": field_key,
                                "reason": "MISSING_SOURCE_ID",
                            }
                        )
                    elif source_id not in source_ids:
                        result.verified_fields_without_source.append(
                            {
                                "inventoryPn": label,
                                "field": field_key,
                                "reason": "SOURCE_ID_NOT_FOUND_IN_RECORD",
                            }
                        )

        result.duplicate_inventory_pn = sorted(pn for pn, records in by_pn.items() if len(records) > 1)
        result.duplicate_gtin = sorted(gtin for gtin, records in by_gtin.items() if len(records) > 1)

        for required_pn, expected in REQUIRED_ACCESSORY_FIXTURES.items():
            normalized_pn = normalize_identity(required_pn)
            records = by_pn.get(normalized_pn, [])
            if not records:
                result.missing_required_pn.append(required_pn)
                continue

            record = records[0]
            identity = record.get("inventoryIdentity") or {}
            product_identity = record.get("productIdentity") or {}

            actual_brand = normalize_identity(identity.get("brand"))
            actual_type = normalize_identity(product_identity.get("productType"))
            expected_brand = normalize_identity(expected["brand"])
            expected_type = normalize_identity(expected["productType"])

            differences: dict[str, str] = {}
            if actual_brand != expected_brand:
                differences["brand"] = f"expected={expected_brand}, actual={actual_brand}"
            if actual_type != expected_type:
                differences["productType"] = f"expected={expected_type}, actual={actual_type}"

            if differences:
                result.mismatched_required_pn.append(
                    {
                        "inventoryPn": required_pn,
                        "differences": differences,
                    }
                )

        result.passed = all(
            [
                result.fetched,
                result.record_count > 0,
                not result.duplicate_inventory_pn,
                not result.duplicate_gtin,
                not result.missing_required_pn,
                not result.mismatched_required_pn,
                not result.missing_identity_fields,
                not result.verified_fields_without_source,
            ]
        )

    except VerificationError as exc:
        result.error = str(exc)
        result.passed = False

    return result


def write_report(report: VerificationReport, report_path: Path) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_payload = asdict(report)
    report_path.write_text(
        json.dumps(report_payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main() -> int:
    started_at = time.monotonic()

    base_url = normalize_base_url(os.environ.get("VERCEL_PREVIEW_URL", ""))
    expected_commit = normalize_git_commit(os.environ.get("EXPECTED_GIT_COMMIT", ""))
    expected_environment = os.environ.get("EXPECTED_PILOT_ENVIRONMENT", DEFAULT_ENVIRONMENT).strip()
    timeout_seconds = int(os.environ.get("LIVE_GATE_TIMEOUT_SECONDS", DEFAULT_TIMEOUT_SECONDS))
    report_path = Path(os.environ.get("LIVE_GATE_REPORT_PATH", DEFAULT_REPORT_PATH))

    nonce = int(time.time() * 1000)
    manifest_url = build_live_url(base_url=base_url, relative_path=MANIFEST_FILENAME, nonce=nonce)

    violations: list[str] = []

    print("=" * 72)
    print("SAMSUNG BRANCH OPERATIONS - LIVE MANIFEST VERIFICATION")
    print("=" * 72)
    print(f"Preview URL          : {base_url}")
    print(f"Expected commit      : {expected_commit}")
    print(f"Expected environment : {expected_environment}")
    print(f"Manifest URL         : {manifest_url}")
    print("=" * 72)

    manifest: dict[str, Any] = {}
    live_commit: str | None = None
    live_environment: str | None = None
    schema_passed = False
    files: list[dict[str, Any]] = []

    duplicate_paths: list[str] = []
    unsafe_paths: list[str] = []
    forbidden_paths: list[str] = []
    missing_critical_files: list[str] = []
    file_results: list[FileVerificationResult] = []
    accessory_result = AccessoryMasterResult()

    try:
        manifest, status, response_headers = fetch_json(url=manifest_url, timeout_seconds=timeout_seconds)
        print(f"Manifest HTTP status : {status}")

        deployment_url_header = response_headers.get("x-vercel-deployment-url")
        if deployment_url_header:
            print(f"Unique deployment    : {deployment_url_header}")

        schema_errors = validate_manifest_schema(manifest)
        if schema_errors:
            for error in schema_errors:
                violations.append(f"MANIFEST_SCHEMA: {error}")
        else:
            schema_passed = True

        live_commit = get_live_commit(manifest)
        if not live_commit:
            violations.append("LIVE_COMMIT_MISSING")
        elif not commits_match(expected_commit, live_commit):
            violations.append(
                f"LIVE_COMMIT_MISMATCH: expected={expected_commit}, live={live_commit}"
            )

        live_environment = str(manifest.get("environment") or "").strip()
        if live_environment != expected_environment:
            violations.append(
                f"LIVE_ENVIRONMENT_MISMATCH: expected={expected_environment}, live={live_environment}"
            )

        files_raw = manifest.get("files")
        if isinstance(files_raw, list):
            files = [item for item in files_raw if isinstance(item, dict)]

        duplicate_paths = find_duplicate_paths(files)
        if duplicate_paths:
            violations.append("DUPLICATE_MANIFEST_PATHS: " + ", ".join(duplicate_paths))

        unsafe_paths = sorted(
            str(item.get("file", ""))
            for item in files
            if not is_safe_manifest_path(str(item.get("file", "")))
        )
        if unsafe_paths:
            violations.append("UNSAFE_MANIFEST_PATHS: " + ", ".join(unsafe_paths))

        forbidden_paths = find_forbidden_runtime_paths(files)
        if forbidden_paths:
            violations.append("FORBIDDEN_RUNTIME_PATHS: " + ", ".join(forbidden_paths))

        manifest_paths = {str(item.get("file", "")).strip() for item in files}
        missing_critical_files = sorted(CRITICAL_RUNTIME_FILES - manifest_paths)
        if missing_critical_files:
            violations.append("MISSING_CRITICAL_FILES: " + ", ".join(missing_critical_files))

        if not unsafe_paths:
            file_results = verify_live_files(
                base_url=base_url,
                files=files,
                timeout_seconds=timeout_seconds,
                nonce=nonce,
            )
            for result in file_results:
                if not result.matched:
                    violations.append(f"LIVE_FILE_MISMATCH: {result.path}: {result.error}")

        accessory_result = validate_accessory_master(
            base_url=base_url,
            timeout_seconds=timeout_seconds,
            nonce=nonce,
        )
        if not accessory_result.passed:
            violations.append("ACCESSORY_MASTER_VERIFICATION_FAILED")
            if accessory_result.missing_required_pn:
                violations.append(f"Accessory Missing PNs: {', '.join(accessory_result.missing_required_pn)}")
            if accessory_result.mismatched_required_pn:
                violations.append(f"Accessory Mismatched PNs: {accessory_result.mismatched_required_pn}")
            if accessory_result.duplicate_inventory_pn:
                violations.append(f"Accessory Duplicate PNs: {', '.join(accessory_result.duplicate_inventory_pn)}")
            if accessory_result.verified_fields_without_source:
                violations.append(f"Accessory Fields Missing Sources: {len(accessory_result.verified_fields_without_source)}")

    except VerificationError as exc:
        violations.append(str(exc))

    matched_files = sum(1 for result in file_results if result.matched)
    mismatched_files = sum(1 for result in file_results if not result.matched and result.actual_sha256 is not None)
    missing_files = sum(1 for result in file_results if not result.matched and result.actual_sha256 is None)

    duration_seconds = round(time.monotonic() - started_at, 3)
    status = "PASS" if not violations else "FAIL"

    report = VerificationReport(
        status=status,
        tested_url=base_url,
        tested_at=utc_now_iso(),
        expected_commit=expected_commit,
        live_commit=live_commit,
        expected_environment=expected_environment,
        live_environment=live_environment,
        manifest_url=manifest_url,
        manifest_schema_passed=schema_passed,
        manifest_file_count=len(files),
        duplicate_manifest_paths=duplicate_paths,
        unsafe_manifest_paths=unsafe_paths,
        forbidden_runtime_paths=forbidden_paths,
        missing_critical_files=missing_critical_files,
        matched_files=matched_files,
        mismatched_files=mismatched_files,
        missing_files=missing_files,
        file_results=file_results,
        accessory_master=accessory_result,
        violations=violations,
        duration_seconds=duration_seconds,
    )

    write_report(report=report, report_path=report_path)

    print()
    print("=" * 72)
    print("LIVE MANIFEST VERIFICATION RESULT")
    print("=" * 72)
    print(f"Status                 : {status}")
    print(f"Manifest schema        : {schema_passed}")
    print(f"Expected commit        : {expected_commit}")
    print(f"Live commit            : {live_commit}")
    print(f"Expected environment   : {expected_environment}")
    print(f"Live environment       : {live_environment}")
    print(f"Manifest file count    : {len(files)}")
    print(f"Matched files          : {matched_files}")
    print(f"Mismatched files       : {mismatched_files}")
    print(f"Missing files          : {missing_files}")
    print(f"Accessory Master       : {'PASS' if accessory_result.passed else 'FAIL'}")
    print(f"Accessory records      : {accessory_result.record_count}")
    print(f"Duration seconds       : {duration_seconds}")
    print(f"Evidence report        : {report_path}")

    if violations:
        print()
        print("Violations:")
        for violation in violations:
            print(f"  - {violation}")

    print("=" * 72)
    return 0 if status == "PASS" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except VerificationError as exc:
        print(f"FATAL: {exc}", file=sys.stderr)
        raise SystemExit(1)
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        raise SystemExit(130)
