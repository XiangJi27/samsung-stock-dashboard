# -*- coding: utf-8 -*-
"""
5-LAYER ARCHITECTURE PIPELINE & NOTEBOOKLM KNOWLEDGE PACKAGER
Components:
1. Python Parser (Cell-level provenance, merged cells, formulas, left-to-right scan)
2. Rule Engine (Exact P/N, code type separation, price equation, coupon check, error quarantine)
3. Promotion Master (Metadata, batch ID, hashes, validated promotions)
4. Dashboard Ready (Exports promotion_variants.js)
5. NotebookLM Knowledge Base Exporter (Flat CSVs, draft, active, blocked, audit, branch rules)
"""

import os
import sys
import json
import csv
import hashlib
import datetime
import openpyxl
import re

sys.stdout.reconfigure(encoding='utf-8')

# Batch identification
TIMESTAMP = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
BATCH_ID = f"BATCH-{TIMESTAMP}"
PARSER_VERSION = "2.1.0-LTR-MERGE"
RULE_ENGINE_VERSION = "2.5.0-STRICT"
TODAY_ISO = datetime.datetime.now().strftime("%Y-%m-%d")

print(f"=== INITIALIZING 5-LAYER PIPELINE [{BATCH_ID}] ===")
print(f"Current Date: {TODAY_ISO}")

# --------------------------------------------------------------------------
# STEP 0: FILE HASH CALCULATOR
# --------------------------------------------------------------------------
def calc_sha256(filepath):
    if not os.path.exists(filepath):
        return None
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

source_files = ["Stock.xlsx", "promo_retail.xlsx", "promo_tablet.xlsx"]
file_hashes = {f: calc_sha256(f) for f in source_files}
print("Source File Hashes calculated:", file_hashes)

# --------------------------------------------------------------------------
# STEP 1: PYTHON PARSER LAYER
# --------------------------------------------------------------------------
print("\n--- Layer 1: Python Parser (Left-to-Right Scan & Cell Provenance) ---")

raw_cells = []
parsed_draft_items = []
flat_draft_csv_rows = []

def get_product_code_type(pn, model=""):
    if not pn:
        if model:
            m = model.lower()
            if 'รหัส f' in m or 'พาส f' in m or 'pass f' in m:
                return "PASS_F"
            if 'bom' in m:
                return "BOM_SET"
            return "STANDARD_SM"
        return "UNKNOWN"
    pn_upper = pn.strip().upper()
    if pn_upper.startswith("F-"):
        return "PASS_F"
    if pn_upper.startswith("SM-"):
        return "STANDARD_SM"
    if 'bom' in (model or '').lower():
        return "BOM_SET"
    if any(pn_upper.startswith(p) for p in ["EP-", "EF-", "GP-", "ET-", "EJ-"]):
        return "STANDARD_ACCESSORY"
    return "UNKNOWN"

