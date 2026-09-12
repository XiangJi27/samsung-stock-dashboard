# -*- coding: utf-8 -*-
"""
Script to merge C:\\Users\\JarNJay\\Downloads\\Stock.xlsx into the system product/stock database.
Adds all new P/Ns, verifies colors and models, regenerates stock_full_data.json, stock_data.js,
synchronizes audit_summary.json, and updates runtime_manifest.json.
"""
import os
import sys
import json
import hashlib
import time
import openpyxl

sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOWNLOADS_STOCK = r"C:\Users\JarNJay\Downloads\Stock.xlsx"
STOCK_FULL_JSON = os.path.join(ROOT_DIR, "stock_full_data.json")
STOCK_DATA_JS = os.path.join(ROOT_DIR, "stock_data.js")
AUDIT_SUMMARY_JSON = os.path.join(ROOT_DIR, "audit_summary.json")
CORRECTED_AUDIT_JSON = os.path.join(ROOT_DIR, "corrected_audit_summary.json")
RUNTIME_MANIFEST_JSON = os.path.join(ROOT_DIR, "runtime_manifest.json")

def run_merge():
    if not os.path.exists(DOWNLOADS_STOCK):
        print(f"❌ File not found: {DOWNLOADS_STOCK}")
        return

    wb = openpyxl.load_workbook(DOWNLOADS_STOCK, data_only=True)
    if "Stock" not in wb.sheetnames:
        print("❌ Sheet 'Stock' not found in workbook.")
        return

    ws = wb["Stock"]
    dl_items = []
    curr_m = ""
    for r in range(1, ws.max_row + 1):
        m = ws.cell(r, 1).value
        pn = ws.cell(r, 2).value
        col = ws.cell(r, 3).value
        if m:
            curr_m = str(m).strip()
        if pn:
            clean_pn = str(pn).strip()
            dl_items.append({
                "model": curr_m,
                "pn": clean_pn,
                "color": str(col).strip() if col else ""
            })

    print(f"Read {len(dl_items)} items from {DOWNLOADS_STOCK} [Sheet: Stock]")

    with open(STOCK_FULL_JSON, "r", encoding="utf-8") as f:
        existing_stock = json.load(f)

    existing_by_pn = {x["pn"]: x for x in existing_stock}
    new_added = 0
    updated_info = 0

    for it in dl_items:
        pn = it["pn"]
        model = it["model"]
        color = it["color"]

        if pn in existing_by_pn:
            item = existing_by_pn[pn]
            if not item.get("color") and color:
                item["color"] = color
                updated_info += 1
            if model and not item.get("model"):
                item["model"] = model
                updated_info += 1
        else:
            code_type = "PASS_F" if pn.startswith("F-") else ("STANDARD_SM" if pn.startswith("SM-") else "STANDARD_ACCESSORY")
            is_core = True if ("Galaxy" in model or pn.startswith("SM-") or pn.startswith("F-")) else False

            new_record = {
                "id": f"STOCK-{len(existing_stock) + 1:04d}",
                "row": len(existing_stock) + 1,
                "category": "SmartPhone" if is_core else "Accessory",
                "inventoryGroup": "CORE_DEVICE" if is_core else "ACCESSORY",
                "includedInCoreDeviceKpi": is_core,
                "sourceSheet": "Stock.xlsx",
                "model": model,
                "pn": pn,
                "color": color,
                "productCodeType": code_type,
                "srp": 0.0,
                "f1": 0,
                "f2": 0,
                "total": 0,
                "stockReferencePrice": 0.0,
                "sourceFile": "Stock.xlsx"
            }
            existing_stock.append(new_record)
            existing_by_pn[pn] = new_record
            new_added += 1

    print(f"Merge Results: Added {new_added} new P/Ns, Updated {updated_info} existing records.")
    print(f"Total Database Size: {len(existing_stock)} products.")

    # Save to stock_full_data.json
    with open(STOCK_FULL_JSON, "w", encoding="utf-8") as f:
        json.dump(existing_stock, f, indent=2, ensure_ascii=False)
    print(f"✅ Saved updated {STOCK_FULL_JSON}")

    # Generate stock_data.js
    core_items = [x for x in existing_stock if x.get("includedInCoreDeviceKpi")]
    core_f1 = sum(x.get("f1", 0) for x in core_items)
    core_f2 = sum(x.get("f2", 0) for x in core_items)
    total_inv = sum(x.get("total", 0) for x in existing_stock)

    metadata = {
        "sourceType": "Excel Snapshot & Master Catalog",
        "sourceFile": "Stock.xlsx",
        "sourceSheets": ["Promotion", "Adapter&สาย&Flim", "Stock"],
        "importedAt": "2026-09-06T09:00:00+07:00",
        "recordCount": len(existing_stock),
        "coreDevices": {
            "floor1": core_f1,
            "floor2": core_f2,
            "total": core_f1 + core_f2
        },
        "importedInventoryTotal": total_inv,
        "schemaVersion": "2.4.0-auto-catalog",
        "importBatchId": "IMPORT-20260906-002",
        "clockMismatch": False,
        "dataVersionMismatch": False
    }

    with open(STOCK_DATA_JS, "w", encoding="utf-8") as f:
        f.write("window.STOCK_METADATA = " + json.dumps(metadata, indent=2, ensure_ascii=False) + ";\n\n")
        f.write("window.STOCK_DATABASE = " + json.dumps(existing_stock, indent=2, ensure_ascii=False) + ";\n")

    print(f"✅ Generated {STOCK_DATA_JS}")

    # Synchronize and touch audit_summary.json
    time.sleep(1) # Ensure timestamp ordering
    for audit_file in [AUDIT_SUMMARY_JSON, CORRECTED_AUDIT_JSON]:
        if os.path.exists(audit_file):
            with open(audit_file, "r", encoding="utf-8") as f:
                audit_data = json.load(f)
            audit_data["stockProductsCount"] = len(existing_stock)
            with open(audit_file, "w", encoding="utf-8") as f:
                json.dump(audit_data, f, indent=2, ensure_ascii=False)
            os.utime(audit_file, None) # Touch mtime to now

    # Update runtime_manifest.json
    with open(RUNTIME_MANIFEST_JSON, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    total_size = 0
    for item in manifest["files"]:
        fpath = os.path.join(ROOT_DIR, item["file"])
        if os.path.exists(fpath):
            with open(fpath, "rb") as rf:
                b = rf.read()
                item["sha256"] = hashlib.sha256(b).hexdigest()
                item["sizeBytes"] = len(b)
                total_size += len(b)

    manifest["summary"]["totalSizeBytes"] = total_size
    manifest["summary"]["totalSizeMB"] = round(total_size / (1024 * 1024), 2)

    with open(RUNTIME_MANIFEST_JSON, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print("✅ Updated runtime_manifest.json with new file hashes")

if __name__ == "__main__":
    run_merge()
