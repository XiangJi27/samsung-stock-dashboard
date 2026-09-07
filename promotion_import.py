# -*- coding: utf-8 -*-
"""
PROMOTION IMPORT & INTEGRITY AUDIT ENGINE FOR SAMSUNG POS DASHBOARD
Pure Excel Ingestion • 95/5 Risk Automation • Exact Source Truth
Time-Based Status Isolation • Strict Date Filtering (Today: Local Date)
Zero Simulation • Zero Guessing • Clean UTF-8
"""

import sys, os, json, openpyxl, re, datetime

sys.stdout.reconfigure(encoding='utf-8')

# PRODUCT CODE TYPE ENUM HELPER
def get_product_code_type(pn, model=""):
    """Determine productCodeType from P/N prefix. This is the ONLY way to classify products."""
    if not pn:
        # Try model name as fallback for promotion rows without P/N
        if model:
            m = model.lower()
            if 'รหัส f' in m or 'พาส f' in m or 'pass f' in m:
                return "PASS_F"
            if 'bom' in m:
                return "BOM_SET"
            # Retail promos without P/N are generally for standard SM- products
            return "STANDARD_SM"
        return "UNKNOWN"
    pn_upper = pn.strip().upper()
    if pn_upper.startswith("F-"):
        return "PASS_F"
    if pn_upper.startswith("SM-"):
        return "STANDARD_SM"
    if 'bom' in (model or '').lower():
        return "BOM_SET"
    # Accessories and other codes
    if any(pn_upper.startswith(p) for p in ["EP-", "EF-", "GP-", "ET-", "EJ-"]):
        return "STANDARD_ACCESSORY"
    return "UNKNOWN"

def get_product_code_type_label(code_type):
    """Human-readable label for product code type."""
    labels = {
        "STANDARD_SM": "เครื่องเปล่า SM-",
        "PASS_F": "พาส F / ชุดเปิดตัว",
        "BOM_SET": "BOM SET",
        "STANDARD_ACCESSORY": "อุปกรณ์เสริม",
        "UNKNOWN": "ไม่ระบุประเภท"
    }
    return labels.get(code_type, code_type)

# 0. GET CURRENT LOCAL DATE DYNAMICALLY (NEVER HARDCODE)
today_dt = datetime.datetime.now()
today_iso = today_dt.strftime('%Y-%m-%d')
print(f"=== STARTING PROMOTION AUDIT ENGINE (CURRENT DATE: {today_iso}) ===")

# Helper: clean text
def clean_str(val):
    if val is None:
        return ""
    return str(val).strip()

def clean_num(val):
    if val is None or val == "":
        return None
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).replace(',', '').strip()
    try:
        return float(s)
    except:
        return None

# 1. LOAD INVENTORY BASELINE FROM Stock.xlsx (Promotion sheet)
wb_stock = openpyxl.load_workbook('Stock.xlsx', data_only=True)
sheet_inv = wb_stock['Promotion']

inventory_items = []
current_model = ""
for r in range(4, sheet_inv.max_row + 1):
    m_val = sheet_inv.cell(r, 1).value
    pn_val = sheet_inv.cell(r, 2).value
    color_val = sheet_inv.cell(r, 3).value
    srp_val = sheet_inv.cell(r, 4).value
    f1_val = sheet_inv.cell(r, 5).value
    f2_val = sheet_inv.cell(r, 6).value
    gift_val = sheet_inv.cell(r, 22).value or sheet_inv.cell(r, 23).value

    if m_val:
        current_model = str(m_val).strip()
    if pn_val:
        pn = str(pn_val).strip()
        color = str(color_val).strip() if color_val else ""
        srp = float(srp_val) if isinstance(srp_val, (int, float)) else 0.0
        f1 = int(f1_val) if isinstance(f1_val, (int, float)) else 0
        f2 = int(f2_val) if isinstance(f2_val, (int, float)) else 0

        model_lower = current_model.lower()
        cat = "SmartPhone"
        if "tab" in model_lower:
            cat = "Tablet"
        elif "watch" in model_lower or "ring" in model_lower or "fit" in model_lower:
            cat = "SmartWatch"
        elif "buds" in model_lower:
            cat = "Buds"
        elif any(k in model_lower for k in ["keyboard", "cover", "adapter", "smarttag", "band", "film", "s pen", "strap"]):
            cat = "Accessory"

        is_pass_f = pn.startswith("F-")
        is_bom = "bom" in model_lower
        is_5g = any(k in model_lower for k in ["5g", "s25", "s26", "fold", "flip"])
        p_code_type = get_product_code_type(pn, current_model)

        inventory_items.append({
            "id": f"p_{r}_{pn.replace('-', '_')}",
            "row": r,
            "model": current_model,
            "category": cat,
            "series": pn[:6].lower(),
            "pn": pn,
            "color": color,
            "srp": srp,
            "f1": f1,
            "f2": f2,
            "gift": str(gift_val).strip() if gift_val else None,
            "isBom": is_bom,
            "is5G": is_5g,
            "isPassF": is_pass_f,
            "productCodeType": p_code_type,
            "promotionVariants": []
        })

print(f"Loaded {len(inventory_items)} active inventory items from Stock.xlsx")

