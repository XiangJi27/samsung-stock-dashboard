#!/usr/bin/env python3
"""
Inspect Published Batches & Top 50 Field Evidence
"""
import json
import sys
import os

sys.stdout.reconfigure(encoding="utf-8")

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    master_path = os.path.join(root, "data", "product-accessory-master.json")
    snapshot_path = os.path.join(root, "assets", "js", "pilot-stock-snapshot.js")

    with open(master_path, "r", encoding="utf-8") as f:
        master = json.load(f)
    products = master.get("products", [])

    with open(snapshot_path, "r", encoding="utf-8") as f:
        content = f.read()
    arr_str = content.split("window.LATEST_STOCK_SNAPSHOT =")[1].split("];")[0].strip() + "]"
    stock = json.loads(arr_str)

    batch_pns = [
        "6941876265732", "EP-T6010NBEGTH", "EP-T4511NBEGTH",
        "SSG-EP-DN975BWEGWW", "6941876265749", "4710343478164",
        "PREMIUM0017044", "PM4897121009793", "PREMIUM0017046", "PM-8806090284687"
    ]

    print(f"Total products in Master: {len(products)}")
    for p in products:
        pn = p.get("inventoryIdentity", {}).get("inventoryPn")
        if pn in batch_pns:
            rec_id = p.get("recordId")
            desc = p.get("inventoryIdentity", {}).get("erpDescription")
            ptype = p.get("productIdentity", {}).get("productType")
            print(f"\n[{pn}] {rec_id} ({ptype})")
            print(f"  ERP: {desc}")
            sources = {s["sourceId"]: s.get("url") for s in p.get("sources", [])}
            print(f"  Sources: {sources}")
            specs = p.get("specifications", {})
            for k, spec in specs.items():
                val = spec.get("value")
                st = spec.get("status")
                sid = spec.get("sourceId")
                print(f"    - {k}: {val} [{st}] (source: {sid})")

if __name__ == "__main__":
    main()
