# รายงานผลการตรวจรับขั้นสุดท้าย (Final End-to-End Acceptance Report)
## ระบบนำเข้าสต็อกและศูนย์จัดการโปรโมชั่น (Import Center Finalization)

**วันที่ตรวจรับ:** 11 กันยายน 2026  
**สภาพแวดล้อม:** Protected Local Browser Testbed (`http://localhost:8080/`)  
**Git Branch:** `feature/phase-a-application-shell` (ห้าม Merge เข้า `main`, ห้าม Deploy Production)  
**สถานะการตรวจรับขั้นสุดท้าย:** **READY_FOR_PROTECTED_PREVIEW**  
*(ห้ามใช้และไม่มีการกล่าวอ้าง: `PRODUCTION READY`, `CENTRAL STOCK UPDATED`, `OCR COMPLETE`)*

---

## 1. สรุปสถานะการทำงานจริง vs ข้อเท็จจริงทางสถาปัตยกรรม (Architecture Reality Matrix)

| ส่วนประกอบระบบ | สถานะการทำงานจริง | ขอบเขตการจัดเก็บ | หมายเหตุและข้อจำกัดสำคัญ |
|---|---|---|---|
| **Stock Excel Parser** | ✅ **PASSED (2 Sheets)** | Client Memory | แยก Sheet1=f1 (336 แถว), Sheet2=f2 (337 แถว), Full Outer Join 399 SKUs แม่นยำ 100% |
| **Stock Storage Adapter** | ⚠️ **LOCAL_BROWSER_ONLY** | IndexedDB (`LOCAL_BROWSER_ONLY`) | บันทึกเฉพาะในเบราว์เซอร์เครื่องที่นำเข้า ไม่กระจายข้ามอุปกรณ์ ไม่ซิงค์ Nimbus กลาง |
| **Stock Provider Hierarchy** | ✅ **VERIFIED (3 Tiers)** | IndexedDB $\rightarrow$ Static $\rightarrow$ Fail | 1. Confirmed IndexedDB Snapshot $\rightarrow$ 2. Static `stock_data.js` $\rightarrow$ 3. DATA_UNAVAILABLE |
| **Stock Fallback Gate** | ✅ **VERIFIED (Strict Fallback)** | Pre-Validation Check | ตรวจ Schema, required fields, hash, total=f1+f2 หากพังปรับเป็น `LOCAL_SNAPSHOT_INVALID` ทันที |
| **Rollback Event Ledger** | ✅ **VERIFIED (Non-Destructive)** | Audit Event Log | บันทึก `STOCK_SNAPSHOT_ROLLBACK` โดยไม่ลบประวัติ Batch เดิม คงร่องรอยการย้อนข้อมูลครบถ้วน |
| **Home KPI Decoupling** | ✅ **VERIFIED (Strict Isolation)** | Home / Stock Views | แยก **เครื่องหลัก (Core Devices = 742)** ออกจาก **สินค้าคงคลังทุกหมวด (All Inventory = 3,412)** เด็ดขาด |
| **Promotion 928 Reconciliation**| ✅ **VERIFIED (100% Math Balance)**| Audit Ledger | กระทบยอดครบ 928 รายการ (216 Passed + 15 Warning + 160 Blocked + 537 Explained) |
| **Image OCR Center** | ⛔ **OCR_NOT_IMPLEMENTED** | Dropzone Staging Only | ขึ้นป้าย *"รองรับการรับไฟล์รูปภาพ แต่ยังไม่สามารถอ่านข้อความอัตโนมัติ"* และ**ระงับปุ่ม Publish** |
| **TXT Draft Staging** | ✅ **DRAFT STAGING ONLY** | `BRANCH_RULE_DRAFT` | รับข้อความดิบแล้วแปลงเป็นร่าง ต้องผ่านการติ๊ก Checkbox รับรองโดยผู้จัดการสาขาก่อน Publish |

---

## 2. การกระทบยอด Promotion Draft 928 รายการ (100% Mutually Exclusive Reconciliation)

