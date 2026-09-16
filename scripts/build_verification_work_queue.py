#!/usr/bin/env python3
"""
Enhanced Product Verification Work Queue Generator
Analyzes stock snapshot inventory against Product Accessory Master,
incorporating:
- Scope breakdown (totalMergedPn: 399, floor1ActivePn: 333, floor2OnlyPn: 66, zeroStockPn: 0)
- Store-aligned Priority Levels (P0: Conflict, P1: Unverified F1>0, P2: Partial F1>0, P3: Mkt Review F1>0, P4: F2 Only, P5: Zero Stock)
- Classification Status & Ambiguity Guard (CONFIRMED_FROM_MASTER, CONFIRMED_FROM_ERP, REVIEW_REQUIRED)
- Template-driven Required Fields & Next Action assignment
- Dual Coverage Metrics: P/N Master Coverage & F1 Quantity Coverage
"""

import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

TEMPLATE_REQUIRED_FIELDS = {
    "WALL_CHARGER": [
        "maximumOutputPower", "outputPorts", "usbPowerDelivery", "pps", "cableIncluded", "chargerType"
    ],
    "WIRELESS_CHARGER": [
        "maximumOutputPower", "chargerType", "chargingDistance", "fastWirelessChargingSupport", "qiCertified"
    ],
    "DATA_CABLE": [
        "connectorA", "connectorB", "maximumPower", "length", "packageQuantity", "color", "dataTransferSpeed"
    ],
    "POWER_BANK": [
        "batteryCapacity", "maximumOutputPower", "inputPorts", "outputPorts", "fastChargingSupport"
    ],
    "PHONE_CASE": [
        "caseType", "compatibleModels", "color", "material", "wirelessChargingCompatible"
    ],
    "TABLET_CASE": [
        "caseType", "compatibleModels", "color", "material", "standFunction"
    ],
    "SCREEN_PROTECTOR": [
        "compatibleModels", "protectorType", "hardness", "thickness", "privacyProtection"
    ],
    "WATCH_BAND": [
        "compatibleModels", "bandStyle", "color", "material", "wristSize"
    ],
    "BLUETOOTH_SPEAKER": [
        "outputPower", "ipRating", "playTime", "tws", "builtInStrap", "bluetoothVersion"
    ],
    "EARBUDS": [
        "driverSize", "batteryLife", "anc", "bluetoothVersion", "waterResistance"
    ],
    "PREMIUM_GIFT": [
        "accessoryType", "compatibleSeries", "color", "material", "dimensions"
    ],
    "SMARTPHONE": [
        "screenSize", "processor", "ram", "storage", "battery", "camera", "security"
    ],
    "TABLET": [
        "screenSize", "processor", "ram", "storage", "battery", "spenSupported"
    ],
    "SMARTWATCH": [
        "screenSize", "sensorList", "batteryLife", "waterResistance", "caseSize"
    ],
    "CARRIER_SIM": [
        "carrier", "packageType", "simFormat"
    ],
    "DEMO_DEVICE": [
        "demoType", "baseModel"
    ]
}