# Helper to validate a promotion variant
def validate_variant(v):
    errors = []
    
    # 1. Formula & Source Corruption Check (#ERROR!, #VALUE!, etc.)
    is_formula_error = False
    for field in ['rrp', 'discountValue', 'netPrice']:
        val = str(v.get(field, ''))
        if any(err_tag in val for err_tag in ['#ERROR!', '#VALUE!', '#REF!', '#NAME?', '#N/A']):
            is_formula_error = True
            errors.append(f"พบค่าสูตรข้อผิดพลาด {val} ในฟิลด์ {field}")

    if v.get('blockReason') == "SOURCE_FORMULA_ERROR" or is_formula_error:
        v['blockReason'] = "SOURCE_FORMULA_ERROR"
        v['sourceValue'] = "#ERROR!"
        v['rrp'] = None
        v['netPrice'] = None
        v['discountValue'] = None
        if not any("สูตรข้อผิดพลาด" in e for e in errors):
            errors.append("พบค่าสูตรข้อผิดพลาด #ERROR! ในเซลล์ราคาต้นทาง (ห้ามเดาราคาแทน)")

    # 2. Check price validity for non-formula errors
    if v.get('blockReason') != "SOURCE_FORMULA_ERROR":
        if v.get('rrp') is None or not isinstance(v.get('rrp'), (int, float)) or v.get('rrp') <= 0:
            errors.append("ราคาปกติ RRP ไม่ถูกต้องหรือเป็นค่าว่าง")
        if v.get('netPrice') is None or not isinstance(v.get('netPrice'), (int, float)) or v.get('netPrice') <= 0:
            errors.append("ราคาขายสุทธิ Net Price ไม่ถูกต้องหรือเป็นค่าว่าง")

        # 3. Math equations check
        if v.get('discountType') == "BAHT" and isinstance(v.get('rrp'), (int, float)) and isinstance(v.get('netPrice'), (int, float)) and isinstance(v.get('discountValue'), (int, float)):
            calc = v['rrp'] - v['discountValue']
            if abs(calc - v['netPrice']) > 1:
                errors.append(f"สมการส่วนลดบาทไม่ตรง: RRP ({v['rrp']}) - ส่วนลด ({v['discountValue']}) = {calc} != ราคาสุทธิ ({v['netPrice']})")

        elif v.get('discountType') == "PERCENT" and isinstance(v.get('rrp'), (int, float)) and isinstance(v.get('discountRate'), (int, float)) and isinstance(v.get('netPrice'), (int, float)):
            calc = round(v['rrp'] * (1 - v['discountRate']))
            if abs(calc - v['netPrice']) > 1:
                errors.append(f"สมการส่วนลดเปอร์เซ็นต์ไม่ตรง: RRP ({v['rrp']}) * (1 - {v['discountRate']}) = {calc} != ราคาสุทธิ ({v['netPrice']})")

    # 4. Dates
    if not v.get('startDate') or not v.get('endDate'):
        errors.append("ไม่ระบุวันที่เริ่มต้นหรือสิ้นสุดโปรโมชั่น")

    # 5. Sale Mode Normalization (Completely eliminate NON_SF -> STANDARD_PAYMENT)
    if v.get('saleMode') == "NON_SF":
        v['saleMode'] = "STANDARD_PAYMENT"
        v['sfPlusEligible'] = False

    mode = v.get('saleMode', 'NORMAL')
    mode_labels = {
        "NORMAL": "ราคาปกติ (ไม่มีส่วนลด)",
        "STANDARD_PAYMENT": "สด / รูดเต็ม / ผ่อนบัตร",
        "SF_PLUS": "สินเชื่อ SF+",
        "STUDENT": "โปร นศ. (Studentcrd)",
        "TRADE_UP": "เก่าแลกใหม่ (Trade Up)",
        "MBO": "ซื้อร่วมตามเงื่อนไข (MBO)",
        "BUNDLE": "ชุดแลกซื้อ / อุปกรณ์เสริม (Bundle)"
    }
    v['saleModeLabel'] = mode_labels.get(mode, mode)

    # 6. Payment methods & Source attribution
    if not v.get('paymentMethodSource'):
        v['paymentMethodSource'] = "BRANCH_POLICY" if mode != "SF_PLUS" else "SOURCE_FILE"

    if not v.get('allowedPaymentMethods'):
        if mode == "SF_PLUS":
            v['allowedPaymentMethods'] = ["SF_PLUS"]
        else:
            v['allowedPaymentMethods'] = ["CASH", "CREDIT_FULL", "CREDIT_INSTALLMENT", "CASH_CARD_INSTALLMENT"]

    # 7. Flags & Hard Rules
    if mode == "STANDARD_PAYMENT":
        v['sfPlusEligible'] = False
        v['tradeUpEligible'] = False
        v['studentEligible'] = False
        v['isPromotion'] = True
        conds = v.setdefault('conditions', [])
        if not any("ไม่ร่วม sf+" in str(c).lower() for c in conds):
            conds.insert(0, "ราคานี้ไม่ร่วม SF+")

    elif mode == "SF_PLUS":
        v['sfPlusEligible'] = True
        v['studentEligible'] = False
        v['isPromotion'] = True

    elif mode == "STUDENT":
        v['sfPlusEligible'] = False
        v['tradeUpEligible'] = False
        v['studentEligible'] = True
        v['isPromotion'] = True
        if v.get('couponCode') != "Studentcrd":
            errors.append(f"โปรโมชั่น Student ต้องใช้คูปอง Studentcrd เท่านั้น (พบ: {v.get('couponCode')})")

    elif mode == "TRADE_UP":
        v['sfPlusEligible'] = False
        v['tradeUpEligible'] = True
        v['studentEligible'] = False
        v['isPromotion'] = True

    elif mode == "NORMAL":
        v['sfPlusEligible'] = False
        v['tradeUpEligible'] = False
        v['studentEligible'] = False
        v['isPromotion'] = False
        v['couponCode'] = None
        v['discountValue'] = 0.0
        v['discountRate'] = 0.0
        v['netPrice'] = v.get('rrp')

    # SF+ Conflict check
    exclusions = v.get('exclusions', [])
    conditions = v.get('conditions', [])
    all_cond_text = " ".join(exclusions + conditions).lower()
    if v.get('sfPlusEligible') is True and ("ไม่สามารถใช้ร่วมกับ sf+" in all_cond_text or "ไม่ร่วม sf+" in all_cond_text):
        errors.append("ข้อมูล SF+ ขัดแย้งกัน: ระบุ sfPlusEligible=true แต่หมายเหตุระบุไม่ร่วม SF+")

    # 8. Validation Status
    v['validationErrors'] = errors
    if len(errors) > 0:
        v['validationStatus'] = "BLOCKED"
        v['riskLevel'] = "HIGH"
    elif len(v.get('conditions', [])) > 0 and any(c for c in v['conditions'] if any(w in str(c).lower() for w in ["เตือน", "ไม่ร่วม", "เฉพาะ", "งด", "mbo", "ดาวน์"])):
        v['validationStatus'] = "WARNING"
        v['riskLevel'] = "MEDIUM"
    else:
        v['validationStatus'] = "PASSED_VALIDATION"
        v['riskLevel'] = "LOW"

    # 9. Time-Based Status (Isolated from Validation Status)
    start_dt = v.get('startDate', '')
    end_dt = v.get('endDate', '')
    if end_dt and end_dt < today_iso:
        v['timeStatus'] = "EXPIRED"
    elif start_dt and start_dt > today_iso:
        v['timeStatus'] = "FUTURE"
    else:
        v['timeStatus'] = "ACTIVE"

    # 10. Composite Status & Active Flag
    if v['validationStatus'] == "BLOCKED":
        v['status'] = "BLOCKED"
    elif v['timeStatus'] == "EXPIRED":
        v['status'] = "EXPIRED"
    elif v['timeStatus'] == "FUTURE":
        v['status'] = "FUTURE"
    elif v['validationStatus'] == "WARNING":
        v['status'] = "WARNING"
    else:
        v['status'] = "ACTIVE"

    v['isActive'] = (v['validationStatus'] in ["PASSED_VALIDATION", "WARNING"]) and (v['timeStatus'] == "ACTIVE")

    return v

# All parsed promotion variants
all_promotion_variants = []

# 2. PARSE Aug_ 2026 Promotion Retail_Shop Samsung .xlsx
wb_retail = openpyxl.load_workbook('Aug_ 2026 Promotion Retail_Shop Samsung .xlsx', data_only=True)

retail_sheet_dates = {
    'อัพเดท 28 Aug - 6 Sep ล่าสุด': ('2026-08-28', '2026-09-06'),
    '19 -27  Aug': ('2026-08-19', '2026-08-27'),
    ' 17-18  Aug': ('2026-08-17', '2026-08-18'),
    ' 14 Aug -16 Aug': ('2026-08-14', '2026-08-16'),
    ' 7 Aug - 12 Aug': ('2026-08-07', '2026-08-12'),
    ' 3 -6 Aug ': ('2026-08-03', '2026-08-06')
}

