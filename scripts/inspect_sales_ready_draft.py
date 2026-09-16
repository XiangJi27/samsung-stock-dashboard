#!/usr/bin/env python3
import json, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('data/product-accessory-drafts.json', encoding='utf-8') as f:
    drafts = json.load(f)
items = drafts.get('drafts', [])

with open('data/product-accessory-master.json', encoding='utf-8') as f:
    master = json.load(f)
master_pns = {p['inventoryIdentity']['inventoryPn'] for p in master.get('products', [])}

# Show first SALES_READY draft NOT yet in master
for d in items:
    if d.get('draftStatus') == 'SALES_READY' and d.get('inventoryPn') not in master_pns:
        print(json.dumps(d, ensure_ascii=False, indent=2))
        break
