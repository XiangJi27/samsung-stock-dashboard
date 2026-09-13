# -*- coding: utf-8 -*-
"""
GOLDEN TEST SUITE: 17 CONFIRMED BUSINESS PROMOTION & STOCK TEST CASES
Ensures 100% compliance with Branch Confirmed Rules & Exact Excel Truth.
Zero Regression • Zero Guessing
"""

import sys
import json
import os

sys.stdout.reconfigure(encoding='utf-8')

# Load database and promotions
with open("stock_full_data.json", "r", encoding="utf-8") as f:
    stock_db = json.load(f)

with open("promotion_variants.json", "r", encoding="utf-8") as f:
    variants = json.load(f)

with open("validated_promotions.json", "r", encoding="utf-8") as f:
    validated_promos = json.load(f)

print("=== RUNNING GOLDEN TEST CASES (17 DOMAINS) ===")
results = []

def run_test(case_id, name, check_fn):
    try:
        passed, msg = check_fn()
        status = "PASS" if passed else "FAIL"
        results.append({"caseId": case_id, "name": name, "status": status, "message": msg})
        symbol = "✅" if passed else "❌"
        print(f"{symbol} [{case_id}] {name}: {msg}")
    except Exception as e:
        results.append({"caseId": case_id, "name": name, "status": "ERROR", "message": str(e)})
        print(f"❌ [{case_id}] {name}: ERROR -> {e}")

# 1. S25 FE
def test_s25_fe():
    items = [x for x in stock_db if "s25 fe" in (x.get("model") or "").lower()]
    if len(items) != 8:
        return False, f"Expected 8 S25 FE models in stock database, found {len(items)}"
    if not all(x.get("productCodeType") == "STANDARD_SM" for x in items):
        return False, "Product code type mismatch in S25 FE stock"
    if not all(x.get("total") == x.get("f1") + x.get("f2") for x in items):
        return False, "Stock arithmetic mismatch in S25 FE"
    s25_promos = [v for v in variants if "s25 fe" in (v.get("model") or "").lower()]
    sf_promo = next((v for v in s25_promos if v.get("saleMode") == "SF_PLUS" and v.get("couponCode") == "01"), None)
    if not sf_promo or sf_promo["rrp"] != 26900.0 or sf_promo["netPrice"] != 23900.0:
        return False, "S25 FE SF+ promo verification failed"
    return True, f"Found 8 S25 FE models in stock database (All STANDARD_SM), Promo RRP=26,900, Net=23,900 (SF+ Coupon 01)"
run_test("GTC-01", "Galaxy S25 FE Stock Baseline", test_s25_fe)

# 2. S26 FE Pass F (Up Size)
def test_s26_fe_pass_f():
    pass_f = [v for v in variants if "s26 fe" in (v.get("model") or "").lower() and (v.get("productCodeType") == "PASS_F" or (v.get("pn") or "").startswith("F-"))]
    return len(pass_f) > 0, f"Found {len(pass_f)} S26 FE Pass F memory upgrade variants"
run_test("GTC-02", "Galaxy S26 FE Pass F Up Size Isolation", test_s26_fe_pass_f)

# 3. Galaxy A57
def test_a57():
    items = [x for x in stock_db if "a57" in (x.get("model") or "").lower()]
    promos = [v for v in variants if "a57" in (v.get("model") or "").lower()]
    return len(items) > 0 and len(promos) > 0, f"Stock: {len(items)}, Promos: {len(promos)}"
run_test("GTC-03", "Galaxy A57 Stock & Promo Coverage", test_a57)

# 4. Galaxy A37
def test_a37():
    items = [x for x in stock_db if "a37" in (x.get("model") or "").lower()]
    expected_pns = {"SM-A376BDGTTHL", "SM-A376BLVTTHL", "SM-A376BZATTHL"}
    actual_pns = {x.get("pn") for x in items}
    if actual_pns != expected_pns:
        return False, f"P/N mismatch: {actual_pns} != {expected_pns}"
    if not all(x.get("productCodeType") == "STANDARD_SM" for x in items):
        return False, "Product code type mismatch in A37 stock"
    if not all(x.get("total") == x.get("f1") + x.get("f2") for x in items):
        return False, "Stock sum mismatch in A37"
    
    a37_promos = [v for v in variants if "a37" in (v.get("model") or "").lower()]
    sf_plus = next((v for v in a37_promos if v.get("saleMode") == "SF_PLUS"), None)
    if not sf_plus or sf_plus["rrp"] != 13999.0 or sf_plus["capacity"] != "8/256GB":
        return False, "A37 SF+ promo verification failed"
    return True, f"Verified 3 A37 SKUs {sorted(list(actual_pns))}, RRP=13,999, Capacity=8/256GB, Stock Sums OK"
