# NotebookLM Data Scope & Sanitization Policy

> **Policy Type**: Information Classification & Sanitization Specification  
> **Status**: `ENFORCED`  
> **Target Package**: `notebooklm-export/`  
> **Version**: `1.0.0`  
> **Date**: `2026-09-07`

---

## 1. ขอบเขตข้อมูลที่อนุญาตให้ส่งออก (In-Scope Whitelist)

เฉพาะข้อมูลที่ผ่านการตรวจสอบจาก Rule Engine และ CI Quality Gate แล้วเท่านั้นที่มีสิทธิ์ส่งออกไปยังโฟลเดอร์ `notebooklm-export/`:

### 1.1 Validated Promotions (`current/active_promotions.csv`)
ส่งออกเฉพาะฟิลด์ที่จำเป็นต่อการสืบค้นและให้คำแนะนำ:
- `variantId`: รหัสประจำ Variant
- `model`: ชื่อรุ่นภาษาทางการ (เช่น Galaxy S26 FE 128GB)
- `ram`: ความจุ RAM
- `storage`: ความจุ ROM
- `connectivity`: ประเภทการเชื่อมต่อ (5G, LTE, Wi-Fi)
- `productCodeType`: ประเภทสินค้า (`STANDARD_SM`, `PASS_F`, `STANDARD_ACCESSORY`)
- `saleMode`: โหมดการขาย (`STANDARD_PAYMENT`, `SF_PLUS`, `TRADE_UP`, `STUDENT`)
- `rrp`: ราคาเปิดตัวทางการ
- `standardDiscount`: ส่วนลดราคาปกติ
- `sfPlusDiscount`: ส่วนลดเฉพาะสินเชื่อ SF+
- `studentDiscount`: ส่วนลดนักศึกษา
- `tradeUpDiscount`: ส่วนลดนำเครื่องเก่ามาแลก
- `netPrice`: ราคาสุทธิที่คำนวณผ่านสมการเลขคณิตแล้ว
- `priceCoupon`: รหัสคูปองส่วนลดราคา
- `studentCoupon`: รหัสคูปองนักศึกษา (ต้องเป็น `Studentcrd` เท่านั้น)
- `tradeUpCode`: รหัสส่วนลด Trade Up (เช่น `T-UP-CO-S`)
- `sfPlusEligible`: สิทธิ์การร่วมผ่อน SF+ (`YES`/`NO`)
- `tradeUpEligible`: สิทธิ์การแลกซื้อ Trade Up (`YES`/`NO`)
- `startDate` / `endDate`: ช่วงเวลาที่โปรโมชั่นมีผลบังคับใช้
- `sourceBadge`: ป้ายระบุแหล่งที่มาความจริง (`EXCEL_CONFIRMED`, `BRANCH_CONFIRMED`, `BOTH_MATCH`, `SOURCE_CONFLICT`)
- `sourceFileDisplayName`: ชื่อไฟล์ต้นฉบับแบบเป็นมิตร (ห้าม Full Path)
- `sourceSheet`: ชื่อชีตใน Excel
- `sourceRow`: บรรทัดที่พบข้อมูลใน Excel
- `headerPath`: ลำดับหัวตาราง (เช่น `TRADE_UP > ส่วนลดเพิ่ม`)
- `validationStatus`: สถานะความถูกต้อง (`PASSED_VALIDATION`, `WARNING`)

### 1.2 Blocked Variant Explanations (`audit/blocked_variants.csv`)
ส่งออกเพื่อให้ NotebookLM สามารถอธิบายเหตุผลที่ระบบไม่เปิดให้ขายได้ โดยมีข้อกำหนด:
- **คอลัมน์ P/N ต้อง Mask เสมอ**: ใช้ชื่อคอลัมน์ `P/N Masked` แสดงเป็น `SM-A075*****` หรือ `F-NS776*****`
- **ห้ามเดาราคา**: ต้องไม่มีราคาคาดเดา หรือราคาทดแทนสำหรับรายการที่สูตรพัง (`#ERROR!`)
- มีคำอธิบายข้อผิดพลาดและวิธีแก้ไขที่ชัดเจน (`Required Action`)

