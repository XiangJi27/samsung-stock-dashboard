#!/usr/bin/env python3
"""
Auto-Draft Generator for Product Accessory Master
Samsung Branch Operations System - Ayutthaya City Park

Core Responsibilities:
1. Detects unverified products (SPEC_NOT_VERIFIED) from Product Verification Work Queue.
2. Creates an isolated Draft Record ('DRAFT-<PN>') for each exact P/N without touching live master data.
3. Captures an immutable 'erpSnapshot' to guarantee ERP immutability.
4. Classifies Product Type following Cat1 -> Cat2 -> Cat3 -> Brand hierarchy.
   - Ambiguous items -> classificationStatus = 'REVIEW_REQUIRED', productType = null
   - Confirmed items -> classificationStatus = 'CONFIRMED_FROM_ERP'
5. Extracts explicit ERP attributes from description (marked strictly as VERIFIED_FROM_ERP).
6. Assembles canonical Required Fields template.
7. Constructs prioritized Search Plan (Manufacturer Official -> Manufacturer Support -> Shopee Mall Official).
8. Initializes Candidate Evidence containers and determines next action.
9. Persists drafts to data/product-accessory-drafts.json.
"""

import json
import os
import re
import sys
from datetime import datetime

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
    "CARRIER_SIM": [
        "carrier", "packageType", "simFormat"
    ],
    "DEMO_DEVICE": [
        "demoType", "baseModel"
    ]
}

def extract_erp_attributes(description, product_type):
    """
    Extracts clearly stated attributes from ERP description.
    All extracted values are tagged strictly as VERIFIED_FROM_ERP.
    Never guesses or asserts unmentioned technical parameters.
    """
    desc = (description or "").strip()
    attrs = {}
    
    # Wattage extraction (e.g. 45W, 25W, 30W, 100W, 65W)
    w_match = re.search(r'(\d+)\s*[wW](?:att)?\b', desc)
    if w_match:
        attrs["maximumOutputPower" if product_type in ["WALL_CHARGER", "WIRELESS_CHARGER", "POWER_BANK"] else "maximumPower"] = {
            "value": int(w_match.group(1)),
            "unit": "W",
            "displayValue": f"{w_match.group(1)}W",
            "status": "VERIFIED_FROM_ERP",
            "evidenceLocator": "ERP Description > Wattage"
        }
        
    # Color extraction
    color_keywords = ["Black", "White", "Grey", "Gray", "Blue", "Green", "Pink", "Silver", "Gold", "Navy", "Yellow"]
    for c in color_keywords:
        if re.search(r'\b' + c + r'\b', desc, re.IGNORECASE):
            attrs["color"] = {
                "value": c.capitalize(),
                "displayValue": c.capitalize(),
                "status": "VERIFIED_FROM_ERP",
                "evidenceLocator": "ERP Description > Color"
            }
            break
            
    # Cable length (e.g. 1M, 2M, 1.8M)
    l_match = re.search(r'\b(\d+(?:\.\d+)?)\s*[mM]\b', desc)
    if l_match and product_type in ["DATA_CABLE"]:
        attrs["length"] = {
            "value": float(l_match.group(1)),
            "unit": "m",
            "displayValue": f"{l_match.group(1)}M",
            "status": "VERIFIED_FROM_ERP",
            "evidenceLocator": "ERP Description > Length"
        }
        
    # Cable Included extraction for chargers
    if product_type in ["WALL_CHARGER", "WIRELESS_CHARGER"]:
        if "with cable" in desc.lower():
            attrs["cableIncluded"] = {
                "value": True,
                "displayValue": "มาพร้อมสายในกล่อง",
                "status": "VERIFIED_FROM_ERP",
                "evidenceLocator": "ERP Description > With Cable"
            }
        elif "no cable" in desc.lower() or "without cable" in desc.lower():
            attrs["cableIncluded"] = {
                "value": False,
                "displayValue": "ไม่มีสายในกล่อง",
                "status": "VERIFIED_FROM_ERP",
                "evidenceLocator": "ERP Description > No Cable"
            }
            
    # Compatible Model extraction (e.g. Galaxy A57, S26, Flip8)
    model_match = re.search(r'(Galaxy\s+[A-Za-z0-9\s]+(?:Ultra|Plus|FE|5G|4G)?)', desc, re.IGNORECASE)
    if model_match and product_type in ["SCREEN_PROTECTOR", "PHONE_CASE", "TABLET_CASE"]:
        attrs["compatibleModels"] = {
            "value": [model_match.group(1).strip()],
            "displayValue": model_match.group(1).strip(),
            "status": "VERIFIED_FROM_ERP",
            "evidenceLocator": "ERP Description > Compatible Model"
        }
        
    return attrs

