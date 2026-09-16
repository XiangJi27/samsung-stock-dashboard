#!/usr/bin/env python3
"""
Patch existing published records in product-accessory-master.json that are missing
the 'sources' array. Adds SRC-ERP-STOCK source to all records that lack it.
"""
import json, os, sys
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER_PATH = os.path.join(ROOT, 'data', 'product-accessory-master.json')

with open(MASTER_PATH, encoding='utf-8') as f:
    master = json.load(f)

products = master.get('products', [])
today = datetime.now().strftime('%Y-%m-%d')
patched = 0

for p in products:
    # Skip records that already have a sources list with at least one entry
    sources = p.get('sources')
    if sources and isinstance(sources, list) and len(sources) > 0:
        continue

    # Check if any spec field uses SRC-ERP-STOCK
    specs = p.get('specifications', {})
    needs_erp_source = any(
        isinstance(v, dict) and v.get('sourceId') == 'SRC-ERP-STOCK'
        for v in specs.values()
    )
    if not needs_erp_source and sources:
        continue

    p['sources'] = [
        {
            'sourceId': 'SRC-ERP-STOCK',
            'sourceType': 'ERP_STOCK_MASTER',
            'publisher': 'Internal Inventory System',
            'url': None,
            'checkedAt': today,
            'status': 'ACTIVE'
        }
    ]
    patched += 1

print(f"Patched {patched} records with missing SRC-ERP-STOCK source entry.")
print(f"Total master records: {len(products)}")

tmp = MASTER_PATH + '.tmp'
with open(tmp, 'w', encoding='utf-8') as f:
    json.dump(master, f, ensure_ascii=False, indent=2)
os.replace(tmp, MASTER_PATH)
print("✅ master.json written atomically.")

# Re-inject into product_specs_data.js
import subprocess
inject = os.path.join(ROOT, 'tools', 'ops', 'inject_accessory_master.py')
if os.path.exists(inject):
    res = subprocess.run([sys.executable, inject], capture_output=True, text=True, encoding='utf-8')
    if res.returncode == 0:
        print("✅ Injected updated Master into product_specs_data.js")
    else:
        print(f"⚠️  Inject error: {res.stderr[:200]}")