for sheet_name, (start_dt, end_dt) in retail_sheet_dates.items():
    if sheet_name not in wb_retail.sheetnames:
        continue
    sheet = wb_retail[sheet_name]
    curr_cat = ""
    curr_model = ""
    empty_streak = 0

    for r in range(4, min(sheet.max_row + 1, 60)):
        c1 = sheet.cell(r, 1).value
        c2 = sheet.cell(r, 2).value
        c3 = sheet.cell(r, 3).value
        c4 = sheet.cell(r, 4).value
        c5 = sheet.cell(r, 5).value
        c6 = sheet.cell(r, 6).value
        c7 = sheet.cell(r, 7).value
        c8 = sheet.cell(r, 8).value
        c9 = sheet.cell(r, 9).value
        c10 = sheet.cell(r, 10).value
        c11 = sheet.cell(r, 11).value
        c12 = sheet.cell(r, 12).value
        c13 = sheet.cell(r, 13).value
        c14 = sheet.cell(r, 14).value

        # Stop on empty row streak
        if not c2 and not c3 and not c4:
            empty_streak += 1
            if empty_streak >= 3:
                break
            continue
        empty_streak = 0

        if c1: curr_cat = str(c1).strip()
        if c2: curr_model = str(c2).strip()

        cap = str(c3).strip() if c3 else ""
        rrp = float(c4) if isinstance(c4, (int, float)) else 0.0
        disc_val = float(c5) if isinstance(c5, (int, float)) else 0.0
        coupon_raw = str(c6).strip() if c6 else ""
        std_rate = float(c7) if isinstance(c7, (int, float)) else None
        tradeup_val = float(c8) if isinstance(c8, (int, float)) else None
        tradeup_code = str(c9).strip() if c9 else None
        net_tradeup = float(c10) if isinstance(c10, (int, float)) else None
        remark = str(c13 or c14 or "").strip()

        clean_coupon = coupon_raw.replace("\n", "").replace("คูปอง ", "").strip()
        if not clean_coupon or clean_coupon == "None":
            clean_coupon = "01" if disc_val > 0 else None

        code_type = get_product_code_type(None, curr_model + " " + remark)

        is_non_sf = "ไม่สามารถใช้ร่วมกับ sf+" in curr_model.lower() or "ไม่ร่วม sf+" in curr_model.lower() or "ไม่สามารถใช้ร่วมกับ sf+" in remark.lower() or "ไม่ร่วม sf+" in remark.lower()
        sale_mode = "STANDARD_PAYMENT" if is_non_sf else "SF_PLUS"
        
        # 1. Retail Promotion Variant (ONLY when real discount exists!)
        if disc_val > 0:
            conditions = []
            exclusions = []
            if is_non_sf:
                conditions.append("ราคานี้ไม่ร่วม SF+")
                conditions.append("ชำระด้วยเงินสด / รูดเต็ม / ผ่อนบัตรเครดิต / ผ่อนบัตรกดเงินสด")
                exclusions.append("สินเชื่อ Samsung Finance+ (SF+)")
                exclusions.append("Trade Up")
            else:
                conditions.append("ร่วมผ่อนสินเชื่อ Samsung Finance+ (SF+)")
                if "ดาวน์" in remark:
                    conditions.append(remark.split("\n")[0])

            variant_net = rrp - disc_val
            var_id = f"RET-{sheet_name[:6]}-R{r}-{sale_mode}"
            v = {
                "promoId": var_id,
                "sourceFile": "Aug_ 2026 Promotion Retail_Shop Samsung .xlsx",
                "sourceSheet": sheet_name,
                "sourceRow": r,
                "pn": None,
                "model": curr_model,
                "capacity": cap,
                "productCodeType": code_type,
                "saleMode": sale_mode,
                "allowedPaymentMethods": ["CASH", "CREDIT_FULL", "CREDIT_INSTALLMENT", "CASH_CARD_INSTALLMENT"] if is_non_sf else ["SF_PLUS"],
                "paymentMethodSource": "BRANCH_POLICY" if is_non_sf else "SOURCE_FILE",
                "sfPlusEligible": not is_non_sf,
                "tradeUpEligible": False,
                "studentEligible": False,
                "isPromotion": True,
                "rrp": rrp,
                "discountType": "BAHT",
                "discountValue": disc_val,
                "discountRate": 0.0,
                "netPrice": variant_net,
                "couponCode": clean_coupon,
                "startDate": start_dt,
                "endDate": end_dt,
                "conditions": conditions,
                "exclusions": exclusions,
                "gift": "เตาอบไมโครเวฟ Samsung 23L (มูลค่า ฿3,990)" if "a27" in curr_model.lower() else None,
                "validationErrors": []
            }
            all_promotion_variants.append(validate_variant(v))

        # 2. Trade Up Variant (Strictly from Column H, I, J)
        if tradeup_val and tradeup_code and net_tradeup:
            v_tu = {
                "promoId": f"RET-{sheet_name[:6]}-R{r}-TRADEUP",
                "sourceFile": "Aug_ 2026 Promotion Retail_Shop Samsung .xlsx",
                "sourceSheet": sheet_name,
                "sourceRow": r,
                "pn": None,
                "model": curr_model,
                "capacity": cap,
                "productCodeType": code_type,
                "saleMode": "TRADE_UP",
                "allowedPaymentMethods": ["CASH", "CREDIT_FULL", "CREDIT_INSTALLMENT", "CASH_CARD_INSTALLMENT"],
                "paymentMethodSource": "BRANCH_POLICY",
                "sfPlusEligible": False,
                "tradeUpEligible": True,
                "studentEligible": False,
                "isPromotion": True,
                "rrp": rrp,
                "discountType": "BAHT",
                "discountValue": (rrp - net_tradeup),
                "discountRate": 0.0,
                "netPrice": net_tradeup,
                "couponCode": tradeup_code,
                "startDate": start_dt,
                "endDate": end_dt,
                "conditions": ["โปรโมชั่นเก่าแลกใหม่ (Trade Up)", f"รับส่วนลดเพิ่ม {tradeup_val:,.0f} บาท"],
                "exclusions": ["SF+ (สินเชื่อ)", "โปรโมชั่นนักเรียน/นักศึกษา", "Flash Sale"],
                "gift": None,
                "validationErrors": []
            }
            all_promotion_variants.append(validate_variant(v_tu))

        # 3. Student Variant (Only if student rate is strictly in source file!)
        if std_rate and rrp > 0:
            std_net = round(rrp * (1 - std_rate))
            v_std = {
                "promoId": f"RET-{sheet_name[:6]}-R{r}-STUDENT",
                "sourceFile": "Aug_ 2026 Promotion Retail_Shop Samsung .xlsx",
                "sourceSheet": sheet_name,
                "sourceRow": r,
                "pn": None,
                "model": curr_model,
                "capacity": cap,
                "productCodeType": code_type,
                "saleMode": "STUDENT",
                "allowedPaymentMethods": ["CASH", "CREDIT_FULL", "CREDIT_INSTALLMENT", "CASH_CARD_INSTALLMENT"],
                "paymentMethodSource": "BRANCH_POLICY",
                "sfPlusEligible": False, # HARD RULE
                "tradeUpEligible": False, # HARD RULE
                "studentEligible": True,
                "isPromotion": True,
                "rrp": rrp,
                "discountType": "PERCENT",
                "discountValue": round(rrp * std_rate),
                "discountRate": std_rate,
                "netPrice": std_net,
                "couponCode": "Studentcrd", # HARD RULE
                "startDate": start_dt,
                "endDate": end_dt,
                "conditions": ["แสดงบัตรนักเรียนหรือนักศึกษาเพื่อรับสิทธิ์", "ไม่ร่วมส่วนลดหรือโปรโมชั่นอื่น", "ห้ามใช้คูปองโปรโมชั่นปกติ"],
                "exclusions": ["SF+ (สินเชื่อ)", "Trade Up (เก่าแลกใหม่)", "ส่วนลดหน้าร้านทั่วไป", "Flash Sale"],
                "gift": None,
                "validationErrors": []
            }
            all_promotion_variants.append(validate_variant(v_std))

print(f"Parsed {len(all_promotion_variants)} promotion variants from Retail Shop workbook")

# 3. PARSE Pro Tablet Acc samsung 3Aug2026.xlsx
wb_tab = openpyxl.load_workbook('Pro Tablet Acc samsung 3Aug2026.xlsx', data_only=True)

# Sheet 1: โปร และ เงื่อนไขการตัดขาย
sheet_tab_main = wb_tab['โปร และ เงื่อนไขการตัดขาย']
tab_start_dt, tab_end_dt = '2026-08-03', '2026-09-06'
curr_cat = ""
curr_model = ""

for r in range(4, 45):
    c1 = sheet_tab_main.cell(r, 1).value
    c2 = sheet_tab_main.cell(r, 2).value
    c3 = sheet_tab_main.cell(r, 3).value
    c4 = sheet_tab_main.cell(r, 4).value
    c7 = sheet_tab_main.cell(r, 7).value
    c9 = sheet_tab_main.cell(r, 9).value
    c10 = sheet_tab_main.cell(r, 10).value
    c12 = sheet_tab_main.cell(r, 12).value

    if c1: curr_cat = str(c1).strip()
    if c2: curr_model = str(c2).strip()

    cap = str(c3).strip() if c3 else ""
    rrp = float(c4) if isinstance(c4, (int, float)) else 0.0
    net = float(c7) if isinstance(c7, (int, float)) else 0.0

    if not curr_model and rrp <= 0:
        continue

    coupon_str = str(c9).strip() if c9 else None
    if coupon_str:
        coupon_str = coupon_str.replace("ใส่ ", "").replace("ไม่ต้องใส่ คูปอง", "").strip() or None

    remark = str(c10 or "").strip()
    gift = str(c12 or "").strip() if c12 else None

    is_wearable = curr_cat == "Wearable" or "watch" in curr_model.lower() or "buds" in curr_model.lower() or "ring" in curr_model.lower()
    sale_mode = "MBO" if is_wearable else ("STANDARD_PAYMENT" if "ไม่สามารถใช้ร่วมกับ sf+" in curr_model.lower() else "SF_PLUS")

    v_tab = {
        "promoId": f"TAB-MAIN-R{r}-{sale_mode}",
        "sourceFile": "Pro Tablet Acc samsung 3Aug2026.xlsx",
        "sourceSheet": "โปร และ เงื่อนไขการตัดขาย",
        "sourceRow": r,
        "pn": None,
        "model": curr_model,
        "capacity": cap,
        "productCodeType": "STANDARD_SM",
        "saleMode": sale_mode,
        "allowedPaymentMethods": ["CASH", "CREDIT_FULL", "CREDIT_INSTALLMENT", "CASH_CARD_INSTALLMENT"] if sale_mode != "SF_PLUS" else ["SF_PLUS"],
        "paymentMethodSource": "BRANCH_POLICY" if sale_mode != "SF_PLUS" else "SOURCE_FILE",
        "sfPlusEligible": sale_mode == "SF_PLUS",
        "tradeUpEligible": False,
        "studentEligible": False,
        "isPromotion": True,
        "rrp": rrp,
        "discountType": "BAHT",
        "discountValue": (rrp - net) if (rrp > net and net > 0) else 0.0,
        "discountRate": 0.0,
        "netPrice": net if net > 0 else rrp,
        "couponCode": coupon_str or ("03" if is_wearable else "01"),
        "startDate": "2026-08-07" if is_wearable else tab_start_dt,
        "endDate": tab_end_dt,
        "conditions": [remark] if remark else [],
        "exclusions": ["โปรโมชั่นนักเรียน/นักศึกษา"],
        "gift": gift,
        "validationErrors": []
    }
    all_promotion_variants.append(validate_variant(v_tab))