def classify_product(it):
    """
    Classifies product following Cat1 -> Cat2 -> Cat3 -> Brand hierarchy.
    Returns (productType, classificationStatus, suggestedProductTypes)
    """
    cat = (it.get("category") or "").strip()
    c1 = (it.get("category1") or "").strip().upper()
    c2 = (it.get("category2") or "").strip().upper()
    c3 = (it.get("category3") or "").strip().upper()

    if cat == "SmartPhone" or c1 == "SMART PHONES":
        return "SMARTPHONE", "CONFIRMED_FROM_ERP", []
    if cat == "Tablet" or c1 == "COMPUTER AND TABLET":
        return "TABLET", "CONFIRMED_FROM_ERP", []
    if cat == "Watch" or c1 == "SMART WATCH":
        return "SMARTWATCH", "CONFIRMED_FROM_ERP", []
    if cat == "Buds" or (c1 == "AUDIO" and "HEADPHONE" in c2):
        return "EARBUDS", "CONFIRMED_FROM_ERP", []
    if c1 == "AUDIO" and "SPEAKER" in c2:
        return "BLUETOOTH_SPEAKER", "CONFIRMED_FROM_ERP", []
    if "CHARGER" in c2:
        if "WIRELESS" in c3:
            return "WIRELESS_CHARGER", "CONFIRMED_FROM_ERP", []
        return "WALL_CHARGER", "CONFIRMED_FROM_ERP", []
    if "CABLE" in c2:
        return "DATA_CABLE", "CONFIRMED_FROM_ERP", []
    if "BACKUP BATTERY" in c2 or "POWER BANK" in c3:
        return "POWER_BANK", "CONFIRMED_FROM_ERP", []
    if "CASE FOR ANDROID PHONE" in c2:
        return "PHONE_CASE", "CONFIRMED_FROM_ERP", []
    if "CASE FOR GALAXY TAB" in c2:
        return "TABLET_CASE", "CONFIRMED_FROM_ERP", []
    if "SCREEN PROTECTOR" in c2 or "LENS PROTECTOR" in c2:
        return "SCREEN_PROTECTOR", "CONFIRMED_FROM_ERP", []
    if "WATCH BANDS" in c2:
        return "WATCH_BAND", "CONFIRMED_FROM_ERP", []
    if cat == "SIM" or c1.startswith("SERVICE"):
        return "CARRIER_SIM", "CONFIRMED_FROM_ERP", []
    if cat == "Premium" or "PREMIUM" in c1 or "PREMIUM" in c2:
        # Ambiguous premium - could be screen protector, phone case, microwave, soundbar, or lifestyle gift
        return None, "REVIEW_REQUIRED", ["PREMIUM_GIFT", "SCREEN_PROTECTOR", "PHONE_CASE", "HOME_APPLIANCE", "SPEAKER"]
    if "DEMO" in c2 or "DEMO" in c3:
        return "DEMO_DEVICE", "CONFIRMED_FROM_ERP", []
    if cat == "Other":
        return None, "REVIEW_REQUIRED", ["HOME_APPLIANCE", "UNKNOWN_ACCESSORY"]
    return None, "REVIEW_REQUIRED", ["UNKNOWN_ACCESSORY"]

def determine_priority(status, f1, f2):
    """
    Assigns strict store-aligned priority:
    P0: BLOCKED_CONFLICT
    P1: SPEC_NOT_VERIFIED and F1 > 0
    P2: PARTIALLY_VERIFIED and F1 > 0
    P3: MARKETPLACE_REVIEW_REQUIRED and F1 > 0
    P4: F1 == 0 and F2 > 0 (F2 only)
    P5: F1 == 0 and F2 == 0 (Zero stock)
    """
    if status == "BLOCKED_CONFLICT":
        return "P0"
    if f1 == 0 and f2 == 0:
        return "P5"
    if f1 == 0 and f2 > 0:
        return "P4"
    if status == "SPEC_NOT_VERIFIED":
        return "P1"
    if status == "PARTIALLY_VERIFIED":
        return "P2"
    if status == "MARKETPLACE_REVIEW_REQUIRED":
        return "P3"
    # Fallback for VERIFIED with F1 > 0
    return "P2"