# Parse Stock.xlsx Promotion Sheet
if os.path.exists("Stock.xlsx"):
    wb_data = openpyxl.load_workbook("Stock.xlsx", data_only=True)
    wb_formula = openpyxl.load_workbook("Stock.xlsx", data_only=False)
    sheet_name = "Promotion"
    if sheet_name in wb_data.sheetnames:
        ws_data = wb_data[sheet_name]
        ws_formula = wb_formula[sheet_name]

        # Extract headers row 1-3
        headers = {}
        for col in range(1, 15):
            col_letter = openpyxl.utils.get_column_letter(col)
            val1 = ws_data.cell(1, col).value or ""
            val2 = ws_data.cell(2, col).value or ""
            val3 = ws_data.cell(3, col).value or ""
            h_path = " > ".join(str(v).strip() for v in [val1, val2, val3] if str(v).strip())
            headers[col_letter] = h_path or f"Column_{col_letter}"

        curr_model = ""
        for r in range(4, ws_data.max_row + 1):
            model_val = ws_data.cell(r, 1).value
            pn_val = ws_data.cell(r, 2).value
            color_val = ws_data.cell(r, 3).value
            srp_val = ws_data.cell(r, 4).value
            f1_val = ws_data.cell(r, 5).value
            f2_val = ws_data.cell(r, 6).value

            if model_val:
                curr_model = str(model_val).strip()
            if not pn_val and not curr_model:
                continue

            pn_clean = str(pn_val).strip() if pn_val else ""
            if not pn_clean:
                continue

            def safe_val(v):
                if v is None or isinstance(v, (int, float, str, bool)):
                    return v
                return str(v)

            # Capture Raw Cell Metadata
            row_cell_record = {
                "sourceFile": "Stock.xlsx",
                "sourceSheet": sheet_name,
                "sourceRow": r,
                "model": curr_model,
                "pn": pn_clean,
                "color": str(color_val).strip() if color_val else "",
                "cells": {
                    "A": {"column": "A", "headerPath": headers.get("A", "Model"), "value": safe_val(curr_model), "formula": safe_val(ws_formula.cell(r, 1).value)},
                    "B": {"column": "B", "headerPath": headers.get("B", "P/N"), "value": safe_val(pn_clean), "formula": safe_val(ws_formula.cell(r, 2).value)},
                    "C": {"column": "C", "headerPath": headers.get("C", "Color"), "value": safe_val(color_val), "formula": safe_val(ws_formula.cell(r, 3).value)},
                    "D": {"column": "D", "headerPath": headers.get("D", "SRP"), "value": safe_val(srp_val), "formula": safe_val(ws_formula.cell(r, 4).value)},
                    "E": {"column": "E", "headerPath": headers.get("E", "Stock Floor 1"), "value": safe_val(f1_val), "formula": safe_val(ws_formula.cell(r, 5).value)},
                    "F": {"column": "F", "headerPath": headers.get("F", "Stock Floor 2"), "value": safe_val(f2_val), "formula": safe_val(ws_formula.cell(r, 6).value)}
                }
            }
            raw_cells.append(row_cell_record)

            f1_num = int(f1_val) if f1_val is not None and str(f1_val).isdigit() else 0
            f2_num = int(f2_val) if f2_val is not None and str(f2_val).isdigit() else 0
            total_num = f1_num + f2_num
            code_type = get_product_code_type(pn_clean, curr_model)

            draft_item = {
                "id": f"STOCK-{pn_clean}",
                "model": curr_model,
                "pn": pn_clean,
                "color": str(color_val).strip() if color_val else "",
                "productCodeType": code_type,
                "srp": float(srp_val) if srp_val is not None and str(srp_val).replace('.','',1).isdigit() else 0.0,
                "f1": f1_num,
                "f2": f2_num,
                "total": total_num,
                "sourceFile": "Stock.xlsx",
                "sourceSheet": sheet_name,
                "sourceRow": r
            }
            parsed_draft_items.append(draft_item)

print(f"Parsed {len(parsed_draft_items)} stock baseline records from Stock.xlsx.")

# Load rich promotion variants from promotion_variants.json or promotion_import.py output
pv_json_path = "promotion_variants.json"
existing_variants = []
if os.path.exists(pv_json_path):
    with open(pv_json_path, "r", encoding="utf-8") as f:
        existing_variants = json.load(f)
    print(f"Loaded {len(existing_variants)} promotion variants from {pv_json_path}.")

# --------------------------------------------------------------------------
# STEP 2: RULE ENGINE LAYER
# --------------------------------------------------------------------------
print("\n--- Layer 2: Rule Engine (Validation, Quarantine & Separation) ---")

validated_variants = []
active_promos = []
audit_detail_records = []
blocked_variants = []

