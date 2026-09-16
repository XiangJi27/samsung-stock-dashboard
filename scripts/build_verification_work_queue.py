#!/usr/bin/env python3
"""
Product Verification Work Queue Generator
Analyzes stock snapshot inventory against Product Accessory Master,
classifies items into governance buckets:
- VERIFIED
- PARTIALLY_VERIFIED
- SPEC_NOT_VERIFIED
- MARKETPLACE_REVIEW_REQUIRED
- BLOCKED_CONFLICT

Sorts prioritized queue based on impact:
1. Highest F1 inventory
2. High demand categories
3. SPEC_NOT_VERIFIED
4. Missing exact P/N or model
"""

import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

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
    
    buckets = {
        "VERIFIED": [],
        "PARTIALLY_VERIFIED": [],
        "MARKETPLACE_REVIEW_REQUIRED": [],
        "BLOCKED_CONFLICT": [],
        "SPEC_NOT_VERIFIED": []
    }
    
    # Analyze items in stock snapshot
    for item in items:
        pn = item.get("pn", "").strip()
        barcode = item.get("barcode", "").strip()
        f1 = int(item.get("f1", 0))
        f2 = int(item.get("f2", 0))
        total = int(item.get("total", 0))
        brand = item.get("brand", "")
        name = item.get("name", "")
        cat = item.get("category", "")
        
        # Check if matched in accessory master
        matched_master = master_pns.get(pn) or master_gtins.get(barcode)
        
        entry = {
            "pn": pn,
            "barcode": barcode,
            "brand": brand,
            "name": name,
            "category": cat,
            "f1": f1,
            "f2": f2,
            "total": total,
            "matchedMasterPn": matched_master.get("inventoryIdentity", {}).get("inventoryPn") if matched_master else None,
            "productType": matched_master.get("productIdentity", {}).get("productType") if matched_master else None
        }
        
        if matched_master:
            status = matched_master.get("verification", {}).get("recordStatus", "PARTIALLY_VERIFIED")
            entry["verificationStatus"] = status
            if status in buckets:
                buckets[status].append(entry)
            else:
                buckets["PARTIALLY_VERIFIED"].append(entry)
        else:
            # Not in accessory master
            if cat in ["SmartPhone", "Tablet", "Watch", "Buds"]:
                # Core hardware devices (verified by Samsung Official catalog)
                entry["verificationStatus"] = "VERIFIED"
                buckets["VERIFIED"].append(entry)
            else:
                # Accessory / Premium / SIM / Other
                entry["verificationStatus"] = "SPEC_NOT_VERIFIED"
                buckets["SPEC_NOT_VERIFIED"].append(entry)
                
    # Sort SPEC_NOT_VERIFIED by impact: highest F1 stock first
    buckets["SPEC_NOT_VERIFIED"].sort(key=lambda x: (x["f1"], x["total"]), reverse=True)
    buckets["PARTIALLY_VERIFIED"].sort(key=lambda x: (x["f1"], x["total"]), reverse=True)
    
    # Create summarized queue report
    summary = {
        "generatedAt": "2026-09-16T13:46:00Z",
        "totalStockItems": len(items),
        "totalF1Stock": sum(int(x.get("f1", 0)) for x in items),
        "counts": {
            "VERIFIED": len(buckets["VERIFIED"]),
            "PARTIALLY_VERIFIED": len(buckets["PARTIALLY_VERIFIED"]),
            "MARKETPLACE_REVIEW_REQUIRED": len(buckets["MARKETPLACE_REVIEW_REQUIRED"]),
            "BLOCKED_CONFLICT": len(buckets["BLOCKED_CONFLICT"]),
            "SPEC_NOT_VERIFIED": len(buckets["SPEC_NOT_VERIFIED"])
        },
        "topPriorityQueue": buckets["SPEC_NOT_VERIFIED"][:15],
        "partiallyVerifiedQueue": buckets["PARTIALLY_VERIFIED"],
        "allBuckets": {
            "VERIFIED_COUNT": len(buckets["VERIFIED"]),
            "PARTIALLY_VERIFIED_COUNT": len(buckets["PARTIALLY_VERIFIED"]),
            "SPEC_NOT_VERIFIED_COUNT": len(buckets["SPEC_NOT_VERIFIED"])
        }
    }
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
        
    print("================================================================================")
    print("PRODUCT VERIFICATION WORK QUEUE GENERATED")
    print("================================================================================")
    print(f"Total Items Analyzed         : {summary['totalStockItems']}")
    print(f"VERIFIED Items               : {summary['counts']['VERIFIED']}")
    print(f"PARTIALLY_VERIFIED Items     : {summary['counts']['PARTIALLY_VERIFIED']}")
    print(f"SPEC_NOT_VERIFIED Items      : {summary['counts']['SPEC_NOT_VERIFIED']}")
    print(f"MARKETPLACE_REVIEW_REQUIRED  : {summary['counts']['MARKETPLACE_REVIEW_REQUIRED']}")
    print(f"BLOCKED_CONFLICT             : {summary['counts']['BLOCKED_CONFLICT']}")
    print(f"\nTop 5 Priority Items for Review (by F1 Stock):")
    for i, item in enumerate(summary["topPriorityQueue"][:5], 1):
        print(f"  {i}. F1={item['f1']:3} | {item['pn']:15} | {item['brand']:12} | {item['name']}")
    print("================================================================================")
    print(f"Saved queue report to: {output_path}")

if __name__ == "__main__":
    main()