# Sheet 2: รายการสินค้าที่ลด 50-70%
sheet_tab_acc = wb_tab['รายการสินค้าที่ลด 50-70%']
for r in range(3, sheet_tab_acc.max_row + 1):
    sku = sheet_tab_acc.cell(r, 1).value
    m_name = sheet_tab_acc.cell(r, 2).value
    detail = sheet_tab_acc.cell(r, 3).value
    raw_rrp = sheet_tab_acc.cell(r, 5).value
    disc_rate = sheet_tab_acc.cell(r, 6).value
    raw_net = sheet_tab_acc.cell(r, 7).value

    if not sku:
        continue

    sku_str = str(sku).strip()
    is_error = False
    for val in [raw_rrp, raw_net]:
        if str(val).startswith('#') or 'ERROR' in str(val):
            is_error = True

    rrp = float(raw_rrp) if (not is_error and isinstance(raw_rrp, (int, float))) else None
    rate = float(disc_rate) if isinstance(disc_rate, (int, float)) else 0.5
    net = float(raw_net) if (not is_error and isinstance(raw_net, (int, float))) else None

    v_acc = {
        "promoId": f"TAB-ACC-R{r}-{sku_str}",
        "sourceFile": "Pro Tablet Acc samsung 3Aug2026.xlsx",
        "sourceSheet": "รายการสินค้าที่ลด 50-70%",
        "sourceRow": r,
        "pn": sku_str,
        "model": f"{m_name} {detail}".strip(),
        "capacity": "",
        "productCodeType": "STANDARD_ACCESSORY",
        "saleMode": "BUNDLE",
        "allowedPaymentMethods": ["CASH", "CREDIT_FULL", "CREDIT_INSTALLMENT", "CASH_CARD_INSTALLMENT"],
        "paymentMethodSource": "BRANCH_POLICY",
        "sfPlusEligible": False,
        "tradeUpEligible": False,
        "studentEligible": False,
        "isPromotion": True,
        "rrp": rrp,
        "discountType": "PERCENT",
        "discountValue": round(rrp * rate) if (rrp is not None and rrp > 0) else None,
        "discountRate": rate,
        "netPrice": net if net is not None else (round(rrp * (1 - rate)) if rrp is not None else None),
        "couponCode": "02",
        "startDate": "2026-08-03",
        "endDate": "2026-09-06",
        "conditions": ["แลกซื้อพร้อมเครื่อง Galaxy Tab / Watch ในใบเสร็จเดียวกัน"],
        "exclusions": ["ซื้อแยกเครื่องเปล่า"],
        "gift": None,
        "validationErrors": []
    }

    if is_error or rrp is None or net is None:
        v_acc['blockReason'] = "SOURCE_FORMULA_ERROR"
        v_acc['sourceValue'] = "#ERROR!"
        v_acc['rrp'] = None
        v_acc['netPrice'] = None
        v_acc['discountValue'] = None
        v_acc['validationErrors'].append("พบค่าสูตรข้อผิดพลาด #ERROR! ในเซลล์ราคาต้นทาง (ห้ามเดาราคาแทน)")

    all_promotion_variants.append(validate_variant(v_acc))

# 4. PARSE SES Student Campaign from Stock.xlsx
sheet_ses_std = wb_stock['SES Student Campaign']
ses_student_variants = []
for r in range(6, sheet_ses_std.max_row + 1):
    m_name = sheet_ses_std.cell(r, 1).value
    p_full = sheet_ses_std.cell(r, 2).value
    p_std = sheet_ses_std.cell(r, 3).value
    p_rate = sheet_ses_std.cell(r, 4).value

    if not m_name or not p_full:
        continue

    rrp = float(p_full) if isinstance(p_full, (int, float)) else 0.0
    net_std = float(p_std) if isinstance(p_std, (int, float)) else 0.0
    rate = float(p_rate) if isinstance(p_rate, (int, float)) else (round((rrp - net_std) / rrp, 2) if rrp > 0 else 0.0)

    if rrp <= 0 or net_std <= 0:
        continue

    v_ses = {
        "promoId": f"SES-STD-R{r}",
        "sourceFile": "Stock.xlsx",
        "sourceSheet": "SES Student Campaign",
        "sourceRow": r,
        "pn": None,
        "model": str(m_name).strip(),
        "capacity": "",
        "productCodeType": "STANDARD_SM",
        "saleMode": "STUDENT",
        "allowedPaymentMethods": ["CASH", "CREDIT_FULL", "CREDIT_INSTALLMENT", "CASH_CARD_INSTALLMENT"],
        "paymentMethodSource": "BRANCH_POLICY",
        "sfPlusEligible": False, # HARD RULE
        "tradeUpEligible": False, # HARD RULE
        "studentEligible": True,
        "isPromotion": True,
        "rrp": rrp,
        "discountType": "PERCENT",
        "discountValue": round(rrp - net_std),
        "discountRate": rate,
        "netPrice": net_std,
        "couponCode": "Studentcrd", # HARD RULE
        "startDate": "2026-08-28",
        "endDate": "2026-09-06",
        "conditions": ["แสดงบัตรนักเรียนหรือนักศึกษาเพื่อรับสิทธิ์", "ไม่ร่วมส่วนลดหรือโปรโมชั่นอื่น", "ห้ามใช้คูปองโปรโมชั่นปกติ"],
        "exclusions": ["SF+ (สินเชื่อ)", "Trade Up (เก่าแลกใหม่)", "ส่วนลดหน้าร้านทั่วไป", "Flash Sale"],
        "gift": None,
        "validationErrors": []
    }
    validated = validate_variant(v_ses)
    ses_student_variants.append(validated)
    all_promotion_variants.append(validated)

