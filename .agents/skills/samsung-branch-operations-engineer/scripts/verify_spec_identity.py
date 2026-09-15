#!/usr/bin/env python3
"""
Product Spec Identity & Field-Level Verification Verifier
Tests product_specs_data.js against permanent identity and field-level invariants:
1. Strict Brand/Product-Type Match (Soundcore A31X1 -> PARTIALLY_VERIFIED)
2. Field-level verification: unverified Bluetooth 5.4 and 18-month warranty suppressed
3. Anti-leakage: No Galaxy A07 / Helio / Knox attributes in non-Samsung accessories
4. Negative Cross-Brand Match blocked
5. Negative Cross-Type Match blocked
6. Unknown item fails closed (null / SPEC_NOT_VERIFIED)
"""

import os
import sys
import json
import subprocess

sys.stdout.reconfigure(encoding="utf-8")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(SCRIPT_DIR)
WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(SKILL_DIR)))
SPEC_JS = os.path.join(WORKSPACE_ROOT, "product_specs_data.js")

def main():
    print("================================================================================")
    print("SAMSUNG BRANCH OPERATIONS - PRODUCT SPEC IDENTITY VERIFIER")
    print("================================================================================\n")
    
    if not os.path.exists(SPEC_JS):
        print(f"❌ Error: product_specs_data.js not found at {SPEC_JS}")
        sys.exit(1)
        
    node_eval_script = """
    const fs = require('fs');
    const code = fs.readFileSync('product_specs_data.js', 'utf8');
    const sandbox = { window: {}, console: { log: console.log, warn: () => {}, error: () => {} } };
    eval(code.replace(/window\\./g, 'sandbox.window.'));
    const fn = sandbox.window.resolveProductSpecs;

    const errors = [];
    const passes = [];

    // 1. Soundcore Select 4 Go Test
    const sc = fn({ pn: '194644055783', model: 'Soundcore Select 4 Go Black', brand: 'SOUNDCORE', category: 'Other' });
    if (!sc) {
        errors.push('Soundcore Select 4 Go failed to resolve');
    } else {
        if (sc.verificationStatus !== 'PARTIALLY_VERIFIED') {
            errors.push('Status is ' + sc.verificationStatus + ', expected PARTIALLY_VERIFIED');
        } else {
            passes.push('Soundcore status is PARTIALLY_VERIFIED');
        }
        if (sc.productType !== 'BLUETOOTH_SPEAKER') {
            errors.push('Product type is ' + sc.productType + ', expected BLUETOOTH_SPEAKER');
        } else {
            passes.push('Soundcore productType is BLUETOOTH_SPEAKER');
        }
        if (sc.manufacturerModel !== 'A31X1') {
            errors.push('Manufacturer model is ' + sc.manufacturerModel + ', expected A31X1');
        } else {
            passes.push('Soundcore manufacturerModel is A31X1');
        }
        
        const rawJson = JSON.stringify(sc);
        if (rawJson.includes('Galaxy A07') || rawJson.includes('Helio G85') || rawJson.includes('Knox')) {
            errors.push('CRITICAL: Leakage of Galaxy A07, Helio G85, or Knox found in Soundcore record!');
        } else {
            passes.push('Zero leakage of Galaxy A07 / Helio / Knox in Soundcore');
        }
        
        if (sc.speakerSpecs && sc.speakerSpecs.bluetoothVersion && sc.speakerSpecs.bluetoothVersion.includes('5.4')) {
            errors.push('Unverified claim Bluetooth 5.4 found in speakerSpecs');
        } else {
            passes.push('Unverified claim Bluetooth 5.4 suppressed');
        }
        
        if (sc.marketRegion && sc.marketRegion.includes('18 เดือน')) {
            errors.push('Unverified claim 18-month warranty found in marketRegion');
        } else {
            passes.push('Unverified claim 18-month warranty suppressed');
        }
    }

    // 2. Negative Cross-Brand Guard
    const fakeBrand = fn({ pn: 'SM-S928BZTQTHL', model: 'Galaxy S26 Ultra Fake', brand: 'SOUNDCORE', category: 'SmartPhone' });
    if (fakeBrand !== null) {
        errors.push('Cross-brand match was not blocked (Soundcore brand matched to phone)');
    } else {
        passes.push('Negative cross-brand guard blocked invalid match');
    }

    // 3. Negative Cross-Type Guard
    const fakeType = fn({ pn: '194644055783', model: 'Soundcore Select 4 Go Black', brand: 'SOUNDCORE', category: 'SmartPhone' });
    if (fakeType !== null) {
        errors.push('Cross-type match was not blocked (Speaker matched to Smartphone category)');
    } else {
        passes.push('Negative cross-type guard blocked invalid match');
    }

    // 4. Fail-Closed on Unknown Item
    const unk = fn({ pn: 'UNKNOWN-RANDOM-999', model: 'Mystery Third Party Dongle', brand: 'GENERIC', category: 'Other' });
    if (unk !== null) {
        errors.push('Unknown item failed to return null / fail-closed');
    } else {
        passes.push('Unknown item correctly returned null (fail-closed)');
    }

    console.log(JSON.stringify({ errors, passes }));
    """
    
    try:
        res = subprocess.check_output(['node', '-e', node_eval_script], cwd=WORKSPACE_ROOT, stderr=subprocess.STDOUT).decode('utf-8').strip()
        lines = [l for l in res.splitlines() if l.strip().startswith('{')]
        result = json.loads(lines[-1]) if lines else {"errors": ["No JSON output returned"], "passes": []}
        
        for p in result.get("passes", []):
            print(f"✅ [PASS] {p}")
            
        errs = result.get("errors", [])
        if errs:
            for e in errs:
                print(f"❌ [FAIL] {e}")
            print("\n" + "=" * 80)
            print("🚨 SPEC IDENTITY VERIFICATION FAILED")
            print("=" * 80)
            sys.exit(1)
        else:
            print("\n" + "=" * 80)
            print("🎉 ALL SPEC IDENTITY & FIELD-LEVEL VERIFICATION CHECKS PASSED")
            print("=" * 80)
            sys.exit(0)
    except subprocess.CalledProcessError as e:
        print(f"❌ Execution error: {e.output.decode('utf-8', errors='ignore')}")
        sys.exit(1)

if __name__ == "__main__":
    main()