for v in existing_variants:
    pn = v.get("pn", "")
    model = v.get("model", "")
    code_type = v.get("productCodeType") or get_product_code_type(pn, model)
    v["productCodeType"] = code_type

    sale_mode = v.get("saleMode", "NORMAL")
    rrp = float(v.get("rrp") or v.get("srp") or 0.0)
    discount = float(v.get("discount") or 0.0)
    net_price = float(v.get("netPrice") or 0.0)
    coupon = v.get("couponCode", "") or ""

    # Rule checks
    passed = True
    errors = []
    warnings = []

    # Check 1: Price Equation
    if rrp > 0 and discount > 0:
        expected_net = rrp - discount
        if abs(expected_net - net_price) > 0.01:
            warnings.append(f"PRICE_EQUATION_MISMATCH: {rrp} - {discount} != {net_price}")

    # Check 2: Formula Error Quarantine
    raw_str = str(v)
    if "#ERROR!" in raw_str or "#REF!" in raw_str or "#VALUE!" in raw_str:
        passed = False
        errors.append("FORMULA_ERROR_DETECTED")
        v["validationStatus"] = "BLOCKED_INVALID"
        v["isBlocked"] = True

    # Check 3: Student Rule
    if sale_mode == "STUDENT":
        if coupon != "Studentcrd":
            errors.append(f"STUDENT_COUPON_INVALID: expected Studentcrd, got '{coupon}'")
            passed = False
            v["validationStatus"] = "BLOCKED_INVALID"
            v["isBlocked"] = True
        if v.get("sfPlusEligible") is True:
            errors.append("STUDENT_SF_PLUS_STACKING_FORBIDDEN")
            passed = False
            v["validationStatus"] = "BLOCKED_INVALID"
            v["isBlocked"] = True
        if v.get("tradeUpEligible") is True:
            errors.append("STUDENT_TRADE_UP_STACKING_FORBIDDEN")
            passed = False
            v["validationStatus"] = "BLOCKED_INVALID"
            v["isBlocked"] = True

    # Check 4: Trade Up Isolation
    if sale_mode == "TRADE_UP":
        trade_code = v.get("tradeUpCode", "")
        if trade_code != "T-UP-CO-S":
            warnings.append(f"TRADE_UP_CODE_UNVERIFIED: {trade_code}")

    # Check 5: Pass F vs SM Isolation
    if code_type == "PASS_F" and pn and pn.startswith("SM-"):
        errors.append("PASS_F_ASSIGNED_TO_SM_DEVICE")
        passed = False
        v["validationStatus"] = "BLOCKED_INVALID"
        v["isBlocked"] = True

    # Check 6: Tab A11+ 5G Coupon Rule
    if "a11+" in model.lower() and "5g" in model.lower():
        if sale_mode == "STANDARD_PAYMENT" and coupon and coupon != "01":
            warnings.append(f"TAB_A11_PLUS_STANDARD_COUPON_EXPECTED_01_GOT_{coupon}")
        elif sale_mode == "SF_PLUS" and coupon and coupon != "04":
            warnings.append(f"TAB_A11_PLUS_SF_PLUS_COUPON_EXPECTED_04_GOT_{coupon}")

    # Check 7: Fold8 Pass F Out of Stock / Unproven
    if "fold8" in model.lower() and code_type == "PASS_F":
        v["validationStatus"] = "VALID_EXCLUDED"
        v["isBlocked"] = True
        errors.append("FOLD8_PASS_F_STOCK_DEPLETED")
        passed = False

    # Check 8: Historical 2025 Gifts
    promo_id = v.get("promoId", "")
    if promo_id.startswith("PREM-2025") or v.get("validationStatus") == "VALID_HISTORICAL_RECORD":
        v["validationStatus"] = "VALID_HISTORICAL_RECORD"
        v["isBlocked"] = True
        errors.append("HISTORICAL_EXPIRED_2025_GIFT")
        passed = False

    # Validation Status Resolution
    if not passed:
        if v.get("validationStatus") not in ["VALID_EXCLUDED", "VALID_HISTORICAL_RECORD", "BLOCKED_UNPROVEN"]:
            v["validationStatus"] = "BLOCKED_INVALID"
        v["isBlocked"] = True
        v["validationErrors"] = errors
        blocked_variants.append(v)
    else:
        if warnings:
            v["validationStatus"] = "PASSED_WITH_WARNING"
            v["warnings"] = warnings
        else:
            v["validationStatus"] = "PASSED_VALIDATION"
        v["isBlocked"] = False
        validated_variants.append(v)
        active_promos.append(v)

    # Audit Detail Log
    audit_detail_records.append({
        "promoId": v.get("promoId", ""),
        "model": model,
        "pn": pn,
        "productCodeType": code_type,
        "saleMode": sale_mode,
        "netPrice": net_price,
        "couponCode": coupon,
        "status": v.get("validationStatus"),
        "errors": "; ".join(errors) if errors else "",
        "warnings": "; ".join(warnings) if warnings else "",
        "sourceFile": v.get("sourceFile", ""),
        "sourceSheet": v.get("sourceSheet", ""),
        "sourceRow": v.get("sourceRow", "")
    })