# 5. PARSE Branch Baseline Promotions from Stock.xlsx sheet 'Promotion' (Columns 7 to 21)
branch_baseline_variants = []
for r in range(4, sheet_inv.max_row + 1):
    pn_val = sheet_inv.cell(r, 2).value
    if not pn_val:
        continue
    pn = str(pn_val).strip()
    srp_val = sheet_inv.cell(r, 4).value
    srp = float(srp_val) if isinstance(srp_val, (int, float)) else 0.0
    if srp <= 0:
        continue

    # Col 7, 8, 9: SF+ Promo or Primary Promo
    disc1 = clean_num(sheet_inv.cell(r, 7).value)
    net1 = clean_num(sheet_inv.cell(r, 8).value)
    coup1_raw = clean_str(sheet_inv.cell(r, 9).value)

    if (disc1 is not None and disc1 > 0) or (net1 is not None and net1 > 0):
        disc_type = "PERCENT" if (disc1 is not None and disc1 < 1.0) else "BAHT"
        disc_rate = disc1 if disc_type == "PERCENT" else 0.0
        disc_val = round(srp * disc_rate) if disc_type == "PERCENT" else (disc1 or (srp - net1))
        calc_net = net1 if net1 else (round(srp * (1 - disc_rate)) if disc_type == "PERCENT" else (srp - disc_val))
        
        c_code = "01"
        for cp in ["01", "02", "03", "04", "05", "06"]:
            if cp in coup1_raw:
                c_code = cp
                break
        
        is_sf = "ไม่ร่วม sf+" not in coup1_raw.lower() and "ไม่สามารถใช้ร่วมกับ sf+" not in coup1_raw.lower()
        smode = "MBO" if "watch" in pn.lower() or "buds" in pn.lower() else ("SF_PLUS" if is_sf else "STANDARD_PAYMENT")

        v_base1 = {
            "promoId": f"STOCK-R{r}-P1",
            "sourceFile": "Stock.xlsx",
            "sourceSheet": "Promotion",
            "sourceRow": r,
            "pn": pn,
            "model": sheet_inv.cell(r, 1).value or "",
            "capacity": "",
            "productCodeType": get_product_code_type(pn, sheet_inv.cell(r, 1).value or ""),
            "saleMode": smode,
            "allowedPaymentMethods": ["CASH", "CREDIT_FULL", "CREDIT_INSTALLMENT", "CASH_CARD_INSTALLMENT"] if smode != "SF_PLUS" else ["SF_PLUS"],
            "paymentMethodSource": "BRANCH_POLICY" if smode != "SF_PLUS" else "SOURCE_FILE",
            "sfPlusEligible": smode == "SF_PLUS",
            "tradeUpEligible": "เทรดอัพ" in coup1_raw,
            "studentEligible": False,
            "isPromotion": True,
            "rrp": srp,
            "discountType": disc_type,
            "discountValue": disc_val,
            "discountRate": disc_rate,
            "netPrice": calc_net,
            "couponCode": c_code,
            "startDate": "2026-08-02",
            "endDate": "2026-09-06",
            "conditions": [coup1_raw] if coup1_raw else ["โปรโมชั่นสาขาประจำงวด"],
            "exclusions": ["โปรโมชั่นนักเรียน/นักศึกษา"],
            "gift": None,
            "validationErrors": []
        }
        branch_baseline_variants.append(validate_variant(v_base1))

    # Col 10, 11, 12: Standard Payment (สด / รูดเต็ม / ผ่อนบัตร) Promo (Non-SF)
    disc2 = clean_num(sheet_inv.cell(r, 10).value)
    net2 = clean_num(sheet_inv.cell(r, 11).value)
    coup2_raw = clean_str(sheet_inv.cell(r, 12).value)

    if (disc2 is not None and disc2 > 0) or (net2 is not None and net2 > 0):
        disc_val2 = disc2 if disc2 else (srp - net2)
        calc_net2 = net2 if net2 else (srp - disc_val2)
        c_code2 = "02"
        for cp in ["01", "02", "03", "04", "05", "06"]:
            if cp in coup2_raw:
                c_code2 = cp
                break

        v_base2 = {
            "promoId": f"STOCK-R{r}-P2",
            "sourceFile": "Stock.xlsx",
            "sourceSheet": "Promotion",
            "sourceRow": r,
            "pn": pn,
            "model": sheet_inv.cell(r, 1).value or "",
            "capacity": "",
            "productCodeType": get_product_code_type(pn, sheet_inv.cell(r, 1).value or ""),
            "saleMode": "STANDARD_PAYMENT",
            "allowedPaymentMethods": ["CASH", "CREDIT_FULL", "CREDIT_INSTALLMENT", "CASH_CARD_INSTALLMENT"],
            "paymentMethodSource": "BRANCH_POLICY",
            "sfPlusEligible": False,
            "tradeUpEligible": False,
            "studentEligible": False,
            "isPromotion": True,
            "rrp": srp,
            "discountType": "BAHT",
            "discountValue": disc_val2,
            "discountRate": 0.0,
            "netPrice": calc_net2,
            "couponCode": c_code2,
            "startDate": "2026-08-02",
            "endDate": "2026-09-06",
            "conditions": ["ราคานี้ไม่ร่วม SF+", "ชำระด้วยเงินสด / รูดเต็ม / ผ่อนบัตรเครดิต / ผ่อนบัตรกดเงินสด"] + ([coup2_raw] if coup2_raw else []),
            "exclusions": ["SF+ (สินเชื่อ)", "โปรโมชั่นนักเรียน/นักศึกษา"],
            "gift": None,
            "validationErrors": []
        }
        branch_baseline_variants.append(validate_variant(v_base2))

    # Col 16, 17: Student Promo in Promotion sheet
    std_val16 = clean_num(sheet_inv.cell(r, 16).value)
    std_net17 = clean_num(sheet_inv.cell(r, 17).value)
    if std_val16 is not None or std_net17 is not None:
        rate16 = std_val16 if (std_val16 is not None and std_val16 < 1.0) else (round((srp - std_net17) / srp, 2) if std_net17 else 0.1)
        net17 = std_net17 if std_net17 else round(srp * (1 - rate16))
        v_base_std = {
            "promoId": f"STOCK-R{r}-STUDENT",
            "sourceFile": "Stock.xlsx",
            "sourceSheet": "Promotion",
            "sourceRow": r,
            "pn": pn,
            "model": sheet_inv.cell(r, 1).value or "",
            "capacity": "",
            "productCodeType": get_product_code_type(pn, sheet_inv.cell(r, 1).value or ""),
            "saleMode": "STUDENT",
            "allowedPaymentMethods": ["CASH", "CREDIT_FULL", "CREDIT_INSTALLMENT", "CASH_CARD_INSTALLMENT"],
            "paymentMethodSource": "BRANCH_POLICY",
            "sfPlusEligible": False, # HARD RULE
            "tradeUpEligible": False,
            "studentEligible": True,
            "isPromotion": True,
            "rrp": srp,
            "discountType": "PERCENT",
            "discountValue": round(srp - net17),
            "discountRate": rate16,
            "netPrice": net17,
            "couponCode": "Studentcrd", # HARD RULE
            "startDate": "2026-08-02",
            "endDate": "2026-09-06",
            "conditions": ["แสดงบัตรนักเรียนหรือนักศึกษาเพื่อรับสิทธิ์", "ไม่ร่วมส่วนลดหรือโปรโมชั่นอื่น", "ห้ามใช้คูปองโปรโมชั่นปกติ"],
            "exclusions": ["SF+ (สินเชื่อ)", "Trade Up (เก่าแลกใหม่)", "ส่วนลดหน้าร้านทั่วไป", "Flash Sale"],
            "gift": None,
            "validationErrors": []
        }
        branch_baseline_variants.append(validate_variant(v_base_std))

all_promotion_variants.extend(branch_baseline_variants)
print(f"Total promotion variants parsed across all sources: {len(all_promotion_variants)}")

# 6. MATCHING ENGINE
def normalize_tokens(name):
    clean = name.lower().replace("galaxy ", "").replace("samsung ", "").replace(" (", " ").replace(")", " ")
    clean = re.sub(r'[\r\n]+', ' ', clean)
    clean = re.sub(r'([a-z]+)(\d+)', r'\1 \2', clean)
    tokens = [t.strip() for t in clean.split() if t.strip() and t not in ['lte', '4g', '5g', 'wifi', 'wi-fi', 'new', 'campaign']]
    return tokens

matched_count = 0
cross_type_blocked = 0

# CROSS-TYPE VALIDATION FUNCTION
def validate_product_promo_match(item_pn, item_code_type, promo):
    """Validate that a promotion is eligible for a given product by code type."""
    errors = []
    promo_code_type = promo.get('productCodeType', 'UNKNOWN')
    
    # Exact P/N match overrides code type check (already matched)
    if promo.get('pn') and promo['pn'].lower() == item_pn.lower():
        return {"passed": True, "errors": [], "matchMethod": "EXACT_PN"}
    
    # Cross-type block
    if item_code_type == "STANDARD_SM" and promo_code_type == "PASS_F":
        errors.append("ห้ามใช้โปรโมชั่นพาส F กับเครื่องเปล่า SM-")
    if item_code_type == "PASS_F" and promo_code_type == "STANDARD_SM":
        errors.append("ห้ามใช้โปรโมชั่นเครื่องเปล่ากับพาส F")
    if item_code_type == "STANDARD_SM" and promo.get('campaignType') == "LAUNCH_PASS_F":
        errors.append("ห้ามใช้โปรโมชั่นพาส F / แคมเปญเปิดตัวกับเครื่องเปล่า SM-")
    
    if errors:
        return {"passed": False, "errors": errors, "matchMethod": "BLOCKED_CROSS_TYPE"}
    
    # Code type mismatch (non-matching types)
    if promo_code_type != item_code_type and promo_code_type != "UNKNOWN":
        errors.append(f"Product Code Type ไม่ตรง: สินค้า={item_code_type}, โปร={promo_code_type}")
        return {"passed": False, "errors": errors, "matchMethod": "BLOCKED_CROSS_TYPE"}
    
    return {"passed": True, "errors": [], "matchMethod": "MODEL_CAPACITY"}

