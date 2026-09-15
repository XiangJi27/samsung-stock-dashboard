#!/usr/bin/env python3
"""
Stock Reconciliation Verifier
Validates live stock snapshot against hash-bound fixture:
- Verifies source file hash
- Checks F1 total and category counts against fixture expectations
- Enforces terminology distinction: SIM (58 ชิ้น, 11 รายการ P/N) and Other (15 ชิ้น, 9 รายการ P/N)
- Checks F1+F2 row arithmetic
"""

import os
import sys
import json
import hashlib

sys.stdout.reconfigure(encoding="utf-8")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(SCRIPT_DIR)
WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(SKILL_DIR)))
FIXTURE_PATH = os.path.join(SKILL_DIR, "fixtures", "stock_snapshot_acceptance.json")
SNAPSHOT_JS = os.path.join(WORKSPACE_ROOT, "assets", "js", "pilot-stock-snapshot.js")
EXCEL_PATH = os.path.join(WORKSPACE_ROOT, "stock(1).xlsx")

def compute_sha256(filepath):
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def main():
    print("================================================================================")
    print("SAMSUNG BRANCH OPERATIONS - STOCK RECONCILIATION VERIFIER")
    print("================================================================================\n")
    
    if not os.path.exists(FIXTURE_PATH):
        print(f"❌ Error: Fixture not found at {FIXTURE_PATH}")
        sys.exit(1)
        
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        fixture = json.load(f)
        
    expected = fixture.get("expected", {})
    source_filename = fixture.get("sourceFilename", "stock(1).xlsx")
    expected_hash = fixture.get("sourceSha256", "")
    
    # 1. Source Excel Hash Check
    target_excel = os.path.join(WORKSPACE_ROOT, source_filename)
    if os.path.exists(target_excel):
        actual_hash = compute_sha256(target_excel)
        if actual_hash == expected_hash:
            print(f"✅ [PASS] Source Excel hash matches fixture ({source_filename})")
        else:
            print(f"❌ [FAIL] Source Excel hash mismatch: {actual_hash} != {expected_hash}")
            sys.exit(1)
    else:
        print(f"⚠️ [WARN] Source Excel file not present in root: {target_excel}")

    # 2. Pilot Stock Snapshot Checks
    if not os.path.exists(SNAPSHOT_JS):
        print(f"❌ [FAIL] Snapshot JS file not found: {SNAPSHOT_JS}")
        sys.exit(1)
        
    with open(SNAPSHOT_JS, "r", encoding="utf-8") as f:
        content = f.read()
        
    arr_str = content.split("window.LATEST_STOCK_SNAPSHOT =")[1].split("];")[0].strip() + "]"
    items = json.loads(arr_str)
    
    f1_sum = sum(int(x.get("f1", 0)) for x in items)
    f2_sum = sum(int(x.get("f2", 0)) for x in items)
    grand_sum = sum(int(x.get("total", 0)) for x in items)
    
    # Category aggregation
    cat_counts = {}
    cat_pns = {}
    row_errors = 0
    
    for it in items:
        cat = it.get("category") or it.get("canonicalCategory") or "Other"
        qty = int(it.get("f1", 0))
        f2 = int(it.get("f2", 0))
        tot = int(it.get("total", 0))
        pn = it.get("pn", "")
        
        cat_counts[cat] = cat_counts.get(cat, 0) + qty
        if qty > 0:
            cat_pns.setdefault(cat, set()).add(pn)
        
        if tot != (qty + f2):
            row_errors += 1

    # Assertions
    passed = True
    
    if f1_sum == expected.get("f1Total"):
        print(f"✅ [PASS] Total F1 Inventory = {f1_sum} (Matches fixture expectation)")
    else:
        print(f"❌ [FAIL] Total F1 Inventory: {f1_sum} != {expected.get('f1Total')}")
        passed = False
        
    categories_to_check = [
        ("SmartPhone", "smartphone"),
        ("Tablet", "tablet"),
        ("Watch", "watch"),
        ("Buds", "buds"),
        ("Accessory", "accessory"),
        ("Premium", "premium")
    ]
    
    for cat_key, fixture_key in categories_to_check:
        actual = cat_counts.get(cat_key, 0)
        exp = expected.get(fixture_key, 0)
        if actual == exp:
            print(f"✅ [PASS] Category {cat_key:12} = {actual:4} (Expected: {exp})")
        else:
            print(f"❌ [FAIL] Category {cat_key:12} = {actual:4} (Expected: {exp})")
            passed = False
            
    # Check SIM and Other breakdown
    sim_qty = cat_counts.get("SIM", 0)
    sim_pns = len(cat_pns.get("SIM", set()))
    if sim_qty == 58 and sim_pns == 11:
        print(f"✅ [PASS] SIM Breakdown: {sim_qty} ชิ้น (Units) across {sim_pns} รายการ (P/Ns)")
    else:
        print(f"❌ [FAIL] SIM Breakdown: {sim_qty} ชิ้น / {sim_pns} รายการ (Expected 58 ชิ้น / 11 รายการ)")
        passed = False
        
    other_qty = cat_counts.get("Other", 0)
    other_pns = len(cat_pns.get("Other", set()))
    if other_qty == 15 and other_pns == 9:
        print(f"✅ [PASS] Other Breakdown: {other_qty} ชิ้น (Units) across {other_pns} รายการ (P/Ns)")
    else:
        print(f"❌ [FAIL] Other Breakdown: {other_qty} ชิ้น / {other_pns} รายการ (Expected 15 ชิ้น / 9 รายการ)")
        passed = False
        
    # Row arithmetic check
    if row_errors == 0:
        print(f"✅ [PASS] Product Table Arithmetic: All {len(items)} rows satisfy Total == F1 + F2")
    else:
        print(f"❌ [FAIL] Product Table Arithmetic: {row_errors} rows failed Total == F1 + F2")
        passed = False

    print("\n" + "=" * 80)
    if passed:
        print("🎉 ALL STOCK RECONCILIATION CHECKS PASSED")
        print("=" * 80)
        sys.exit(0)
    else:
        print("🚨 STOCK RECONCILIATION FAILED")
        print("=" * 80)
        sys.exit(1)

if __name__ == "__main__":
    main()
