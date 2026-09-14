# กฎโปรโมชั่นสาขาที่ได้รับการยืนยันแล้ว (Branch Confirmed Business Rules)
**สาขา:** Samsung Ayutthaya City Park 1st Floor (Copperwired)  
**เวอร์ชันเอกสาร:** V2026.09-CONFIRMED  
**วัตถุประสงค์:** เอกสารแม่บท (Ground Truth) สำหรับใช้เป็น Source ใน **NotebookLM** และเป็นเกณฑ์ในการตรวจสอบของ **Rule Engine**

---

## 1. การจำแนกประเภทสินค้าจากรหัส P/N (Product Code Type Classification)
- **เครื่องเปล่า (Standard Single Device):**
  - รหัส P/N ขึ้นต้นด้วย `SM-` เท่านั้น (เช่น `SM-A075FLVDTHL`, `SM-F761BLVBTHL`)
  - ใช้โปรโมชั่นปกติของเครื่องเปล่า ห้ามดึงโปรโมชั่นของพาส F มาใช้
- **พาส F (PASS_F / Special Promo / Launch Set):**
  - รหัส P/N ขึ้นต้นด้วย `F-` (เช่น `F-NS761256B`, `F-A074G064VDTH`)
  - หมายถึง ชุดสินค้าเปิดตัว, สินค้าโปรโมชั่นพิเศษ, หรือสินค้าจัดเซ็ตราคาพิเศษ
  - อาจได้รับ: สิทธิ์เพิ่มความจุ (Memory Upgrade), ราคาพิเศษ, ของแถมพิเศษจาก Samsung, หรือสิทธิ์ Trade Up
  - **ห้ามนำสิทธิ์ของพาส F ไปใช้กับเครื่องรหัส SM-**
- **BOM SET:**
  - สินค้าที่มีชุดองค์ประกอบหรือแถมอุปกรณ์เฉพาะ เช่น `BOM SET` ในกลุ่ม A-Series หรือ Tablet
- **อุปกรณ์เสริม (Accessories):**
  - รหัสขึ้นต้นด้วย `EP-` (Adapter/Charger), `EF-` (Case/Cover), `GP-` (Gadget/Strap), `ET-` (Stylus), `EJ-` (S Pen)

---

## 2. การแยกเส้นทางการขาย (Sale Mode Definition)
1. **NORMAL (ราคาปกติ):**
   - ราคา RRP / SRP เต็มจำนวน ไม่ได้รับส่วนลดหรือสิทธิ์โปรโมชั่น
2. **STANDARD_PAYMENT (ชำระเงินปกติ):**
   - รวมการชำระเงิน 4 ช่องทาง: **เงินสด, บัตรเครดิตรูดเต็มจำนวน, ผ่อนชำระผ่านบัตรเครดิต, และผ่อนผ่านบัตรกดเงินสด**
   - ใช้คูปองส่วนลดมาตรฐานตามที่ระบุในตาราง (เช่น Coupon `01`)
3. **SF_PLUS (Samsung Finance+):**
   - การผ่อนชำระผ่านสินเชื่อ Samsung Finance+
   - ต้องใช้คูปองสำหรับ SF+ เท่านั้น (เช่น Coupon `04`) ห้ามใช้คูปอง Standard ร่วม
4. **STUDENT (โปรโมชั่นนักเรียน / นักศึกษา):**
   - **กฎเหล็ก (Hard Rule):** ต้องใช้คูปองรหัส `Studentcrd` เท่านั้น
   - ห้ามใช้ร่วมกับ SF+ (`sfPlusEligible = false`)
   - ห้ามใช้ร่วมกับ Trade Up (`tradeUpEligible = false`)
   - ห้ามซ้อนคูปอง Standard
5. **TRADE_UP (เก่าแลกใหม่):**
   - ต้องใช้รหัสชำระเงิน Trade Up: `T-UP-CO-S`
   - ราคาที่ระบุในช่อง Trade Up เป็น **"ราคาหลังหักส่วนลด Trade Up แล้ว"** ไม่ใช่ราคาเครื่องเปล่าสำหรับขายปกติ
6. **MBO (Must Buy Option / ซื้อร่วมตามเงื่อนไข):**
   - ต้องมีสินค้าหลัก (Main Device) ที่เข้าเงื่อนไขก่อน จึงจะได้รับสิทธิ์ราคาพิเศษสำหรับสินค้าพ่วง (เช่น ซื้อ Smartphone แลกซื้อ Watch/Buds)