def determine_next_action(classification_status, current_status, brand):
    if classification_status == "REVIEW_REQUIRED":
        return "CONFIRM_PRODUCT_TYPE"
    if current_status == "BLOCKED_CONFLICT":
        return "RESOLVE_CONFLICT"
    if current_status == "MARKETPLACE_REVIEW_REQUIRED":
        return "REVIEW_MARKETPLACE_EVIDENCE"
    if current_status == "PARTIALLY_VERIFIED":
        return "SEARCH_MANUAL"
    if current_status == "VERIFIED":
        return "APPROVE_VERIFIED"
    # SPEC_NOT_VERIFIED
    brand_upper = (brand or "").upper()
    if "SAMSUNG" in brand_upper:
        return "SEARCH_MANUFACTURER"
    return "SEARCH_MANUFACTURER"

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    snapshot_path = os.path.join(root, "assets", "js", "pilot-stock-snapshot.js")
    master_path = os.path.join(root, "data", "product-accessory-master.json")
    output_path = os.path.join(root, "reports", "product_verification_work_queue.json")
    
    with open(snapshot_path, "r", encoding="utf-8") as f:
        content = f.read()
    arr_str = content.split("window.LATEST_STOCK_SNAPSHOT =")[1].split("];")[0].strip() + "]"
    items = json.loads(arr_str)
    
    with open(master_path, "r", encoding="utf-8") as f:
        master = json.load(f)
        
    master_pns = {p["inventoryIdentity"]["inventoryPn"]: p for p in master.get("products", []) if p.get("inventoryIdentity", {}).get("inventoryPn")}
    master_gtins = {p["inventoryIdentity"]["gtin"]: p for p in master.get("products", []) if p.get("inventoryIdentity", {}).get("gtin")}
    
    queue_records = []
    
    # Scope counters
    floor1_active_count = 0
    floor2_only_count = 0
    zero_stock_count = 0
    
    # Metric counters
    status_counts = {
        "VERIFIED": 0,
        "PARTIALLY_VERIFIED": 0,
        "SPEC_NOT_VERIFIED": 0,
        "MARKETPLACE_REVIEW_REQUIRED": 0,
        "BLOCKED_CONFLICT": 0
    }
    
    total_f1_quantity = 0
    master_f1_quantity = 0
    total_f2_quantity = 0
    
    for idx, item in enumerate(items, start=1):
        pn = item.get("pn", "").strip()
        barcode = item.get("barcode", "").strip()
        f1 = int(item.get("f1", 0))
        f2 = int(item.get("f2", 0))
        total = int(item.get("total", 0))
        brand = item.get("brand", "").strip()
        name = item.get("name") or item.get("description") or ""
        cat = item.get("category", "").strip()
        c1 = item.get("category1", "").strip()
        c2 = item.get("category2", "").strip()
        c3 = item.get("category3", "").strip()
        
        # Track Scope
        if f1 > 0:
            floor1_active_count += 1
        elif f2 > 0:
            floor2_only_count += 1
        else:
            zero_stock_count += 1
            
        total_f1_quantity += f1
        total_f2_quantity += f2
        
        matched_master = master_pns.get(pn) or master_gtins.get(barcode)
        
        if matched_master:
            status = matched_master.get("verification", {}).get("recordStatus", "PARTIALLY_VERIFIED")
            product_type = matched_master.get("productIdentity", {}).get("productType")
            classification_status = "CONFIRMED_FROM_MASTER"
            suggested_types = [product_type] if product_type else []
        else:
            if cat in ["SmartPhone", "Tablet", "Watch", "Buds"]:
                status = "VERIFIED"
                product_type, classification_status, suggested_types = classify_product(item)
            else:
                status = "SPEC_NOT_VERIFIED"
                product_type, classification_status, suggested_types = classify_product(item)
                
        status_counts[status] = status_counts.get(status, 0) + 1
        
        if status in ["VERIFIED", "PARTIALLY_VERIFIED"]:
            master_f1_quantity += f1
            
        priority = determine_priority(status, f1, f2)
        next_action = determine_next_action(classification_status, status, brand)
        required_fields = TEMPLATE_REQUIRED_FIELDS.get(product_type, [])
        
        record = {
            "queueId": f"PVQ-{idx:06d}",
            "inventoryPn": pn,
            "barcode": barcode if barcode else None,
            "brand": brand,
            "erpDescription": name,
            "cat1": c1,
            "cat2": c2,
            "cat3": c3,
            "category": cat,
            "f1": f1,
            "f2": f2,
            "total": total,
            "srp": float(item.get("srp", 0.0)),
            "erpPrice": float(item.get("srp", 0.0)),
            "currentStatus": status,
            "priority": priority,
            "productType": product_type,
            "suggestedProductTypes": suggested_types,
            "classificationStatus": classification_status,
            "requiredFields": required_fields,
            "nextAction": next_action,
            "assignedTo": None,
            "reviewedAt": None
        }
        queue_records.append(record)
        
    # Sort queue:
    # Priority order: P0 -> P1 -> P2 -> P3 -> P4 -> P5
    # Secondary order: F1 stock descending, Total stock descending
    priority_order = {"P0": 0, "P1": 1, "P2": 2, "P3": 3, "P4": 4, "P5": 5}
    queue_records.sort(key=lambda r: (priority_order.get(r["priority"], 99), -r["f1"], -r["total"], r["inventoryPn"]))
    
    # Re-assign sequential queueId after sorting
    for rank, rec in enumerate(queue_records, start=1):
        rec["queueRank"] = rank
        
    total_records = len(queue_records)
    verified_pn_count = status_counts["VERIFIED"]
    partially_verified_pn_count = status_counts["PARTIALLY_VERIFIED"]
    spec_not_verified_pn_count = status_counts["SPEC_NOT_VERIFIED"]
    
    master_record_coverage_percent = round(((verified_pn_count + partially_verified_pn_count) / total_records) * 100, 2)
    unverified_coverage_percent = round((spec_not_verified_pn_count / total_records) * 100, 2)
    f1_quantity_coverage_percent = round((master_f1_quantity / total_f1_quantity) * 100, 2)
    
    # Extract Top 20 P/N by F1 for immediate Pareto execution
    top_20_f1 = [r for r in queue_records if r["priority"] == "P1"][:20]
    
    report = {
        "generatedAt": "2026-09-16T13:51:00Z",
        "scope": {
            "totalMergedPn": total_records,
            "floor1ActivePn": floor1_active_count,
            "floor2OnlyPn": floor2_only_count,
            "zeroStockPn": zero_stock_count
        },
        "inventoryTotals": {
            "totalF1Quantity": total_f1_quantity,
            "totalF2Quantity": total_f2_quantity,
            "grandTotalQuantity": total_f1_quantity + total_f2_quantity
        },
        "statusCounts": status_counts,
        "coverageMetrics": {
            "masterRecordCoveragePercent": master_record_coverage_percent,
            "unverifiedCoveragePercent": unverified_coverage_percent,
            "masterF1Quantity": master_f1_quantity,
            "f1QuantityCoveragePercent": f1_quantity_coverage_percent
        },
        "priorityBreakdown": {
            "P0": len([r for r in queue_records if r["priority"] == "P0"]),
            "P1": len([r for r in queue_records if r["priority"] == "P1"]),
            "P2": len([r for r in queue_records if r["priority"] == "P2"]),
            "P3": len([r for r in queue_records if r["priority"] == "P3"]),
            "P4": len([r for r in queue_records if r["priority"] == "P4"]),
            "P5": len([r for r in queue_records if r["priority"] == "P5"])
        },
        "top20ParetoReviewTargets": top_20_f1,
        "queue": queue_records
    }
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        
    print("================================================================================")
    print("ENHANCED PRODUCT VERIFICATION WORK QUEUE GENERATED")
    print("================================================================================")
    print(f"Scope:")
    print(f"  Total Merged P/N            : {report['scope']['totalMergedPn']}")
    print(f"  Floor 1 Active P/N (F1 > 0) : {report['scope']['floor1ActivePn']}")
    print(f"  Floor 2 Only P/N (F1 = 0)   : {report['scope']['floor2OnlyPn']}")
    print(f"  Zero Stock P/N (F1 = F2 = 0): {report['scope']['zeroStockPn']}")
    print(f"\nStatus Breakdown:")
    print(f"  VERIFIED                    : {status_counts['VERIFIED']}")
    print(f"  PARTIALLY_VERIFIED          : {status_counts['PARTIALLY_VERIFIED']}")
    print(f"  SPEC_NOT_VERIFIED           : {status_counts['SPEC_NOT_VERIFIED']}")
    print(f"  MARKETPLACE_REVIEW_REQUIRED : {status_counts['MARKETPLACE_REVIEW_REQUIRED']}")
    print(f"  BLOCKED_CONFLICT            : {status_counts['BLOCKED_CONFLICT']}")
    print(f"\nCoverage Metrics:")
    print(f"  Master Coverage (by P/N)    : {master_record_coverage_percent}%")
    print(f"  Unverified Ratio (by P/N)   : {unverified_coverage_percent}%")
    print(f"  F1 Inventory Quantity Sum   : {total_f1_quantity} ชิ้น")
    print(f"  F1 Master Quantity Covered  : {master_f1_quantity} ชิ้น ({f1_quantity_coverage_percent}%)")
    print(f"\nPriority Queue Breakdown:")
    for p_key, p_val in report["priorityBreakdown"].items():
        print(f"  {p_key:3}: {p_val:3} items")
    print(f"\nTop 5 P1 Items for Immediate Verification:")
    for i, rec in enumerate(top_20_f1[:5], 1):
        pt_display = rec['productType'] or f"AMBIGUOUS({','.join(rec['suggestedProductTypes'])})"
        print(f"  {i}. [Rank {rec['queueRank']:3}] F1={rec['f1']:2} | {rec['inventoryPn']:18} | {rec['brand']:12} | {pt_display:20} | {rec['classificationStatus']}")
    print("================================================================================")
    print(f"Saved complete work queue artifact to: {output_path}")

if __name__ == "__main__":
    main()