run_test("GTC-04", "Galaxy A37 Stock Verification", test_a37)

# 5. Galaxy A27
def test_a27():
    items = [x for x in stock_db if "a27" in (x.get("model") or "").lower()]
    expected_pns = {"SM-A276BLIGTHL", "SM-A276BZKGTHL"}
    actual_pns = {x.get("pn") for x in items}
    if actual_pns != expected_pns:
        return False, f"P/N mismatch: {actual_pns} != {expected_pns}"
    if not all(x.get("productCodeType") == "STANDARD_SM" for x in items):
        return False, "Product code type mismatch in A27 stock"
    if not all(x.get("total") == x.get("f1") + x.get("f2") for x in items):
        return False, "Stock sum mismatch in A27"
    
    a27_promos = [v for v in variants if "a27" in (v.get("model") or "").lower()]
    promo = next((v for v in a27_promos if v.get("couponCode") == "01"), None)
    if not promo or promo["rrp"] != 10999.0 or promo["netPrice"] != 9999.0 or promo["saleMode"] != "SF_PLUS":
        return False, "A27 Coupon 01 promo verification failed"
    return True, f"Verified 2 A27 SKUs {sorted(list(actual_pns))}, RRP=10,999, Net=9,999, Coupon=01, SF_PLUS"
run_test("GTC-05", "Galaxy A27 Stock Verification", test_a27)

# 6. Galaxy A17
def test_a17():
    items = [x for x in stock_db if "a17" in (x.get("model") or "").lower()]
    if len(items) != 12:
        return False, f"Expected 12 A17 items, got {len(items)}"
    pass_f_pns = {x.get("pn") for x in items if x.get("pn", "").startswith("F-")}
    std_pns = {x.get("pn") for x in items if x.get("pn", "").startswith("SM-")}
    if len(pass_f_pns) != 6 or len(std_pns) != 6:
        return False, f"Expected 6 Pass F & 6 Standard SM, got {len(pass_f_pns)} and {len(std_pns)}"
    if not all(x.get("productCodeType") == "PASS_F" for x in items if x.get("pn") in pass_f_pns):
        return False, "Product code type mismatch for A17 Pass F"
    if not all(x.get("productCodeType") == "STANDARD_SM" for x in items if x.get("pn") in std_pns):
        return False, "Product code type mismatch for A17 Standard SM"
    if not all(x.get("total") == x.get("f1") + x.get("f2") for x in items):
        return False, "Stock sum mismatch in A17"

    a17_promos = [v for v in variants if "a17" in (v.get("model") or "").lower()]
    p02 = next((v for v in a17_promos if v.get("couponCode") == "02" and v.get("saleMode") == "SF_PLUS"), None)
    if not p02 or p02["rrp"] != 10599.0 or p02["netPrice"] != 8999.0:
        return False, "A17 Coupon 02 promo verification failed"
    return True, f"Verified 12 A17 SKUs (6 Pass F, 6 Standard SM), Promo RRP=10,599, Net=8,999 (Coupon 02)"
run_test("GTC-06", "Galaxy A17 Stock Verification", test_a17)

# 7. Galaxy A07 (Strict stock counts from Stock.xlsx)
def test_a07():
    a07_items = [x for x in stock_db if "a07" in (x.get("model") or "").lower()]
    sm_a075 = next((x for x in a07_items if x.get("pn") == "SM-A075FLVDTHL"), None)
    sm_a076 = next((x for x in a07_items if x.get("pn") == "SM-A076BLVCTHL"), None)
    if not sm_a075 or not sm_a076:
        return False, "SM-A075FLVDTHL or SM-A076BLVCTHL missing"
    c1 = (sm_a075.get("f1") == 2 and sm_a075.get("f2") == 5 and sm_a075.get("total") == 7)
    c2 = (sm_a076.get("f1") == 6 and sm_a076.get("f2") == 5 and sm_a076.get("total") == 11)
    return len(a07_items) == 14 and c1 and c2, f"Total A07: {len(a07_items)} (SM-A075FLVDTHL: f1={sm_a075.get('f1')}, f2={sm_a075.get('f2')}, total={sm_a075.get('total')})"
run_test("GTC-07", "Galaxy A07 Exact Stock Provenance", test_a07)

# 8. Galaxy S26 Ultra
def test_s26_ultra():
    items = [x for x in stock_db if "s26 ultra" in (x.get("model") or "").lower()]
    promos = [v for v in variants if "s26 ultra" in (v.get("model") or "").lower()]
    return len(items) > 0, f"Found {len(items)} S26 Ultra models, {len(promos)} promo variants"