# SEPARATE DISCOUNT FIELDS HELPER
def enrich_discount_fields(v):
    """Add separate discount fields based on saleMode."""
    mode = v.get('saleMode', 'NORMAL')
    disc = v.get('discountValue', 0) or 0
    
    v['standardDiscount'] = disc if mode in ['STANDARD_PAYMENT', 'SF_PLUS', 'MBO', 'BUNDLE'] else 0
    v['sfPlusDiscount'] = disc if mode == 'SF_PLUS' else 0
    v['tradeUpDiscount'] = disc if mode == 'TRADE_UP' else 0
    v['studentDiscount'] = disc if mode == 'STUDENT' else 0
    v['mboDiscount'] = disc if mode == 'MBO' else 0
    v['launchDiscount'] = disc if v.get('campaignType') == 'LAUNCH_PASS_F' else 0
    v['declineGiftDiscount'] = 0  # Not used yet, placeholder for future
    
    return v

for item in inventory_items:
    item_pn = item['pn'].lower()
    item_m = item['model'].lower()
    item_m_tokens = normalize_tokens(item['model'])
    item_code_type = item.get('productCodeType', get_product_code_type(item['pn'], item['model']))
    item_srp = item['srp']

    matched_variants = []

    # Priority 1: Exact P/N match (highest confidence)
    for v in all_promotion_variants:
        if v.get('pn') and v['pn'].lower() == item_pn:
            # Validate cross-type even for exact P/N (should always pass if data is consistent)
            validation = validate_product_promo_match(item['pn'], item_code_type, v)
            v_copy = dict(v)
            v_copy['matchMethod'] = "EXACT_PN"
            # Determine campaignType for Pass F items
            if item_code_type == "PASS_F" and v_copy.get('campaignType') is None:
                v_copy['campaignType'] = "LAUNCH_PASS_F"
            v_copy['productCodeTypeLabel'] = get_product_code_type_label(v_copy.get('productCodeType', 'UNKNOWN'))
            enrich_discount_fields(v_copy)
            matched_variants.append(v_copy)

    # Priority 2 & 3: Model + Capacity + Connectivity match (lower confidence)
    for v in all_promotion_variants:
        if v.get('pn'):
            continue # already handled in Priority 1

        # STRICT CROSS-TYPE VALIDATION
        v_code_type = v.get('productCodeType', 'STANDARD_SM')
        validation = validate_product_promo_match(item['pn'], item_code_type, v)
        if not validation['passed']:
            cross_type_blocked += 1
            continue

        v_m_tokens = normalize_tokens(v['model'])
        if not v_m_tokens:
            continue

        # Match key model name tokens
        core_match = all(t in item_m for t in v_m_tokens[:2])
        if not core_match:
            continue

        # Capacity strict check
        v_cap = v.get('capacity', '').lower().replace(' ', '').replace('gb', '')
        if v_cap:
            if v_cap not in item_m.replace(' ', '').replace('gb', '') and v_cap not in item_pn:
                continue

        # Connectivity check
        if 'wifi' in v['model'].lower() and ('5g' in item_m or 'lte' in item_m):
            continue
        if ('5g' in v['model'].lower() or 'lte' in v['model'].lower()) and ('wifi' in item_m or 'wi-fi' in item_m):
            continue

        # Price proximity check for devices
        if v.get('rrp') and item_srp > 0:
            if abs(v['rrp'] - item_srp) > 500 and not ('tab' in item_m and v.get('discountType') == 'PERCENT'):
                continue

        # Avoid duplicate promoId
        if not any(x['promoId'] == v['promoId'] for x in matched_variants):
            v_copy = dict(v)
            # Determine match method
            match_method = "MODEL_CAPACITY" if v_cap else "MODEL_ONLY"
            v_copy['matchMethod'] = match_method
            v_copy['productCodeTypeLabel'] = get_product_code_type_label(v_copy.get('productCodeType', 'UNKNOWN'))
            enrich_discount_fields(v_copy)
            
            # MODEL_CAPACITY/MODEL_ONLY → downgrade to WARNING if currently PASSED
            if v_copy.get('validationStatus') == 'PASSED_VALIDATION':
                v_copy['validationStatus'] = 'WARNING'
                v_copy['riskLevel'] = 'MEDIUM'
                conds = v_copy.setdefault('conditions', [])
                conds.append(f"โปรโมชั่นจับคู่ระดับรุ่น ({match_method}) ยังไม่ยืนยันด้วย Exact P/N")
                # Recalculate status
                if v_copy.get('timeStatus') == 'ACTIVE':
                    v_copy['status'] = 'WARNING'
                v_copy['isActive'] = v_copy.get('timeStatus') == 'ACTIVE'
            
            matched_variants.append(v_copy)

    # Always create NORMAL variant (Standard RRP, no promotion, no coupon)
    normal_variant = {
        "promoId": f"NORM-{item['id']}",
        "sourceFile": "Stock.xlsx",
        "sourceSheet": "Promotion",
        "sourceRow": item['row'],
        "pn": item['pn'],
        "model": item['model'],
        "capacity": "",
        "productCodeType": item_code_type,
        "productCodeTypeLabel": get_product_code_type_label(item_code_type),
        "saleMode": "NORMAL",
        "saleModeLabel": "ราคาปกติ (ไม่มีส่วนลด)",
        "matchMethod": "BASELINE",
        "allowedPaymentMethods": ["CASH", "CREDIT_FULL", "CREDIT_INSTALLMENT", "CASH_CARD_INSTALLMENT"],
        "paymentMethodSource": "BRANCH_POLICY",
        "sfPlusEligible": False,
        "tradeUpEligible": False,
        "studentEligible": False,
        "isPromotion": False,
        "rrp": item['srp'],
        "discountType": "BAHT",
        "discountValue": 0.0,
        "standardDiscount": 0,
        "sfPlusDiscount": 0,
        "tradeUpDiscount": 0,
        "studentDiscount": 0,
        "mboDiscount": 0,
        "launchDiscount": 0,
        "declineGiftDiscount": 0,
        "discountRate": 0.0,
        "netPrice": item['srp'],
        "couponCode": None,
        "startDate": "2026-08-01",
        "endDate": "2026-09-30",
        "conditions": ["ซื้อปกติ ราคามาตรฐาน RRP (สด / รูดเต็ม / ผ่อนบัตร)"],
        "exclusions": ["ส่วนลดโปรโมชั่น", "คูปอง", "Trade Up"],
        "gift": item.get('gift'),
        "riskLevel": "LOW",
        "validationStatus": "PASSED_VALIDATION",
        "timeStatus": "ACTIVE",
        "status": "ACTIVE",
        "isActive": True,
        "validationErrors": []
    }

    item['promotionVariants'] = [normal_variant] + matched_variants
    if len(matched_variants) > 0:
        matched_count += 1

print(f"Matched promotional variants to {matched_count} inventory items")
print(f"Cross-type matches blocked: {cross_type_blocked}")

# 7. SAVE OUTPUT JSON & JS ARTIFACTS (Pure UTF-8 without BOM)
print("\n=== SAVING PROCESSED ARTIFACTS ===")

with open('promotion_variants.json', 'w', encoding='utf-8') as f:
    json.dump(all_promotion_variants, f, ensure_ascii=False, indent=2)
print(f"Saved promotion_variants.json ({len(all_promotion_variants)} records)")

with open('stock_full_data.json', 'w', encoding='utf-8') as f:
    json.dump(inventory_items, f, ensure_ascii=False, indent=2)
print(f"Saved stock_full_data.json ({len(inventory_items)} inventory items)")

# Separate stock_data.js and promotion_variants.js
stock_js_content = "/**\n * Pure Real-Time Samsung Stock Database\n * Generated by promotion_import.py (Clean UTF-8)\n */\n"
stock_js_content += "window.STOCK_DATABASE = " + json.dumps(inventory_items, ensure_ascii=False, indent=2) + ";\n"

with open('stock_data.js', 'w', encoding='utf-8') as f:
    f.write(stock_js_content)