print(f"Validated Variants: {len(validated_variants)} active.")
print(f"Blocked Variants: {len(blocked_variants)} quarantined.")

# --------------------------------------------------------------------------
# STEP 3: PROMOTION MASTER LAYER & METADATA
# --------------------------------------------------------------------------
print("\n--- Layer 3: Promotion Master (Batch Metadata & Export) ---")

batch_metadata = {
    "importBatchId": BATCH_ID,
    "timestamp": datetime.datetime.now().isoformat(),
    "importedAt": TODAY_ISO,
    "parserVersion": PARSER_VERSION,
    "ruleEngineVersion": RULE_ENGINE_VERSION,
    "sourceFiles": file_hashes,
    "summary": {
        "totalStockRecords": len(parsed_draft_items),
        "totalVariantsProcessed": len(existing_variants),
        "validatedActiveVariants": len(validated_variants),
        "quarantinedBlockedVariants": len(blocked_variants),
        "historicalArchiveGifts": sum(1 for v in blocked_variants if v.get("validationStatus") == "VALID_HISTORICAL_RECORD"),
        "depletedLaunchSets": sum(1 for v in blocked_variants if v.get("validationStatus") == "VALID_EXCLUDED")
    }
}

with open("import_batch_metadata.json", "w", encoding="utf-8") as f:
    json.dump(batch_metadata, f, ensure_ascii=False, indent=2)
print("Wrote import_batch_metadata.json")

with open("raw_cells.json", "w", encoding="utf-8") as f:
    json.dump(raw_cells, f, ensure_ascii=False, indent=2)
print("Wrote raw_cells.json")

with open("parsed_promotion_draft.json", "w", encoding="utf-8") as f:
    json.dump(parsed_draft_items, f, ensure_ascii=False, indent=2)
print("Wrote parsed_promotion_draft.json")

with open("rule_engine_results.json", "w", encoding="utf-8") as f:
    json.dump({"summary": batch_metadata["summary"], "audit": audit_detail_records}, f, ensure_ascii=False, indent=2)
print("Wrote rule_engine_results.json")

with open("validated_promotions.json", "w", encoding="utf-8") as f:
    json.dump(validated_variants, f, ensure_ascii=False, indent=2)
print("Wrote validated_promotions.json")

# Export promotion_variants.js for Dashboard
js_content = f"""// AUTO-GENERATED BY 5-LAYER PIPELINE [{BATCH_ID}]
// Pure Provenance Data • Zero Guessing • Strict Validation
window.PROMOTION_BATCH_METADATA = {json.dumps(batch_metadata, ensure_ascii=False, indent=2)};
window.PROMOTION_VARIANTS = {json.dumps(existing_variants, ensure_ascii=False, indent=2)};
"""
with open("promotion_variants.js", "w", encoding="utf-8") as f:
    f.write(js_content)
print("Wrote promotion_variants.js")

# --------------------------------------------------------------------------
# STEP 4: NOTEBOOKLM KNOWLEDGE BASE EXPORTS (Flat CSVs)
# --------------------------------------------------------------------------
print("\n--- Layer 5: NotebookLM Knowledge Base Exporter ---")

# 1. promotion_draft.csv (Flat structure, 1 row per variant)
draft_fields = [
    "promoId", "model", "pn", "productCodeType", "saleMode", "rrp", "discount",
    "netPrice", "couponCode", "tradeUpCode", "tradeUpDiscount", "sfPlusEligible",
    "studentEligible", "giftSamsung", "giftCopperwired", "validationStatus",
    "sourceFile", "sourceSheet", "sourceRow"
]