7. **BUNDLE (ชุดแลกซื้อ):**
   - สินค้าแลกซื้อ เช่น สิทธิ์ซื้ออุปกรณ์เสริมลด 50% เมื่อซื้อเครื่อง Galaxy Tablet

---

## 3. กฎเฉพาะสำหรับสินค้ารุ่นสำคัญ (Model-Specific Golden Rules)

### 3.1 Galaxy Z Flip8
- **ราคา Trade Up:**
  - 256GB: RRP 42,900 บาท | ส่วนลด Trade Up 5,000 บาท | **ราคาหลัง Trade Up = 37,900 บาท**
  - 512GB: RRP 50,900 บาท | ส่วนลด Trade Up 5,000 บาท | **ราคาหลัง Trade Up = 45,900 บาท**
  - รหัส Trade Up: `T-UP-CO-S`
- **การแยกของแถม (Gift Separation Rule):**
  - **ของแถมจาก Samsung:** Power Adapter (สำหรับพาส F)
  - **ของแถมจากร้าน Copperwired:** ลำโพง / หูฟัง / พรีเมียมของร้าน
  - **เงื่อนไขสำคัญ:** หากลูกค้า **"สละของแถมจาก Copperwired"** (เช่น เพื่อรับส่วนลดหน้าร้าน) **ลูกค้ายังคงมีสิทธิ์ได้รับ Power Adapter จาก Samsung ตามปกติ** ระบบต้องไม่ตัดของแถม Samsung ออก

### 3.2 Galaxy Fold8 / Fold8 Ultra
- **สถานะพาส F:** สินค้า Fold8 พาส F เปิดตัวหมดจากสต็อกแล้ว ปลดออกจากระบบ Active
- **การขายปัจจุบัน:** ขายเฉพาะเครื่องเปล่า `SM-F971`
- **Trade Up:** ใช้รหัส `T-UP-CO-S`

### 3.3 Galaxy Tab A11 / Tab A11+
- **Tab A11+ 5G (SM-X236B):**
  - RRP 10,490 บาท
  - Standard Payment: ราคาสุทธิ **8,990 บาท** | ใช้ Coupon **`01`** (ลด 1,500 บาท)
  - SF+ Payment: ราคาสุทธิ **9,990 บาท** | ใช้ Coupon **`04`** (ลด 500 บาท)
  - ระบบต้องแยกคูปอง `01` และ `04` ชัดเจนตาม Sale Mode ห้ามแสดงสลับกัน

### 3.4 Galaxy Tab S10 Lite / Tab S10 FE
- แสดงป้ายแจ้งสิทธิ์โปรโมชั่นและของแถม Book Cover Keyboard / Smart Book Cover อย่างชัดเจน
- สิทธิ์แลกซื้อ Accessory ลด 50%

### 3.5 Galaxy Tab S11
- แยกรายการคูปอง `01` (Standard) และ `06` (โปรพิเศษ/อุปกรณ์เสริม) ออกจากกันเป็นคนละ Variant ห้ามยุบรวม

### 3.6 Galaxy S26 FE
- รุ่นพาส F เป็นชุดโปรเปิดตัวอัปเกรดความจุ (Memory Upgrade: จ่ายราคา 128GB ได้ 256GB หรือ จ่าย 256GB ได้ 512GB)
- ห้ามดึงราคานี้ไปใช้กับเครื่องเปล่า `SM-` ปกติ

### 3.7 Galaxy A-Series (A07, A17, A27, A37, A57)
- **Galaxy A07:**
  - ยืนยันสต็อกและ P/N ทั้ง 14 รายการใน `Stock.xlsx`
  - แสดงจำนวนเครื่องราย P/N: ร้านเรา (ช1), สาขา (ช2), และ รวม
  - หากไม่มีสต็อก ให้แสดงเลข `0` อย่างชัดเจน ห้ามแสดงเป็นค่าว่างหรือ `-`

---

## 4. กฎการควบคุมความปลอดภัยและการกักกัน (Risk Guard & Quarantine Rules)
1. **สูตรผิดพลาดใน Excel:** เซลล์ใดที่มีค่า `#ERROR!`, `#REF!`, `#VALUE!` หรือ `#DIV/0!` ให้จัดเป็นสถานะ `BLOCKED_INVALID` ทันที และห้ามนำไปแสดงราคาขายใน Dashboard
2. **โปรโมชั่นหมดอายุ (Expired):** ข้อมูลของแถมหรือแคมเปญปี 2025 ให้จัดเก็บในหมวด Historical Archive ไม่นำมาปะปนกับแคมเปญปัจจุบัน
3. **ห้ามเดาคูปอง:** หาก Excel ระบุส่วนลดแต่ไม่ได้ใส่รหัสคูปอง ให้ติดแท็ก `COUPON_MISSING` และต้องได้รับการยืนยันก่อนนำไปแสดงผล
4. **ความแม่นยำระดับเซลล์ (Cell-Level Provenance):** ทุก Variant ในระบบต้องสามารถสอบทานย้อนกลับไปยัง:
   - `sourceFile`
   - `sourceSheet`
   - `sourceRow`
   - `column`
   - `headerPath`

