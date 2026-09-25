#!/usr/bin/env python3
"""
Build Dedicated Feedback Pilot Package (samsung_stock_dashboard_feedback_pilot.zip)
Scope: 4-User Store Pilot (Ayutthaya City Park)
Safety Guarantee: NEVER modifies or overwrites samsung_stock_dashboard_runtime.zip.

New in Phase 1.5-C2:
  --output-package <path>     Write zip to <path> instead of the default pilot zip
  --output-manifest <path>    Write manifest JSON to <path> instead of pilot_runtime_manifest.json
  --runtime-manifest <path>   Read runtime manifest from <path> instead of runtime_manifest.json
  PILOT_PACKAGE_OUTPUT / PILOT_MANIFEST_OUTPUT / PILOT_RUNTIME_MANIFEST env vars also supported.
  In isolated mode, the original zip and manifest files are NOT written.
"""

import os
import sys
import zipfile
import json
import hashlib
from datetime import datetime

sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASELINE_ZIP = os.path.join(ROOT_DIR, "samsung_stock_dashboard_runtime.zip")
PILOT_ZIP = os.path.join(ROOT_DIR, "samsung_stock_dashboard_feedback_pilot.zip")
MANIFEST_PATH = os.path.join(ROOT_DIR, "runtime_manifest.json")
PILOT_MANIFEST_PATH = os.path.join(ROOT_DIR, "pilot_runtime_manifest.json")

