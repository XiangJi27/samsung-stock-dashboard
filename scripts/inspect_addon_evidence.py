# -*- coding: utf-8 -*-
"""
Read-Only Trace and Evidence Gathering for ADD_ON_PURCHASE and PRICE_EQUATION_MISMATCH
Adheres strictly to RULE-0: REPORT PROVENANCE CHECK.
Gathers:
1. Source SHA-256 hashes of input Excel files
2. Commit SHA, Batch ID, Evaluation Date
3. Exact cell locations, formulas, values for all 13 TAB-R*-ADDON-KEYBOARD rows
4. Root cause breakdown of all PRICE_EQUATION_MISMATCH events
5. Validation of the 75 SOURCE_FORMULA_ERROR records
"""

import sys, os, json, hashlib, openpyxl, subprocess

sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# 1. Git provenance
def get_git_commit():
    try:
        out = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT_DIR).decode('utf-8').strip()
        return out
    except Exception as e:
        return f"UNKNOWN ({e})"

def sha256_file(filepath):
    if not os.path.exists(filepath):
        return None
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

commit_sha = get_git_commit()
promo_tab_path = os.path.join(ROOT_DIR, 'Pro Tablet Acc samsung 3Aug2026.xlsx')
retail_path = os.path.join(ROOT_DIR, 'Aug_ 2026 Promotion Retail_Shop Samsung .xlsx')
stock_path = os.path.join(ROOT_DIR, 'Stock.xlsx')

tab_hash = sha256_file(promo_tab_path)
retail_hash = sha256_file(retail_path)
stock_hash = sha256_file(stock_path)

print(f"Git Commit SHA: {commit_sha}")
print(f"Pro Tablet Acc SHA-256: {tab_hash}")
print(f"Retail Shop SHA-256: {retail_hash}")
print(f"Stock.xlsx SHA-256: {stock_hash}")

# Load variants
variants_path = os.path.join(ROOT_DIR, 'promotion_variants.json')
with open(variants_path, 'r', encoding='utf-8') as f:
    variants = json.load(f)

# Inspect PRICE_EQUATION_MISMATCH
mismatch = [v for v in variants if 'PRICE_EQUATION_MISMATCH' in v.get('validationErrors', [])]
print(f"\nTotal PRICE_EQUATION_MISMATCH variants: {len(mismatch)}")

by_sale_mode = {}
for v in mismatch:
    sm = v.get('saleMode', 'UNKNOWN')
    by_sale_mode[sm] = by_sale_mode.get(sm, 0) + 1
print("PRICE_EQUATION_MISMATCH by saleMode:", by_sale_mode)

addon_mismatch = [v for v in mismatch if v.get('saleMode') == 'ADD_ON_PURCHASE']
print(f"\nADD_ON_PURCHASE mismatch count: {len(addon_mismatch)}")

# Inspect cell coordinates for ADD_ON_PURCHASE
wb = openpyxl.load_workbook(promo_tab_path, data_only=False) # Get formulas if any
wb_val = openpyxl.load_workbook(promo_tab_path, data_only=True) # Get evaluated values
ws_formula = wb['โปร และ เงื่อนไขการตัดขาย']
ws_val = wb_val['โปร และ เงื่อนไขการตัดขาย']

merged_map = {}
for rng in ws_val.merged_cells.ranges:
    min_col, min_row, max_col, max_row = rng.bounds
    tl_val = ws_val.cell(min_row, min_col).value
    tl_form = ws_formula.cell(min_row, min_col).value
    for r in range(min_row, max_row + 1):
        for c in range(min_col, max_col + 1):
            merged_map[(r, c)] = (tl_val, tl_form, str(rng))

def get_cell_detail(r, c):
    if (r, c) in merged_map:
        val, form, rng_str = merged_map[(r, c)]
        return val, form, rng_str
    val = ws_val.cell(r, c).value
    form = ws_formula.cell(r, c).value
    col_let = openpyxl.utils.get_column_letter(c)
    return val, form, f"{col_let}{r}"