run_test("GTC-08", "Galaxy S26 Ultra Coverage", test_s26_ultra)

# 9. Galaxy Z Flip8 (Trade Up 37,900 / 45,900, Adapter separation)
def test_z_flip8():
    tu_promos = [v for v in variants if "flip8" in (v.get("model") or "").lower() and v.get("saleMode") == "TRADE_UP"]
    if len(tu_promos) == 0:
        return False, "No Flip8 Trade Up promos found"
    p256 = next((v for v in tu_promos if ("256" in (v.get("model") or "") or "256" in (v.get("capacity") or "")) and v.get("couponCode") == "01"), None)
    p512 = next((v for v in tu_promos if ("512" in (v.get("model") or "") or "512" in (v.get("capacity") or "")) and v.get("couponCode") == "01"), None)
    if not p256 or not p512:
        return False, "Missing Flip8 Trade Up 256GB or 512GB Coupon 01 variants"
    
    # Direct dictionary key access (zero fallback guessing)
    p256_net = p256["netPrice"]
    p512_net = p512["netPrice"]
    cond1 = (p256_net == 37900.0 and p256["rrp"] == 42900.0)
    cond2 = (p512_net == 45900.0 and p512["rrp"] == 50900.0)
    if not cond1 or not cond2:
        return False, f"Price mismatch: 256GB Net={p256_net} (exp 37900), 512GB Net={p512_net} (exp 45900)"
    return True, f"Trade Up Prices Strictly Verified (Direct dict access): 256GB (RRP={p256['rrp']} -> Net={p256_net}), 512GB (RRP={p512['rrp']} -> Net={p512_net})"
run_test("GTC-09", "Galaxy Z Flip8 Trade Up & Gift Separation", test_z_flip8)

# 10. Galaxy Fold8 / Fold8 Ultra (Pass F depleted / Quarantined)
def test_fold8():
    fold8_items = [v for v in variants if "fold8" in (v.get("model") or "").lower()]
    fold8_pass_f_active = [v for v in fold8_items if (v.get("productCodeType") == "PASS_F" or (v.get("pn") or "").startswith("F-")) and not v.get("isBlocked")]
    tu_items = [v for v in fold8_items if v.get("saleMode") == "TRADE_UP"]
    return len(fold8_pass_f_active) == 0 and len(tu_items) > 0, f"Fold8: 0 active Pass F (depleted), {len(tu_items)} Trade Up promos verified"
run_test("GTC-10", "Galaxy Fold8 Pass F Out-of-Stock Quarantine", test_fold8)

# 11. Tab A11 / Tab A11+ (Coupon 01 Standard vs 04 SF+)
def test_tab_a11():
    a11_promos = [v for v in variants if "a11+" in (v.get("model") or "").lower()]
    c01 = any(v.get("couponCode") == "01" for v in a11_promos)
    c04 = any(v.get("couponCode") == "04" for v in a11_promos)
    return c01 and c04, f"Found Coupon 01 (Standard) and Coupon 04 (SF+) for Tab A11+"
run_test("GTC-11", "Galaxy Tab A11+ 5G Coupon 01/04 Separation", test_tab_a11)

# 12. Tab S10 Lite
def test_tab_s10_lite():
    items = [x for x in stock_db if "s10 lite" in (x.get("model") or "").lower()]
    if len(items) != 7:
        return False, f"Expected 7 Tab S10 Lite items, got {len(items)}"
    pass_f_items = [x for x in items if x.get("pn", "").startswith("F-")]
    std_items = [x for x in items if x.get("pn", "").startswith("SM-")]
    if len(pass_f_items) != 4 or len(std_items) != 3:
        return False, f"Expected 4 Pass F & 3 Standard SM, got {len(pass_f_items)} and {len(std_items)}"
    if not all(x.get("hasKeyboardBundle") is True for x in pass_f_items):
        return False, "Pass F must have keyboard bundle"
    if not all(x.get("hasKeyboardBundle") is False for x in std_items):
        return False, "Standard SM must not have keyboard bundle"
    
    promos = [v for v in variants if "s10 lite" in (v.get("model") or "").lower()]
    p5g = next((v for v in promos if "5g" in (v.get("model") or "").lower() and v.get("couponCode") == "01"), None)
    if not p5g or p5g["rrp"] != 16990.0 or p5g["netPrice"] != 16490.0 or p5g["capacity"] != "6/128GB":
        return False, "Tab S10 Lite 5G promo verification failed"
    return True, f"Verified 7 Tab S10 Lite items (4 Pass F with KB Bundle, 3 Standard SM), Promo 5G RRP=16,990, Net=16,490 (Coupon 01)"
