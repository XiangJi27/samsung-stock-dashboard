# รายงานโปรโมชั่นที่มีผลบังคับใช้ ณ วันที่ปัจจุบัน (Active Promotion Report)
- **วันที่ประเมิน (Local Current Date)**: `2026-09-06`
- **Import Batch ID**: `IMPORT-20260906-002`
- **จำนวน Variant โปรโมชั่นทั้งหมดในฐานข้อมูล**: 928 รายการ
- **จำนวนโปรโมชั่นที่เปิดใช้งานได้ในวันนี้ (Active Usable Promotions)**: 547 รายการ
- **จำนวนโปรโมชั่นที่หมดอายุแล้ว (Expired - รวมของแถมปี 2025)**: 306 รายการ
- **จำนวนโปรโมชั่นที่ถูกกักกัน (Blocked / Formula Error)**: 75 รายการ

## 1. สรุปสถานะความปลอดภัยและการแยกตามช่วงเวลา (Audit Matrix)
| สถานะการตรวจสอบ (Validation) | ปัจจุบันใช้งานได้ (ACTIVE) | หมดอายุแล้ว (EXPIRED) | ยังไม่ถึงกำหนด (FUTURE) | รวม |
| :--- | :---: | :---: | :---: | :---: |
| 🟢 **ผ่านการตรวจอัตโนมัติ (PASSED_VALIDATION)** | **112** | 0 | 0 | 112 |
| 🟡 **มีเงื่อนไข/ข้อควรระวัง (WARNING)** | **435** | 256 | 0 | 691 |
| ⏰ **ของแถมปี 2025 (HISTORICAL EXPIRED)** | 0 | 32 | 0 | 32 |
| ⛔ **ถูกกักกัน (BLOCKED / Formula Error)** | 0 | 75 | 0 | 75 |
| **รวมทั้งสิ้น** | **547** | **363** | **0** | **928** |

> [!IMPORTANT]
> **นโยบายการตัดขายหน้าร้าน POS (Batch: IMPORT-20260906-002)**: ระบบ Dashboard ดึงเฉพาะ Variant ที่มีสถานะ `validationStatus IN ('PASSED_VALIDATION', 'WARNING')` และอยู่ในช่วงวันที่ใช้งานได้จริง ณ ปัจจุบัน รวมทั้งสิ้น **547 รายการ** (ตัวเลข 589 เดิมเป็นยอดจาก Snapshot ก่อนการปลดพาส F ที่สินค้าหมดออกจากระบบ) ส่วนโปรโมชั่นที่หมดอายุและสูตรผิดพลาดจะถูกระงับการตัดขายโดยอัตโนมัติ

## 2. รายงานการตรวจสอบ 75 BLOCKED Variants (Formula Error Integrity)
- **จำนวนรายการที่ถูกบล็อกทั้งหมด**: 75 รายการ (คิดเป็น **75 SKU ไม่ซ้ำกัน**)
- **ไฟล์ต้นทาง (Source File)**: `Pro Tablet Acc samsung 3Aug2026.xlsx`
- **แผ่นงาน (Source Sheet)**: `รายการสินค้าที่ลด 50-70%`
- **ช่วงแถวใน Excel**: แถว 70 ถึง 144 (รวม 75 แถว)
- **ค่าราคาต้นทาง (Source RRP & Net)**: ปรากฏเป็น `#ERROR!` ในเซลล์ Excel โดยตรง
- **สาเหตุที่บล็อก (Block Reason)**: `SOURCE_FORMULA_ERROR`
- **ข้อกำหนดความปลอดภัย**: **ห้ามเดาราคาหรือนำ RRP ปกติมาอนุญาตให้ขายอัตโนมัติ** หากพบ `#ERROR!` สินค้าจะถูกกักกันจนกว่าจะมีไฟล์อัปเดตแก้ไขจากส่วนกลาง

### ตัวอย่างรายการที่ถูกบล็อก 10 ลำดับแรก:
| Promo ID | SKU (P/N) | ชื่อสินค้า | RRP ต้นทาง | Net Price ต้นทาง | สาเหตุที่บล็อก | แถวใน Excel |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: |
| `TAB-ACC-R70-EF-GS931CBEGWW` | `EF-GS931CBEGWW` | S25 Standing Grip Case | `#ERROR!` | `#ERROR!` | SOURCE_FORMULA_ERROR | แถว 70 |
| `TAB-ACC-R71-EF-GS931CJEGWW` | `EF-GS931CJEGWW` | S25 Standing Grip Case | `#ERROR!` | `#ERROR!` | SOURCE_FORMULA_ERROR | แถว 71 |
| `TAB-ACC-R72-EF-GS931CWEGWW` | `EF-GS931CWEGWW` | S25 Standing Grip Case | `#ERROR!` | `#ERROR!` | SOURCE_FORMULA_ERROR | แถว 72 |
| `TAB-ACC-R73-EF-GS936CBEGWW` | `EF-GS936CBEGWW` | S25+ Standing Grip Case | `#ERROR!` | `#ERROR!` | SOURCE_FORMULA_ERROR | แถว 73 |
| `TAB-ACC-R74-EF-GS936CJEGWW` | `EF-GS936CJEGWW` | S25+ Standing Grip Case | `#ERROR!` | `#ERROR!` | SOURCE_FORMULA_ERROR | แถว 74 |
| `TAB-ACC-R75-EF-GS936CWEGWW` | `EF-GS936CWEGWW` | S25+ Standing Grip Case | `#ERROR!` | `#ERROR!` | SOURCE_FORMULA_ERROR | แถว 75 |
| `TAB-ACC-R76-EF-GS938CBEGWW` | `EF-GS938CBEGWW` | S25 Ultra Standing Grip Case | `#ERROR!` | `#ERROR!` | SOURCE_FORMULA_ERROR | แถว 76 |
| `TAB-ACC-R77-EF-GS938CJEGWW` | `EF-GS938CJEGWW` | S25 Ultra Standing Grip Case | `#ERROR!` | `#ERROR!` | SOURCE_FORMULA_ERROR | แถว 77 |
| `TAB-ACC-R78-EF-GS938CWEGWW` | `EF-GS938CWEGWW` | S25 Ultra Standing Grip Case | `#ERROR!` | `#ERROR!` | SOURCE_FORMULA_ERROR | แถว 78 |
| `TAB-ACC-R79-EF-PS931CBEGWW` | `EF-PS931CBEGWW` | S25 Silicone Case | `#ERROR!` | `#ERROR!` | SOURCE_FORMULA_ERROR | แถว 79 |

## 3. ตารางตรวจสอบสินค้าตัวอย่างสำคัญตามข้อกำหนด (Mandatory Key Model Verification)
> [!NOTE]
> รายการด้านล่างแสดงผลการจับคู่โปรโมชั่นที่ **มีผลบังคับใช้จริงในวันนี้** พร้อม matchMethod และ productCodeType:

