# NotebookLM Read-Only Knowledge Assistant Contract

> **Document Type**: System Governance & Architectural Boundary Contract  
> **Status**: `ACTIVE & ENFORCED`  
> **Target Tool**: Google NotebookLM (External Cloud Knowledge Assistant)  
> **Target System**: Samsung Branch Operations System  
> **Version**: `1.0.0`  
> **Date**: `2026-09-07`

---

## 1. วัตถุประสงค์ (Purpose & Operational Scope)

Google NotebookLM ถูกจัดวางให้ทำหน้าที่เป็น **"ผู้ช่วยความรู้และค้นหาข้อมูลแบบอ่านอย่างเดียว" (Read-Only Knowledge Assistant)** สำหรับพนักงานสาขาและทีมบริหารงานหน้าร้าน

### หน้าที่ที่อนุญาต (Authorized Scope):
1. **ค้นหาโปรโมชั่น**: ค้นหาส่วนลด, ของแถม, และเงื่อนไขตามรุ่น ความจุ หรือวิธีการชำระเงิน
2. **สรุปโปรโมชั่นรายรุ่น**: สรุปสิทธิประโยชน์แบบกระชับไม่เปลี่ยนความหมาย
3. **อธิบายเงื่อนไขที่ซับซ้อน**: อธิบายลำดับส่วนลด กฎการแลกซื้อ หรือข้อกำหนดสินเชื่อ SF+
4. **เปรียบเทียบแหล่งข้อมูล**: เปรียบเทียบไฟล์ Excel ต่างชีต หรือระหว่างเอกสารค้าปลีกกับแท็บเล็ต
5. **ชี้ข้อมูลที่ขัดแย้งกัน**: รายงานข้อความที่ขัดแย้งกันโดยระบุสถานะเป็นข้อเสนอแนะ
6. **สร้าง FAQ และคู่มือภายใน**: ผลิตคู่มือสรุปภาษาไทยสำหรับการอบรมพนักงาน
7. **ช่วยค้นหาพิกัดต้นทาง**: ระบุ `sourceFileDisplayName`, `sourceSheet`, และ `sourceRow` เพื่อการตรวจสอบย้อนกลับ

### หน้าที่ต้องห้ามเด็ดขาด (Strictly Prohibited):
1. **ห้ามกำหนดราคาหรือคำนวณราคา** เพื่อนำไปแสดงผลหรือจำหน่ายจริง
2. **ห้ามเปลี่ยนคูปอง** (เช่น บังคับเปลี่ยนคูปอง Studentcrd หรือรวมคูปอง 01/06)
3. **ห้ามเปลี่ยน Sale Mode** (เช่น เปลี่ยน Trade Up หรือ SF+ เป็น Standard Payment)
4. **ห้ามอนุมัติหรือ Publish โปรโมชั่น** เข้าสู่ระบบ
5. **ห้ามแก้ไขข้อมูล Stock** ในสต็อกสาขา
6. **ห้ามปลดรายการ Blocked** ที่ถูกกักกันโดย Rule Engine
7. **ห้ามคิดราคาทดแทน** สำหรับเซลล์ที่มีค่า `#ERROR!`, `#REF!`, หรือว่างเปล่า
8. **ห้ามเขียนข้อมูลกลับ** ไปยัง Database, Dashboard Runtime, หรือไฟล์ Validated Data

---

## 2. ตำแหน่งเชิงสถาปัตยกรรม (Architectural Boundaries)

```text
[Pipeline หลัก: แหล่งความจริงหนึ่งเดียว (Single Source of Truth)]
Excel ต้นทาง ---> Python Parser ---> Rule Engine ---> CI Quality Gate ---> Validated Data ---> API ---> Dashboard
                                                            |
                                               [ผ่าน Gate 11/11 เท่านั้น]
                                                            v
[Pipeline ความรู้: อ่านอย่างเดียว (Read-Only Sidecar)]
                                              Export Sanitizer & PII Filter
                                                            v
                                              NotebookLM Knowledge Package (CSV/MD)
                                                            v
                                                  Google NotebookLM (Cloud)
                                                            v
                                              [ค้นหา / สรุป / อธิบาย / แจ้งเตือนข้อขัดแย้ง]
```