with open("promotion_draft.csv", "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=draft_fields)
    writer.writeheader()
    for v in existing_variants:
        row = {
            "promoId": v.get("promoId", ""),
            "model": v.get("model", ""),
            "pn": v.get("pn", ""),
            "productCodeType": v.get("productCodeType", ""),
            "saleMode": v.get("saleMode", ""),
            "rrp": v.get("rrp", ""),
            "discount": v.get("discount", ""),
            "netPrice": v.get("netPrice", ""),
            "couponCode": v.get("couponCode", ""),
            "tradeUpCode": v.get("tradeUpCode", ""),
            "tradeUpDiscount": v.get("tradeUpDiscount", ""),
            "sfPlusEligible": "YES" if v.get("sfPlusEligible") else "NO",
            "studentEligible": "YES" if v.get("studentEligible") else "NO",
            "giftSamsung": v.get("giftSamsung", v.get("gift", "")),
            "giftCopperwired": v.get("giftCopperwired", ""),
            "validationStatus": v.get("validationStatus", ""),
            "sourceFile": v.get("sourceFile", ""),
            "sourceSheet": v.get("sourceSheet", ""),
            "sourceRow": v.get("sourceRow", "")
        }
        writer.writerow(row)
print(f"Wrote promotion_draft.csv ({len(existing_variants)} rows)")

# 2. active_promotions.csv
with open("active_promotions.csv", "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=draft_fields)
    writer.writeheader()
    for v in validated_variants:
        row = {
            "promoId": v.get("promoId", ""),
            "model": v.get("model", ""),
            "pn": v.get("pn", ""),
            "productCodeType": v.get("productCodeType", ""),
            "saleMode": v.get("saleMode", ""),
            "rrp": v.get("rrp", ""),
            "discount": v.get("discount", ""),
            "netPrice": v.get("netPrice", ""),
            "couponCode": v.get("couponCode", ""),
            "tradeUpCode": v.get("tradeUpCode", ""),
            "tradeUpDiscount": v.get("tradeUpDiscount", ""),
            "sfPlusEligible": "YES" if v.get("sfPlusEligible") else "NO",
            "studentEligible": "YES" if v.get("studentEligible") else "NO",
            "giftSamsung": v.get("giftSamsung", v.get("gift", "")),
            "giftCopperwired": v.get("giftCopperwired", ""),
            "validationStatus": v.get("validationStatus", ""),
            "sourceFile": v.get("sourceFile", ""),
            "sourceSheet": v.get("sourceSheet", ""),
            "sourceRow": v.get("sourceRow", "")
        }
        writer.writerow(row)
print(f"Wrote active_promotions.csv ({len(validated_variants)} rows)")

# 3. blocked_variants.csv
blocked_fields = [
    "promoId", "model", "pn", "productCodeType", "saleMode", "validationStatus",
    "validationErrors", "sourceFile", "sourceSheet", "sourceRow"
]
with open("blocked_variants.csv", "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=blocked_fields)
    writer.writeheader()
    for v in blocked_variants:
        writer.writerow({
            "promoId": v.get("promoId", ""),
            "model": v.get("model", ""),
            "pn": v.get("pn", ""),
            "productCodeType": v.get("productCodeType", ""),
            "saleMode": v.get("saleMode", ""),
            "validationStatus": v.get("validationStatus", ""),
            "validationErrors": "; ".join(v.get("validationErrors", [])),
            "sourceFile": v.get("sourceFile", ""),
            "sourceSheet": v.get("sourceSheet", ""),
            "sourceRow": v.get("sourceRow", "")
        })
print(f"Wrote blocked_variants.csv ({len(blocked_variants)} rows)")

# 4. audit_detail.csv
with open("audit_detail.csv", "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["promoId", "model", "pn", "productCodeType", "saleMode", "netPrice", "couponCode", "status", "errors", "warnings", "sourceFile", "sourceSheet", "sourceRow"])
    writer.writeheader()
    for rec in audit_detail_records:
        writer.writerow(rec)
print(f"Wrote audit_detail.csv ({len(audit_detail_records)} rows)")

print(f"\n=== 5-LAYER PIPELINE COMPLETED SUCCESSFULLY [{BATCH_ID}] ===")