### 1.3 กฎที่ทีมยืนยัน (`current/branch_confirmed_rules.md`)
ส่งออกกฎข้อตกลงสาขาที่ผ่านการ Sanitized แล้ว:
- แสดงเฉพาะบทบาท (เช่น `Store Leader`, `Branch Operations Manager`) แทนชื่อพนักงานจริง
- ระบุ Rule ID, คำอธิบายกฎ, รุ่นที่ครอบคลุม และวันที่ยืนยัน

### 1.4 คู่มือและ FAQ หน้าร้าน (`current/*.md`)
- `coupon_guide.md`: คู่มือคูปอง (วิธีแยก Coupon 01, 04, 06)
- `sale_mode_guide.md`: คู่มือโหมดการขาย (สด, รูดบัตร, ผ่อน, SF+, Trade Up)
- `promotion_summary.md`: สรุปภาพรวมโปรโมชั่นประจำรอบ

---

## 2. ข้อมูลต้องห้ามส่งออกเด็ดขาด (Strictly Out-of-Scope Blacklist)

หากตรวจพบข้อมูลประเภทนี้แม้แต่รายการเดียว **Export Validator จะสั่ง Block ทันที (`EXPORT_BLOCKED`)**:

```text
[CRITICAL VIOLATION - EXPORT BLOCKERS]
├── 1. Credentials & Auth: Passwords, PIN, OTP, Access Tokens, API Keys, Private Keys, Cookies
├── 2. Employee Identity: Personal Email, Mobile Numbers, National ID, Raw Windows Username
├── 3. Customer Data: Customer Names, Credit Card Numbers, Installment Accounts, IMEI Numbers
├── 4. POS & Nimbus Session: Active Cashier Tokens, Raw Transaction Records, Bill Numbers
├── 5. Infrastructure Leak: Absolute file paths (drive roots, user homes), internal tool dirs, Private IPs
└── 6. Unredacted Raw Data: Raw dump of raw_cells.json, Browser sessionStorage, Console logs
```

---

## 3. นิยาม Source Badges (ป้ายกำกับแหล่งที่มาของข้อมูล)

ทุกแถวของข้อมูลโปรโมชั่นต้องระบุ Source Badge 1 ใน 6 ค่าต่อไปนี้:

| Source Badge | คำอธิบายความน่าเชื่อถือ | พฤติกรรมที่อนุญาตสำหรับ NotebookLM |
| :--- | :--- | :--- |
| `EXCEL_CONFIRMED` | ข้อมูลปรากฏชัดเจนในไฟล์ Excel ต้นฉบับ | อ้างอิงเป็นข้อเท็จจริงได้ |
| `BRANCH_CONFIRMED` | กฎที่ยืนยันโดยทีมสาขาแต่ไม่ปรากฏใน Excel | ตอบโดยระบุว่าเป็นกฎข้อตกลงภายในสาขา |
| `BOTH_MATCH` | ข้อมูลใน Excel และกฎสาขาสอดคล้องตรงกัน 100% | มีความน่าเชื่อถือสูงสุด |
| `SOURCE_CONFLICT` | ข้อมูลสองแหล่งขัดแย้งกัน | **ต้องแสดงทั้งสองค่า** ห้ามเลือกข้าง |
| `RULE_ENGINE_DERIVED`| ค่าที่คำนวณผ่านสมการ (เช่น Net Price = RRP - Discount)| อธิบายสูตรคำนวณได้ |
| `UNPROVEN` | ข้อมูลขาดหลักฐานสนับสนุน | ห้ามตอบว่าเป็นข้อเท็จจริงเด็ดขาด |

---

## 4. ข้อกำหนดการแปลงชื่อไฟล์และเส้นทาง (Path Sanitization Rule)

- **ห้ามส่ง Full Local Path**: เช่น `C:\Company\InternalPath\Workbook.xlsx` หรือไดเรกทอรีส่วนตัวของนักพัฒนา
- **ให้แปลงเป็น Display Name**:
  - `Aug_ 2026 Promotion Retail_Shop Samsung .xlsx` ➔ `promo_retail.xlsx` หรือ `Promotion Retail Aug 2026.xlsx`
  - `Copy of Promotion Tab 01-30.09.2026.xlsx` ➔ `promo_tablet.xlsx` หรือ `Promotion Tablet Sep 2026.xlsx`
  - `Stock.xlsx` ➔ `Stock Master (Branch Inventory).xlsx`
