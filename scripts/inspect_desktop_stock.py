# -*- coding: utf-8 -*-
import openpyxl
import sys
import json

sys.stdout.reconfigure(encoding='utf-8')

file_path = r'C:\Users\JarNJay\Desktop\Stock.xlsx'
wb = openpyxl.load_workbook(file_path, data_only=True)

sheet1 = wb['Sheet1']
sheet2 = wb['Sheet2']

def extract_items(sheet):
    items = {}
    for r_idx, row in enumerate(sheet.iter_rows(min_row=5, values_only=True), start=5):
        if not any(row):
            continue
        cat1 = row[0]
        cat2 = row[1]
        cat3 = row[2]
        brand = row[3]
        price99 = row[4]
        pn = str(row[5]).strip() if row[5] is not None else None
        koan = row[6]
        apple = row[7]
        desc = str(row[8]).strip() if row[8] is not None else ""
        on_hand = row[9]
        on_br = row[10]
        on_alloc = row[11]
        on_tf = row[12]

        if not pn:
            continue

        try:
            qty = int(on_hand) if on_hand is not None else 0
        except Exception:
            qty = 0

        items[pn] = {
            "pn": pn,
            "cat1": cat1,
            "cat2": cat2,
            "cat3": cat3,
            "brand": brand,
            "price99": price99,
            "koanSku": koan,
            "applePart": apple,
            "description": desc,
            "onHand": qty,
            "onBR": on_br or 0,
            "onAlloc": on_alloc or 0,
            "onTF": on_tf or 0
        }
    return items

s1_items = extract_items(sheet1)
s2_items = extract_items(sheet2)

all_pns = sorted(set(s1_items.keys()) | set(s2_items.keys()))
both_pns = set(s1_items.keys()) & set(s2_items.keys())
s1_only = set(s1_items.keys()) - set(s2_items.keys())
s2_only = set(s2_items.keys()) - set(s1_items.keys())

print(f"Total Unique P/Ns across both sheets: {len(all_pns)}")
print(f"P/Ns in both Sheet1 & Sheet2: {len(both_pns)}")
print(f"P/Ns in Sheet1 only: {len(s1_only)}")
print(f"P/Ns in Sheet2 only: {len(s2_only)}")

# Categories & Brands
brands = set()
cats = set()
total_f1 = 0
total_f2 = 0
total_stock = 0

price_diffs = []

joined_inventory = []
for pn in all_pns:
    i1 = s1_items.get(pn)
    i2 = s2_items.get(pn)

    f1 = i1["onHand"] if i1 else 0
    f2 = i2["onHand"] if i2 else 0
    tot = f1 + f2

    total_f1 += f1
    total_f2 += f2
    total_stock += tot

    base = i1 if i1 else i2
    brand = base.get("brand") or "UNKNOWN"
    cat1 = base.get("cat1") or ""
    cat2 = base.get("cat2") or ""
    desc = base.get("description") or ""
    p99_1 = i1.get("price99") if i1 else None
    p99_2 = i2.get("price99") if i2 else None

    if p99_1 is not None and p99_2 is not None and p99_1 != p99_2:
        price_diffs.append((pn, desc, p99_1, p99_2))

    brands.add(brand)
    cats.add(cat1)

    joined_inventory.append({
        "pn": pn,
        "description": desc,
        "category": cat1,
        "subCategory": cat2,
        "brand": brand,
        "price99": p99_1 if p99_1 is not None else p99_2,
        "f1": f1,
        "f2": f2,
        "total": tot
    })

print(f"\nTotal F1 Stock: {total_f1}")
print(f"Total F2 Stock: {total_f2}")
print(f"Grand Total Stock: {total_stock}")
print(f"Brands: {sorted(brands)}")
print(f"Categories (Cat1): {sorted(cats)}")
print(f"Price 99 discrepancies between Sheet1 & Sheet2: {len(price_diffs)}")
for pd in price_diffs[:5]:
    print("  ", pd)

# Check Samsung Smartphones & A07 specifically
print("\n--- Samsung Galaxy A07 Cases in Joined Inventory ---")
for it in joined_inventory:
    if "A07" in it["description"] or "A07" in it["pn"]:
        print(f"  P/N: {it['pn']:15} | Desc: {it['description']:35} | Price99: {it['price99']:6} | F1: {it['f1']:2} | F2: {it['f2']:2} | Total: {it['total']:2}")
