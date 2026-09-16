#!/usr/bin/env python3
"""
Promotion Import Parser & 5-Stage Gate Validator (Draft Pilot)
Samsung Branch Operations System - Ayutthaya City Park

Flow:
Upload File -> File Gate -> Identity Gate -> Date Gate -> Price Gate -> Conflict Gate -> Preview Diff -> Save as DRAFT

Strict Pilot Rules:
- AUTO_PUBLISH_PROMOTION    = OFF (Never active on upload)
- IMPORT_STATUS             = DRAFT
- PREVIEW_DIFF_REQUIRED     = TRUE
- MANAGER_APPROVAL_REQUIRED = TRUE

Permanent Invariants:
- CANNOT mutate Product Accessory Master
- CANNOT mutate Product Specifications
- CANNOT mutate F1, F2, Cat1-Cat3, or ERP RRP
"""

import json
import os
import sys
import re
from datetime import datetime

sys.stdout.reconfigure(encoding="utf-8")

def validate_promotion_record(record, valid_stock_pns, existing_promo_ids, current_time):
    violations = []
    warnings = []
    status = "DRAFT"
    
    pid = record.get("promotionId", "").strip()
    pname = record.get("promotionName", "").strip()
    pn = record.get("inventoryPn", "").strip()
    ptype = record.get("promotionType", "").strip()
    s_date_str = record.get("startDate", "").strip()
    e_date_str = record.get("endDate", "").strip()
    rrp = record.get("rrp")
    discount = record.get("discountAmount")
    net_price = record.get("netPrice")
    payment = record.get("paymentMethod")
    segment = record.get("customerSegment")
    
    # ---------------------------------------------------------
    # STAGE 1: FILE & STRUCTURE GATE
    # ---------------------------------------------------------
    for req in ["promotionId", "promotionName", "inventoryPn", "promotionType", "startDate", "endDate", "rrp", "discountAmount", "netPrice"]:
        if record.get(req) is None or str(record.get(req)).strip() == "":
            violations.append({"stage": "FILE_GATE", "code": "MISSING_REQUIRED_FIELD", "detail": f"Missing field: {req}"})

    for f_name, f_val in [("rrp", rrp), ("discountAmount", discount), ("netPrice", net_price)]:
        if isinstance(f_val, str) and ("#ERROR" in f_val or "NAN" in f_val.upper() or "#REF" in f_val):
            violations.append({"stage": "FILE_GATE", "code": "UNPARSED_FORMULA_ERROR", "detail": f"Field {f_name} contains unparsed formula: {f_val}"})

    # ---------------------------------------------------------
    # STAGE 2: IDENTITY GATE (EXACT P/N)
    # ---------------------------------------------------------
    if pn not in valid_stock_pns:
        warnings.append({"stage": "IDENTITY_GATE", "code": "EXACT_PN_NOT_FOUND", "detail": f"P/N '{pn}' not found in stock master catalog"})
        status = "REVIEW_REQUIRED"
        
    if pid in existing_promo_ids:
        violations.append({"stage": "IDENTITY_GATE", "code": "DUPLICATE_PROMOTION_DETECTED", "detail": f"Promotion ID '{pid}' already exists in batch"})

    # ---------------------------------------------------------
    # STAGE 3: DATE & TIMEZONE GATE
    # ---------------------------------------------------------
    try:
        s_date = datetime.fromisoformat(s_date_str)
        e_date = datetime.fromisoformat(e_date_str)
        if e_date < s_date:
            violations.append({"stage": "DATE_GATE", "code": "INVALID_DATE_RANGE", "detail": f"End date ({e_date_str}) is before start date ({s_date_str})"})
        elif e_date < current_time:
            violations.append({"stage": "DATE_GATE", "code": "PROMOTION_ALREADY_EXPIRED", "detail": f"Promotion expired on {e_date_str} (current: {current_time.isoformat()})"})
    except Exception as e:
        violations.append({"stage": "DATE_GATE", "code": "DATE_PARSING_ERROR", "detail": str(e)})

    # ---------------------------------------------------------
    # STAGE 4: PRICE GATE
    # ---------------------------------------------------------
    if isinstance(rrp, (int, float)) and isinstance(discount, (int, float)) and isinstance(net_price, (int, float)):
        if discount < 0:
            violations.append({"stage": "PRICE_GATE", "code": "NEGATIVE_DISCOUNT_PROHIBITED", "detail": f"Discount cannot be negative ({discount})"})
        if discount > rrp:
            violations.append({"stage": "PRICE_GATE", "code": "DISCOUNT_EXCEEDS_RRP", "detail": f"Discount ({discount}) exceeds RRP ({rrp})"})
        if net_price <= 0:
            violations.append({"stage": "PRICE_GATE", "code": "INVALID_NET_PRICE", "detail": f"Net price must be positive ({net_price})"})
            
        expected_net = round(rrp - discount, 2)
        if abs(expected_net - round(net_price, 2)) > 0.01:
            violations.append({"stage": "PRICE_GATE", "code": "PRICE_EQUATION_MISMATCH", "detail": f"Net price ({net_price}) != RRP ({rrp}) - Discount ({discount}) [Expected: {expected_net}]"})

    # ---------------------------------------------------------
    # STAGE 5: CONFLICT GATE
    # ---------------------------------------------------------
    if ptype == "TRADE_UP_OFFER" and payment == "STANDARD_PAYMENT":
        violations.append({"stage": "CONFLICT_GATE", "code": "TRADE_UP_STANDARD_PAYMENT_COLLISION", "detail": "Trade Up promotions cannot use STANDARD_PAYMENT"})

    if ptype == "STUDENT_DISCOUNT" and segment != "STUDENT_ONLY":
        violations.append({"stage": "CONFLICT_GATE", "code": "INVALID_STUDENT_SEGMENT_RULES", "detail": "Student promotions must target STUDENT_ONLY segment"})

    if len(violations) > 0:
        status = "BLOCKED_CONFLICT"
    elif record.get("status") == "SUPERSEDED":
        status = "SUPERSEDED"

    return {
        "promotionId": pid,
        "inventoryPn": pn,
        "gateOutcome": "PASS" if len(violations) == 0 and len(warnings) == 0 else ("REVIEW_REQUIRED" if len(violations) == 0 else "FAIL"),
        "status": status,
        "violations": violations,
        "warnings": warnings,
        "record": record
    }

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    fixtures_path = os.path.join(root, "fixtures", "promotions", "promotion_pilot_fixtures.json")
    snapshot_path = os.path.join(root, "assets", "js", "pilot-stock-snapshot.js")
    diff_report_path = os.path.join(root, "reports", "promotion_preview_diff.json")
    drafts_output_path = os.path.join(root, "reports", "promotion_import_drafts.json")

    print("================================================================================")
    print("SAMSUNG BRANCH OPERATIONS - PROMOTION 5-STAGE GATE VALIDATOR & DRAFT IMPORT")
    print("================================================================================\n")

    # Load live stock P/Ns
    with open(snapshot_path, "r", encoding="utf-8") as f:
        content = f.read()
    arr_str = content.split("window.LATEST_STOCK_SNAPSHOT =")[1].split("];")[0].strip() + "]"
    stock_items = json.loads(arr_str)
    valid_pns = {item["pn"] for item in stock_items if item.get("pn")}

    # Current baseline time for audit (September 2026)
    current_time = datetime.fromisoformat("2026-09-16T12:00:00+07:00")

    with open(fixtures_path, "r", encoding="utf-8") as f:
        fixtures_data = json.load(f)

    fixtures = fixtures_data.get("fixtures", [])
    evaluated_promos = []
    existing_ids = set()

    for item in fixtures:
        rec = item["record"]
        # Only check duplicate against already processed in batch
        res = validate_promotion_record(rec, valid_pns, existing_ids, current_time)
        res["testId"] = item.get("testId")
        res["expectedGateOutcome"] = item.get("expectedGateOutcome")
        res["expectedStatus"] = item.get("expectedStatus")
        res["expectedError"] = item.get("expectedError")
        evaluated_promos.append(res)
        
        # Add to existing_ids if it was the valid first promo
        if res["gateOutcome"] == "PASS":
            existing_ids.add(res["promotionId"])

    # Build Preview Diff
    preview_diff = {
        "generatedAt": datetime.now().isoformat(),
        "policy": {
            "autoPublishPromotion": "OFF",
            "importStatus": "DRAFT",
            "previewDiffRequired": True,
            "managerApprovalRequired": True
        },
        "isolationGuards": {
            "productMasterMutations": 0,
            "productSpecsMutations": 0,
            "stockQuantityMutations": 0,
            "erpPriceMutations": 0
        },
        "summary": {
            "totalEvaluated": len(evaluated_promos),
            "passCount": sum(1 for p in evaluated_promos if p["gateOutcome"] == "PASS"),
            "reviewRequiredCount": sum(1 for p in evaluated_promos if p["gateOutcome"] == "REVIEW_REQUIRED"),
            "blockedConflictCount": sum(1 for p in evaluated_promos if p["gateOutcome"] == "FAIL")
        },
        "results": evaluated_promos
    }

    os.makedirs(os.path.dirname(diff_report_path), exist_ok=True)
    with open(diff_report_path, "w", encoding="utf-8") as f:
        json.dump(preview_diff, f, ensure_ascii=False, indent=2)

    # Save only PASS and REVIEW_REQUIRED to draft imports
    draft_imports = [p["record"] for p in evaluated_promos if p["status"] in ["DRAFT", "REVIEW_REQUIRED", "SUPERSEDED"]]
    with open(drafts_output_path, "w", encoding="utf-8") as f:
        json.dump({
            "generatedAt": datetime.now().isoformat(),
            "policy": "DRAFT_PILOT_ONLY",
            "draftPromotions": draft_imports
        }, f, ensure_ascii=False, indent=2)

    print(f"Total Promotion Records Evaluated : {len(evaluated_promos)}")
    print(f"  ✅ PASS (Ready as DRAFT)         : {preview_diff['summary']['passCount']}")
    print(f"  ⏳ REVIEW_REQUIRED               : {preview_diff['summary']['reviewRequiredCount']}")
    print(f"  ❌ BLOCKED_CONFLICT              : {preview_diff['summary']['blockedConflictCount']}")
    print(f"\nAuto-Publish Status              : STRICTLY OFF")
    print(f"Preview Diff Saved to            : {diff_report_path}")
    print(f"Draft Imports Saved to           : {drafts_output_path}")
    print("================================================================================")
    print("🎉 PROMOTION 5-STAGE GATE VALIDATION COMPLETE!")

if __name__ == "__main__":
    main()