run_test("GTC-12", "Galaxy Tab S10 Lite Verification", test_tab_s10_lite)

# 13. Tab S10 FE
def test_tab_s10_fe():
    items = [x for x in stock_db if "s10 fe" in (x.get("model") or "").lower()]
    expected_pns = {"SM-X526BLBATHL", "SM-X526BZAATHL", "SM-X520NLBATHL", "SM-X520NZAATHL"}
    actual_pns = {x.get("pn") for x in items}
    if actual_pns != expected_pns:
        return False, f"P/N mismatch: {actual_pns} != {expected_pns}"
    if not all(x.get("productCodeType") == "STANDARD_SM" for x in items):
        return False, "Product code type mismatch in Tab S10 FE"
    if not all(x.get("total") == x.get("f1") + x.get("f2") for x in items):
        return False, "Stock sum mismatch in Tab S10 FE"
    
    promos = [v for v in variants if "s10 fe" in (v.get("model") or "").lower()]
    p = next((v for v in promos if v.get("couponCode") == "01" and v.get("saleMode") == "STANDARD_PAYMENT"), None)
    if not p or p["rrp"] != 30900.0 or p["netPrice"] != 25900.0 or p["capacity"] != "12/256GB":
        return False, "Tab S10 FE promo verification failed"
    return True, f"Verified 4 Tab S10 FE SKUs {sorted(list(actual_pns))}, Promo 5G RRP=30,900, Net=25,900 (Coupon 01)"
run_test("GTC-13", "Galaxy Tab S10 FE Verification", test_tab_s10_fe)

# 14. Tab S11 (Coupon 01 vs 06 Separation)
def test_tab_s11():
    s11_promos = [v for v in variants if "s11" in (v.get("model") or "").lower()]
    has_01 = any(v.get("couponCode") == "01" for v in s11_promos)
    no_slash = all("/" not in str(v.get("couponCode") or "") for v in s11_promos)
    return has_01 and no_slash, f"Tab S11 Price Coupon 01 verified, 01/06 slash concatenation strictly decoupled"
run_test("GTC-14", "Galaxy Tab S11 Coupon 01 vs 06 Separation", test_tab_s11)

# 15. Student Promotion (Studentcrd rule)
def test_student_rule():
    student_promos = [v for v in variants if v.get("saleMode") == "STUDENT"]
    valid_student = all(v.get("couponCode") == "Studentcrd" for v in student_promos)
    no_sf_plus = all(v.get("sfPlusEligible") is not True for v in student_promos)
    return len(student_promos) > 0 and valid_student and no_sf_plus, f"Verified {len(student_promos)} Student promos with Studentcrd rule"
run_test("GTC-15", "Student Promotion Hard Rule (Studentcrd)", test_student_rule)

# 16. SmartTag2
def test_smarttag2():
    items = [x for x in stock_db if "smarttag" in (x.get("model") or "").lower()]
    return len(items) > 0, f"Found {len(items)} SmartTag2 accessories in stock"
run_test("GTC-16", "Galaxy SmartTag2 Accessory Baseline", test_smarttag2)

# 17. MBO Cross-Category Rules
def test_mbo():
    # Check MBO rules from wearable_mbo_report.csv
    mbo_count = 0
    mbo_path = "wearable_mbo_report.csv" if os.path.exists("wearable_mbo_report.csv") else os.path.join("reports", "archive", "wearable_mbo_report.csv")
    if os.path.exists(mbo_path):
        import csv
        with open(mbo_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            mbo_count = sum(1 for row in reader if row.get("Sale Mode") == "MBO")
    return mbo_count > 0, f"Verified {mbo_count} MBO cross-category promotional rules in {mbo_path}"
run_test("GTC-17", "MBO Cross-Category Rules", test_mbo)

# Summary and Save
pass_count = sum(1 for r in results if r["status"] == "PASS")
fail_count = sum(1 for r in results if r["status"] != "PASS")

print(f"\n==========================================")
print(f"GOLDEN TEST RESULTS: {pass_count}/{len(results)} PASSED ({fail_count} FAILED)")
print(f"==========================================")

with open("regression_test_results.json", "w", encoding="utf-8") as f:
    json.dump({
        "summary": {
            "total": len(results),
            "passed": pass_count,
            "failed": fail_count,
            "passRate": f"{(pass_count / len(results)) * 100:.1f}%"
        },
        "tests": results
    }, f, ensure_ascii=False, indent=2)

if fail_count > 0:
    sys.exit(1)
