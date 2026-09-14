import json

items = json.load(open('scratch/merged_stock1.json', encoding='utf-8'))
for it in items:
    cat = it.get('category')
    if cat == 'BUDS':
        it['category'] = 'Buds'
    elif cat == 'SMARTPHONE':
        it['category'] = 'SmartPhone'
    elif cat == 'TABLET':
        it['category'] = 'Tablet'
    elif cat == 'SMARTWATCH':
        it['category'] = 'Watch'
    elif cat == 'ACCESSORY':
        it['category'] = 'Accessory'
    elif cat == 'ADAPTER':
        it['category'] = 'Adapter'
    elif cat == 'PREMIUM':
        it['category'] = 'Premium'
    elif cat == 'SIM':
        it['category'] = 'SIM'
    else:
        it['category'] = 'Other'

lines = [
    '/**',
    ' * Samsung Branch Operations - Pilot Stock Snapshot',
    ' * Source: stock(1).xlsx (Sheet1: Floor 1 / f1, Sheet2: Floor 2 / f2)',
    f' * Total Products: {len(items)} | F1: 1701 | F2: 1635 | Grand Total: 3336',
    ' */',
    'window.LATEST_STOCK_SNAPSHOT = ' + json.dumps(items, ensure_ascii=False, indent=2) + ';',
    '',
    'window.STOCK_DATABASE = window.LATEST_STOCK_SNAPSHOT;',
    'window.STOCK_DATA = window.LATEST_STOCK_SNAPSHOT;',
    'window.STOCK_METADATA = {',
    '  stockBatchId: "STOCK-20260914-LATEST",',
    '  importBatchId: "STOCK-20260914-LATEST",',
    '  sourceType: "Manual Excel Snapshot",',
    '  sourceFilename: "stock(1).xlsx",',
    f'  recordCount: {len(items)},',
    f'  uniquePn: {len(items)},',
    '  f1Total: 1701,',
    '  f2Total: 1635,',
    '  grandTotal: 3336',
    '};',
    ''
]

with open('assets/js/pilot-stock-snapshot.js', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f"Successfully generated assets/js/pilot-stock-snapshot.js with {len(items)} items")