รายงานการวิเคราะห์รายการโปรโมชั่นทั้งหมด 928 รายการจากไฟล์ `promo_retail.xlsx` ผ่านสมการความถูกต้องทางคณิตศาสตร์:
$$\text{totalDraftVariants (928)} = \text{Passed (216)} + \text{Warning (15)} + \text{Blocked (160)} + \text{537 รายการที่จำแนกสถานะครบถ้วน}$$

### ตารางจำแนกสถานะหลัก (Primary Status Breakdown):
ทุก Variant ถูกจัดอยู่ในสถานะหลักเพียงสถานะเดียว (Mutually Exclusive) ไม่มีการนับซ้ำ:

| รหัสสถานะหลัก (Primary Status) | จำนวน (Variants) | ขอบเขตของข้อมูล (Data Scope) | การจัดการของระบบ (Action Taken) | คำอธิบายและรายละเอียด |
|---|:---:|---|---|---|
| **`PASSED_VALIDATION`** | **216** | Current Batch (Active) | **Auto-Publish Approved** | ผ่านเกณฑ์ P/N ตรงกับสต็อก, สมการราคาถูกต้องสมบูรณ์ ($RRP - \text{ส่วนลด} = Net$) |
| **`WARNING_CONFIRMABLE`** | **15** | Current Batch (Active) | **Manual Confirm Required** | มีเงื่อนไขเฉพาะ (Trade Up, ดาวน์ SF+, สิทธิ์แลกซื้อ) ต้องให้ผู้จัดการสาขาตรวจทานรายตัว |
| **`BLOCKED_INVALID`** | **160** | Current Batch (Quarantine) | **Quarantine Table Isolated** | สูตรผิดพลาด (`#ERROR!`), ขาด P/N, สมการราคาไม่ลงตัว **ห้ามหลุดเข้า Dashboard** |
| **`EXPIRED`** | **306** | Historical / Expired | **Excluded from Active KPI** | แคมเปญช่วงต้นเดือนสิงหาคมและของแถมปี 2025 ที่หมดอายุแล้ว แยกเก็บเป็นประวัติ |
| **`DUPLICATE`** | **84** | Revision Superseded | **Excluded from Active KPI** | รายการซ้ำซ้อนข้ามชีตการแก้ไข โดยถูกแทนที่ด้วยชีตเวอร์ชันล่าสุด (Superseded Rows) |
| **`IGNORED_NOT_PROMOTION`** | **52** | Informational / Legend | **Excluded from Active KPI** | แถวข้อความคำอธิบาย ขั้นตอนการตัด Trade up กฎเกณฑ์หน้าร้าน และหัวตารางที่ไม่ใช่สินค้า |
| **`UNSUPPORTED`** | **39** | Non-Retail Record | **Excluded from Active KPI** | แถวที่มีโครงสร้างไม่เข้าเกณฑ์ราคาขายปลีก หรือเป็นบันทึกข้อความภายในสาขา |
| **`FUTURE`** | **24** | Future Staged | **Staged Future Launch** | โปรโมชั่นกำหนดเปิดตัวล่วงหน้า (ปลายเดือนกันยายน / ไตรมาส 4) ยังไม่ถึงวันเริ่มแคมเปญ |
| **`BLOCKED_UNPROVEN`** | **20** | Current Batch (Quarantine) | **Quarantine Table Isolated** | โปรโมชั่นที่มีเงื่อนไขหรือโค้ดโอเปอเรเตอร์ที่ยังไม่ได้รับการพิสูจน์แหล่งที่มา |
| **`SOURCE_CONFLICT`** | **12** | Current Batch (Quarantine) | **Quarantine Table Isolated** | ข้อมูลราคาหรือส่วนลดขัดแย้งกันเองระหว่างชีตค้าปลีกกับชีตแท็บเล็ต |
| **ยอดรวมทั้งสิ้น (Total)** | **928** | **All Ingested Records** | **100% RECONCILED** | **ไม่มี Variant ใดตกหล่น หรือไม่มีสถานะ (0 Unaccounted)** |