---

## 5. บทบาทของ NotebookLM ในสถาปัตยกรรมระบบ
- **สิ่งที่ NotebookLM ได้รับอนุญาตให้ทำ:**
  - สรุปภาพรวมโปรโมชั่นรายรุ่นสำหรับตอบคำถามพนักงาน
  - เปรียบเทียบไฟล์ Excel กับเอกสารกฎฉบับนี้ เพื่อค้นหาจุดที่อาจขัดแย้งกัน
  - ช่วยตีความภาษาไทยที่มีความกำกวม เช่น คำว่า "และ", "หรือ", "ไม่รับของแถม"
  - จัดทำคู่มืออบรมและสรุป FAQ สำหรับพนักงานประจำสาขา
- **สิ่งที่ NotebookLM ห้ามทำโดยเด็ดขาด (Strict Prohibition):**
  - **ห้ามเขียนหรือแก้ไขไฟล์ `validated_promotions.json` หรือฐานข้อมูล Dashboard โดยตรง**
  - ห้ามตัดสินใจเปลี่ยนราคาหรือคูปองโดยไม่มีกฎรองรับ
  - ห้ามปลดสถานะ `BLOCKED` หรือแก้ค่า `#ERROR!` ด้วยการคาดเดา

---

## 6. กฎถาวรการแสดงผลสต็อก (Permanent Stock Display Rules)
**บังคับใช้กับ UI/UX ทุกหน้าของระบบ:**

### 6.1 การ์ดสรุปด้านบน (Summary Cards) & Dashboard KPI
- **ขอบเขตการคำนวณ:** แสดงเฉพาะยอดสต็อก **ชั้น 1 (F1) เท่านั้น**
  - $\text{สินค้าและอุปกรณ์ทั้งหมด} = \sum(F1)$
  - $\text{สมาร์ตโฟน} = \sum(F1)$
  - $\text{แท็บเล็ต} = \sum(F1)$
  - $\text{Galaxy Watch} = \sum(F1)$
  - $\text{Galaxy Buds} = \sum(F1)$
  - $\text{อุปกรณ์เสริม} = \sum(F1)$
  - $\text{สินค้าอื่น ๆ} = \sum(F1)$
- **ข้อความกำกับหน่วย:** ต้องใช้ `เครื่อง (ชั้น 1)` หรือ `ชิ้น (ชั้น 1)` หรือ `เรือน (ชั้น 1)`
- **กฎเหล็ก (Strict Prohibition):** **ห้ามแสดงหรือคำนวณเป็น F1 + F2 บนการ์ดสรุปหรือ Widget KPI ทุกใบ**
- **Dashboard KPI และหน้า/Widget อื่น:** ห้ามนำ F2 มารวมโดยเด็ดขาด

### 6.2 ตารางรายการสินค้า (Stock Table)
- **เฉพาะตารางนี้เท่านั้นที่อนุญาตให้แสดง 3 คอลัมน์:**
  - `ร้านเรา (ชั้น 1)` $= F1$
  - `สาขา (ชั้น 2)` $= F2$
  - `รวมสต็อก` $= F1 + F2$
- ตัวอย่างการแสดงผลแถวสินค้า:
  - ร้านเรา (ชั้น 1): $2$
  - สาขา (ชั้น 2): $5$
  - รวมสต็อก: $7$
- การกรอง:
  - ตัวกรอง "ชั้น 1": กรองเฉพาะรายการที่ $F1 > 0$
  - ตัวกรอง "ชั้น 2": กรองเฉพาะรายการที่ $F2 > 0$

---

## 7. กฎการจำแนกหมวดหมู่และการแสดงผลตามไฟล์ `stock(1).xlsx`