def build_search_plan(brand, pn, barcode, model, product_type, description):
    """
    Constructs a prioritized Search Plan for candidate evidence collection.
    """
    brand_clean = (brand or "").strip()
    pn_clean = (pn or "").strip()
    plan = []
    
    # Priority 1: Manufacturer Official Site
    if pn_clean:
        plan.append({
            "priority": 1,
            "sourceType": "MANUFACTURER_OFFICIAL",
            "searchQuery": f"{brand_clean} {pn_clean}".strip(),
            "targetPlatform": "Manufacturer Official Website",
            "purpose": "Verify exact model identity, datasheet specs, and compliance"
        })
        
    # Priority 2: Manufacturer Support / Datasheet / Manual
    if model or pn_clean:
        target_term = model if model else pn_clean
        plan.append({
            "priority": 2,
            "sourceType": "MANUFACTURER_SUPPORT",
            "searchQuery": f"{brand_clean} {target_term} specifications manual".strip(),
            "targetPlatform": "Manufacturer Support / Manual",
            "purpose": "Retrieve detailed technical parameters (PD, PPS, output profiles)"
        })
        
    # Priority 3: Shopee Mall Official Store (Secondary Supporting Evidence)
    if pn_clean or barcode:
        query_id = pn_clean if pn_clean else barcode
        plan.append({
            "priority": 3,
            "sourceType": "SHOPEE_MALL_OFFICIAL",
            "searchQuery": f"{brand_clean} Official Store {query_id}".strip(),
            "targetPlatform": "Shopee Mall Official Store (Thailand)",
            "purpose": "Retrieve supporting marketplace evidence with anti-bias scoring"
        })
        
    return plan

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    wq_path = os.path.join(root, "reports", "product_verification_work_queue.json")
    master_path = os.path.join(root, "data", "product-accessory-master.json")
    output_drafts_path = os.path.join(root, "data", "product-accessory-drafts.json")
    
    if not os.path.exists(wq_path):
        print(f"❌ Error: Work queue report not found at {wq_path}")
        sys.exit(1)
        
    with open(wq_path, "r", encoding="utf-8") as f:
        wq = json.load(f)
        
    with open(master_path, "r", encoding="utf-8") as f:
        master = json.load(f)
        
    master_pns = {p["inventoryIdentity"]["inventoryPn"]: p for p in master.get("products", []) if p.get("inventoryIdentity", {}).get("inventoryPn")}
    master_gtins = {p["inventoryIdentity"]["gtin"]: p for p in master.get("products", []) if p.get("inventoryIdentity", {}).get("gtin")}
    
    # Existing drafts if any
    existing_drafts = {}
    if os.path.exists(output_drafts_path):
        try:
            with open(output_drafts_path, "r", encoding="utf-8") as df:
                draft_data = json.load(df)
                existing_drafts = {d["inventoryPn"]: d for d in draft_data.get("drafts", [])}
        except Exception:
            pass
            
    # Process queue records in priority order
    queue_items = wq.get("queue", [])
    
    drafts_list = []
    drafts_by_status = {
        "DRAFT_CREATED": 0,
        "ERP_EXTRACTED": 0,
        "CLASSIFICATION_REVIEW_REQUIRED": 0,
        "EVIDENCE_COLLECTING": 0,
        "READY_TO_PUBLISH": 0,
        "HUMAN_REVIEW_REQUIRED": 0,
        "BLOCKED_CONFLICT": 0
    }
    
    created_count = 0
    skipped_master_count = 0
    
    for item in queue_items:
        pn = item.get("inventoryPn", "").strip()
        barcode = item.get("barcode")
        brand = item.get("brand", "").strip()
        desc = item.get("erpDescription", "").strip()
        cat = item.get("category", "").strip()
        c1 = item.get("cat1", "").strip()
        c2 = item.get("cat2", "").strip()
        c3 = item.get("cat3", "").strip()
        f1 = item.get("f1", 0)
        f2 = item.get("f2", 0)
        total = item.get("total", 0)
        
        # Step 1: Skip if item already has a verified/partial record in master
        if pn in master_pns or (barcode and barcode in master_gtins):
            skipped_master_count += 1
            continue
            
        # Step 1b: Skip carrier SIM or non-accessory categories
        if cat in ["SIM", "SmartPhone", "Tablet", "Watch", "Buds"]:
            continue
            
        # Step 2: Lock ERP Snapshot
        erp_snapshot = {
            "inventoryPn": pn,
            "barcode": barcode,
            "brand": brand,
            "description": desc,
            "cat1": c1,
            "cat2": c2,
            "cat3": c3,
            "category": cat,
            "f1": f1,
            "f2": f2,
            "total": total,
            "srp": float(item.get("srp", 0.0)),
            "erpPrice": float(item.get("srp", 0.0)),
            "snapshotLockedAt": datetime.now().isoformat()
        }
        
        # Step 3: Classification & Ambiguity Guard
        classification_status = item.get("classificationStatus", "CONFIRMED_FROM_ERP")
        product_type = item.get("productType")
        suggested_types = item.get("suggestedProductTypes", [])
        
        if classification_status == "REVIEW_REQUIRED" or product_type is None:
            draft_status = "CLASSIFICATION_REVIEW_REQUIRED"
            publication_status = "HOLD_REVIEW_REQUIRED"
            next_action = "CONFIRM_PRODUCT_TYPE"
            erp_attrs = {}
            required_fields = []
            search_plan = []
        else:
            # Step 4: Extract ERP attributes
            erp_attrs = extract_erp_attributes(desc, product_type)
            required_fields = TEMPLATE_REQUIRED_FIELDS.get(product_type, [])
            draft_status = "ERP_EXTRACTED"
            publication_status = "DRAFT"
            next_action = "SEARCH_MANUFACTURER"
            
            # Step 5: Build Search Plan
            search_plan = build_search_plan(brand, pn, barcode, None, product_type, desc)
            
        draft_id = f"DRAFT-{pn}"
        
        draft_record = {
            "draftId": draft_id,
            "inventoryPn": pn,
            "barcode": barcode,
            "brand": brand,
            "productType": product_type,
            "suggestedProductTypes": suggested_types,
            "classificationStatus": classification_status,
            "draftStatus": draft_status,
            "publicationStatus": publication_status,
            "erpSnapshot": erp_snapshot,
            "erpExtractedAttributes": erp_attrs,
            "requiredFields": required_fields,
            "searchPlan": search_plan,
            "candidateSources": [],
            "candidateFields": {},
            "conflictReports": [],
            "nextAction": next_action,
            "priority": item.get("priority", "P1"),
            "queueRank": item.get("queueRank"),
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat()
        }
        
        drafts_list.append(draft_record)
        drafts_by_status[draft_status] = drafts_by_status.get(draft_status, 0) + 1
        created_count += 1

    manifest = {
        "schemaVersion": "1.0.0",
        "generator": "scripts/build_auto_drafts.py",
        "generatedAt": datetime.now().isoformat(),
        "totalDrafts": len(drafts_list),
        "statusSummary": drafts_by_status,
        "skippedMasterRecords": skipped_master_count,
        "drafts": drafts_list
    }
    
    os.makedirs(os.path.dirname(output_drafts_path), exist_ok=True)
    with open(output_drafts_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        
    print("================================================================================")
    print("AUTO-DRAFT GENERATION COMPLETE")
    print("================================================================================")
    print(f"Total Drafts Generated           : {manifest['totalDrafts']}")
    print(f"ERP Extracted (Ready for Search) : {drafts_by_status.get('ERP_EXTRACTED', 0)}")
    print(f"Classification Review Required   : {drafts_by_status.get('CLASSIFICATION_REVIEW_REQUIRED', 0)}")
    print(f"Master Records Skipped (Existing): {skipped_master_count}")
    print("\nTop 5 Drafts Generated:")
    for i, d in enumerate(drafts_list[:5], 1):
        pt_display = d['productType'] or f"AMBIGUOUS({len(d['suggestedProductTypes'])})"
        print(f"  {i}. {d['draftId']:25} | {d['brand']:12} | {pt_display:18} | Status: {d['draftStatus']}")
    print("================================================================================")
    print(f"Saved auto-drafts artifact to: {output_drafts_path}")

if __name__ == "__main__":
    main()
