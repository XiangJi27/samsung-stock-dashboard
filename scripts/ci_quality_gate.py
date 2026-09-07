# -*- coding: utf-8 -*-
"""
CI/CD Quality Gate & Data Governance Validator
Samsung Branch Operations System - Automated Deployment Blocker

Enforces 8 Critical Blocking Rules:
1. Formula Error: No '#ERROR!', NaN, or unparsed formulas in price/discount fields of active records.
2. Price Equation: Standard net price must equal RRP - Standard Discount for all active promotions.
3. Student Rule: Student promotions must strictly use coupon 'Studentcrd' and cannot combine with SF+ or Trade Up.
4. Pass F Isolation: Pass F / Memory upgrade variants must not leak into standard SM- retail items.
5. Trade Up Isolation: Trade Up pricing must not be miscategorized as Standard retail payment.
6. Stock Arithmetic: Total stock must strictly equal f1 + f2 across all items.
7. Exact P/N & A07 Golden Truth: A07 8 verified Golden Cases must match Stock.xlsx ground truth.
8. Secret Leak: Zero passwords, API keys, or enterprise tokens in code repository.
"""

import sys
import json
import os
import re

sys.stdout.reconfigure(encoding='utf-8')

print("=" * 70)
print("SAMSUNG BRANCH OPERATIONS - CI/CD QUALITY GATE VALIDATION")
print("=" * 70)

violations = []
warnings = []
passed_checks = []

def record_violation(rule_code, message, details=None):
    violations.append({
        "rule": rule_code,
        "message": message,
        "details": details or {}
    })
    print(f"❌ [BLOCK] {rule_code}: {message}")

def record_pass(check_name, message):
    passed_checks.append({"check": check_name, "message": message})
    print(f"✅ [PASS] {check_name}: {message}")

def record_warning(rule_code, message):
    warnings.append({"rule": rule_code, "message": message})
    print(f"⚠️  [WARN] {rule_code}: {message}")

# ----------------------------------------------------------------------
# 1. FILE EXISTENCE & JSON INTEGRITY
# ----------------------------------------------------------------------
stock_file = "stock_full_data.json"
variants_file = "promotion_variants.json"

if not os.path.exists(stock_file):
    record_violation("FILE-01", f"Missing critical stock database file: {stock_file}")
    sys.exit(1)

if not os.path.exists(variants_file):
    record_violation("FILE-02", f"Missing critical promotion variants file: {variants_file}")
    sys.exit(1)

with open(stock_file, "r", encoding="utf-8") as f:
    try:
        stock_db = json.load(f)
        record_pass("FILE-INTEGRITY", f"Loaded {len(stock_db)} items from {stock_file}")
    except Exception as e:
        record_violation("JSON-SYNTAX", f"Corrupted JSON in {stock_file}: {e}")
        sys.exit(1)

with open(variants_file, "r", encoding="utf-8") as f:
    try:
        variants = json.load(f)
        record_pass("FILE-INTEGRITY", f"Loaded {len(variants)} promotion variants from {variants_file}")
    except Exception as e:
        record_violation("JSON-SYNTAX", f"Corrupted JSON in {variants_file}: {e}")
        sys.exit(1)

active_variants = [v for v in variants if v.get("isActive") is not False and v.get("validationStatus") != "BLOCKED_INVALID"]
quarantined_count = len(variants) - len(active_variants)
record_pass("QUARANTINE-AUDIT", f"Verified {len(active_variants)} active promotions and {quarantined_count} quarantined items")

# ----------------------------------------------------------------------
# 2. RULE 1: FORMULA ERROR & NUMERIC SANITY
# ----------------------------------------------------------------------
formula_error_count = 0
for v in active_variants:
    pn = v.get("pn") or v.get("model") or "UNKNOWN"
    for field in ["rrp", "netPrice", "discount", "standardDiscount", "discountValue"]:
        val = str(v.get(field, ""))
        if "#ERROR!" in val or "#REF!" in val or "#VALUE!" in val or "NaN" in val:
            formula_error_count += 1
            record_violation("RULE-01-FORMULA-ERROR", f"Formula error in {field} for {pn}: {val}")

if formula_error_count == 0:
    record_pass("RULE-01-FORMULA-ERROR", "Zero formula errors (#ERROR!, #REF!, NaN) detected across active promotions")