| SKU | Code Type | Model | Cap | Sale Mode | Match | RRP | Std Disc | TU Disc | Launch Disc | Net | Coupon | SF+ | TU | Std | Source | Row | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :---: |
| `SM-A576BDBSTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256 | **NORMAL** | BASELINE | 16,999 | - | - | - | **16,999** | `-` | N | N | N | Promotion | 35 | 🟢 |
| `SM-A576BDBSTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256 | **STANDARD_PAYMENT** | EXACT_PN | 16,999 | -2,000 | - | - | **14,999** | `01` | N | N | N | Promotion | 35 | 🟡 |
| `SM-A576BDBSTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256 | **STUDENT** | EXACT_PN | 16,999 | - | - | - | **14,450** | `Studentcrd` | N | N | Y | Promotion | 35 | 🟡 |
| `SM-A576BDBSTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256GB | **STUDENT** | MODEL_CAPACITY | 16,999 | - | - | - | **14,449** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 33 | 🟡 |
| `SM-A576BDBSTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 16,999 | -2,000 | - | - | **14,999** | `01` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 36 | 🟡 |
| `SM-A576BDBSTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256GB | **STUDENT** | MODEL_CAPACITY | 16,999 | - | - | - | **14,449** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 36 | 🟡 |
| `SM-A576BDBSTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256 | **STUDENT** | MODEL_ONLY | 16,999 | - | - | - | **15,299** | `Studentcrd` | N | N | Y | SES Student Campaign | 12 | 🟡 |
| `SM-A576BZVSTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256 | **NORMAL** | BASELINE | 16,999 | - | - | - | **16,999** | `-` | N | N | N | Promotion | 36 | 🟢 |
| `SM-A576BZVSTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256 | **STANDARD_PAYMENT** | EXACT_PN | 16,999 | -2,000 | - | - | **14,999** | `02` | N | N | N | Promotion | 36 | 🟡 |
| `SM-A576BZVSTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256 | **STUDENT** | EXACT_PN | 16,999 | - | - | - | **14,450** | `Studentcrd` | N | N | Y | Promotion | 36 | 🟡 |
| `SM-A576BZVSTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256GB | **STUDENT** | MODEL_CAPACITY | 16,999 | - | - | - | **14,449** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 33 | 🟡 |
| `SM-A576BZVSTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 16,999 | -2,000 | - | - | **14,999** | `01` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 36 | 🟡 |
| `SM-A576BZVSTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256GB | **STUDENT** | MODEL_CAPACITY | 16,999 | - | - | - | **14,449** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 36 | 🟡 |
| `SM-A576BZVSTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256 | **STUDENT** | MODEL_ONLY | 16,999 | - | - | - | **15,299** | `Studentcrd` | N | N | Y | SES Student Campaign | 12 | 🟡 |
| `SM-A576BZASTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256 | **NORMAL** | BASELINE | 16,999 | - | - | - | **16,999** | `-` | N | N | N | Promotion | 37 | 🟢 |
| `SM-A576BZASTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256 | **STANDARD_PAYMENT** | EXACT_PN | 16,999 | -2,000 | - | - | **14,999** | `02` | N | N | N | Promotion | 37 | 🟡 |
| `SM-A576BZASTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256 | **STUDENT** | EXACT_PN | 16,999 | - | - | - | **14,450** | `Studentcrd` | N | N | Y | Promotion | 37 | 🟡 |
| `SM-A576BZASTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256GB | **STUDENT** | MODEL_CAPACITY | 16,999 | - | - | - | **14,449** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 33 | 🟡 |
| `SM-A576BZASTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 16,999 | -2,000 | - | - | **14,999** | `01` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 36 | 🟡 |
| `SM-A576BZASTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256GB | **STUDENT** | MODEL_CAPACITY | 16,999 | - | - | - | **14,449** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 36 | 🟡 |
| `SM-A576BZASTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 8/256GB | 8/256 | **STUDENT** | MODEL_ONLY | 16,999 | - | - | - | **15,299** | `Studentcrd` | N | N | Y | SES Student Campaign | 12 | 🟡 |
| `SM-A576BDBTTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256 | **NORMAL** | BASELINE | 17,999 | - | - | - | **17,999** | `-` | N | N | N | Promotion | 38 | 🟢 |
| `SM-A576BDBTTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256 | **STANDARD_PAYMENT** | EXACT_PN | 17,999 | -2,000 | - | - | **15,999** | `02` | N | N | N | Promotion | 38 | 🟡 |
| `SM-A576BDBTTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256 | **STUDENT** | EXACT_PN | 17,999 | - | - | - | **15,480** | `Studentcrd` | N | N | Y | Promotion | 38 | 🟡 |
| `SM-A576BDBTTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256GB | **STUDENT** | MODEL_CAPACITY | 17,999 | - | - | - | **15,479** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 32 | 🟡 |
| `SM-A576BDBTTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 17,999 | -2,000 | - | - | **15,999** | `01` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 35 | 🟡 |
| `SM-A576BDBTTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256GB | **STUDENT** | MODEL_CAPACITY | 17,999 | - | - | - | **15,479** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 35 | 🟡 |
| `SM-A576BDBTTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256 | **STUDENT** | MODEL_ONLY | 17,999 | - | - | - | **16,199** | `Studentcrd` | N | N | Y | SES Student Campaign | 13 | 🟡 |
| `SM-A576BZVTTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256 | **NORMAL** | BASELINE | 17,999 | - | - | - | **17,999** | `-` | N | N | N | Promotion | 39 | 🟢 |
| `SM-A576BZVTTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256 | **STANDARD_PAYMENT** | EXACT_PN | 17,999 | -2,000 | - | - | **15,999** | `02` | N | N | N | Promotion | 39 | 🟡 |
| `SM-A576BZVTTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256 | **STUDENT** | EXACT_PN | 17,999 | - | - | - | **15,480** | `Studentcrd` | N | N | Y | Promotion | 39 | 🟡 |
| `SM-A576BZVTTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256GB | **STUDENT** | MODEL_CAPACITY | 17,999 | - | - | - | **15,479** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 32 | 🟡 |
| `SM-A576BZVTTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 17,999 | -2,000 | - | - | **15,999** | `01` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 35 | 🟡 |
| `SM-A576BZVTTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256GB | **STUDENT** | MODEL_CAPACITY | 17,999 | - | - | - | **15,479** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 35 | 🟡 |
| `SM-A576BZVTTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256 | **STUDENT** | MODEL_ONLY | 17,999 | - | - | - | **16,199** | `Studentcrd` | N | N | Y | SES Student Campaign | 13 | 🟡 |
| `SM-A576BZATTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256 | **NORMAL** | BASELINE | 17,999 | - | - | - | **17,999** | `-` | N | N | N | Promotion | 40 | 🟢 |
| `SM-A576BZATTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256 | **STANDARD_PAYMENT** | EXACT_PN | 17,999 | -2,000 | - | - | **15,999** | `02` | N | N | N | Promotion | 40 | 🟡 |
| `SM-A576BZATTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256 | **STUDENT** | EXACT_PN | 17,999 | - | - | - | **15,480** | `Studentcrd` | N | N | Y | Promotion | 40 | 🟡 |
| `SM-A576BZATTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256GB | **STUDENT** | MODEL_CAPACITY | 17,999 | - | - | - | **15,479** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 32 | 🟡 |
| `SM-A576BZATTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 17,999 | -2,000 | - | - | **15,999** | `01` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 35 | 🟡 |
| `SM-A576BZATTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256GB | **STUDENT** | MODEL_CAPACITY | 17,999 | - | - | - | **15,479** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 35 | 🟡 |
| `SM-A576BZATTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/256GB | 12/256 | **STUDENT** | MODEL_ONLY | 17,999 | - | - | - | **16,199** | `Studentcrd` | N | N | Y | SES Student Campaign | 13 | 🟡 |
| `SM-A576BDBUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512 | **NORMAL** | BASELINE | 20,999 | - | - | - | **20,999** | `-` | N | N | N | Promotion | 41 | 🟢 |
| `SM-A576BDBUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512 | **STANDARD_PAYMENT** | EXACT_PN | 20,999 | -2,000 | - | - | **18,999** | `02` | N | N | N | Promotion | 41 | 🟡 |
| `SM-A576BDBUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512 | **STUDENT** | EXACT_PN | 20,999 | - | - | - | **18,480** | `Studentcrd` | N | N | Y | Promotion | 41 | 🟡 |
| `SM-A576BDBUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512GB | **STUDENT** | MODEL_CAPACITY | 20,999 | - | - | - | **18,479** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 31 | 🟡 |
| `SM-A576BDBUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 20,999 | -3,000 | - | - | **17,999** | `01` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 34 | 🟡 |
| `SM-A576BDBUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512GB | **STUDENT** | MODEL_CAPACITY | 20,999 | - | - | - | **18,479** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 34 | 🟡 |
| `SM-A576BDBUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512 | **STUDENT** | MODEL_ONLY | 20,999 | - | - | - | **18,899** | `Studentcrd` | N | N | Y | SES Student Campaign | 14 | 🟡 |
| `SM-A576BZVUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512 | **NORMAL** | BASELINE | 20,999 | - | - | - | **20,999** | `-` | N | N | N | Promotion | 42 | 🟢 |
| `SM-A576BZVUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512 | **STANDARD_PAYMENT** | EXACT_PN | 20,999 | -2,000 | - | - | **18,999** | `02` | N | N | N | Promotion | 42 | 🟡 |
| `SM-A576BZVUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512 | **STUDENT** | EXACT_PN | 20,999 | - | - | - | **18,480** | `Studentcrd` | N | N | Y | Promotion | 42 | 🟡 |
| `SM-A576BZVUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512GB | **STUDENT** | MODEL_CAPACITY | 20,999 | - | - | - | **18,479** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 31 | 🟡 |
| `SM-A576BZVUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 20,999 | -3,000 | - | - | **17,999** | `01` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 34 | 🟡 |
| `SM-A576BZVUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512GB | **STUDENT** | MODEL_CAPACITY | 20,999 | - | - | - | **18,479** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 34 | 🟡 |
| `SM-A576BZVUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512 | **STUDENT** | MODEL_ONLY | 20,999 | - | - | - | **18,899** | `Studentcrd` | N | N | Y | SES Student Campaign | 14 | 🟡 |
| `SM-A576BZAUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512 | **NORMAL** | BASELINE | 20,999 | - | - | - | **20,999** | `-` | N | N | N | Promotion | 43 | 🟢 |
| `SM-A576BZAUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512 | **STANDARD_PAYMENT** | EXACT_PN | 20,999 | -2,000 | - | - | **18,999** | `02` | N | N | N | Promotion | 43 | 🟡 |
| `SM-A576BZAUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512 | **STUDENT** | EXACT_PN | 20,999 | - | - | - | **18,480** | `Studentcrd` | N | N | Y | Promotion | 43 | 🟡 |
| `SM-A576BZAUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512GB | **STUDENT** | MODEL_CAPACITY | 20,999 | - | - | - | **18,479** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 31 | 🟡 |
| `SM-A576BZAUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 20,999 | -3,000 | - | - | **17,999** | `01` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 34 | 🟡 |
| `SM-A576BZAUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512GB | **STUDENT** | MODEL_CAPACITY | 20,999 | - | - | - | **18,479** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 34 | 🟡 |
| `SM-A576BZAUTHL` | เครื่องเปล่า SM- | Galaxy A57 5G 12/512GB | 12/512 | **STUDENT** | MODEL_ONLY | 20,999 | - | - | - | **18,899** | `Studentcrd` | N | N | Y | SES Student Campaign | 14 | 🟡 |
| `SM-S731BDBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **NORMAL** | BASELINE | 22,900 | - | - | - | **22,900** | `-` | N | N | N | Promotion | 44 | 🟢 |
| `SM-S731BDBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **SF_PLUS** | EXACT_PN | 22,900 | -3,000 | - | - | **19,900** | `01` | Y | N | N | Promotion | 44 | 🟡 |
| `SM-S731BDBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **STANDARD_PAYMENT** | EXACT_PN | 22,900 | -5,000 | - | - | **17,900** | `02` | N | N | N | Promotion | 44 | 🟡 |
| `SM-S731BDBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **STUDENT** | EXACT_PN | 22,900 | - | - | - | **19,465** | `Studentcrd` | N | N | Y | Promotion | 44 | 🟡 |
| `SM-S731BDBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128GB | **SF_PLUS** | MODEL_CAPACITY | 22,900 | -3,000 | - | - | **19,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 15 | 🟡 |
| `SM-S731BDBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128GB | **STUDENT** | MODEL_CAPACITY | 22,900 | - | - | - | **19,465** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 15 | 🟡 |
| `SM-S731BDBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 22,900 | -5,000 | - | - | **17,900** | `02` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 17 | 🟡 |
| `SM-S731BDBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **STUDENT** | MODEL_ONLY | 22,900 | - | - | - | **19,465** | `Studentcrd` | N | N | Y | SES Student Campaign | 16 | 🟡 |
| `SM-S731BLBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **NORMAL** | BASELINE | 22,900 | - | - | - | **22,900** | `-` | N | N | N | Promotion | 45 | 🟢 |
| `SM-S731BLBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **SF_PLUS** | EXACT_PN | 22,900 | -3,000 | - | - | **19,900** | `01` | Y | N | N | Promotion | 45 | 🟢 |
| `SM-S731BLBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **STANDARD_PAYMENT** | EXACT_PN | 22,900 | -5,000 | - | - | **17,900** | `02` | N | N | N | Promotion | 45 | 🟡 |
| `SM-S731BLBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **STUDENT** | EXACT_PN | 22,900 | - | - | - | **19,465** | `Studentcrd` | N | N | Y | Promotion | 45 | 🟡 |
| `SM-S731BLBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128GB | **SF_PLUS** | MODEL_CAPACITY | 22,900 | -3,000 | - | - | **19,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 15 | 🟡 |
| `SM-S731BLBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128GB | **STUDENT** | MODEL_CAPACITY | 22,900 | - | - | - | **19,465** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 15 | 🟡 |
| `SM-S731BLBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 22,900 | -5,000 | - | - | **17,900** | `02` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 17 | 🟡 |
| `SM-S731BLBBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **STUDENT** | MODEL_ONLY | 22,900 | - | - | - | **19,465** | `Studentcrd` | N | N | Y | SES Student Campaign | 16 | 🟡 |
| `SM-S731BZKBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **NORMAL** | BASELINE | 22,900 | - | - | - | **22,900** | `-` | N | N | N | Promotion | 46 | 🟢 |
| `SM-S731BZKBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **SF_PLUS** | EXACT_PN | 22,900 | -3,000 | - | - | **19,900** | `01` | Y | N | N | Promotion | 46 | 🟢 |
| `SM-S731BZKBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **STANDARD_PAYMENT** | EXACT_PN | 22,900 | -5,000 | - | - | **17,900** | `02` | N | N | N | Promotion | 46 | 🟡 |
| `SM-S731BZKBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **STUDENT** | EXACT_PN | 22,900 | - | - | - | **19,465** | `Studentcrd` | N | N | Y | Promotion | 46 | 🟡 |
| `SM-S731BZKBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128GB | **SF_PLUS** | MODEL_CAPACITY | 22,900 | -3,000 | - | - | **19,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 15 | 🟡 |
| `SM-S731BZKBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128GB | **STUDENT** | MODEL_CAPACITY | 22,900 | - | - | - | **19,465** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 15 | 🟡 |
| `SM-S731BZKBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 22,900 | -5,000 | - | - | **17,900** | `02` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 17 | 🟡 |
| `SM-S731BZKBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **STUDENT** | MODEL_ONLY | 22,900 | - | - | - | **19,465** | `Studentcrd` | N | N | Y | SES Student Campaign | 16 | 🟡 |
| `SM-S731BZWBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **NORMAL** | BASELINE | 22,900 | - | - | - | **22,900** | `-` | N | N | N | Promotion | 47 | 🟢 |
| `SM-S731BZWBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **SF_PLUS** | EXACT_PN | 22,900 | -3,000 | - | - | **19,900** | `01` | Y | N | N | Promotion | 47 | 🟢 |
| `SM-S731BZWBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **STANDARD_PAYMENT** | EXACT_PN | 22,900 | -5,000 | - | - | **17,900** | `02` | N | N | N | Promotion | 47 | 🟡 |
| `SM-S731BZWBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **STUDENT** | EXACT_PN | 22,900 | - | - | - | **19,465** | `Studentcrd` | N | N | Y | Promotion | 47 | 🟡 |
| `SM-S731BZWBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128GB | **SF_PLUS** | MODEL_CAPACITY | 22,900 | -3,000 | - | - | **19,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 15 | 🟡 |
| `SM-S731BZWBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128GB | **STUDENT** | MODEL_CAPACITY | 22,900 | - | - | - | **19,465** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 15 | 🟡 |
| `SM-S731BZWBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 22,900 | -5,000 | - | - | **17,900** | `02` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 17 | 🟡 |
| `SM-S731BZWBTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/128GB) | 128 | **STUDENT** | MODEL_ONLY | 22,900 | - | - | - | **19,465** | `Studentcrd` | N | N | Y | SES Student Campaign | 16 | 🟡 |
| `SM-S731BDBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **NORMAL** | BASELINE | 26,900 | - | - | - | **26,900** | `-` | N | N | N | Promotion | 48 | 🟢 |
| `SM-S731BDBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **SF_PLUS** | EXACT_PN | 26,900 | -3,000 | - | - | **23,900** | `01` | Y | N | N | Promotion | 48 | 🟢 |
| `SM-S731BDBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **STANDARD_PAYMENT** | EXACT_PN | 26,900 | -6,000 | - | - | **20,900** | `02` | N | N | N | Promotion | 48 | 🟡 |
| `SM-S731BDBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **STUDENT** | EXACT_PN | 26,900 | - | - | - | **22,865** | `Studentcrd` | N | N | Y | Promotion | 48 | 🟡 |
| `SM-S731BDBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256GB | **SF_PLUS** | MODEL_CAPACITY | 26,900 | -3,000 | - | - | **23,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 14 | 🟡 |
| `SM-S731BDBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256GB | **STUDENT** | MODEL_CAPACITY | 26,900 | - | - | - | **22,865** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 14 | 🟡 |
| `SM-S731BDBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 26,900 | -6,000 | - | - | **20,900** | `02` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 16 | 🟡 |
| `SM-S731BDBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **STUDENT** | MODEL_ONLY | 26,900 | - | - | - | **22,865** | `Studentcrd` | N | N | Y | SES Student Campaign | 17 | 🟡 |
| `SM-S731BLBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **NORMAL** | BASELINE | 26,900 | - | - | - | **26,900** | `-` | N | N | N | Promotion | 49 | 🟢 |
| `SM-S731BLBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **SF_PLUS** | EXACT_PN | 26,900 | -3,000 | - | - | **23,900** | `01` | Y | N | N | Promotion | 49 | 🟢 |
| `SM-S731BLBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **STANDARD_PAYMENT** | EXACT_PN | 26,900 | -6,000 | - | - | **20,900** | `02` | N | N | N | Promotion | 49 | 🟡 |
| `SM-S731BLBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **STUDENT** | EXACT_PN | 26,900 | - | - | - | **22,865** | `Studentcrd` | N | N | Y | Promotion | 49 | 🟡 |
| `SM-S731BLBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256GB | **SF_PLUS** | MODEL_CAPACITY | 26,900 | -3,000 | - | - | **23,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 14 | 🟡 |
| `SM-S731BLBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256GB | **STUDENT** | MODEL_CAPACITY | 26,900 | - | - | - | **22,865** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 14 | 🟡 |
| `SM-S731BLBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 26,900 | -6,000 | - | - | **20,900** | `02` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 16 | 🟡 |
| `SM-S731BLBCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **STUDENT** | MODEL_ONLY | 26,900 | - | - | - | **22,865** | `Studentcrd` | N | N | Y | SES Student Campaign | 17 | 🟡 |
| `SM-S731BZKCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **NORMAL** | BASELINE | 26,900 | - | - | - | **26,900** | `-` | N | N | N | Promotion | 50 | 🟢 |
| `SM-S731BZKCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **SF_PLUS** | EXACT_PN | 26,900 | -3,000 | - | - | **23,900** | `01` | Y | N | N | Promotion | 50 | 🟢 |
| `SM-S731BZKCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **STANDARD_PAYMENT** | EXACT_PN | 26,900 | -6,000 | - | - | **20,900** | `02` | N | N | N | Promotion | 50 | 🟡 |
| `SM-S731BZKCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **STUDENT** | EXACT_PN | 26,900 | - | - | - | **22,865** | `Studentcrd` | N | N | Y | Promotion | 50 | 🟡 |
| `SM-S731BZKCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256GB | **SF_PLUS** | MODEL_CAPACITY | 26,900 | -3,000 | - | - | **23,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 14 | 🟡 |
| `SM-S731BZKCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256GB | **STUDENT** | MODEL_CAPACITY | 26,900 | - | - | - | **22,865** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 14 | 🟡 |
| `SM-S731BZKCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 26,900 | -6,000 | - | - | **20,900** | `02` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 16 | 🟡 |
| `SM-S731BZKCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **STUDENT** | MODEL_ONLY | 26,900 | - | - | - | **22,865** | `Studentcrd` | N | N | Y | SES Student Campaign | 17 | 🟡 |
| `SM-S731BZWCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **NORMAL** | BASELINE | 26,900 | - | - | - | **26,900** | `-` | N | N | N | Promotion | 51 | 🟢 |
| `SM-S731BZWCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **SF_PLUS** | EXACT_PN | 26,900 | -3,000 | - | - | **23,900** | `01` | Y | N | N | Promotion | 51 | 🟢 |
| `SM-S731BZWCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **STANDARD_PAYMENT** | EXACT_PN | 26,900 | -6,000 | - | - | **20,900** | `02` | N | N | N | Promotion | 51 | 🟡 |
| `SM-S731BZWCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **STUDENT** | EXACT_PN | 26,900 | - | - | - | **22,865** | `Studentcrd` | N | N | Y | Promotion | 51 | 🟡 |
| `SM-S731BZWCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256GB | **SF_PLUS** | MODEL_CAPACITY | 26,900 | -3,000 | - | - | **23,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 14 | 🟡 |
| `SM-S731BZWCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256GB | **STUDENT** | MODEL_CAPACITY | 26,900 | - | - | - | **22,865** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 14 | 🟡 |
| `SM-S731BZWCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 26,900 | -6,000 | - | - | **20,900** | `02` | N | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 16 | 🟡 |
| `SM-S731BZWCTHL` | เครื่องเปล่า SM- | Galaxy S25 FE (8/256GB) | 256 | **STUDENT** | MODEL_ONLY | 26,900 | - | - | - | **22,865** | `Studentcrd` | N | N | Y | SES Student Campaign | 17 | 🟡 |
| `SM-S948BZKBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **NORMAL** | BASELINE | 46,900 | - | - | - | **46,900** | `-` | N | N | N | Promotion | 80 | 🟢 |
| `SM-S948BZKBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **SF_PLUS** | EXACT_PN | 46,900 | -5,000 | - | - | **41,900** | `01` | Y | Y | N | Promotion | 80 | 🟢 |
| `SM-S948BZKBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **STUDENT** | EXACT_PN | 46,900 | - | - | - | **39,865** | `Studentcrd` | N | N | Y | Promotion | 80 | 🟡 |
| `SM-S948BZKBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256GB | **SF_PLUS** | MODEL_CAPACITY | 46,900 | -5,000 | - | - | **41,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 6 | 🟡 |
| `SM-S948BZKBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256GB | **TRADE_UP** | MODEL_CAPACITY | 46,900 | - | -7,000 | - | **39,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 6 | 🟡 |
| `SM-S948BZKBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256GB | **STUDENT** | MODEL_CAPACITY | 46,900 | - | - | - | **39,865** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 6 | 🟡 |
| `SM-S948BZKBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **STUDENT** | MODEL_ONLY | 46,900 | - | - | - | **42,210** | `Studentcrd` | N | N | Y | SES Student Campaign | 18 | 🟡 |
| `SM-S948BLBBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **NORMAL** | BASELINE | 46,900 | - | - | - | **46,900** | `-` | N | N | N | Promotion | 81 | 🟢 |
| `SM-S948BLBBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **SF_PLUS** | EXACT_PN | 46,900 | -5,000 | - | - | **41,900** | `01` | Y | N | N | Promotion | 81 | 🟢 |
| `SM-S948BLBBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **STUDENT** | EXACT_PN | 46,900 | - | - | - | **39,865** | `Studentcrd` | N | N | Y | Promotion | 81 | 🟡 |
| `SM-S948BLBBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256GB | **SF_PLUS** | MODEL_CAPACITY | 46,900 | -5,000 | - | - | **41,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 6 | 🟡 |
| `SM-S948BLBBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256GB | **TRADE_UP** | MODEL_CAPACITY | 46,900 | - | -7,000 | - | **39,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 6 | 🟡 |
| `SM-S948BLBBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256GB | **STUDENT** | MODEL_CAPACITY | 46,900 | - | - | - | **39,865** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 6 | 🟡 |
| `SM-S948BLBBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **STUDENT** | MODEL_ONLY | 46,900 | - | - | - | **42,210** | `Studentcrd` | N | N | Y | SES Student Campaign | 18 | 🟡 |
| `SM-S948BZVBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **NORMAL** | BASELINE | 46,900 | - | - | - | **46,900** | `-` | N | N | N | Promotion | 82 | 🟢 |
| `SM-S948BZVBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **SF_PLUS** | EXACT_PN | 46,900 | -5,000 | - | - | **41,900** | `01` | Y | N | N | Promotion | 82 | 🟢 |
| `SM-S948BZVBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **STUDENT** | EXACT_PN | 46,900 | - | - | - | **39,865** | `Studentcrd` | N | N | Y | Promotion | 82 | 🟡 |
| `SM-S948BZVBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256GB | **SF_PLUS** | MODEL_CAPACITY | 46,900 | -5,000 | - | - | **41,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 6 | 🟡 |
| `SM-S948BZVBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256GB | **TRADE_UP** | MODEL_CAPACITY | 46,900 | - | -7,000 | - | **39,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 6 | 🟡 |
| `SM-S948BZVBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256GB | **STUDENT** | MODEL_CAPACITY | 46,900 | - | - | - | **39,865** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 6 | 🟡 |
| `SM-S948BZVBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **STUDENT** | MODEL_ONLY | 46,900 | - | - | - | **42,210** | `Studentcrd` | N | N | Y | SES Student Campaign | 18 | 🟡 |
| `SM-S948BZWBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **NORMAL** | BASELINE | 46,900 | - | - | - | **46,900** | `-` | N | N | N | Promotion | 83 | 🟢 |
| `SM-S948BZWBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **SF_PLUS** | EXACT_PN | 46,900 | -5,000 | - | - | **41,900** | `01` | Y | N | N | Promotion | 83 | 🟢 |
| `SM-S948BZWBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **STUDENT** | EXACT_PN | 46,900 | - | - | - | **39,865** | `Studentcrd` | N | N | Y | Promotion | 83 | 🟡 |
| `SM-S948BZWBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256GB | **SF_PLUS** | MODEL_CAPACITY | 46,900 | -5,000 | - | - | **41,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 6 | 🟡 |
| `SM-S948BZWBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256GB | **TRADE_UP** | MODEL_CAPACITY | 46,900 | - | -7,000 | - | **39,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 6 | 🟡 |
| `SM-S948BZWBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256GB | **STUDENT** | MODEL_CAPACITY | 46,900 | - | - | - | **39,865** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 6 | 🟡 |
| `SM-S948BZWBTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/256GB | 256 | **STUDENT** | MODEL_ONLY | 46,900 | - | - | - | **42,210** | `Studentcrd` | N | N | Y | SES Student Campaign | 18 | 🟡 |
| `SM-S948BZKCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512 | **NORMAL** | BASELINE | 54,900 | - | - | - | **54,900** | `-` | N | N | N | Promotion | 84 | 🟢 |
| `SM-S948BZKCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512 | **SF_PLUS** | EXACT_PN | 54,900 | -5,000 | - | - | **49,900** | `01` | Y | N | N | Promotion | 84 | 🟢 |
| `SM-S948BZKCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512 | **STUDENT** | EXACT_PN | 54,900 | - | - | - | **46,665** | `Studentcrd` | N | N | Y | Promotion | 84 | 🟡 |
| `SM-S948BZKCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512GB | **SF_PLUS** | MODEL_CAPACITY | 54,900 | -5,000 | - | - | **49,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 5 | 🟡 |
| `SM-S948BZKCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512GB | **TRADE_UP** | MODEL_CAPACITY | 54,900 | - | -10,000 | - | **44,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 5 | 🟡 |
| `SM-S948BZKCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512GB | **STUDENT** | MODEL_CAPACITY | 54,900 | - | - | - | **46,665** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 5 | 🟡 |
| `SM-S948BLBCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512 | **NORMAL** | BASELINE | 54,900 | - | - | - | **54,900** | `-` | N | N | N | Promotion | 85 | 🟢 |
| `SM-S948BLBCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512 | **SF_PLUS** | EXACT_PN | 54,900 | -5,000 | - | - | **49,900** | `01` | Y | N | N | Promotion | 85 | 🟢 |
| `SM-S948BLBCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512 | **STUDENT** | EXACT_PN | 54,900 | - | - | - | **46,665** | `Studentcrd` | N | N | Y | Promotion | 85 | 🟡 |
| `SM-S948BLBCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512GB | **SF_PLUS** | MODEL_CAPACITY | 54,900 | -5,000 | - | - | **49,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 5 | 🟡 |
| `SM-S948BLBCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512GB | **TRADE_UP** | MODEL_CAPACITY | 54,900 | - | -10,000 | - | **44,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 5 | 🟡 |
| `SM-S948BLBCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512GB | **STUDENT** | MODEL_CAPACITY | 54,900 | - | - | - | **46,665** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 5 | 🟡 |
| `SM-S948BZVCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512 | **NORMAL** | BASELINE | 54,900 | - | - | - | **54,900** | `-` | N | N | N | Promotion | 86 | 🟢 |
| `SM-S948BZVCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512 | **SF_PLUS** | EXACT_PN | 54,900 | -5,000 | - | - | **49,900** | `01` | Y | N | N | Promotion | 86 | 🟢 |
| `SM-S948BZVCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512 | **STUDENT** | EXACT_PN | 54,900 | - | - | - | **46,665** | `Studentcrd` | N | N | Y | Promotion | 86 | 🟡 |
| `SM-S948BZVCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512GB | **SF_PLUS** | MODEL_CAPACITY | 54,900 | -5,000 | - | - | **49,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 5 | 🟡 |
| `SM-S948BZVCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512GB | **TRADE_UP** | MODEL_CAPACITY | 54,900 | - | -10,000 | - | **44,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 5 | 🟡 |
| `SM-S948BZVCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512GB | **STUDENT** | MODEL_CAPACITY | 54,900 | - | - | - | **46,665** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 5 | 🟡 |
| `SM-S948BZWCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512 | **NORMAL** | BASELINE | 54,900 | - | - | - | **54,900** | `-` | N | N | N | Promotion | 87 | 🟢 |
| `SM-S948BZWCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512 | **SF_PLUS** | EXACT_PN | 54,900 | -5,000 | - | - | **49,900** | `01` | Y | N | N | Promotion | 87 | 🟢 |
| `SM-S948BZWCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512 | **STUDENT** | EXACT_PN | 54,900 | - | - | - | **46,665** | `Studentcrd` | N | N | Y | Promotion | 87 | 🟡 |
| `SM-S948BZWCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512GB | **SF_PLUS** | MODEL_CAPACITY | 54,900 | -5,000 | - | - | **49,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 5 | 🟡 |
| `SM-S948BZWCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512GB | **TRADE_UP** | MODEL_CAPACITY | 54,900 | - | -10,000 | - | **44,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 5 | 🟡 |
| `SM-S948BZWCTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/512GB | 512GB | **STUDENT** | MODEL_CAPACITY | 54,900 | - | - | - | **46,665** | `Studentcrd` | N | N | Y | อัพเดท 28 Aug - 6 Sep ล่าสุด | 5 | 🟡 |
| `SM-S948BZKQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1tb | **NORMAL** | BASELINE | 66,900 | - | - | - | **66,900** | `-` | N | N | N | Promotion | 88 | 🟢 |
| `SM-S948BZKQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1tb | **SF_PLUS** | EXACT_PN | 66,900 | -5,000 | - | - | **61,900** | `01` | Y | N | N | Promotion | 88 | 🟢 |
| `SM-S948BZKQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1TB | **SF_PLUS** | MODEL_CAPACITY | 66,900 | -5,000 | - | - | **61,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 4 | 🟡 |
| `SM-S948BZKQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1TB | **TRADE_UP** | MODEL_CAPACITY | 66,900 | - | -10,000 | - | **56,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 4 | 🟡 |
| `SM-S948BLBQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1tb | **NORMAL** | BASELINE | 66,900 | - | - | - | **66,900** | `-` | N | N | N | Promotion | 89 | 🟢 |
| `SM-S948BLBQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1tb | **SF_PLUS** | EXACT_PN | 66,900 | -5,000 | - | - | **61,900** | `01` | Y | N | N | Promotion | 89 | 🟢 |
| `SM-S948BLBQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1TB | **SF_PLUS** | MODEL_CAPACITY | 66,900 | -5,000 | - | - | **61,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 4 | 🟡 |
| `SM-S948BLBQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1TB | **TRADE_UP** | MODEL_CAPACITY | 66,900 | - | -10,000 | - | **56,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 4 | 🟡 |
| `SM-S948BZVQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1tb | **NORMAL** | BASELINE | 66,900 | - | - | - | **66,900** | `-` | N | N | N | Promotion | 90 | 🟢 |
| `SM-S948BZVQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1tb | **SF_PLUS** | EXACT_PN | 66,900 | -5,000 | - | - | **61,900** | `01` | Y | N | N | Promotion | 90 | 🟢 |
| `SM-S948BZVQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1TB | **SF_PLUS** | MODEL_CAPACITY | 66,900 | -5,000 | - | - | **61,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 4 | 🟡 |
| `SM-S948BZVQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1TB | **TRADE_UP** | MODEL_CAPACITY | 66,900 | - | -10,000 | - | **56,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 4 | 🟡 |
| `SM-S948BZWQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1tb | **NORMAL** | BASELINE | 66,900 | - | - | - | **66,900** | `-` | N | N | N | Promotion | 91 | 🟢 |
| `SM-S948BZWQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1tb | **SF_PLUS** | EXACT_PN | 66,900 | -5,000 | - | - | **61,900** | `01` | Y | N | N | Promotion | 91 | 🟢 |
| `SM-S948BZWQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1TB | **SF_PLUS** | MODEL_CAPACITY | 66,900 | -5,000 | - | - | **61,900** | `01` | Y | N | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 4 | 🟡 |
| `SM-S948BZWQTHL` | เครื่องเปล่า SM- | Galaxy S26 Ultra 5G 12/1TB | 1TB | **TRADE_UP** | MODEL_CAPACITY | 66,900 | - | -10,000 | - | **56,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 4 | 🟡 |
| `F-NS971BLVDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/256GB  รหัส F | 256 | **NORMAL** | BASELINE | 61,900 | - | - | - | **61,900** | `-` | N | N | N | Promotion | 118 | 🟢 |
| `F-NS971BLVDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/256GB  รหัส F | 256 | **SF_PLUS** | EXACT_PN | 61,900 | -1,000 | - | -1,000 | **60,900** | `01` | Y | Y | N | Promotion | 118 | 🟢 |
| `F-NS971BZKDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/256GB  รหัส F | 256 | **NORMAL** | BASELINE | 61,900 | - | - | - | **61,900** | `-` | N | N | N | Promotion | 119 | 🟢 |
| `F-NS971BZKDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/256GB  รหัส F | 256 | **SF_PLUS** | EXACT_PN | 61,900 | -1,000 | - | -1,000 | **60,900** | `01` | Y | N | N | Promotion | 119 | 🟢 |
| `F-NS971BZWDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/256GB  รหัส F | 256 | **NORMAL** | BASELINE | 61,900 | - | - | - | **61,900** | `-` | N | N | N | Promotion | 120 | 🟢 |
| `F-NS971BZWDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/256GB  รหัส F | 256 | **SF_PLUS** | EXACT_PN | 61,900 | -1,000 | - | -1,000 | **60,900** | `01` | Y | N | N | Promotion | 120 | 🟢 |
| `F-NS971BLVGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/512GB  รหัส F | 512 | **NORMAL** | BASELINE | 69,900 | - | - | - | **69,900** | `-` | N | N | N | Promotion | 121 | 🟢 |
| `F-NS971BLVGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/512GB  รหัส F | 512 | **SF_PLUS** | EXACT_PN | 69,900 | -5,000 | - | -5,000 | **64,900** | `01` | Y | Y | N | Promotion | 121 | 🟡 |
| `F-NS971BZKGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/512GB  รหัส F | 512 | **NORMAL** | BASELINE | 69,900 | - | - | - | **69,900** | `-` | N | N | N | Promotion | 122 | 🟢 |
| `F-NS971BZKGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/512GB  รหัส F | 512 | **SF_PLUS** | EXACT_PN | 69,900 | -5,000 | - | -5,000 | **64,900** | `01` | Y | N | N | Promotion | 122 | 🟢 |
| `F-NS971BZWGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/512GB  รหัส F | 512 | **NORMAL** | BASELINE | 69,900 | - | - | - | **69,900** | `-` | N | N | N | Promotion | 123 | 🟢 |
| `F-NS971BZWGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/512GB  รหัส F | 512 | **SF_PLUS** | EXACT_PN | 69,900 | -5,000 | - | -5,000 | **64,900** | `01` | Y | N | N | Promotion | 123 | 🟢 |
| `F-NS971BLVHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 16/1TB  รหัส F | 1tb | **NORMAL** | BASELINE | 85,900 | - | - | - | **85,900** | `-` | N | N | N | Promotion | 124 | 🟢 |
| `F-NS971BLVHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 16/1TB  รหัส F | 1tb | **SF_PLUS** | EXACT_PN | 85,900 | -5,000 | - | -5,000 | **80,900** | `01` | Y | N | N | Promotion | 124 | 🟢 |
| `F-NS971BZKHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 16/1TB  รหัส F | 1tb | **NORMAL** | BASELINE | 85,900 | - | - | - | **85,900** | `-` | N | N | N | Promotion | 125 | 🟢 |
| `F-NS971BZKHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 16/1TB  รหัส F | 1tb | **SF_PLUS** | EXACT_PN | 85,900 | -5,000 | - | -5,000 | **80,900** | `01` | Y | N | N | Promotion | 125 | 🟢 |
| `F-NS971BZWHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 16/1TB  รหัส F | 1tb | **NORMAL** | BASELINE | 85,900 | - | - | - | **85,900** | `-` | N | N | N | Promotion | 126 | 🟢 |
| `F-NS971BZWHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 16/1TB  รหัส F | 1tb | **SF_PLUS** | EXACT_PN | 85,900 | -5,000 | - | -5,000 | **80,900** | `01` | Y | N | N | Promotion | 126 | 🟢 |
| `SM-F971BLVDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 256 | **NORMAL** | BASELINE | 61,900 | - | - | - | **61,900** | `-` | N | N | N | Promotion | 127 | 🟢 |
| `SM-F971BLVDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 256GB | **TRADE_UP** | MODEL_CAPACITY | 61,900 | - | -5,000 | - | **56,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 23 | 🟡 |
| `SM-F971BZKDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 256 | **NORMAL** | BASELINE | 61,900 | - | - | - | **61,900** | `-` | N | N | N | Promotion | 128 | 🟢 |
| `SM-F971BZKDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 256GB | **TRADE_UP** | MODEL_CAPACITY | 61,900 | - | -5,000 | - | **56,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 23 | 🟡 |
| `SM-F971BZWDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 256 | **NORMAL** | BASELINE | 61,900 | - | - | - | **61,900** | `-` | N | N | N | Promotion | 129 | 🟢 |
| `SM-F971BZWDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 256GB | **TRADE_UP** | MODEL_CAPACITY | 61,900 | - | -5,000 | - | **56,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 23 | 🟡 |
| `SM-F971BLVGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 512 | **NORMAL** | BASELINE | 69,900 | - | - | - | **69,900** | `-` | N | N | N | Promotion | 130 | 🟢 |
| `SM-F971BLVGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 512GB | **TRADE_UP** | MODEL_CAPACITY | 69,900 | - | -5,000 | - | **64,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 22 | 🟡 |
| `SM-F971BZKGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 512 | **NORMAL** | BASELINE | 69,900 | - | - | - | **69,900** | `-` | N | N | N | Promotion | 131 | 🟢 |
| `SM-F971BZKGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 512GB | **TRADE_UP** | MODEL_CAPACITY | 69,900 | - | -5,000 | - | **64,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 22 | 🟡 |
| `SM-F971BZWGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 512 | **NORMAL** | BASELINE | 69,900 | - | - | - | **69,900** | `-` | N | N | N | Promotion | 132 | 🟢 |
| `SM-F971BZWGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 512GB | **TRADE_UP** | MODEL_CAPACITY | 69,900 | - | -5,000 | - | **64,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 22 | 🟡 |
| `SM-F971BLVHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 1tb | **NORMAL** | BASELINE | 85,900 | - | - | - | **85,900** | `-` | N | N | N | Promotion | 133 | 🟢 |
| `SM-F971BLVHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 1TB | **TRADE_UP** | MODEL_CAPACITY | 85,900 | - | -7,000 | - | **78,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 21 | 🟡 |
| `SM-F971BZKHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 1tb | **NORMAL** | BASELINE | 85,900 | - | - | - | **85,900** | `-` | N | N | N | Promotion | 134 | 🟢 |
| `SM-F971BZKHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 1TB | **TRADE_UP** | MODEL_CAPACITY | 85,900 | - | -7,000 | - | **78,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 21 | 🟡 |
| `SM-F971BZWHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 1tb | **NORMAL** | BASELINE | 85,900 | - | - | - | **85,900** | `-` | N | N | N | Promotion | 135 | 🟢 |
| `SM-F971BZWHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 1TB | **TRADE_UP** | MODEL_CAPACITY | 85,900 | - | -7,000 | - | **78,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 21 | 🟡 |
| `F-NS976BZKDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/256GB  รหัส F | 256 | **NORMAL** | BASELINE | 69,900 | - | - | - | **69,900** | `-` | N | N | N | Promotion | 136 | 🟢 |
| `F-NS976BZKDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/256GB  รหัส F | 256 | **SF_PLUS** | EXACT_PN | 69,900 | -1,000 | - | -1,000 | **68,900** | `01` | Y | Y | N | Promotion | 136 | 🟢 |
| `F-NS976BZVDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/256GB  รหัส F | 256 | **NORMAL** | BASELINE | 69,900 | - | - | - | **69,900** | `-` | N | N | N | Promotion | 137 | 🟢 |
| `F-NS976BZVDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/256GB  รหัส F | 256 | **SF_PLUS** | EXACT_PN | 69,900 | -1,000 | - | -1,000 | **68,900** | `01` | Y | N | N | Promotion | 137 | 🟢 |
| `F-NS976BZWDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/256GB  รหัส F | 256 | **NORMAL** | BASELINE | 69,900 | - | - | - | **69,900** | `-` | N | N | N | Promotion | 138 | 🟢 |
| `F-NS976BZWDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/256GB  รหัส F | 256 | **SF_PLUS** | EXACT_PN | 69,900 | -1,000 | - | -1,000 | **68,900** | `01` | Y | N | N | Promotion | 138 | 🟢 |
| `F-NS976BZKGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/512GB  รหัส F | 512 | **NORMAL** | BASELINE | 77,900 | - | - | - | **77,900** | `-` | N | N | N | Promotion | 139 | 🟢 |
| `F-NS976BZKGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/512GB  รหัส F | 512 | **SF_PLUS** | EXACT_PN | 77,900 | -5,000 | - | -5,000 | **72,900** | `01` | Y | Y | N | Promotion | 139 | 🟡 |
| `F-NS976BZVGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/512GB  รหัส F | 512 | **NORMAL** | BASELINE | 77,900 | - | - | - | **77,900** | `-` | N | N | N | Promotion | 140 | 🟢 |
| `F-NS976BZVGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/512GB  รหัส F | 512 | **SF_PLUS** | EXACT_PN | 77,900 | -5,000 | - | -5,000 | **72,900** | `01` | Y | N | N | Promotion | 140 | 🟢 |
| `F-NS976BZWGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/512GB  รหัส F | 512 | **NORMAL** | BASELINE | 77,900 | - | - | - | **77,900** | `-` | N | N | N | Promotion | 141 | 🟢 |
| `F-NS976BZWGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/512GB  รหัส F | 512 | **SF_PLUS** | EXACT_PN | 77,900 | -5,000 | - | -5,000 | **72,900** | `01` | Y | N | N | Promotion | 141 | 🟢 |
| `F-NS976BZKHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 16/1TB  รหัส F | 1tb | **NORMAL** | BASELINE | 93,900 | - | - | - | **93,900** | `-` | N | N | N | Promotion | 142 | 🟢 |
| `F-NS976BZKHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 16/1TB  รหัส F | 1tb | **SF_PLUS** | EXACT_PN | 93,900 | -5,000 | - | -5,000 | **88,900** | `01` | Y | N | N | Promotion | 142 | 🟢 |
| `F-NS976BZVHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 16/1TB  รหัส F | 1tb | **NORMAL** | BASELINE | 93,900 | - | - | - | **93,900** | `-` | N | N | N | Promotion | 143 | 🟢 |
| `F-NS976BZVHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 16/1TB  รหัส F | 1tb | **SF_PLUS** | EXACT_PN | 93,900 | -5,000 | - | -5,000 | **88,900** | `01` | Y | N | N | Promotion | 143 | 🟢 |
| `F-NS976BZWHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 16/1TB  รหัส F | 1tb | **NORMAL** | BASELINE | 93,900 | - | - | - | **93,900** | `-` | N | N | N | Promotion | 144 | 🟢 |
| `F-NS976BZWHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 16/1TB  รหัส F | 1tb | **SF_PLUS** | EXACT_PN | 93,900 | -5,000 | - | -5,000 | **88,900** | `01` | Y | N | N | Promotion | 144 | 🟢 |
| `SM-F976BZKDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 256 | **NORMAL** | BASELINE | 69,900 | - | - | - | **69,900** | `-` | N | N | N | Promotion | 145 | 🟢 |
| `SM-F976BZKDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 256GB | **TRADE_UP** | MODEL_CAPACITY | 69,900 | - | -5,000 | - | **64,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 20 | 🟡 |
| `SM-F976BZVDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 256 | **NORMAL** | BASELINE | 69,900 | - | - | - | **69,900** | `-` | N | N | N | Promotion | 146 | 🟢 |
| `SM-F976BZVDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 256GB | **TRADE_UP** | MODEL_CAPACITY | 69,900 | - | -5,000 | - | **64,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 20 | 🟡 |
| `SM-F976BZWDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 256 | **NORMAL** | BASELINE | 69,900 | - | - | - | **69,900** | `-` | N | N | N | Promotion | 147 | 🟢 |
| `SM-F976BZWDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 256GB | **TRADE_UP** | MODEL_CAPACITY | 69,900 | - | -5,000 | - | **64,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 20 | 🟡 |
| `SM-F976BZKGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 512 | **NORMAL** | BASELINE | 77,900 | - | - | - | **77,900** | `-` | N | N | N | Promotion | 148 | 🟢 |
| `SM-F976BZKGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 512GB | **TRADE_UP** | MODEL_CAPACITY | 77,900 | - | -5,000 | - | **72,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 19 | 🟡 |
| `SM-F976BZVGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 512 | **NORMAL** | BASELINE | 77,900 | - | - | - | **77,900** | `-` | N | N | N | Promotion | 149 | 🟢 |
| `SM-F976BZVGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 512GB | **TRADE_UP** | MODEL_CAPACITY | 77,900 | - | -5,000 | - | **72,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 19 | 🟡 |
| `SM-F976BZWGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 512 | **NORMAL** | BASELINE | 77,900 | - | - | - | **77,900** | `-` | N | N | N | Promotion | 150 | 🟢 |
| `SM-F976BZWGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 512GB | **TRADE_UP** | MODEL_CAPACITY | 77,900 | - | -5,000 | - | **72,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 19 | 🟡 |
| `SM-F976BZKHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 1tb | **NORMAL** | BASELINE | 93,900 | - | - | - | **93,900** | `-` | N | N | N | Promotion | 151 | 🟢 |
| `SM-F976BZKHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 1TB | **TRADE_UP** | MODEL_CAPACITY | 93,900 | - | -7,000 | - | **86,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 18 | 🟡 |
| `SM-F976BZVHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 1tb | **NORMAL** | BASELINE | 93,900 | - | - | - | **93,900** | `-` | N | N | N | Promotion | 152 | 🟢 |
| `SM-F976BZVHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 1TB | **TRADE_UP** | MODEL_CAPACITY | 93,900 | - | -7,000 | - | **86,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 18 | 🟡 |
| `SM-F976BZWHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 1tb | **NORMAL** | BASELINE | 93,900 | - | - | - | **93,900** | `-` | N | N | N | Promotion | 153 | 🟢 |
| `SM-F976BZWHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 1TB | **TRADE_UP** | MODEL_CAPACITY | 93,900 | - | -7,000 | - | **86,900** | `T-UP-CO-S` | N | Y | N | อัพเดท 28 Aug - 6 Sep ล่าสุด | 18 | 🟡 |
| `F-X236BZAAFBX2` | พาส F / ชุดเปิดตัว | Galaxy Tab A11Plus 5G 6/128GB | - | **NORMAL** | BASELINE | 10,490 | - | - | - | **10,490** | `-` | N | N | N | Promotion | 176 | 🟢 |
| `F-X236BZAAFBX2` | พาส F / ชุดเปิดตัว | Galaxy Tab A11Plus 5G 6/128GB | - | **SF_PLUS** | EXACT_PN | 10,490 | -500 | - | -500 | **9,990** | `01` | Y | N | N | Promotion | 176 | 🟢 |
| `F-X236BZAAFBX2` | พาส F / ชุดเปิดตัว | Galaxy Tab A11Plus 5G 6/128GB | - | **STANDARD_PAYMENT** | EXACT_PN | 10,490 | -1,500 | - | -1,500 | **8,990** | `04` | N | N | N | Promotion | 176 | 🟡 |
| `F-X236BZAAFBX2` | พาส F / ชุดเปิดตัว | Galaxy Tab A11Plus 5G 6/128GB | - | **STUDENT** | EXACT_PN | 10,490 | - | - | -1,573 | **8,917** | `Studentcrd` | N | N | Y | Promotion | 176 | 🟡 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | - | **NORMAL** | BASELINE | 10,490 | - | - | - | **10,490** | `-` | N | N | N | Promotion | 177 | 🟢 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | - | **SF_PLUS** | EXACT_PN | 10,490 | -500 | - | - | **9,990** | `01` | Y | N | N | Promotion | 177 | 🟢 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | - | **STANDARD_PAYMENT** | EXACT_PN | 10,490 | -1,500 | - | - | **8,990** | `02` | N | N | N | Promotion | 177 | 🟡 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | - | **STUDENT** | EXACT_PN | 10,490 | - | - | - | **8,917** | `Studentcrd` | N | N | Y | Promotion | 177 | 🟡 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | 6/128GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 10,490 | -1,500 | - | - | **8,990** | `01` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 20 | 🟡 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | 6/128GB | **SF_PLUS** | MODEL_CAPACITY | 10,490 | -500 | - | - | **9,990** | `04` | Y | N | N | โปร และ เงื่อนไขการตัดขาย | 22 | 🟡 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | - | **STUDENT** | MODEL_ONLY | 7,490 | - | - | - | **6,367** | `Studentcrd` | N | N | Y | SES Student Campaign | 25 | 🟡 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | - | **STUDENT** | MODEL_ONLY | 10,490 | - | - | - | **8,917** | `Studentcrd` | N | N | Y | SES Student Campaign | 27 | 🟡 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | - | **STUDENT** | MODEL_ONLY | 12,990 | - | - | - | **11,691** | `Studentcrd` | N | N | Y | SES Student Campaign | 29 | 🟡 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | - | **STUDENT** | MODEL_ONLY | 16,990 | - | - | - | **15,291** | `Studentcrd` | N | N | Y | SES Student Campaign | 30 | 🟡 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | - | **STUDENT** | MODEL_ONLY | 19,900 | - | - | - | **16,915** | `Studentcrd` | N | N | Y | SES Student Campaign | 32 | 🟡 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | - | **STUDENT** | MODEL_ONLY | 22,900 | - | - | - | **19,465** | `Studentcrd` | N | N | Y | SES Student Campaign | 33 | 🟡 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | - | **STUDENT** | MODEL_ONLY | 30,900 | - | - | - | **26,265** | `Studentcrd` | N | N | Y | SES Student Campaign | 35 | 🟡 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | - | **STUDENT** | MODEL_ONLY | 28,900 | - | - | - | **24,565** | `Studentcrd` | N | N | Y | SES Student Campaign | 37 | 🟡 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | - | **STUDENT** | MODEL_ONLY | 33,900 | - | - | - | **28,815** | `Studentcrd` | N | N | Y | SES Student Campaign | 38 | 🟡 |
| `SM-X236BZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus 5G 6/128GB | - | **STUDENT** | MODEL_ONLY | 48,900 | - | - | - | **41,565** | `Studentcrd` | N | N | Y | SES Student Campaign | 39 | 🟡 |
| `F-X230NZAAFBX2` | พาส F / ชุดเปิดตัว | Galaxy Tab A11Plus Wi-Fi 6/128GB | - | **NORMAL** | BASELINE | 8,490 | - | - | - | **8,490** | `-` | N | N | N | Promotion | 178 | 🟢 |
| `F-X230NZAAFBX2` | พาส F / ชุดเปิดตัว | Galaxy Tab A11Plus Wi-Fi 6/128GB | - | **SF_PLUS** | EXACT_PN | 8,490 | -500 | - | -500 | **7,990** | `01` | Y | N | N | Promotion | 178 | 🟢 |
| `F-X230NZAAFBX2` | พาส F / ชุดเปิดตัว | Galaxy Tab A11Plus Wi-Fi 6/128GB | - | **STANDARD_PAYMENT** | EXACT_PN | 8,490 | -1,500 | - | -1,500 | **6,990** | `02` | N | N | N | Promotion | 178 | 🟡 |
| `F-X230NZAAFBX2` | พาส F / ชุดเปิดตัว | Galaxy Tab A11Plus Wi-Fi 6/128GB | - | **STUDENT** | EXACT_PN | 8,490 | - | - | -1,273 | **7,217** | `Studentcrd` | N | N | Y | Promotion | 178 | 🟡 |
| `SM-X230NZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus Wi-Fi 6/128GB | - | **NORMAL** | BASELINE | 8,490 | - | - | - | **8,490** | `-` | N | N | N | Promotion | 179 | 🟢 |
| `SM-X230NZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus Wi-Fi 6/128GB | - | **SF_PLUS** | EXACT_PN | 8,490 | -500 | - | - | **7,990** | `01` | Y | N | N | Promotion | 179 | 🟢 |
| `SM-X230NZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus Wi-Fi 6/128GB | - | **STANDARD_PAYMENT** | EXACT_PN | 8,490 | -1,500 | - | - | **6,990** | `02` | N | N | N | Promotion | 179 | 🟡 |
| `SM-X230NZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus Wi-Fi 6/128GB | - | **STUDENT** | EXACT_PN | 8,490 | - | - | - | **7,217** | `Studentcrd` | N | N | Y | Promotion | 179 | 🟡 |
| `SM-X230NZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus Wi-Fi 6/128GB | 6/128GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 8,490 | -1,500 | - | - | **6,990** | `01` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 21 | 🟡 |
| `SM-X230NZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus Wi-Fi 6/128GB | 6/128GB | **SF_PLUS** | MODEL_CAPACITY | 8,490 | -500 | - | - | **7,990** | `01` | Y | N | N | โปร และ เงื่อนไขการตัดขาย | 23 | 🟡 |
| `SM-X230NZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus Wi-Fi 6/128GB | - | **STUDENT** | MODEL_ONLY | 8,490 | - | - | - | **7,217** | `Studentcrd` | N | N | Y | SES Student Campaign | 26 | 🟡 |
| `SM-X230NZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus Wi-Fi 6/128GB | - | **STUDENT** | MODEL_ONLY | 12,990 | - | - | - | **11,691** | `Studentcrd` | N | N | Y | SES Student Campaign | 29 | 🟡 |
| `SM-X230NZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus Wi-Fi 6/128GB | - | **STUDENT** | MODEL_ONLY | 19,900 | - | - | - | **16,915** | `Studentcrd` | N | N | Y | SES Student Campaign | 32 | 🟡 |
| `SM-X230NZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus Wi-Fi 6/128GB | - | **STUDENT** | MODEL_ONLY | 27,900 | - | - | - | **23,715** | `Studentcrd` | N | N | Y | SES Student Campaign | 34 | 🟡 |
| `SM-X230NZAATHL` | เครื่องเปล่า SM- | Galaxy Tab A11Plus Wi-Fi 6/128GB | - | **STUDENT** | MODEL_ONLY | 28,900 | - | - | - | **24,565** | `Studentcrd` | N | N | Y | SES Student Campaign | 37 | 🟡 |
| `SM-X135GZAETHL` | เครื่องเปล่า SM- | Galaxy Tab A11 LTE 8/128GB | - | **NORMAL** | BASELINE | 7,490 | - | - | - | **7,490** | `-` | N | N | N | Promotion | 180 | 🟢 |
| `SM-X135GZAETHL` | เครื่องเปล่า SM- | Galaxy Tab A11 LTE 8/128GB | - | **SF_PLUS** | EXACT_PN | 7,490 | -500 | - | - | **6,990** | `01` | Y | N | N | Promotion | 180 | 🟢 |
| `SM-X135GZAETHL` | เครื่องเปล่า SM- | Galaxy Tab A11 LTE 8/128GB | - | **STANDARD_PAYMENT** | EXACT_PN | 7,490 | -1,500 | - | - | **5,990** | `02` | N | N | N | Promotion | 180 | 🟡 |
| `SM-X135GZAETHL` | เครื่องเปล่า SM- | Galaxy Tab A11 LTE 8/128GB | - | **STUDENT** | EXACT_PN | 7,490 | - | - | - | **6,367** | `Studentcrd` | N | N | Y | Promotion | 180 | 🟡 |
| `SM-X135GZAETHL` | เครื่องเปล่า SM- | Galaxy Tab A11 LTE 8/128GB | 8/128GB | **STANDARD_PAYMENT** | MODEL_CAPACITY | 7,490 | -1,500 | - | - | **5,990** | `01` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 24 | 🟡 |
| `SM-X135GZAETHL` | เครื่องเปล่า SM- | Galaxy Tab A11 LTE 8/128GB | 8/128GB | **SF_PLUS** | MODEL_CAPACITY | 7,490 | -500 | - | - | **6,990** | `04` | Y | N | N | โปร และ เงื่อนไขการตัดขาย | 25 | 🟡 |
| `SM-X135GZAETHL` | เครื่องเปล่า SM- | Galaxy Tab A11 LTE 8/128GB | - | **STUDENT** | MODEL_ONLY | 7,490 | - | - | - | **6,367** | `Studentcrd` | N | N | Y | SES Student Campaign | 25 | 🟡 |
| `SM-X135GZAETHL` | เครื่องเปล่า SM- | Galaxy Tab A11 LTE 8/128GB | - | **STUDENT** | MODEL_ONLY | 10,490 | - | - | - | **8,917** | `Studentcrd` | N | N | Y | SES Student Campaign | 27 | 🟡 |
| `SM-R410NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds Core | - | **NORMAL** | BASELINE | 1,490 | - | - | - | **1,490** | `-` | N | N | N | Promotion | 182 | 🟢 |
| `SM-R410NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds Core | - | **SF_PLUS** | EXACT_PN | 1,490 | -200 | - | - | **1,290** | `03` | Y | N | N | Promotion | 182 | 🟢 |
| `SM-R410NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds Core | - | **MBO** | MODEL_ONLY | 1,490 | -200 | - | - | **1,290** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 41 | 🟡 |
| `SM-R410NZWAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds Core | - | **NORMAL** | BASELINE | 1,490 | - | - | - | **1,490** | `-` | N | N | N | Promotion | 183 | 🟢 |
| `SM-R410NZWAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds Core | - | **SF_PLUS** | EXACT_PN | 1,490 | -200 | - | - | **1,290** | `01` | Y | N | N | Promotion | 183 | 🟢 |
| `SM-R410NZWAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds Core | - | **MBO** | MODEL_ONLY | 1,490 | -200 | - | - | **1,290** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 41 | 🟡 |
| `SM-R420NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds3 FE | - | **NORMAL** | BASELINE | 4,290 | - | - | - | **4,290** | `-` | N | N | N | Promotion | 184 | 🟢 |
| `SM-R420NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds3 FE | - | **SF_PLUS** | EXACT_PN | 4,290 | -1,287 | - | - | **3,003** | `01` | Y | N | N | Promotion | 184 | 🟢 |
| `SM-R420NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds3 FE | - | **MBO** | MODEL_ONLY | 4,290 | -1,287 | - | - | **3,003** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 40 | 🟡 |
| `SM-R420NZAAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds3 FE | - | **NORMAL** | BASELINE | 4,290 | - | - | - | **4,290** | `-` | N | N | N | Promotion | 185 | 🟢 |
| `SM-R420NZAAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds3 FE | - | **SF_PLUS** | EXACT_PN | 4,290 | -1,287 | - | - | **3,003** | `01` | Y | N | N | Promotion | 185 | 🟢 |
| `SM-R420NZAAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds3 FE | - | **MBO** | MODEL_ONLY | 4,290 | -1,287 | - | - | **3,003** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 40 | 🟡 |
| `SM-R540NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 | - | **NORMAL** | BASELINE | 5,990 | - | - | - | **5,990** | `-` | N | N | N | Promotion | 186 | 🟢 |
| `SM-R540NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 | - | **SF_PLUS** | EXACT_PN | 5,990 | -1,797 | - | - | **4,193** | `01` | Y | N | N | Promotion | 186 | 🟢 |
| `SM-R540NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 | - | **MBO** | MODEL_ONLY | 5,990 | -1,797 | - | - | **4,193** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 38 | 🟡 |
| `SM-R540NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 | - | **MBO** | MODEL_ONLY | 5,990 | -1,797 | - | - | **4,193** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 39 | 🟡 |
| `SM-R540NZWAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 | - | **NORMAL** | BASELINE | 5,990 | - | - | - | **5,990** | `-` | N | N | N | Promotion | 187 | 🟢 |
| `SM-R540NZWAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 | - | **SF_PLUS** | EXACT_PN | 5,990 | -1,797 | - | - | **4,193** | `01` | Y | N | N | Promotion | 187 | 🟢 |
| `SM-R540NZWAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 | - | **MBO** | MODEL_ONLY | 5,990 | -1,797 | - | - | **4,193** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 38 | 🟡 |
| `SM-R540NZWAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 | - | **MBO** | MODEL_ONLY | 5,990 | -1,797 | - | - | **4,193** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 39 | 🟡 |
| `SM-R640NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 Pro | - | **NORMAL** | BASELINE | 7,990 | - | - | - | **7,990** | `-` | N | N | N | Promotion | 188 | 🟢 |
| `SM-R640NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 Pro | - | **SF_PLUS** | EXACT_PN | 7,990 | -2,397 | - | - | **5,593** | `01` | Y | N | N | Promotion | 188 | 🟢 |
| `SM-R640NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 Pro | - | **MBO** | MODEL_ONLY | 7,990 | -2,397 | - | - | **5,593** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 35 | 🟡 |
| `SM-R640NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 Pro | - | **MBO** | MODEL_ONLY | 7,990 | -2,397 | - | - | **5,593** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 36 | 🟡 |
| `SM-R640NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 Pro | - | **MBO** | MODEL_ONLY | 7,990 | -2,397 | - | - | **5,593** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 37 | 🟡 |
| `SM-R640NZWAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 Pro | - | **NORMAL** | BASELINE | 7,990 | - | - | - | **7,990** | `-` | N | N | N | Promotion | 189 | 🟢 |
| `SM-R640NZWAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 Pro | - | **SF_PLUS** | EXACT_PN | 7,990 | -2,397 | - | - | **5,593** | `01` | Y | N | N | Promotion | 189 | 🟢 |
| `SM-R640NZWAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 Pro | - | **MBO** | MODEL_ONLY | 7,990 | -2,397 | - | - | **5,593** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 35 | 🟡 |
| `SM-R640NZWAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 Pro | - | **MBO** | MODEL_ONLY | 7,990 | -2,397 | - | - | **5,593** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 36 | 🟡 |
| `SM-R640NZWAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 Pro | - | **MBO** | MODEL_ONLY | 7,990 | -2,397 | - | - | **5,593** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 37 | 🟡 |
| `SM-R640NZDAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 Pro | - | **NORMAL** | BASELINE | 7,990 | - | - | - | **7,990** | `-` | N | N | N | Promotion | 190 | 🟢 |
| `SM-R640NZDAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 Pro | - | **SF_PLUS** | EXACT_PN | 7,990 | -2,397 | - | - | **5,593** | `01` | Y | N | N | Promotion | 190 | 🟢 |
| `SM-R640NZDAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 Pro | - | **MBO** | MODEL_ONLY | 7,990 | -2,397 | - | - | **5,593** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 35 | 🟡 |
| `SM-R640NZDAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 Pro | - | **MBO** | MODEL_ONLY | 7,990 | -2,397 | - | - | **5,593** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 36 | 🟡 |
| `SM-R640NZDAASA` | เครื่องเปล่า SM- | Samsung Galaxy Buds4 Pro | - | **MBO** | MODEL_ONLY | 7,990 | -2,397 | - | - | **5,593** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 37 | 🟡 |
| `SM-L320NDAAASA` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 40mm BT | - | **NORMAL** | BASELINE | 11,900 | - | - | - | **11,900** | `-` | N | N | N | Promotion | 200 | 🟢 |
| `SM-L320NDAAASA` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 40mm BT | - | **SF_PLUS** | EXACT_PN | 11,900 | -4,000 | - | - | **7,900** | `01` | Y | N | N | Promotion | 200 | 🟢 |
| `SM-L320NDAAASA` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 40mm BT | - | **MBO** | MODEL_ONLY | 11,900 | -4,000 | - | - | **7,900** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 34 | 🟡 |
| `SM-L320NZSAASA` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 40mm BT | - | **NORMAL** | BASELINE | 11,900 | - | - | - | **11,900** | `-` | N | N | N | Promotion | 201 | 🟢 |
| `SM-L320NZSAASA` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 40mm BT | - | **SF_PLUS** | EXACT_PN | 11,900 | -4,000 | - | - | **7,900** | `01` | Y | N | N | Promotion | 201 | 🟢 |
| `SM-L320NZSAASA` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 40mm BT | - | **MBO** | MODEL_ONLY | 11,900 | -4,000 | - | - | **7,900** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 34 | 🟡 |
| `SM-L330NDAAASA` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 44mm BT | - | **NORMAL** | BASELINE | 13,900 | - | - | - | **13,900** | `-` | N | N | N | Promotion | 202 | 🟢 |
| `SM-L330NDAAASA` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 44mm BT | - | **SF_PLUS** | EXACT_PN | 13,900 | -4,000 | - | - | **9,900** | `01` | Y | N | N | Promotion | 202 | 🟢 |
| `SM-L330NDAAASA` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 44mm BT | - | **MBO** | MODEL_ONLY | 13,900 | -4,000 | - | - | **9,900** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 33 | 🟡 |
| `SM-L500NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 Classic BT | - | **NORMAL** | BASELINE | 17,900 | - | - | - | **17,900** | `-` | N | N | N | Promotion | 203 | 🟢 |
| `SM-L500NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 Classic BT | - | **SF_PLUS** | EXACT_PN | 17,900 | -5,370 | - | - | **12,530** | `01` | Y | N | N | Promotion | 203 | 🟢 |
| `SM-L500NZKAASA` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 Classic BT | - | **MBO** | MODEL_ONLY | 17,900 | -5,370 | - | - | **12,530** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 30 | 🟡 |
| `SM-L500NZWAASA` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 Classic BT | - | **NORMAL** | BASELINE | 17,900 | - | - | - | **17,900** | `-` | N | N | N | Promotion | 204 | 🟢 |
| `SM-L500NZWAASA` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 Classic BT | - | **SF_PLUS** | EXACT_PN | 17,900 | -5,370 | - | - | **12,530** | `01` | Y | N | N | Promotion | 204 | 🟢 |
| `SM-L500NZWAASA` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 Classic BT | - | **MBO** | MODEL_ONLY | 17,900 | -5,370 | - | - | **12,530** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 30 | 🟡 |
| `SM-L505FZKATHL` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 Classic LTE | - | **NORMAL** | BASELINE | 19,900 | - | - | - | **19,900** | `-` | N | N | N | Promotion | 205 | 🟢 |
| `SM-L505FZKATHL` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 Classic LTE | - | **SF_PLUS** | EXACT_PN | 19,900 | -5,970 | - | - | **13,930** | `01` | Y | N | N | Promotion | 205 | 🟢 |
| `SM-L505FZKATHL` | เครื่องเปล่า SM- | Samsung Galaxy Watch8 Classic LTE | - | **MBO** | MODEL_ONLY | 19,900 | -5,970 | - | - | **13,930** | `03` | N | N | N | โปร และ เงื่อนไขการตัดขาย | 29 | 🟡 |

## 4. 🔍 รายงานตรวจสอบ Galaxy Z Fold 8 & Fold 8 Ultra — แยก P/N × Product Code Type
> [!IMPORTANT]
> **หลักการ**: รุ่นเดียวกัน + ความจุเดียวกัน ≠ โปรโมชั่นเดียวกัน
> ต้องดู: เครื่องเปล่า SM- vs พาส F (F-) — Exact P/N ต้องมาก่อนชื่อรุ่นเสมอ

### Before/After Diff
| State | P/N | Code Type | Sale Mode | Discount | Net Price | Reason |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| ❌ ก่อนแก้ | SM-F971... | (ไม่ตรวจ) | STANDARD_PAYMENT | ฿5,000 | ฿64,900 | Trade Up leak |
| ✅ หลังแก้ | SM-F971... | STANDARD_SM | NORMAL | ฿0 | ฿69,900 (RRP) | ไม่มีโปรยืนยัน |
| ✅ หลังแก้ | F-NS971... | PASS_F | STANDARD_PAYMENT | ฿5,000 | ฿64,900 | Stock.xlsx R121 |

### Fold8 & Fold8 Ultra — ทุก P/N
| P/N | Code Type | Model | Cap | Sale Mode | Match | Std Disc | TU Disc | Launch | Net | Coupon | Source | Row | Val |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: | :---: |
| `F-NS971BLVDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/256GB  รหัส F | 12/256GB | NORMAL | BASELINE | - | - | - | **61,900** | `-` | Promotion | 118 | 🟢 |
| `F-NS971BLVDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/256GB  รหัส F | 12/256GB | SF_PLUS | EXACT_PN | -1,000 | - | -1,000 | **60,900** | `01` | Promotion | 118 | 🟢 |
| `F-NS971BZKDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/256GB  รหัส F | 12/256GB | NORMAL | BASELINE | - | - | - | **61,900** | `-` | Promotion | 119 | 🟢 |
| `F-NS971BZKDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/256GB  รหัส F | 12/256GB | SF_PLUS | EXACT_PN | -1,000 | - | -1,000 | **60,900** | `01` | Promotion | 119 | 🟢 |
| `F-NS971BZWDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/256GB  รหัส F | 12/256GB | NORMAL | BASELINE | - | - | - | **61,900** | `-` | Promotion | 120 | 🟢 |
| `F-NS971BZWDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/256GB  รหัส F | 12/256GB | SF_PLUS | EXACT_PN | -1,000 | - | -1,000 | **60,900** | `01` | Promotion | 120 | 🟢 |
| `F-NS971BLVGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/512GB  รหัส F | 12/512GB | NORMAL | BASELINE | - | - | - | **69,900** | `-` | Promotion | 121 | 🟢 |
| `F-NS971BLVGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/512GB  รหัส F | 12/512GB | SF_PLUS | EXACT_PN | -5,000 | - | -5,000 | **64,900** | `01` | Promotion | 121 | 🟡 |
| `F-NS971BZKGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/512GB  รหัส F | 12/512GB | NORMAL | BASELINE | - | - | - | **69,900** | `-` | Promotion | 122 | 🟢 |
| `F-NS971BZKGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/512GB  รหัส F | 12/512GB | SF_PLUS | EXACT_PN | -5,000 | - | -5,000 | **64,900** | `01` | Promotion | 122 | 🟢 |
| `F-NS971BZWGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/512GB  รหัส F | 12/512GB | NORMAL | BASELINE | - | - | - | **69,900** | `-` | Promotion | 123 | 🟢 |
| `F-NS971BZWGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 12/512GB  รหัส F | 12/512GB | SF_PLUS | EXACT_PN | -5,000 | - | -5,000 | **64,900** | `01` | Promotion | 123 | 🟢 |
| `F-NS971BLVHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 16/1TB  รหัส F | 16/1TB | NORMAL | BASELINE | - | - | - | **85,900** | `-` | Promotion | 124 | 🟢 |
| `F-NS971BLVHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 16/1TB  รหัส F | 16/1TB | SF_PLUS | EXACT_PN | -5,000 | - | -5,000 | **80,900** | `01` | Promotion | 124 | 🟢 |
| `F-NS971BZKHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 16/1TB  รหัส F | 16/1TB | NORMAL | BASELINE | - | - | - | **85,900** | `-` | Promotion | 125 | 🟢 |
| `F-NS971BZKHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 16/1TB  รหัส F | 16/1TB | SF_PLUS | EXACT_PN | -5,000 | - | -5,000 | **80,900** | `01` | Promotion | 125 | 🟢 |
| `F-NS971BZWHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 16/1TB  รหัส F | 16/1TB | NORMAL | BASELINE | - | - | - | **85,900** | `-` | Promotion | 126 | 🟢 |
| `F-NS971BZWHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 16/1TB  รหัส F | 16/1TB | SF_PLUS | EXACT_PN | -5,000 | - | -5,000 | **80,900** | `01` | Promotion | 126 | 🟢 |
| `F-NS976BZKDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/256GB  รหัส F | 12/256GB | NORMAL | BASELINE | - | - | - | **69,900** | `-` | Promotion | 136 | 🟢 |
| `F-NS976BZKDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/256GB  รหัส F | 12/256GB | SF_PLUS | EXACT_PN | -1,000 | - | -1,000 | **68,900** | `01` | Promotion | 136 | 🟢 |
| `F-NS976BZVDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/256GB  รหัส F | 12/256GB | NORMAL | BASELINE | - | - | - | **69,900** | `-` | Promotion | 137 | 🟢 |
| `F-NS976BZVDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/256GB  รหัส F | 12/256GB | SF_PLUS | EXACT_PN | -1,000 | - | -1,000 | **68,900** | `01` | Promotion | 137 | 🟢 |
| `F-NS976BZWDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/256GB  รหัส F | 12/256GB | NORMAL | BASELINE | - | - | - | **69,900** | `-` | Promotion | 138 | 🟢 |
| `F-NS976BZWDTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/256GB  รหัส F | 12/256GB | SF_PLUS | EXACT_PN | -1,000 | - | -1,000 | **68,900** | `01` | Promotion | 138 | 🟢 |
| `F-NS976BZKGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/512GB  รหัส F | 12/512GB | NORMAL | BASELINE | - | - | - | **77,900** | `-` | Promotion | 139 | 🟢 |
| `F-NS976BZKGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/512GB  รหัส F | 12/512GB | SF_PLUS | EXACT_PN | -5,000 | - | -5,000 | **72,900** | `01` | Promotion | 139 | 🟡 |
| `F-NS976BZVGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/512GB  รหัส F | 12/512GB | NORMAL | BASELINE | - | - | - | **77,900** | `-` | Promotion | 140 | 🟢 |
| `F-NS976BZVGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/512GB  รหัส F | 12/512GB | SF_PLUS | EXACT_PN | -5,000 | - | -5,000 | **72,900** | `01` | Promotion | 140 | 🟢 |
| `F-NS976BZWGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/512GB  รหัส F | 12/512GB | NORMAL | BASELINE | - | - | - | **77,900** | `-` | Promotion | 141 | 🟢 |
| `F-NS976BZWGTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 12/512GB  รหัส F | 12/512GB | SF_PLUS | EXACT_PN | -5,000 | - | -5,000 | **72,900** | `01` | Promotion | 141 | 🟢 |
| `F-NS976BZKHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 16/1TB  รหัส F | 16/1TB | NORMAL | BASELINE | - | - | - | **93,900** | `-` | Promotion | 142 | 🟢 |
| `F-NS976BZKHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 16/1TB  รหัส F | 16/1TB | SF_PLUS | EXACT_PN | -5,000 | - | -5,000 | **88,900** | `01` | Promotion | 142 | 🟢 |
| `F-NS976BZVHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 16/1TB  รหัส F | 16/1TB | NORMAL | BASELINE | - | - | - | **93,900** | `-` | Promotion | 143 | 🟢 |
| `F-NS976BZVHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 16/1TB  รหัส F | 16/1TB | SF_PLUS | EXACT_PN | -5,000 | - | -5,000 | **88,900** | `01` | Promotion | 143 | 🟢 |
| `F-NS976BZWHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 16/1TB  รหัส F | 16/1TB | NORMAL | BASELINE | - | - | - | **93,900** | `-` | Promotion | 144 | 🟢 |
| `F-NS976BZWHTHL` | พาส F / ชุดเปิดตัว | Galaxy Z Fold 8 Ultra 16/1TB  รหัส F | 16/1TB | SF_PLUS | EXACT_PN | -5,000 | - | -5,000 | **88,900** | `01` | Promotion | 144 | 🟢 |
| `SM-F971BLVDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 12/256GB | NORMAL | BASELINE | - | - | - | **61,900** | `-` | Promotion | 127 | 🟢 |
| `SM-F971BLVDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **56,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 23 | 🟡 |
| `SM-F971BLVDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **56,900** | `T-UP-CO-S` | 19 -27  Aug | 21 | 🟡 |
| `SM-F971BLVDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **56,900** | `T-UP-CO-S` |  17-18  Aug | 21 | 🟡 |
| `SM-F971BLVDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **56,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 21 | 🟡 |
| `SM-F971BZKDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 12/256GB | NORMAL | BASELINE | - | - | - | **61,900** | `-` | Promotion | 128 | 🟢 |
| `SM-F971BZKDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **56,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 23 | 🟡 |
| `SM-F971BZKDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **56,900** | `T-UP-CO-S` | 19 -27  Aug | 21 | 🟡 |
| `SM-F971BZKDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **56,900** | `T-UP-CO-S` |  17-18  Aug | 21 | 🟡 |
| `SM-F971BZKDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **56,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 21 | 🟡 |
| `SM-F971BZWDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 12/256GB | NORMAL | BASELINE | - | - | - | **61,900** | `-` | Promotion | 129 | 🟢 |
| `SM-F971BZWDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **56,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 23 | 🟡 |
| `SM-F971BZWDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **56,900** | `T-UP-CO-S` | 19 -27  Aug | 21 | 🟡 |
| `SM-F971BZWDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **56,900** | `T-UP-CO-S` |  17-18  Aug | 21 | 🟡 |
| `SM-F971BZWDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **56,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 21 | 🟡 |
| `SM-F971BLVGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 12/512GB | NORMAL | BASELINE | - | - | - | **69,900** | `-` | Promotion | 130 | 🟢 |
| `SM-F971BLVGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 22 | 🟡 |
| `SM-F971BLVGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` | 19 -27  Aug | 20 | 🟡 |
| `SM-F971BLVGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` |  17-18  Aug | 20 | 🟡 |
| `SM-F971BLVGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 20 | 🟡 |
| `SM-F971BZKGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 12/512GB | NORMAL | BASELINE | - | - | - | **69,900** | `-` | Promotion | 131 | 🟢 |
| `SM-F971BZKGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 22 | 🟡 |
| `SM-F971BZKGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` | 19 -27  Aug | 20 | 🟡 |
| `SM-F971BZKGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` |  17-18  Aug | 20 | 🟡 |
| `SM-F971BZKGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 20 | 🟡 |
| `SM-F971BZWGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 12/512GB | NORMAL | BASELINE | - | - | - | **69,900** | `-` | Promotion | 132 | 🟢 |
| `SM-F971BZWGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 22 | 🟡 |
| `SM-F971BZWGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` | 19 -27  Aug | 20 | 🟡 |
| `SM-F971BZWGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` |  17-18  Aug | 20 | 🟡 |
| `SM-F971BZWGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 20 | 🟡 |
| `SM-F971BLVHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 16/1TB | NORMAL | BASELINE | - | - | - | **85,900** | `-` | Promotion | 133 | 🟢 |
| `SM-F971BLVHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **78,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 21 | 🟡 |
| `SM-F971BLVHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **78,900** | `T-UP-CO-S` | 19 -27  Aug | 19 | 🟡 |
| `SM-F971BLVHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **78,900** | `T-UP-CO-S` |  17-18  Aug | 19 | 🟡 |
| `SM-F971BLVHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **78,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 19 | 🟡 |
| `SM-F971BZKHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 16/1TB | NORMAL | BASELINE | - | - | - | **85,900** | `-` | Promotion | 134 | 🟢 |
| `SM-F971BZKHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **78,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 21 | 🟡 |
| `SM-F971BZKHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **78,900** | `T-UP-CO-S` | 19 -27  Aug | 19 | 🟡 |
| `SM-F971BZKHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **78,900** | `T-UP-CO-S` |  17-18  Aug | 19 | 🟡 |
| `SM-F971BZKHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **78,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 19 | 🟡 |
| `SM-F971BZWHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 16/1TB | NORMAL | BASELINE | - | - | - | **85,900** | `-` | Promotion | 135 | 🟢 |
| `SM-F971BZWHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **78,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 21 | 🟡 |
| `SM-F971BZWHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **78,900** | `T-UP-CO-S` | 19 -27  Aug | 19 | 🟡 |
| `SM-F971BZWHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **78,900** | `T-UP-CO-S` |  17-18  Aug | 19 | 🟡 |
| `SM-F971BZWHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **78,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 19 | 🟡 |
| `SM-F976BZKDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 12/256GB | NORMAL | BASELINE | - | - | - | **69,900** | `-` | Promotion | 145 | 🟢 |
| `SM-F976BZKDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 20 | 🟡 |
| `SM-F976BZKDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` | 19 -27  Aug | 18 | 🟡 |
| `SM-F976BZKDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` |  17-18  Aug | 18 | 🟡 |
| `SM-F976BZKDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 18 | 🟡 |
| `SM-F976BZVDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 12/256GB | NORMAL | BASELINE | - | - | - | **69,900** | `-` | Promotion | 146 | 🟢 |
| `SM-F976BZVDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 20 | 🟡 |
| `SM-F976BZVDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` | 19 -27  Aug | 18 | 🟡 |
| `SM-F976BZVDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` |  17-18  Aug | 18 | 🟡 |
| `SM-F976BZVDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 18 | 🟡 |
| `SM-F976BZWDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 12/256GB | NORMAL | BASELINE | - | - | - | **69,900** | `-` | Promotion | 147 | 🟢 |
| `SM-F976BZWDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 20 | 🟡 |
| `SM-F976BZWDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` | 19 -27  Aug | 18 | 🟡 |
| `SM-F976BZWDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` |  17-18  Aug | 18 | 🟡 |
| `SM-F976BZWDTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/256GB | 12/256GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **64,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 18 | 🟡 |
| `SM-F976BZKGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 12/512GB | NORMAL | BASELINE | - | - | - | **77,900** | `-` | Promotion | 148 | 🟢 |
| `SM-F976BZKGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **72,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 19 | 🟡 |
| `SM-F976BZKGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **72,900** | `T-UP-CO-S` | 19 -27  Aug | 17 | 🟡 |
| `SM-F976BZKGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **72,900** | `T-UP-CO-S` |  17-18  Aug | 17 | 🟡 |
| `SM-F976BZKGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **72,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 17 | 🟡 |
| `SM-F976BZVGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 12/512GB | NORMAL | BASELINE | - | - | - | **77,900** | `-` | Promotion | 149 | 🟢 |
| `SM-F976BZVGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **72,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 19 | 🟡 |
| `SM-F976BZVGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **72,900** | `T-UP-CO-S` | 19 -27  Aug | 17 | 🟡 |
| `SM-F976BZVGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **72,900** | `T-UP-CO-S` |  17-18  Aug | 17 | 🟡 |
| `SM-F976BZVGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **72,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 17 | 🟡 |
| `SM-F976BZWGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 12/512GB | NORMAL | BASELINE | - | - | - | **77,900** | `-` | Promotion | 150 | 🟢 |
| `SM-F976BZWGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **72,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 19 | 🟡 |
| `SM-F976BZWGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **72,900** | `T-UP-CO-S` | 19 -27  Aug | 17 | 🟡 |
| `SM-F976BZWGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **72,900** | `T-UP-CO-S` |  17-18  Aug | 17 | 🟡 |
| `SM-F976BZWGTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 12/512GB | 12/512GB | TRADE_UP | MODEL_CAPACITY | - | -5,000 | - | **72,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 17 | 🟡 |
| `SM-F976BZKHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 16/1TB | NORMAL | BASELINE | - | - | - | **93,900** | `-` | Promotion | 151 | 🟢 |
| `SM-F976BZKHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **86,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 18 | 🟡 |
| `SM-F976BZKHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **86,900** | `T-UP-CO-S` | 19 -27  Aug | 16 | 🟡 |
| `SM-F976BZKHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **86,900** | `T-UP-CO-S` |  17-18  Aug | 16 | 🟡 |
| `SM-F976BZKHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **86,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 16 | 🟡 |
| `SM-F976BZVHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 16/1TB | NORMAL | BASELINE | - | - | - | **93,900** | `-` | Promotion | 152 | 🟢 |
| `SM-F976BZVHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **86,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 18 | 🟡 |
| `SM-F976BZVHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **86,900** | `T-UP-CO-S` | 19 -27  Aug | 16 | 🟡 |
| `SM-F976BZVHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **86,900** | `T-UP-CO-S` |  17-18  Aug | 16 | 🟡 |
| `SM-F976BZVHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **86,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 16 | 🟡 |
| `SM-F976BZWHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 16/1TB | NORMAL | BASELINE | - | - | - | **93,900** | `-` | Promotion | 153 | 🟢 |
| `SM-F976BZWHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **86,900** | `T-UP-CO-S` | อัพเดท 28 Aug - 6 Sep ล่าสุด | 18 | 🟡 |
| `SM-F976BZWHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **86,900** | `T-UP-CO-S` | 19 -27  Aug | 16 | 🟡 |
| `SM-F976BZWHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **86,900** | `T-UP-CO-S` |  17-18  Aug | 16 | 🟡 |
| `SM-F976BZWHTHL` | เครื่องเปล่า SM- | Galaxy Z Fold 8 Ultra 16/1TB | 16/1TB | TRADE_UP | MODEL_CAPACITY | - | -7,000 | - | **86,900** | `T-UP-CO-S` |  14 Aug -16 Aug | 16 | 🟡 |

### สรุป Fold8 Product Code Type
- **เครื่องเปล่า SM-**: 18 P/N
- **พาส F**: 18 P/N
- **SM- มี NORMAL เท่านั้น**: 0 / 18
- **F- มีโปร (>NORMAL)**: 18 / 18
- **Cross-type leak (SM- ได้โปร Pass F)**: 0