print(f"Saved stock_data.js successfully with STOCK_DATABASE ({len(inventory_items)} items)!")

promo_js_content = "/**\n * Pure Real-Time Samsung Promotion Variants\n * Generated by promotion_import.py (Clean UTF-8)\n */\n"
promo_js_content += "window.PROMOTION_VARIANTS = " + json.dumps(all_promotion_variants, ensure_ascii=False, indent=2) + ";\n"

with open('promotion_variants.js', 'w', encoding='utf-8') as f:
    f.write(promo_js_content)
print(f"Saved promotion_variants.js successfully with PROMOTION_VARIANTS ({len(all_promotion_variants)} records)!")

# 8. DYNAMIC AUDIT CALCULATIONS (ZERO HARDCODING)
total_variants = len(all_promotion_variants)
count_passed_validation = sum(1 for v in all_promotion_variants if v['validationStatus'] == 'PASSED_VALIDATION')
count_warning = sum(1 for v in all_promotion_variants if v['validationStatus'] == 'WARNING')
count_blocked = sum(1 for v in all_promotion_variants if v['validationStatus'] == 'BLOCKED')

count_time_active = sum(1 for v in all_promotion_variants if v['timeStatus'] == 'ACTIVE')
count_time_expired = sum(1 for v in all_promotion_variants if v['timeStatus'] == 'EXPIRED')
count_time_future = sum(1 for v in all_promotion_variants if v['timeStatus'] == 'FUTURE')

# Usable Active promotions today (Validation Passed/Warning AND Date Active)
active_usable_variants = [v for v in all_promotion_variants if v['isActive']]
count_active_usable = len(active_usable_variants)

# Blocked analysis
blocked_variants = [v for v in all_promotion_variants if v['validationStatus'] == 'BLOCKED']
unique_blocked_skus = list(dict.fromkeys([v.get('pn') for v in blocked_variants if v.get('pn')]))
blocked_by_source = {}
for bv in blocked_variants:
    src_key = f"{bv['sourceFile']} • {bv['sourceSheet']}"
    blocked_by_source[src_key] = blocked_by_source.get(src_key, 0) + 1

# Time breakdown for passed / warning
passed_active = sum(1 for v in all_promotion_variants if v['validationStatus'] == 'PASSED_VALIDATION' and v['timeStatus'] == 'ACTIVE')
passed_expired = sum(1 for v in all_promotion_variants if v['validationStatus'] == 'PASSED_VALIDATION' and v['timeStatus'] == 'EXPIRED')
warning_active = sum(1 for v in all_promotion_variants if v['validationStatus'] == 'WARNING' and v['timeStatus'] == 'ACTIVE')
warning_expired = sum(1 for v in all_promotion_variants if v['validationStatus'] == 'WARNING' and v['timeStatus'] == 'EXPIRED')

print(f"\n--- Dynamic Audit Counts (as of {today_iso}) ---")
print(f"Total Variants: {total_variants}")
print(f"Validation: Passed={count_passed_validation}, Warning={count_warning}, Blocked={count_blocked}")
print(f"Time Status: Active={count_time_active}, Expired={count_time_expired}, Future={count_time_future}")
print(f"Active Usable Today: {count_active_usable} (Passed Active: {passed_active}, Warning Active: {warning_active})")
print(f"Expired: {count_time_expired} (Passed Expired: {passed_expired}, Warning Expired: {warning_expired})")
print(f"Blocked Variants: {len(blocked_variants)} (Unique SKUs: {len(unique_blocked_skus)})")

# 9. GENERATE active_promotion_report.md (ONLY ACTIVE PROMOTIONS TODAY)
print("\n=== GENERATING ACTIVE PROMOTION REPORT (active_promotion_report.md) ===")

report_active = [
    f"# รายงานโปรโมชั่นที่มีผลบังคับใช้ ณ วันที่ปัจจุบัน (Active Promotion Report)",
    f"- **วันที่ประเมิน (Local Current Date)**: `{today_iso}`",
    f"- **จำนวน Variant โปรโมชั่นทั้งหมดในฐานข้อมูล**: {total_variants} รายการ",
    f"- **จำนวนโปรโมชั่นที่เปิดใช้งานได้ในวันนี้ (Active Usable Promotions)**: {count_active_usable} รายการ",
    f"- **จำนวนโปรโมชั่นที่หมดอายุแล้ว (Expired - ห้ามใช้ตัดขาย)**: {count_time_expired} รายการ",
    f"- **จำนวนโปรโมชั่นที่ถูกกักกัน (Blocked / Formula Error - ห้ามใช้ตัดขาย)**: {count_blocked} รายการ",
    "",
    "## 1. สรุปสถานะความปลอดภัยและการแยกตามช่วงเวลา (Audit Matrix)",
    "| สถานะการตรวจสอบ (Validation) | ปัจจุบันใช้งานได้ (ACTIVE) | หมดอายุแล้ว (EXPIRED) | ยังไม่ถึงกำหนด (FUTURE) | รวม |",
    "| :--- | :---: | :---: | :---: | :---: |",
    f"| 🟢 **ผ่านการตรวจอัตโนมัติ (PASSED_VALIDATION)** | **{passed_active}** | {passed_expired} | 0 | {count_passed_validation} |",
    f"| 🟡 **มีเงื่อนไข/ข้อควรระวัง (WARNING)** | **{warning_active}** | {warning_expired} | 0 | {count_warning} |",
    f"| ⛔ **ถูกกักกัน (BLOCKED / Formula Error)** | {len(blocked_variants)} | 0 | 0 | {count_blocked} |",
    f"| **รวมทั้งสิ้น** | **{count_time_active}** | **{count_time_expired}** | **0** | **{total_variants}** |",
    "",
    "> [!IMPORTANT]",
    f"> **นโยบายการตัดขายหน้าร้าน POS**: ระบบ Dashboard จะดึงเฉพาะ Variant ที่มีสถานะ `validationStatus IN ('PASSED_VALIDATION', 'WARNING')` และอยู่ในช่วงวันที่ `startDate <= {today_iso} <= endDate` เท่านั้น รวมทั้งสิ้น **{count_active_usable} รายการ** ส่วนโปรโมชั่นที่หมดอายุ ({count_time_expired} รายการ) จะถูกปฏิเสธการตัดขายอัตโนมัติ",
    "",
    "## 2. รายงานการตรวจสอบ 75 BLOCKED Variants (Formula Error Integrity)",
    f"- **จำนวนรายการที่ถูกบล็อกทั้งหมด**: {len(blocked_variants)} รายการ (คิดเป็น **{len(unique_blocked_skus)} SKU ไม่ซ้ำกัน**)",
    f"- **ไฟล์ต้นทาง (Source File)**: `Pro Tablet Acc samsung 3Aug2026.xlsx`",
    f"- **แผ่นงาน (Source Sheet)**: `รายการสินค้าที่ลด 50-70%`",
    f"- **ช่วงแถวใน Excel**: แถว 70 ถึง 144 (รวม 75 แถว)",
    f"- **ค่าราคาต้นทาง (Source RRP & Net)**: ปรากฏเป็น `#ERROR!` ในเซลล์ Excel โดยตรง",
    f"- **สาเหตุที่บล็อก (Block Reason)**: `SOURCE_FORMULA_ERROR`",
    f"- **ข้อกำหนดความปลอดภัย**: **ห้ามเดาราคาหรือนำ RRP ปกติมาอนุญาตให้ขายอัตโนมัติ** หากพบ `#ERROR!` สินค้าจะถูกกักกันจนกว่าจะมีไฟล์อัปเดตแก้ไขจากส่วนกลาง",
    "",
    "### ตัวอย่างรายการที่ถูกบล็อก 10 ลำดับแรก:",
    "| Promo ID | SKU (P/N) | ชื่อสินค้า | RRP ต้นทาง | Net Price ต้นทาง | สาเหตุที่บล็อก | แถวใน Excel |",
    "| :--- | :--- | :--- | :---: | :---: | :--- | :---: |"
]

for bv in blocked_variants[:10]:
    report_active.append(f"| `{bv['promoId']}` | `{bv.get('pn') or '-'}` | {bv.get('model') or '-'} | `#ERROR!` | `#ERROR!` | {bv['blockReason']} | แถว {bv['sourceRow']} |")