# ----------------------------------------------------------------------
# 3. RULE 2: PRICE EQUATION CONSISTENCY (STANDARD PAYMENT)
# ----------------------------------------------------------------------
equation_mismatch_count = 0
for v in active_variants:
    sale_mode = v.get("saleMode")
    if sale_mode == "STANDARD_PAYMENT":
        rrp = v.get("rrp")
        disc = v.get("discountValue") if v.get("discountValue") is not None else (v.get("standardDiscount") or v.get("discount") or 0)
        net = v.get("netPrice")
        if rrp is not None and net is not None and disc is not None:
            expected_net = rrp - disc
            if abs(net - expected_net) > 1.0:
                equation_mismatch_count += 1
                record_violation("RULE-02-PRICE-EQUATION", 
                    f"Price mismatch for {v.get('pn') or v.get('model')}: RRP({rrp}) - Discount({disc}) = {expected_net}, but netPrice is {net}")

if equation_mismatch_count == 0:
    record_pass("RULE-02-PRICE-EQUATION", "All active standard payment promotions satisfy arithmetic equation (Net = RRP - Discount)")

# ----------------------------------------------------------------------
# 4. RULE 3: STUDENT PROMOTION STRICT VALIDATION (Studentcrd)
# ----------------------------------------------------------------------
student_violations = 0
student_count = 0
for v in active_variants:
    if v.get("saleMode") == "STUDENT":
        student_count += 1
        coupon = v.get("couponCode") or v.get("studentCoupon")
        if coupon != "Studentcrd":
            student_violations += 1
            record_violation("RULE-03-STUDENT-RULE", f"Student promotion for {v.get('pn') or v.get('model')} has invalid coupon: '{coupon}' (MUST be 'Studentcrd')")
        if v.get("sfPlusEligible") is True:
            student_violations += 1
            record_violation("RULE-03-STUDENT-RULE", f"Student promotion for {v.get('pn') or v.get('model')} erroneously marked sfPlusEligible=true")
        if v.get("tradeUpEligible") is True:
            student_violations += 1
            record_violation("RULE-03-STUDENT-RULE", f"Student promotion for {v.get('pn') or v.get('model')} erroneously marked tradeUpEligible=true")

if student_violations == 0 and student_count > 0:
    record_pass("RULE-03-STUDENT-RULE", f"Verified {student_count} Student promotions: 100% enforce 'Studentcrd' and zero prohibited combinations")

# ----------------------------------------------------------------------
# 5. RULE 4: PASS F (UP SIZE) ISOLATION
# ----------------------------------------------------------------------
pass_f_leaks = 0
for v in active_variants:
    pn = v.get("pn") or ""
    code_type = v.get("productCodeType", "")
    if pn.startswith("SM-") and code_type == "PASS_F":
        pass_f_leaks += 1
        record_violation("RULE-04-PASS-F-ISOLATION", f"Pass F code type leaked into retail P/N: {pn}")
    if pn.startswith("F-") and code_type != "PASS_F" and code_type != "BOM_SET":
        pass_f_leaks += 1
        record_violation("RULE-04-PASS-F-ISOLATION", f"Pass F P/N {pn} misclassified as: {code_type}")

if pass_f_leaks == 0:
    record_pass("RULE-04-PASS-F-ISOLATION", "Pass F (F- / Memory Upgrade) variants strictly decoupled from standard retail (SM-)")

# ----------------------------------------------------------------------
# 6. RULE 5: TRADE UP ISOLATION
# ----------------------------------------------------------------------
trade_up_leaks = 0
for v in active_variants:
    if v.get("saleMode") == "STANDARD_PAYMENT" and "trade up" in (v.get("title") or "").lower():
        trade_up_leaks += 1
        record_violation("RULE-05-TRADE-UP-ISOLATION", f"Trade Up title present in STANDARD_PAYMENT mode for {v.get('pn') or v.get('model')}")

if trade_up_leaks == 0:
    record_pass("RULE-05-TRADE-UP-ISOLATION", "Trade Up promotions strictly categorized under TRADE_UP mode")

# ----------------------------------------------------------------------
# 7. RULE 6: STOCK ARITHMETIC INTEGRITY (Total = f1 + f2)
# ----------------------------------------------------------------------
stock_sum_errors = 0
for item in stock_db:
    f1 = item.get("f1", 0) or 0
    f2 = item.get("f2", 0) or 0
    total = item.get("total", 0) or 0
    if total != (f1 + f2):
        stock_sum_errors += 1
        record_violation("RULE-06-STOCK-SUM", f"Stock sum error for {item.get('pn')}: f1({f1}) + f2({f2}) = {f1+f2} != total({total})")

if stock_sum_errors == 0:
    record_pass("RULE-06-STOCK-SUM", f"All {len(stock_db)} inventory records satisfy stock equation (Total = f1 + f2)")

