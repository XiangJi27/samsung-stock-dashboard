#!/usr/bin/env python3
"""
Audit Top 50 F1 Items against Master, Official Hardware, and ERP Safe
"""
import json
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    snapshot_path = os.path.join(root, "assets", "js", "pilot-stock-snapshot.js")
    master_path = os.path.join(root, "data", "product-accessory-master.json")

    with open(snapshot_path, "r", encoding="utf-8") as f:
        content = f.read()
    items = json.loads(content.split("window.LATEST_STOCK_SNAPSHOT =")[1].split("];")[0].strip() + "]")

    with open(master_path, "r", encoding="utf-8") as f:
        master = json.load(f)
    master_pns = {p["inventoryIdentity"]["inventoryPn"]: p for p in master.get("products", [])}

    # F1 items sorted descending
    f1_items = [x for x in items if int(x.get("f1", 0)) > 0]
    f1_items.sort(key=lambda x: (int(x.get("f1", 0)), int(x.get("total", 0))), reverse=True)
    top50 = f1_items[:50]

    official_hardware_cats = {"SmartPhone", "Tablet", "Watch", "Buds"}

    print("=== TOP 50 F1 ITEMS BREAKDOWN ===")
    sales_ready = []
    erp_only_safe = []
    review_required = []

    for idx, item in enumerate(top50, 1):
        pn = item.get("pn")
        cat = item.get("category")
        brand = item.get("brand")
        model = item.get("model")
        f1 = int(item.get("f1", 0))

        if cat in official_hardware_cats:
            sales_ready.append((idx, pn, f1, brand, model, "OFFICIAL_HARDWARE_SPEC"))
        elif pn in master_pns:
            m_rec = master_pns[pn]
            st = m_rec.get("verification", {}).get("recordStatus", "VERIFIED")
            ptype = m_rec.get("productIdentity", {}).get("productType")
            sales_ready.append((idx, pn, f1, brand, model, f"MASTER_{st}_{ptype}"))
        else:
            # Check if clean ERP data exists
            if item.get("description") and item.get("srp"):
                erp_only_safe.append((idx, pn, f1, brand, model, "ERP_ONLY_SAFE"))
            else:
                review_required.append((idx, pn, f1, brand, model, "REVIEW_REQUIRED"))

    print(f"\n1. SALES_READY: {len(sales_ready)} items")
    for r in sales_ready:
        print(f"  #{r[0]:02d} | F1: {r[2]:2d} | {r[1]:20s} | {r[3]:12s} | {r[5]} | {r[4]}")

    print(f"\n2. ERP_ONLY_SAFE (Clean ERP data, no unproven claims): {len(erp_only_safe)} items")
    for r in erp_only_safe:
        print(f"  #{r[0]:02d} | F1: {r[2]:2d} | {r[1]:20s} | {r[3]:12s} | {r[5]} | {r[4]}")

    print(f"\n3. REVIEW_REQUIRED: {len(review_required)} items")
    for r in review_required:
        print(f"  #{r[0]:02d} | F1: {r[2]:2d} | {r[1]:20s} | {r[3]:12s} | {r[5]} | {r[4]}")

    print(f"\nSummary:")
    print(f"  Sales-Ready: {len(sales_ready)}/50")
    print(f"  ERP-Only Safe: {len(erp_only_safe)}/50")
    print(f"  Safe-to-Use Total: {len(sales_ready) + len(erp_only_safe)}/50")

if __name__ == "__main__":
    main()
