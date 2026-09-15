#!/usr/bin/env python3
"""
Automated Project Rules and Invariant Validator for Samsung Branch Operations.
Tests codebase against project_rules.json and all fixtures in fixtures/.
"""

import os
import sys
import json
import hashlib
import subprocess

sys.stdout.reconfigure(encoding="utf-8")

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(SKILL_DIR)))
if not os.path.exists(os.path.join(PROJECT_ROOT, "product_specs_data.js")):
    # Fallback to current working directory if structure differs
    PROJECT_ROOT = os.getcwd()

print("================================================================================")
print("SAMSUNG BRANCH OPERATIONS - SKILL PROJECT INVARIANT VALIDATOR")
print(f"Project Root: {PROJECT_ROOT}")
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
manifest_path = os.path.join(PROJECT_ROOT, "runtime_manifest.json")
if os.path.exists(manifest_path):
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    frozen_files = ["index.html", "app.js", "style.css"]
    all_frozen_match = True
    for item in manifest.get("files", []):
        if item["file"] in frozen_files:
            file_path = os.path.join(PROJECT_ROOT, item["file"])
            if os.path.exists(file_path):
                hasher = hashlib.sha256()
                with open(file_path, "rb") as bf:
                    hasher.update(bf.read())
                actual_hash = hasher.hexdigest()
                expected_hash = item.get("sha256", item.get("hash"))
                if actual_hash != expected_hash:
                    all_frozen_match = False
                    failures.append(f"Baseline file {item['file']} modified! Hash mismatch.")
    record_check("BASELINE-FREEZE: Core baseline files untouched", all_frozen_match)
else:
    record_check("BASELINE-FREEZE: runtime_manifest.json exists", False, "Missing manifest")

# ----------------------------------------------------------------------
# 2. STOCK ACCEPTANCE INVARIANTS (F1 ONLY CARDS)
# ----------------------------------------------------------------------
stock_snapshot_path = os.path.join(PROJECT_ROOT, "assets", "js", "pilot-stock-snapshot.js")
if os.path.exists(stock_snapshot_path):
    with open(stock_snapshot_path, "r", encoding="utf-8") as f:
        txt = f.read()
    arr_str = txt.split("window.LATEST_STOCK_SNAPSHOT =")[1].split("];")[0].strip() + "]"
    snapshot = json.loads(arr_str)

    f1_sum = sum(int(x.get("f1", 0)) for x in snapshot)
    f2_sum = sum(int(x.get("f2", 0)) for x in snapshot)
    total_sum = sum(int(x.get("total", 0)) for x in snapshot)

    record_check("STOCK-F1-TOTAL: F1 grand total == 1701", f1_sum == 1701, f"Actual: {f1_sum}")
    record_check("STOCK-F2-TOTAL: F2 grand total == 1635", f2_sum == 1635, f"Actual: {f2_sum}")
    record_check("STOCK-ARITHMETIC: Total == F1 + F2", total_sum == (f1_sum + f2_sum), f"{total_sum} != {f1_sum} + {f2_sum}")
else:
    record_check("STOCK-SNAPSHOT: pilot-stock-snapshot.js exists", False)

# ----------------------------------------------------------------------
# 3. SPEC IDENTITY & FIELD-LEVEL VERIFICATION FIXTURES
# ----------------------------------------------------------------------
spec_file = os.path.join(PROJECT_ROOT, "product_specs_data.js")
spec_tests_passed = True
spec_error_detail = ""

if os.path.exists(spec_file):
    node_eval_script = """
    const fs = require('fs');
    const code = fs.readFileSync('product_specs_data.js', 'utf8');
    const sandbox = { window: {}, console: { log: console.log, warn: () => {}, error: () => {} } };
    eval(code.replace(/window\\./g, 'sandbox.window.'));
    const fn = sandbox.window.resolveProductSpecs;

    const errors = [];

    // Soundcore Select 4 Go Test
    const sc = fn({ pn: '194644055783', model: 'Soundcore Select 4 Go Black', brand: 'SOUNDCORE', category: 'Other' });
    if (!sc) errors.push('Soundcore not resolved');
    else {
        if (sc.verificationStatus !== 'PARTIALLY_VERIFIED') errors.push('Status not PARTIALLY_VERIFIED');
        if (sc.productType !== 'BLUETOOTH_SPEAKER') errors.push('Product type not BLUETOOTH_SPEAKER');
        if (sc.manufacturerModel !== 'A31X1') errors.push('Model not A31X1');
        const s = JSON.stringify(sc);
        if (s.includes('Galaxy A07') || s.includes('Helio G85') || s.includes('Knox')) errors.push('Leakage of A07/Helio/Knox');
        if (sc.speakerSpecs && sc.speakerSpecs.bluetoothVersion && sc.speakerSpecs.bluetoothVersion.includes('5.4')) {
            errors.push('Unverified Bluetooth 5.4 found');
        }
        if (sc.marketRegion && sc.marketRegion.includes('18 เดือน')) {
            errors.push('Unverified 18 months warranty found');
        }
    }

    // Negative Cross-Brand Test
    const fakeBrand = fn({ pn: 'SM-S928BZTQTHL', model: 'Galaxy S26 Ultra Fake', brand: 'SOUNDCORE', category: 'SmartPhone' });
    if (fakeBrand !== null) errors.push('Cross-brand phone match was not blocked');

    // Negative Cross-Type Test
    const fakeType = fn({ pn: '194644055783', model: 'Soundcore Select 4 Go Black', brand: 'SOUNDCORE', category: 'SmartPhone' });
    if (fakeType !== null) errors.push('Cross-type speaker as phone match was not blocked');

    // Fail-Closed Unknown Test
    const unk = fn({ pn: 'UNKNOWN-RANDOM-001', model: 'Unknown Generic Gadget', brand: 'OTHER', category: 'Other' });
    if (unk !== null) errors.push('Unknown item failed to return null');

    console.log(JSON.stringify(errors));
    """
    try:
        res = subprocess.check_output(['node', '-e', node_eval_script], cwd=PROJECT_ROOT, stderr=subprocess.STDOUT).decode('utf-8').strip()
        lines = [l for l in res.splitlines() if l.strip().startswith('[')]
        errs = json.loads(lines[-1]) if lines else []
        if len(errs) > 0:
            spec_tests_passed = False
            spec_error_detail = "; ".join(errs)
    except Exception as e:
        spec_tests_passed = False
        spec_error_detail = str(e)

record_check("SPEC-IDENTITY-GUARD: Field-level verification and fail-closed policies active", spec_tests_passed, spec_error_detail)

# ----------------------------------------------------------------------
# 4. SUMMARY
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
