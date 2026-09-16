#!/usr/bin/env python3
import json
import os
import sys

sys.stdout.reconfigure(encoding="utf-8")

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dash_path = os.path.join(root, "reports", "sales_readiness_dashboard.json")
drafts_path = os.path.join(root, "data", "product-accessory-drafts.json")

with open(dash_path, "r", encoding="utf-8") as f:
    dash = json.load(f)

with open(drafts_path, "r", encoding="utf-8") as f:
    drafts = json.load(f).get("drafts", [])

drafts_by_pn = {d["inventoryPn"]: d for d in drafts}

top50 = dash.get("top50F1ReadinessBreakdown", [])
unready = [item for item in top50 if item.get("readinessStatus") == "HOLD_REVIEW"]

print(f"Total Top 50 items: {len(top50)}")
print(f"Total Unready in Top 50: {len(unready)}")
print("=" * 80)

for u in unready:
    pn = u["inventoryPn"]
    f1 = u["f1"]
    brand = u["brand"]
    name = u["name"]
    d = drafts_by_pn.get(pn, {})
    pt = d.get("productType")
    cls_st = d.get("classificationStatus")
    enriched = d.get("enrichedSalesFields", {})
    print(f"Rank {u['rank']:2d} | F1={f1:2d} | P/N: {pn:<18} | Brand: {brand:<12} | Pt: {str(pt):<16} | Cls: {str(cls_st):<18}")
    print(f"   Name: {name}")
    print(f"   Summary: {u['summary']}")
    if enriched:
        print(f"   Enriched fields: {list(enriched.keys())}")
    print("-" * 80)
