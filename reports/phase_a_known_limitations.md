# ข้อจำกัดและสถานะของระบบใน Phase A (Known Limitations & Status)

**ระบบ:** Samsung Branch Operations System  
**เวอร์ชัน:** Phase A: Application Shell (V2026.09-v1)  
**วันที่บันทึก:** 7 กันยายน 2026

---

## 1. การพิสูจน์ตัวตน (Authentication Limitations)
- **โหมดการทำงานปัจจุบัน:** `DEVELOPMENT AUTHENTICATION` เท่านั้น
- **การจัดเก็บเซสชัน:** จัดเก็บเฉพาะใน `sessionStorage` ภายในแท็บของเบราว์เซอร์เท่านั้น (เซสชันจะถูกทำลายอัตโนมัติเมื่อปิดแท็บ และไม่แชร์ข้ามแท็บใหม่)
- **ยังไม่ใช่ Production Ready Authentication:** ยังไม่มีการเชื่อมต่อระบบบัญชีองค์กร เช่น **Microsoft Entra ID (Azure AD)**, Supabase Auth, หรือระบบ SSO ของบริษัท Copperwired
- **นโยบายความปลอดภัย:** ระบบไม่มีการเก็บ Password จริง, ไม่มีรหัสผ่านใน Git, ไม่ใช้ `localStorage` สำหรับ Token, และไม่มีการส่งข้อมูลรหัสผ่านออกนอกเครื่อง

---

## 2. โมดูลยอดขาย (Sales Dashboard Limitations)
- **สถานะ:** `NOT_CONNECTED` (รอเชื่อมต่อข้อมูล)
- **ไม่มีตัวเลขจำลอง:** การ์ดยอดขายวันนี้, เป้าหมาย, Achievement, จำนวนบิล และยอดซื้อเฉลี่ย แสดงข้อความ "รอเชื่อมต่อข้อมูลระบบ POS" โดยไม่มีการสร้างตัวเลขปลอมหรือเลข 0
- **แผนงาน:** จะเชื่อมต่อในโปรเจกต์ถัดไปเมื่อ IT กำหนดช่องทางการดึงข้อมูล (API, POS Export, หรือ BI System)

---

## 3. ข้อมูลสต็อก (Stock Module Status)
- **ลักษณะข้อมูล:** ข้อมูลสต็อกในระบบเป็น **Snapshot จากไฟล์ Excel (`Stock.xlsx` Promotion Sheet)** ไม่ใช่ข้อมูล Real-time ดึงสดจากระบบ InventoryControl.asp / Nimbus แบบวินาทีต่อวินาที
- **ความแม่นยำ:** ตัวเลขสต็อกตรงตามไฟล์ `Stock.xlsx` 100% โดยแสดงจำนวนเครื่องราย P/N แยกตาม ร้านเรา (ช1) และ สาขา (ช2) ชัดเจน

---

## 4. คลังความรู้ (NotebookLM Integration Status)
- **สถานะ:** `PLANNED` (วางแผนแล้วและจัดเตรียมชุดข้อมูล Source ครบถ้วน)
- **สิทธิการทำงาน:** เป็น **Read-only Knowledge Assistant** ผ่านการอัปโหลดไฟล์ Source (`branch_confirmed_rules.md`, `promotion_draft.csv`, `active_promotions.csv`)
- **ข้อจำกัด:** ไม่มีการเชื่อมต่อแบบ Auto-Publish เพื่อป้องกันไม่ให้ AI เขียนทับราคาในระบบโดยตรง