### ข้อห้ามเชิงสถาปัตยกรรม (Zero Writeback Guarantee)
จะต้อง**ไม่มี**เส้นทางส่งข้อมูลย้อนกลับดังต่อไปนี้:
- `NotebookLM` ➔ `Validated Data` (ห้ามเด็ดขาด)
- `NotebookLM` ➔ `Dashboard Runtime` (ห้ามเด็ดขาด)
- `NotebookLM` ➔ `Database Write API` (ห้ามเด็ดขาด)

### การป้องกันสิทธิ์ระดับระบบ (Credential Isolation)
NotebookLM และผู้ดูแลที่ใช้งาน Package นี้จะต้อง**ไม่มี**:
- API Key สำหรับเขียนฐานข้อมูล
- Supabase Service Role Key
- Access Token หรือ Write Token ใดๆ
- GitHub Personal Access Token ที่มีสิทธิ์ Commit/Push
- Vercel Deployment Hook / Token
- สิทธิ์แก้ไขไฟล์ Source Data หรือรัน Importer อัตโนมัติ

---

## 3. ลำดับความน่าเชื่อถือของข้อมูล (Data Provenance Hierarchy)

กำหนดลำดับชั้นความน่าเชื่อถือทางธุรกิจอย่างเด็ดขาด:

1. **ระดับ 1 (สูงสุด): Excel Source Evidence** (ข้อความต้นฉบับจริงในเอกสารของบริษัท)
2. **ระดับ 2: Branch Confirmed Rules** (กฎข้อตกลงสาขาที่ Store Leader ยืนยัน)
3. **ระดับ 3: Rule Engine Validated Result** (ผลการคำนวณทางคณิตศาสตร์จาก 8 กฎเหล็ก)
4. **ระดับ 4: Dashboard Display** (การแสดงผลบนหน้าจอแดชบอร์ด)
5. **ระดับ 5 (ต่ำสุด): NotebookLM Explanation** (คำอธิบายหรือบทสรุปของ AI)

> **กฎการตัดสิน**: หากคำตอบของ NotebookLM ขัดแย้งกับผลลัพธ์ของ Rule Engine หรือ Source Evidence ให้ยึดถือ Rule Engine และ Excel Source เป็นข้อสรุปเด็ดขาด โดย NotebookLM ไม่มีสิทธิ์เปลี่ยนสถานะหรือราคาโดยพลการ

---

## 4. สถานะผลลัพธ์ที่ NotebookLM ได้รับอนุญาตให้แสดง

| สถานะที่อนุญาต | ความหมาย |
| :--- | :--- |
| `INFORMATIONAL` | คำอธิบายข้อมูลทั่วไปที่ตรงกับ Source Evidence |
| `SUMMARY` | บทสรุปเงื่อนไขโปรโมชั่นโดยคงความหมายเดิมครบถ้วน |
| `SUGGESTION` | ข้อเสนอแนะเชิงปฏิบัติการที่ยังไม่ผ่าน Rule Engine |
| `POSSIBLE_CONFLICT` | ตรวจพบข้อความที่อาจขัดแย้งกัน ต้องส่งให้คนตรวจสอบต้นทาง |
| `SOURCE_CONFLICT` | ตรวจพบข้อความจาก 2 แหล่งข้อมูลที่ไม่ตรงกันอย่างชัดเจน |
| `INSUFFICIENT_EVIDENCE` | เอกสารที่แนบไม่มีหลักฐานเพียงพอที่จะสรุปเงื่อนไข |
| `NOT_FOUND` | ไม่พบข้อมูลที่สอบถามใน Knowledge Package ที่อัปโหลด |

### สถานะต้องห้ามเด็ดขาด (Prohibited Statuses)
ห้ามใช้คำหรือสถานะต่อไปนี้ในคำตอบของ NotebookLM โดยเด็ดขาด:
- ❌ `APPROVED`
- ❌ `PUBLISHED`
- ❌ `READY_FOR_SALE`
- ❌ `CONFIRMED_PRICE`
- ❌ `AUTO_VALIDATED`
- ❌ `VALIDATED_BY_AI`

---

## 5. นโยบายความเสี่ยงที่ยอมรับแล้ว (Accepted Business Risk Policy)