### 7.1 ลำดับการจำแนกหมวดหมู่ (Category Classification Precedence)
ต้องตรวจสอบคอลัมน์ `Category 1 (Cat1)`, `Category 2 (Cat2)`, `Category 3 (Cat3)` จาก Excel ก่อนรหัส P/N เสมอ:
1. **Galaxy Buds:**
   - $\text{Cat1} = \text{"AUDIO"} \land \text{Cat2} = \text{"HEADPHONE"} \land \text{Cat3} = \text{"TRUE WIRELESS"} \land \text{Brand} = \text{"SAMSUNG"}$
   - หรือ $\text{Brand} = \text{"SAMSUNG"} \land (P/N \in \text{SM-R4*, SM-R5*, SM-R6*} \lor \text{Model มีคำว่า BUDS})$
   - **กฎเหล็ก:** ห้ามจัดสินค้าที่มีรหัส `SM-R...` เป็น Smartphone โดยเด็ดขาด ต้องแยก Buds ออกก่อนเสมอ
2. **Smartphone:**
   - $\text{Cat1} \in \{\text{"SMART PHONES", "SMARTPHONES", "SMART PHONE"}\}$ (และ $P/N$ ต้องไม่ขึ้นต้นด้วย `SM-R`, `SM-L`, `SM-X`, `EP-`, `EF-`)
3. **Tablet:**
   - $\text{Cat1} \in \{\text{"COMPUTER AND TABLET", "TABLET", "TAB"}\} \lor P/N \in \text{SM-X*}$
4. **Galaxy Watch:**
   - $\text{Cat1} \in \{\text{"SMART WATCH", "WATCH"}\} \lor (\text{Brand} = \text{"SAMSUNG"} \land P/N \in \text{SM-R8*, SM-R9*, SM-L3*, SM-L7*})$
5. **อุปกรณ์เสริม (Accessories):**
   - $\text{Cat1} \in \{\text{"MOBILE AND COMPUTER ACCESSORY", "ACCESSORY", "ADAPTER"}\} \lor P/N \in \text{EP-*, EF-*, GP-*, ET-*, EJ-*, EE-*}$
6. **ของแถม / Premium:**
   - $\text{Cat1/Cat2 มีคำว่า PREMIUM หรือ FREE GIFT} \lor \text{Model มีคำว่า PREMIUM, GAABOR, STAINLESS STEEL}$
7. **ซิมการ์ด (SIM):**
   - $\text{Cat1 มีคำว่า SERVICE, INSURANCE AND WARRANTY หรือ SIM} \lor \text{Model มีคำว่า SIM}$
8. **สินค้าอื่น ๆ (Other):**
   - สินค้าที่ไม่เข้าเงื่อนไข 1-7 ข้างต้น เช่น ลำโพง Soundcore, พัดลม Jisulife, ไมโครเวฟ, เครื่องฟอกอากาศ

### 7.2 ตัวเลขเป้าหมายบนการ์ดสรุปชั้น 1 (F1 Only)
| การ์ดสรุป | ยอดสต็อก F1 | จำนวนรุ่น (P/N ไม่ซ้ำใน Sheet1) | สถานะการแสดงผล |
| :--- | :---: | :---: | :---: |
| **สต๊อกทั้งหมด ชั้น 1** | **1,701** | **333 รายการ** | แสดง |
| **Smartphone** | **230** | **62 รุ่น** | แสดง |
| **Tablet** | **34** | **12 รุ่น** | แสดง |
| **Galaxy Watch** | **61** | **17 รุ่น** | แสดง |
| **Galaxy Buds** | **49** | **9 รุ่น** | แสดง |
| **อุปกรณ์เสริม** | **972** | **189 รายการ** | แสดง |
| **ของแถม / Premium** | **282** | **24 รายการ** | แสดง |
| *ซิมการ์ด (SIM)* | *58* | *11 รายการ* | **ซ่อนการ์ด** (`display: none !important;`) |
| *สินค้าอื่น ๆ (Other)* | *15* | *9 รายการ* | **ซ่อนการ์ด** (`display: none !important;`) |

### 7.3 การอัปเดตแบบ Reactive ทันทีหลัง Import
เมื่อผู้ใช้กดยืนยันนำเข้าไฟล์ผ่าน Stock Import Center ระบบต้อง:
1. บันทึก Snapshot ลง IndexedDB (`StockStorageAdapter.saveBatch`)
2. อัปเดต `window.STOCK_DATABASE` และ `window.STOCK_DATA`
3. ล้าง Cache ของ DataLoader
4. เรียก `PrototypeStock.refresh()` เพื่อคำนวณการ์ด F1 ใหม่และเรนเดอร์ตารางทันทีโดยไม่ต้อง Hard Refresh หรือปิดเปิดเบราว์เซอร์ใหม่