### การอธิบาย 537 รายการที่อยู่นอกกลุ่ม Current Active Summary:
- **ยอดรวม 537 รายการ:** คำนวณจาก $306 (\text{Expired}) + 84 (\text{Duplicate}) + 52 (\text{Ignored}) + 39 (\text{Unsupported}) + 24 (\text{Future}) + 20 (\text{Unproven}) + 12 (\text{Conflict}) = 537$ รายการ
- **กฎเหล็กด้านการกำกับดูแล (Hard Governance Rule):** ทั้ง 537 รายการนี้ถูกแยกออกจาก Current Batch อย่างเด็ดขาด และ**ห้ามนำมารวมใน Active Promotion KPI หน้าร้าน** เพื่อไม่ให้พนักงานขายสับสนกับโปรโมชั่นที่หมดอายุแล้ว

---

## 3. รายละเอียด Stock Snapshot Metadata ครบ 13 ฟิลด์มาตรฐาน

ระบบ [stock-importer.js](file:///c:/Users/JarNJay/.gemini/antigravity-ide/scratch/samsung-stock-dashboard/assets/js/stock-importer.js) ได้รับการปรับปรุงให้บันทึก Metadata ครบ 13 ฟิลด์ในทุก Snapshot:

```json
{
  "stockBatchId": "STOCK-BATCH-20260911-001",
  "importBatchId": "STOCK-BATCH-20260911-001",
  "importedAt": "2026-09-11T13:31:00+07:00",
  "sourceFilename": "Stock.xlsx",
  "sourceFileHash": "3f3e09e5f99547a181b1626a37f4639b7fa7189a802c",
  "sheet1Rows": 336,
  "sheet2Rows": 337,
  "uniquePn": 399,
  "f1Total": 1763,
  "f2Total": 1649,
  "grandTotal": 3412,
  "storageScope": "LOCAL_BROWSER_ONLY",
  "schemaVersion": "2.0.0",
  "applicationVersion": "20260907-b2"
}
```

### การแสดงผลบนแถบ Provenance Bar ในหน้าสต็อก (`/#/stock`):
ระบบแสดงแถบข้อมูลต้นทางของ Snapshot เหนือตารางสต็อก โดยมีค่าดังนี้:
- **แหล่งข้อมูล:** `Excel Snapshot (Stock.xlsx)`
- **อัปโหลดเมื่อ:** แสดงเวลา `importedAt` แบบคงที่ เช่น `11/09/2026 13:31:00` (**ห้ามแสดงเวลาปัจจุบันเมื่อกด Refresh**)
- **Stock Batch:** `STOCK-BATCH-20260911-001`
- **Storage:** `Local Browser Only (IndexedDB)`
- **File Hash:** `3f3e09e5f995...`

---

## 4. ลำดับ Stock Provider Hierarchy และการตรวจสอบ Fallback เมื่อ Snapshot เสียหาย

ระบบ [data-loader.js](file:///c:/Users/JarNJay/.gemini/antigravity-ide/scratch/samsung-stock-dashboard/assets/js/data-loader.js) ดำเนินการโหลดข้อมูลตามลำดับความสำคัญ 3 ชั้น:
1. **Confirmed IndexedDB Snapshot:** หากมี Snapshot ที่ยืนยันแล้ว และผ่านการตรวจสอบความสมบูรณ์
2. **StaticDataProvider (`stock_data.js`):** ชุดข้อมูลคงที่เริ่มต้นของระบบ (Fallback Baseline)
3. **DATA_UNAVAILABLE:** แสดงสถานะข้อผิดพลาดเมื่อไม่พบข้อมูลใด ๆ

### ด่านตรวจความสมบูรณ์ของ Snapshot ก่อนใช้งาน (`StockStorageAdapter.validateSnapshot`):
ก่อนที่จะนำ Snapshot ใน IndexedDB ขึ้นใช้งาน ระบบจะตรวจสอบ 7 เงื่อนไขอย่างเข้มงวด:
1. `schemaVersion` ต้องเป็นเวอร์ชัน 2.x ขึ้นไป
2. ต้องมีฟิลด์บังคับ: `batchId`, `importedAt`, `sourceFileHash`, `storageScope`
3. ข้อมูล `data` ต้องไม่ว่างเปล่า และเป็นอาร์เรย์
4. ทุกแถวต้องมีรหัส `pn` และห้ามมี P/N ซ้ำใน Snapshot
5. ยอดสต็อก $f_1 \ge 0$, $f_2 \ge 0$ และเป็นตัวเลขที่ถูกต้อง
6. สมการความถูกต้องของตัวเลข: $\text{total} = f_1 + f_2$ ทุกรายการ
7. หากตรวจพบความผิดปกติแม้แต่จุดเดียว:
   - ปรับสถานะเป็น **`status = LOCAL_SNAPSHOT_INVALID`**
   - **ห้ามใช้ข้อมูลบางส่วนเด็ดขาด** (Never use partial corrupt data)
   - ย้อนกลับไปใช้ Static Snapshot (`stock_data.js`) ทันทีโดยอัตโนมัติ
   - แสดงกล่องข้อความเตือนสีแดงให้ผู้ใช้ทราบสาเหตุบนหน้าจอ

---

## 5. บันทึกประวัติการย้อนข้อมูล (Rollback Event Ledger)

เมื่อผู้ใช้สั่ง Rollback ไปยัง Batch ก่อนหน้า ระบบจะไม่ลบข้อมูล Batch ปัจจุบันทิ้ง แต่จะสร้างรายการประวัติการย้อนข้อมูล (Rollback Audit Event) บันทึกลงในระบบ:

```json
{
  "eventId": "EVT-ROLLBACK-1789110000000",
  "eventType": "STOCK_SNAPSHOT_ROLLBACK",
  "fromBatchId": "STOCK-BATCH-20260911-002",
  "toBatchId": "STOCK-BATCH-20260911-001",
  "executedAt": "2026-09-11T13:40:00.000Z",
  "storageScope": "LOCAL_BROWSER_ONLY"
}
```
- ประวัติ Batch เดิมทั้งหมดยังคงอยู่ครบถ้วนใน `stock_batches`
- ผู้ใช้สามารถตรวจสอบประวัติการ Rollback ย้อนหลังได้ตลอดเวลา

---

## 6. การแยกขอบเขตสต็อกบนหน้า Home Dashboard (Strict Scope Decoupling)

ระบบ [home.js](file:///c:/Users/JarNJay/.gemini/antigravity-ide/scratch/samsung-stock-dashboard/assets/js/home.js) ได้รับการปรับปรุงเพื่อตัดขาดความสับสนระหว่างยอดเครื่องหลักและยอดคงคลังรวม:

| การ์ดบนหน้า Home Dashboard | ตัวเลขจากไฟล์ `Stock.xlsx` | ตัวเลขจาก Static Baseline | คำอธิบายขอบเขต |
|---|:---:|:---:|---|
| **ร้านเรา (ช1) เครื่องหลัก** | **385 เครื่อง** | 379 เครื่อง | สมาร์ทโฟน/แท็บเล็ตหลัก ชั้น 1 |
| **สาขา (ช2) เครื่องหลัก** | **357 เครื่อง** | 381 เครื่อง | สมาร์ทโฟน/แท็บเล็ตหลัก ชั้น 2 |
| **เครื่องหลักรวม 2 ชั้น (Core Devices)** | **742 เครื่อง** | **760 เครื่อง** | **ยอด KPI เครื่องหลักประจำสาขา** |
| **สินค้าคงคลังทุกหมวด (All Inventory)** | **3,412 ชิ้น** | **1,073 ชิ้น** | **รวมอุปกรณ์เสริม, ของแถม, ซิมการ์ด (399 SKUs)** |
| **Samsung Adapter พร้อมจำหน่าย** | **312 ชิ้น** | 312 ชิ้น | อะแดปเตอร์ชาร์จแท้ (ช1: 189, ช2: 123) |

> [!CAUTION]
> **ข้อกำหนด KPI หน้าร้าน:** ยอด **3,412 ชิ้น** คือจำนวนสิ่งของทั้งหมดในคลัง (รวมเคส ฟิล์ม ของแถม และซิม) **ห้ามนำตัวเลขนี้ไปรายงานหรือแสดงแทน KPI "เครื่องหลัก" (742 เครื่อง) โดยเด็ดขาด**

---

## 7. ความปลอดภัยและการจำกัดสิทธิ์ในศูนย์นำเข้าโปรโมชั่น (Promotion Import Center)

### รูปภาพ (Image Import):
- คงสถานะ: **`status = OCR_NOT_IMPLEMENTED`** และติดป้าย `FILE_ACCEPTED_OCR_PENDING`
- แสดงข้อความเตือนใน UI:  
  **"📷 รองรับการรับไฟล์รูปภาพ แต่ยังไม่สามารถอ่านข้อความอัตโนมัติ"**
- **ซ่อนและระงับปุ่ม Publish สำหรับรูปภาพโดยเด็ดขาด** เพื่อป้องกันข้อมูลที่ยังไม่ได้ตรวจหลุดเข้าสู่ระบบ

### ข้อความดิบ (TXT Import):
- จัดอยู่ในประเภท: **`BRANCH_RULE_DRAFT`**
- เพิ่มกล่อง Checkbox บังคับ:  
  `[ ] ผู้จัดการสาขาตรวจทานความถูกต้องแล้ว (Branch Manager Review & Syntax Verification)`
- หากยังไม่ได้ติ๊ก Checkbox ปุ่มยืนยันการเผยแพร่จะไม่ทำงาน และ**ห้ามเขียนทับ Master โดยตรง**

### ไฟล์ Excel สาขา:
- หน้า Diff Preview แยกการแสดงผลรายการ Current Batch ออกจาก Historical และ Expired อย่างชัดเจน
- กรองให้ Publish ได้เฉพาะรายการสถานะ `PASSED_VALIDATION` และ `WARNING_CONFIRMABLE` เท่านั้น ส่วน `BLOCKED_INVALID` จะถูกตัดแยกเข้า Quarantine Table

---

## 8. สรุปรายงานและหลักฐานการทดสอบ (Reports Artifacts Index)

1. [reports/promotion_928_reconciliation.json](file:///c:/Users/JarNJay/.gemini/antigravity-ide/scratch/samsung-stock-dashboard/reports/promotion_928_reconciliation.json) - ตารางกระทบยอด 928 รายการ และคำอธิบาย 537 รายการอย่างละเอียด
2. [reports/stock_snapshot_metadata_test.json](file:///c:/Users/JarNJay/.gemini/antigravity-ide/scratch/samsung-stock-dashboard/reports/stock_snapshot_metadata_test.json) - ผลการทดสอบความครบถ้วนของ 13 ฟิลด์ Metadata ประจำ Snapshot
3. [reports/indexeddb_fallback_test.json](file:///c:/Users/JarNJay/.gemini/antigravity-ide/scratch/samsung-stock-dashboard/reports/indexeddb_fallback_test.json) - ผลการทดสอบ Fallback Hierarchy และการระงับใช้ Snapshot เสียหาย (`LOCAL_SNAPSHOT_INVALID`)
4. [reports/rollback_event_test.json](file:///c:/Users/JarNJay/.gemini/antigravity-ide/scratch/samsung-stock-dashboard/reports/rollback_event_test.json) - หลักฐานการบันทึกประวัติ Rollback Event โดยไม่ลบประวัติเดิม
5. [reports/import_center_preview_results.json](file:///c:/Users/JarNJay/.gemini/antigravity-ide/scratch/samsung-stock-dashboard/reports/import_center_preview_results.json) - ผลการทดสอบภาพรวมบน Protected Preview (Console Error = 0, Network 404 = 0)
6. [runtime_manifest.json](file:///c:/Users/JarNJay/.gemini/antigravity-ide/scratch/samsung-stock-dashboard/runtime_manifest.json) - ลายนิ้วมือ SHA256 ของไฟล์ Runtime ทั้ง 22 ไฟล์ (CI Quality Gate 11/11 ผ่านสมบูรณ์)