> [!WARNING]
> **การรับทราบและยอมรับความเสี่ยงการใช้บริการภายนอก (Accepted Cloud Risk)**:
> ทีมงานโครงการรับทราบและยอมรับอย่างเป็นทางการว่า แม้ Knowledge Package จะผ่านการคัดกรอง ขจัด Credential, Token, ข้อมูลลูกค้า และข้อมูลส่วนบุคคล (PII) ออกไปทั้งหมด 100% แล้ว แต่โครงสร้างราคา ส่วนลด เงื่อนไขแคมเปญ และข้อมูลของแถม ถือเป็น **"ข้อมูลธุรกิจที่มีมูลค่าทางการแข่งขัน" (Competitive-Sensitive Business Data)**
> 
> การอัปโหลดชุดข้อมูลนี้ไปยัง Google NotebookLM ซึ่งเป็นบริการ Cloud ภายนอก ถือเป็นการตัดสินใจเชิงกลยุทธ์ของทีมบริหารงานโครงการเพื่อเพิ่มประสิทธิภาพหน้าร้าน โดยยอมรับความเสี่ยงที่ข้อมูลโปรโมชั่นอาจถูกประมวลผลบนเซิร์ฟเวอร์ภายนอกของ Google ตามข้อตกลงการใช้งานบริการ

---

## 6. นโยบายการปกปิด P/N (P/N Masking Policy)

เพื่อขจัดความไม่สอดคล้องระหว่างเอกสารและตัวตรวจสอบ Validator:
- กำหนดให้คอลัมน์ใน `audit/blocked_variants.csv` ใช้ชื่อ **`P/N Masked`** เป็นมาตรฐานตายตัว
- กำหนดค่า Default ให้นำหน้าด้วย Prefix และครอบด้วย Mask เสมอ เช่น:
  - `SM-A075*****`
  - `SM-S948B*****`
  - `F-NS776*****`
- **ประโยชน์**: คงโครงสร้างรหัสตระกูลสินค้าและประเภท (SM- vs F-) ให้ AI ใช้อธิบายความผิดพลาดได้ แต่ไม่เปิดเผย SKU ย่อยภายในที่ไม่จำเป็น

---

## 7. ขั้นตอนและผู้รับผิดชอบการ Export และลบข้อมูล (Trigger & Lifecycle Protocol)

1. **เงื่อนไขบังคับก่อนรัน Export (Preconditions)**:
   - Python Parser รันเสร็จสมบูรณ์
   - Rule Engine คำนวณเสร็จสมบูรณ์
   - CI Quality Gate ผ่าน 11/11 กฎ (`exact_pn_quality_gate.json` = PASSED, `batch_consistency_gate.json` = PASSED, `runtime_hash_verification.json` = PASSED)
2. **ผู้สั่งการ Export (Trigger Owner)**:
   - สั่งรันด้วยมือ (Manual Execution) โดย Store Operations Lead หรือ Technical Lead ผ่านคำสั่ง:
     ```bash
     python scripts/notebooklm_export.py
     python scripts/notebooklm_export_validator.py
     ```
3. **การลบและควบคุม Package เก่า (Lifecycle & Deletion Owner)**:
   - กำหนดให้มีชุดข้อมูลที่ใช้งานบน NotebookLM เพียงชุดเดียวที่มีสถานะ `CURRENT`
   - เมื่อสร้าง Package รอบใหม่สำเร็จ ให้ **Store Operations Lead** ทำการลบ Source เก่าออกจากหน้าเว็บ Google NotebookLM UI ด้วยตนเอง หรือย้ายเข้าสมุดงาน `ARCHIVED` แยกต่างหาก เพื่อป้องกันไม่ให้ AI ดึงข้อมูลโปรโมชั่นเก่าที่หมดอายุมาตอบปะปน

---

## 8. เกณฑ์การตรวจรับสัญญา (Acceptance Criteria)

- [x] มีข้อกำหนดห้ามเขียนข้อมูลกลับ (Zero Writeback)
- [x] บันทึกนโยบายความเสี่ยงที่ยอมรับแล้ว (Accepted Cloud Risk)
- [x] กำหนดมาตรฐาน P/N Masked เป็นค่าเริ่มต้นที่ชัดเจน
- [x] มีลำดับความน่าเชื่อถือของข้อมูล 5 ระดับ
- [x] กำหนดสถานะคำตอบที่อนุญาต 7 สถานะ และสั่งห้ามสถานะอันตราย 6 สถานะ
- [x] ระบุผู้รับผิดชอบขั้นตอน Trigger และ Deletion ชัดเจน