addon_evidence = []
for v in addon_mismatch:
    r = v.get('sourceRow')
    # Cols: D=4 (RRP), E=5 (SS), F=6 (CPW), G=7 (Net Price), I=9 (Device Coupon), J=10 (Remarks/Addon), K=11 (Addon Coupon)
    rrp_v, rrp_f, rrp_ref = get_cell_detail(r, 4)
    ss_v, ss_f, ss_ref = get_cell_detail(r, 5)
    cpw_v, cpw_f, cpw_ref = get_cell_detail(r, 6)
    net_v, net_f, net_ref = get_cell_detail(r, 7)
    coup_v, coup_f, coup_ref = get_cell_detail(r, 9)
    rem_v, rem_f, rem_ref = get_cell_detail(r, 10)
    addcoup_v, addcoup_f, addcoup_ref = get_cell_detail(r, 11)
    
    ss_num = float(ss_v or 0)
    cpw_num = float(cpw_v or 0)
    total_disc_cell = ss_num + cpw_num

    item_evidence = {
        "promoId": v.get('promoId'),
        "sourceRow": r,
        "model": v.get('model'),
        "capacity": v.get('capacity'),
        "saleMode": v.get('saleMode'),
        "sourceFile": v.get('sourceFile'),
        "sourceSheet": v.get('sourceSheet'),
        "rrp": {
            "cell": f"D{r}",
            "value": rrp_v,
            "formula": rrp_f
        },
        "ssDiscount": {
            "cell": f"E{r}",
            "value": ss_v,
            "formula": ss_f
        },
        "cpwDiscount": {
            "cell": f"F{r}",
            "value": cpw_v,
            "formula": cpw_f
        },
        "totalDiscountFromCells": total_disc_cell,
        "netPrice": {
            "cell": f"G{r}",
            "value": net_v,
            "formula": net_f
        },
        "remarksAddOn": {
            "cell": rem_ref,
            "value": rem_v
        },
        "addonCoupon": {
            "cell": addcoup_ref,
            "value": addcoup_v
        },
        "rawParserRecord": {
            "rrp": v.get('rrp'),
            "netPrice": v.get('netPrice'),
            "discountValue": v.get('discountValue'),
            "standardDiscount": v.get('standardDiscount'),
            "addOnDiscount": v.get('addOnDiscount'),
            "sourceColumnMapping": v.get('sourceColumnMapping'),
            "headerPaths": v.get('headerPaths')
        },
        "validation": {
            "status": v.get('validationStatus'),
            "errors": v.get('validationErrors'),
            "equationCheck": f"RRP ({v.get('rrp')}) - discountValue ({v.get('discountValue')}) = {v.get('rrp', 0) - v.get('discountValue', 0)} != NetPrice ({v.get('netPrice')})"
        },
        "rootCause": "PARSER_ADDON_DISCOUNT_MAPPING_MISSING",
        "rootCauseExplanation": f"Excel sheet row {r} has RRP={rrp_v} in D{r} and discount of {total_disc_cell} (SS={ss_v} in E{r} + CPW={cpw_v} in F{r}) resulting in Net Price {net_v} in G{r}. The parser set discountValue=0, standardDiscount=0, and addOnDiscount=None for saleMode ADD_ON_PURCHASE instead of mapping the add-on discount, causing RRP - 0 != NetPrice."
    }
    addon_evidence.append(item_evidence)

print(f"\nGenerated evidence for {len(addon_evidence)} ADD_ON_PURCHASE variants.")

# Also inspect non-addon mismatch variants
non_addon_mismatch = [v for v in mismatch if v.get('saleMode') != 'ADD_ON_PURCHASE']
print(f"\nNon-addon mismatch variants count: {len(non_addon_mismatch)}")
for v in non_addon_mismatch:
    print(f"  {v.get('promoId')}: {v.get('model')} | Sheet: {v.get('sourceSheet')} | Row: {v.get('sourceRow')} | Mode: {v.get('saleMode')} | RRP: {v.get('rrp')}, Disc: {v.get('discountValue')}, Net: {v.get('netPrice')}")

# Inspect 75 SOURCE_FORMULA_ERROR variants
formula_err_vars = [v for v in variants if 'SOURCE_FORMULA_ERROR' in v.get('validationErrors', [])]
print(f"\nTotal SOURCE_FORMULA_ERROR variants: {len(formula_err_vars)}")
print(f"Rows range: min={min(v.get('sourceRow') for v in formula_err_vars)}, max={max(v.get('sourceRow') for v in formula_err_vars)}")
print(f"All blocked?: {all('BLOCKED' in v.get('validationStatus', '') for v in formula_err_vars)}")