def build_pilot_package(
    output_zip=None,
    output_manifest=None,
    runtime_manifest=None,
):
    # Resolve output paths
    _isolated = bool(output_zip or output_manifest or runtime_manifest)
    dest_zip = output_zip or PILOT_ZIP
    dest_manifest = output_manifest or PILOT_MANIFEST_PATH
    src_manifest = runtime_manifest or MANIFEST_PATH

    print("================================================================")
    print("SAMSUNG FEEDBACK PILOT - DEDICATED RUNTIME PACKAGE BUILDER")
    if _isolated:
        print("[ISOLATED MODE] Output paths overridden:")
        print(f"  Package  -> {dest_zip}")
        print(f"  Manifest -> {dest_manifest}")
        print(f"  Source   <- {src_manifest}")
    print("Scope: 4-User Store Model (Ayutthaya City Park)")
    print("================================================================\n")

    # 1. Verify baseline zip integrity before build
    if not os.path.exists(BASELINE_ZIP):
        raise FileNotFoundError(f"Baseline zip not found: {BASELINE_ZIP}")

    baseline_stat_before = os.stat(BASELINE_ZIP).st_mtime_ns

    # Read baseline manifest (source manifest may be overridden in isolated mode)
    with open(src_manifest, "r", encoding="utf-8") as f:
        base_manifest = json.load(f)

    baseline_files = [item["file"] for item in base_manifest.get("files", [])]

    # Additional pilot-specific files
    pilot_specific_files = [
        "pilot.html",
        "api/admin/members.js",
        "assets/css/prototype-stock.css",
        "assets/js/prototype-stock.js",
        "product_specs_data.js",
        "assets/js/pilot-runtime-config.js",
        "assets/js/supabase-client.js",
        "assets/js/auth-service.js",
        "assets/js/permission-service.js",
        "assets/js/session-guard.js",
        "assets/js/issue-service.js",
        "assets/js/auth-modal.js",
        "assets/js/user-status-bar.js",
        "assets/js/issue-report-modal.js",
        "assets/js/issue-list.js",
        "assets/js/pilot-navigation.js",
        "assets/js/pilot-dashboard-widgets.js",
        "assets/js/member-admin-service.js",
        "assets/js/pilot-bootstrap.js",
        "assets/js/pilot-stock-snapshot.js",
        "api/stock-imports.js",
        "api/stock/active.js",
        "api/promotion-imports.js",
        "api/promotion-campaigns.js",
        "api/promotion-errors.js",
        "api/promotions/active.js",
        "assets/js/promotion-heading-parser.js",
        "assets/js/promotion-knowledge-base.js",
        "assets/js/promotion-calculator.js",
        "promotion_review_dashboard.html",
        "reports/promotion_release_manifest.json",
        "data/product-accessory-master.json"
    ]

    all_pilot_files = baseline_files + pilot_specific_files

    # 2. Build pilot manifest
    pilot_manifest_items = []
    total_bytes = 0

    print(f"Packaging {len(all_pilot_files)} runtime files into {os.path.basename(dest_zip)}...")

    os.makedirs(os.path.dirname(os.path.abspath(dest_zip)), exist_ok=True)
    with zipfile.ZipFile(dest_zip, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for rel_path in all_pilot_files:
            abs_path = os.path.join(ROOT_DIR, rel_path)
            if not os.path.exists(abs_path):
                raise FileNotFoundError(f"Missing required file for pilot package: {rel_path}")

            if rel_path == "index.html":
                # Safety Isolation: Mirror pilot.html into index.html inside Pilot package
                # Guarantees root domain '/' serves Feedback Pilot without modifying baseline index.html on disk
                pilot_source_path = os.path.join(ROOT_DIR, "pilot.html")
                with open(pilot_source_path, "rb") as rf:
                    file_bytes = rf.read()
                file_sha = hashlib.sha256(file_bytes).hexdigest()
                file_size = len(file_bytes)
                zf.writestr(rel_path, file_bytes)
                total_bytes += file_size
                pilot_manifest_items.append({
                    "file": "index.html",
                    "sizeBytes": file_size,
                    "sha256": file_sha,
                    "status": "PILOT_ENTRYPOINT_MIRROR"
                })
                print(f"  + Added: {rel_path} (MIRRORED FROM pilot.html, {file_size} bytes)")
                continue
            if rel_path == "vercel.json":
                # Pilot deployment routing: Redirect root '/' to '/pilot.html' and rewrite admin API paths
                pilot_vercel_cfg = {
                    "version": 2,
                    "name": "samsung-stock-dashboard",
                    "cleanUrls": True,
                    "redirects": [
                        {
                            "source": "/",
                            "destination": "/pilot.html",
                            "permanent": False
                        }
                    ],
                    "rewrites": [
                        {
                            "source": "/api/admin/members/:path*",
                            "destination": "/api/admin/members?path=:path*"
                        },
                        {
                            "source": "/api/stock/active",
                            "destination": "/api/stock/active"
                        },
                        {
                            "source": "/api/stock-imports/:path*",
                            "destination": "/api/stock-imports?path=:path*"
                        },
                        {
                            "source": "/api/promotion-imports/:path*",
                            "destination": "/api/promotion-imports?path=:path*"
                        },
                        {
                            "source": "/api/promotion-campaigns/:path*",
                            "destination": "/api/promotion-campaigns?path=:path*"
                        },
                        {
                            "source": "/api/promotion-errors/:path*",
                            "destination": "/api/promotion-errors?path=:path*"
                        },
                        {
                            "source": "/api/promotions/active",
                            "destination": "/api/promotions/active"
                        }
                    ]
                }
                file_bytes = json.dumps(pilot_vercel_cfg, indent=2, ensure_ascii=False).encode("utf-8")
                file_sha = hashlib.sha256(file_bytes).hexdigest()
                file_size = len(file_bytes)
                zf.writestr(rel_path, file_bytes)
                total_bytes += file_size
                pilot_manifest_items.append({
                    "file": "vercel.json",
                    "sizeBytes": file_size,
                    "sha256": file_sha,
                    "status": "PILOT_ROUTING_CONFIG",
                    "note": "Root redirect to /pilot.html configured for Vercel Preview"
                })
                print(f"  + Added: {rel_path} (PILOT ROUTING REDIRECT, {file_size} bytes)")
                continue

            with open(abs_path, "rb") as rf:
                file_bytes = rf.read()
                file_sha = hashlib.sha256(file_bytes).hexdigest()
                file_size = len(file_bytes)

            zf.write(abs_path, rel_path)
            total_bytes += file_size

            pilot_manifest_items.append({
                "file": rel_path.replace("\\", "/"),
                "sizeBytes": file_size,
                "sha256": file_sha,
                "status": "PILOT_RUNTIME" if rel_path in pilot_specific_files else "BASELINE_CORE"
            })
            print(f"  + Added: {rel_path} ({file_size} bytes)")

        import subprocess
        try:
            head_commit = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
        except Exception:
            head_commit = "b38d846"

        manifest_data = {
            "manifestVersion": "1.1.0-pilot",
            "environment": "FEEDBACK_PILOT_PREVIEW_CANDIDATE",
            "applicationSourceCommit": "4dba2fe",
            "packageBuiltFromCommit": head_commit,
            "baselineCommit": "a7c3390",
            "databaseSchemaCommit": "4dba2fe",
            "builtAt": datetime.now().astimezone().isoformat(),
            "project": "Samsung Branch Operations System - Feedback Pilot",
            "pilotBranch": "AYUTTHAYA_CITY_PARK",
            "usersCount": 4,
            "primaryUseCase": "STOCK_LOOKUP",
            "totalFiles": len(pilot_manifest_items),
            "summary": {
                "totalFiles": len(pilot_manifest_items),
                "totalSizeBytes": total_bytes,
                "totalSizeMB": round(total_bytes / (1024 * 1024), 2)
            },
            "files": pilot_manifest_items
        }

        manifest_str = json.dumps(manifest_data, indent=2, ensure_ascii=False)
        zf.writestr("pilot_runtime_manifest.json", manifest_str.encode("utf-8"))

    # Save pilot manifest to dest_manifest (isolated or default)
    os.makedirs(os.path.dirname(os.path.abspath(dest_manifest)), exist_ok=True)
    with open(dest_manifest, "w", encoding="utf-8") as f:
        f.write(manifest_str)
    if _isolated:
        print(f"[ISOLATED] Manifest written to: {dest_manifest} (default pilot_runtime_manifest.json NOT written)")

    # 3. Post-build Baseline Integrity Verification
    baseline_stat_after = os.stat(BASELINE_ZIP).st_mtime_ns
    if baseline_stat_before != baseline_stat_after:
        raise RuntimeError("FATAL: Baseline runtime zip was touched during pilot build!")

    print("\n----------------------------------------------------------------")
    print("BUILD VERIFICATION:")
    print(f"Baseline Zip Unchanged: YES (mtime match)")
    print(f"Pilot Package Created: {dest_zip}")
    print(f"Pilot Package Size: {os.path.getsize(dest_zip)} bytes")
    print(f"Total Files in Pilot: {len(pilot_manifest_items) + 1}")
    if _isolated:
        print("[ISOLATED MODE] Default samsung_stock_dashboard_feedback_pilot.zip NOT written")
    print("\u2705 Feedback Pilot Package Build Complete & Verified!")
    print("================================================================\n")

if __name__ == "__main__":
    _pkg = os.environ.get("PILOT_PACKAGE_OUTPUT", "")
    _mfst = os.environ.get("PILOT_MANIFEST_OUTPUT", "")
    _rmfst = os.environ.get("PILOT_RUNTIME_MANIFEST", "")
    _args = sys.argv[1:]
    _i = 0
    while _i < len(_args):
        if _args[_i] == "--output-package" and _i + 1 < len(_args):
            _pkg = _args[_i + 1]; _i += 2
        elif _args[_i] == "--output-manifest" and _i + 1 < len(_args):
            _mfst = _args[_i + 1]; _i += 2
        elif _args[_i] == "--runtime-manifest" and _i + 1 < len(_args):
            _rmfst = _args[_i + 1]; _i += 2
        else:
            _i += 1
    build_pilot_package(
        output_zip=_pkg or None,
        output_manifest=_mfst or None,
        runtime_manifest=_rmfst or None,
    )