# ----------------------------------------------------------------------
# 8. RULE 7: GALAXY A07 8 GOLDEN CASES GROUND TRUTH
# ----------------------------------------------------------------------
a07_expected = {
    "SM-A075FLVDTHL": {"f1": 2, "f2": 5, "total": 7, "rrp": 4599.0},
    "SM-A075FZKDTHL": {"f1": 0, "f2": 0, "total": 0, "rrp": 4599.0},
    "SM-A075FLVGTHL": {"f1": 0, "f2": 1, "total": 1, "rrp": 5299.0},
    "SM-A075FZKGTHL": {"f1": 0, "f2": 12, "total": 12, "rrp": 5299.0},
    "SM-A075FLVHTHL": {"f1": 4, "f2": 3, "total": 7, "rrp": 5999.0},
    "SM-A075FZKHTHL": {"f1": 5, "f2": 2, "total": 7, "rrp": 5999.0},
    "SM-A076BLVCTHL": {"f1": 6, "f2": 5, "total": 11, "rrp": 6999.0},
    "SM-A076BZKCTHL": {"f1": 5, "f2": 7, "total": 12, "rrp": 6999.0}
}

a07_mismatches = 0
for pn, exp in a07_expected.items():
    match = next((x for x in stock_db if x.get("pn") == pn), None)
    if not match:
        a07_mismatches += 1
        record_violation("RULE-07-A07-GOLDEN", f"A07 Golden Case P/N missing from stock database: {pn}")
        continue
    f1 = match.get("f1", 0) or 0
    f2 = match.get("f2", 0) or 0
    total = match.get("total", 0) or 0
    rrp = match.get("rrp")
    if f1 != exp["f1"] or f2 != exp["f2"] or total != exp["total"]:
        a07_mismatches += 1
        record_violation("RULE-07-A07-GOLDEN", f"Stock count mismatch for {pn}: expected ({exp['f1']}/{exp['f2']}/{exp['total']}) but found ({f1}/{f2}/{total})")
    if rrp and abs(rrp - exp["rrp"]) > 1.0:
        a07_mismatches += 1
        record_violation("RULE-07-A07-GOLDEN", f"RRP mismatch for {pn}: expected {exp['rrp']} but found {rrp}")

if a07_mismatches == 0:
    record_pass("RULE-07-A07-GOLDEN", "All 8 Galaxy A07 Golden Cases match exact Stock.xlsx ground truth")

# ----------------------------------------------------------------------
# 9. RULE 8: SECRET & CREDENTIAL LEAK SCAN
# ----------------------------------------------------------------------
secret_patterns = [
    r'(?i)(api[_-]?key|secret|password|passwd|private[_-]?key)\s*[:=]\s*["\'][A-Za-z0-9_\-]{8,}["\']',
    r'-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----',
    r'eyJ[A-Za-z0-9-_]{20,}\.eyJ[A-Za-z0-9-_]{20,}\.[A-Za-z0-9-_]{20,}' # Real JWT pattern
]

secret_leaks = 0
scan_extensions = ['.js', '.json', '.py', '.html', '.md', '.env']
ignore_dirs = ['.git', 'node_modules', '.venv', '__pycache__']

for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d not in ignore_dirs]
    for file in files:
        if file.startswith(".env.example"):
            continue
        ext = os.path.splitext(file)[1]
        if ext in scan_extensions:
            filepath = os.path.join(root, file)
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as sf:
                    content = sf.read()
                    for pat in secret_patterns:
                        if re.search(pat, content):
                            secret_leaks += 1
                            record_violation("RULE-08-SECRET-LEAK", f"Potential credential leak pattern in {filepath}")
            except Exception:
                pass

if secret_leaks == 0:
    record_pass("RULE-08-SECRET-LEAK", "Zero real credentials, private keys, or API tokens detected in repository")

# ----------------------------------------------------------------------
# SUMMARY AND EXIT DECISION
# ----------------------------------------------------------------------
print("\n" + "=" * 70)
print(f"QUALITY GATE SUMMARY: {len(passed_checks)} PASSED, {len(warnings)} WARNINGS, {len(violations)} VIOLATIONS")
print("=" * 70)

report_data = {
    "gateStatus": "PASSED" if len(violations) == 0 else "BLOCKED",
    "passedCount": len(passed_checks),
    "warningCount": len(warnings),
    "violationCount": len(violations),
    "passedChecks": passed_checks,
    "warnings": warnings,
    "violations": violations
}

os.makedirs("reports", exist_ok=True)
with open("reports/ci_quality_gate_results.json", "w", encoding="utf-8") as rf:
    json.dump(report_data, rf, ensure_ascii=False, indent=2)

if len(violations) > 0:
    print(f"\n🚨 DEPLOYMENT BLOCKED: Found {len(violations)} policy violations that must be fixed before merge.")
    sys.exit(1)
else:
    print("\n🎉 QUALITY GATE PASSED: All deployment criteria and business rules satisfied.")
    sys.exit(0)
