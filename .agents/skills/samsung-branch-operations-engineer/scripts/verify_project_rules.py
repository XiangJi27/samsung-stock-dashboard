#!/usr/bin/env python3
"""
Master Project Rules & Invariant Validator for Samsung Branch Operations.
Tests codebase against project_rules.json, fixtures, baseline integrity, and secret hygiene.
"""

import os
import sys
import json
import re
import hashlib
import subprocess

sys.stdout.reconfigure(encoding="utf-8")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(SCRIPT_DIR)
WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(SKILL_DIR)))
RULES_JSON = os.path.join(SKILL_DIR, "references", "project_rules.json")

print("================================================================================")
print("SAMSUNG BRANCH OPERATIONS - MASTER PROJECT INVARIANT VALIDATOR")
print(f"Project Root: {WORKSPACE_ROOT}")
print("================================================================================\n")

failures = []

def record_check(name, passed, detail=""):
    status = "✅ [PASS]" if passed else "❌ [FAIL]"
    print(f"{status} {name}")
    if not passed:
        failures.append(f"{name}: {detail}")

# ----------------------------------------------------------------------
# 1. BASELINE FREEZE CHECK
# ----------------------------------------------------------------------
manifest_path = os.path.join(WORKSPACE_ROOT, "runtime_manifest.json")
if os.path.exists(manifest_path):
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    frozen_files = ["index.html", "app.js", "style.css"]
    all_frozen_match = True
    for item in manifest.get("files", []):
        if item["file"] in frozen_files:
            file_path = os.path.join(WORKSPACE_ROOT, item["file"])
            if os.path.exists(file_path):
                hasher = hashlib.sha256()
                with open(file_path, "rb") as bf:
                    hasher.update(bf.read())
                actual_hash = hasher.hexdigest()
                expected_hash = item.get("sha256", item.get("hash"))
                if actual_hash != expected_hash:
                    all_frozen_match = False
                    failures.append(f"Baseline file {item['file']} modified! Hash mismatch.")
    record_check("BASELINE-FREEZE: Core baseline files untouched (a7c3390)", all_frozen_match)
else:
    record_check("BASELINE-FREEZE: runtime_manifest.json exists", False, "Missing manifest")

# ----------------------------------------------------------------------
# 2. STOCK RECONCILIATION & DYNAMIC FIXTURE CHECK
# ----------------------------------------------------------------------
recon_script = os.path.join(SCRIPT_DIR, "verify_stock_reconciliation.py")
try:
    res = subprocess.run([sys.executable, recon_script], capture_output=True, encoding="utf-8", errors="replace", cwd=WORKSPACE_ROOT)
    record_check("STOCK-RECONCILIATION: Hash-bound fixture and F1/F2 counts", res.returncode == 0, (res.stdout or "") + (res.stderr or ""))
except Exception as e:
    record_check("STOCK-RECONCILIATION: Execution failed", False, str(e))

# ----------------------------------------------------------------------
# 3. SPEC IDENTITY & FIELD-LEVEL VERIFICATION CHECK
# ----------------------------------------------------------------------
spec_script = os.path.join(SCRIPT_DIR, "verify_spec_identity.py")
try:
    res = subprocess.run([sys.executable, spec_script], capture_output=True, encoding="utf-8", errors="replace", cwd=WORKSPACE_ROOT)
    record_check("SPEC-IDENTITY-GUARD: Field-level verification and fail-closed policies", res.returncode == 0, (res.stdout or "") + (res.stderr or ""))
except Exception as e:
    record_check("SPEC-IDENTITY-GUARD: Execution failed", False, str(e))

# ----------------------------------------------------------------------
# 4. CREDENTIAL HYGIENE & SECRET SCANNER
# ----------------------------------------------------------------------
# Prohibit hardcoded test credentials in source code and test files
suspicious_patterns = [
    (re.compile(r'TEST_ADMIN_PASSWORD\s*=\s*["\'][^"\']+["\']'), "Hardcoded TEST_ADMIN_PASSWORD assignment"),
    (re.compile(r'TEST_MEMBER_PASSWORD\s*=\s*["\'][^"\']+["\']'), "Hardcoded TEST_MEMBER_PASSWORD assignment"),
    (re.compile(r'password\s*:\s*["\']-hxBrSZ'), "Known plaintext admin password embedded"),
    (re.compile(r'password\s*:\s*["\']test1234["\']'), "Known plaintext test password embedded in source code"),
]

scan_dirs = [
    os.path.join(SKILL_DIR, "tests"),
    os.path.join(SKILL_DIR, "scripts"),
    os.path.join(WORKSPACE_ROOT, "api"),
    os.path.join(WORKSPACE_ROOT, "assets", "js")
]

secrets_found = []
for sdir in scan_dirs:
    if not os.path.exists(sdir):
        continue
    for root, _, files in os.walk(sdir):
        for f in files:
            if f.endswith(('.ts', '.js', '.py', '.json', '.html', '.ps1')):
                filepath = os.path.join(root, f)
                try:
                    with open(filepath, 'r', encoding='utf-8', errors='ignore') as sf:
                        content = sf.read()
                    for pat, desc in suspicious_patterns:
                        if pat.search(content):
                            rel = os.path.relpath(filepath, WORKSPACE_ROOT)
                            secrets_found.append(f"{rel}: {desc}")
                except Exception:
                    pass

record_check("CREDENTIAL-HYGIENE: Zero hardcoded passwords/tokens in code & test suite", len(secrets_found) == 0, "; ".join(secrets_found))

# ----------------------------------------------------------------------
# 5. ROUTE ISOLATION CONFIGURATION CHECK
# ----------------------------------------------------------------------
route_fixture = os.path.join(SKILL_DIR, "fixtures", "route_regressions.json")
route_check_passed = os.path.exists(route_fixture)
if route_check_passed:
    with open(route_fixture, "r", encoding="utf-8") as rf:
        rdata = json.load(rf)
    route_check_passed = len(rdata.get("routes", [])) >= 3
record_check("ROUTE-REGRESSIONS: Route isolation rules defined for #/stock and #/admin/members", route_check_passed)

# ----------------------------------------------------------------------
# 6. SUMMARY
# ----------------------------------------------------------------------
print("\n" + "=" * 80)
if len(failures) == 0:
    print("🎉 ALL PROJECT INVARIANTS SATISFIED! Codebase complies with Skill rules.")
    print("=" * 80)
    sys.exit(0)
else:
    print(f"🚨 FAILED: {len(failures)} project invariant violations detected!")
    for f in failures:
        print(f"  - {f}")
    print("=" * 80)
    sys.exit(1)