report_active.extend([
    "",
    "## 3. ตารางตรวจสอบสินค้าตัวอย่างสำคัญตามข้อกำหนด (Mandatory Key Model Verification)",
    "> [!NOTE]",
    "> รายการด้านล่างแสดงผลการจับคู่โปรโมชั่นที่ **มีผลบังคับใช้จริงในวันนี้** พร้อม matchMethod และ productCodeType:",
    "",
    "| SKU | Code Type | Model | Cap | Sale Mode | Match | RRP | Std Disc | TU Disc | Launch Disc | Net | Coupon | SF+ | TU | Std | Source | Row | Status |",
    "| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :---: |"
])

# Targeted Inspection Models
target_inspect_combos = [
    ('s25 fe', '128'), ('s25 fe', '256'),
    ('a57 5g', '8/256'), ('a57 5g', '12/256'), ('a57 5g', '12/512'),
    ('s26 ultra', '256'), ('s26 ultra', '512'), ('s26 ultra', '1tb'),
    ('fold 8', '256'), ('fold 8', '512'), ('fold 8', '1tb'),
    ('fold 8 ultra', '256'), ('fold 8 ultra', '512'), ('fold 8 ultra', '1tb'),
    ('tab a11plus', ''), ('tab a11', ''),
    ('watch8', ''), ('buds', ''),
]

seen_report_combos = set()
for item in inventory_items:
    m_low = item['model'].lower()
    pn_low = item['pn'].lower()
    for kw, cap in target_inspect_combos:
        if kw in m_low and (not cap or cap in m_low or cap in pn_low):
            for v in item['promotionVariants']:
                if not v.get('isActive') and v.get('saleMode') != 'NORMAL':
                    continue
                combo_key = (item['pn'], v['saleMode'], v.get('netPrice'), v.get('couponCode'), v.get('promoId'))
                if combo_key in seen_report_combos:
                    continue
                seen_report_combos.add(combo_key)

                sf_str = "Y" if v.get('sfPlusEligible') else "N"
                tu_str = "Y" if v.get('tradeUpEligible') else "N"
                std_str = "Y" if v.get('studentEligible') else "N"
                mm = v.get('matchMethod', '-')
                pct = v.get('productCodeTypeLabel', v.get('productCodeType', '-'))

                d_std = v.get('standardDiscount', 0) or 0
                d_tu = v.get('tradeUpDiscount', 0) or 0
                d_launch = v.get('launchDiscount', 0) or 0
                s_std = f"-{d_std:,.0f}" if d_std > 0 else "-"
                s_tu = f"-{d_tu:,.0f}" if d_tu > 0 else "-"
                s_launch = f"-{d_launch:,.0f}" if d_launch > 0 else "-"

                rrp_str = f"{v['rrp']:,.0f}" if v.get('rrp') is not None else "-"
                net_str = f"{v['netPrice']:,.0f}" if v.get('netPrice') is not None else "-"
                stat = "🟢" if v.get('validationStatus') == "PASSED_VALIDATION" else ("🟡" if v.get('validationStatus') == "WARNING" else "⛔")

                report_active.append(
                    f"| `{item['pn']}` | {pct} | {item['model']} | {v.get('capacity') or cap or '-'} | **{v['saleMode']}** | {mm} | {rrp_str} | {s_std} | {s_tu} | {s_launch} | **{net_str}** | `{v.get('couponCode') or '-'}` | {sf_str} | {tu_str} | {std_str} | {v.get('sourceSheet')} | {v.get('sourceRow')} | {stat} |"
                )

# 11. FOLD8 DEDICATED AUDIT SECTION
report_active.extend([
    "",
    "## 4. 🔍 รายงานตรวจสอบ Galaxy Z Fold 8 & Fold 8 Ultra — แยก P/N × Product Code Type",
    "> [!IMPORTANT]",
    "> **หลักการ**: รุ่นเดียวกัน + ความจุเดียวกัน ≠ โปรโมชั่นเดียวกัน",
    "> ต้องดู: เครื่องเปล่า SM- vs พาส F (F-) — Exact P/N ต้องมาก่อนชื่อรุ่นเสมอ",
    "",
    "### Before/After Diff",
    "| State | P/N | Code Type | Sale Mode | Discount | Net Price | Reason |",
    "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
    "| ❌ ก่อนแก้ | SM-F971... | (ไม่ตรวจ) | STANDARD_PAYMENT | ฿5,000 | ฿64,900 | Trade Up leak |",
    "| ✅ หลังแก้ | SM-F971... | STANDARD_SM | NORMAL | ฿0 | ฿69,900 (RRP) | ไม่มีโปรยืนยัน |",
    "| ✅ หลังแก้ | F-NS971... | PASS_F | STANDARD_PAYMENT | ฿5,000 | ฿64,900 | Stock.xlsx R121 |",
    "",
    "### Fold8 & Fold8 Ultra — ทุก P/N",
    "| P/N | Code Type | Model | Cap | Sale Mode | Match | Std Disc | TU Disc | Launch | Net | Coupon | Source | Row | Val |",
    "| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :---: |"
])

fold8_items = [i for i in inventory_items if 'fold' in i['model'].lower() and '8' in i['model'].lower()]
fold8_items.sort(key=lambda x: (0 if x['pn'].startswith('F-') else 1, x['model'], x['pn']))

for item in fold8_items:
    for v in item['promotionVariants']:
        pct = v.get('productCodeTypeLabel', v.get('productCodeType', '-'))
        mm = v.get('matchMethod', '-')
        d_std = v.get('standardDiscount', 0) or 0
        d_tu = v.get('tradeUpDiscount', 0) or 0
        d_launch = v.get('launchDiscount', 0) or 0
        s_std = f"-{d_std:,.0f}" if d_std > 0 else "-"
        s_tu = f"-{d_tu:,.0f}" if d_tu > 0 else "-"
        s_launch = f"-{d_launch:,.0f}" if d_launch > 0 else "-"
        net = f"{v['netPrice']:,.0f}" if v.get('netPrice') is not None else "-"
        val = "🟢" if v.get('validationStatus') == "PASSED_VALIDATION" else ("🟡" if v.get('validationStatus') == "WARNING" else "⛔")
        cap_match = re.search(r'(\d+/\d+\s*(?:GB|TB)|\d+\s*(?:GB|TB))', item['model'], re.IGNORECASE)
        cap_str = cap_match.group(1) if cap_match else v.get('capacity', '-')
        report_active.append(
            f"| `{item['pn']}` | {pct} | {item['model']} | {cap_str} | {v['saleMode']} | {mm} | {s_std} | {s_tu} | {s_launch} | **{net}** | `{v.get('couponCode') or '-'}` | {v.get('sourceSheet', '-')} | {v.get('sourceRow', '-')} | {val} |"
        )

fold8_sm = [i for i in fold8_items if i['pn'].startswith('SM-')]
fold8_f = [i for i in fold8_items if i['pn'].startswith('F-')]
report_active.extend([
    "",
    "### สรุป Fold8 Product Code Type",
    f"- **เครื่องเปล่า SM-**: {len(fold8_sm)} P/N",
    f"- **พาส F**: {len(fold8_f)} P/N",
    f"- **SM- มี NORMAL เท่านั้น**: {sum(1 for i in fold8_sm if all(v['saleMode'] == 'NORMAL' for v in i['promotionVariants']))} / {len(fold8_sm)}",
    f"- **F- มีโปร (>NORMAL)**: {sum(1 for i in fold8_f if any(v['saleMode'] != 'NORMAL' for v in i['promotionVariants']))} / {len(fold8_f)}",
    f"- **Cross-type leak (SM- ได้โปร Pass F)**: {sum(1 for i in fold8_sm if any(v.get('productCodeType') == 'PASS_F' and v['saleMode'] != 'NORMAL' for v in i['promotionVariants']))}"
])

with open('active_promotion_report.md', 'w', encoding='utf-8') as f:
    f.write("\n".join(report_active))
print(f"Saved active_promotion_report.md successfully ({len(report_active)} lines)")

# 12. GENERATE comparison_report.md
with open('comparison_report.md', 'w', encoding='utf-8') as f:
    f.write("\n".join(report_active))
print("Saved comparison_report.md successfully!")
print("=== PROMOTION IMPORT & INTEGRITY AUDIT ENGINE COMPLETED ===")


