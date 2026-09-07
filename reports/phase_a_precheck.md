# Phase A Precheck Report: Samsung Branch Operations System

**วันที่ตรวจสอบ:** 7 กันยายน 2026  
**สาขา:** Samsung Ayutthaya City Park 1st Floor (Copperwired)  
**เป้าหมาย:** วิเคราะห์โครงสร้างเดิมก่อนพัฒนา Application Shell เพื่อป้องกันผลกระทบต่อ Stock และ Promotion Module

---

## 1. ข้อมูลระบบปัจจุบัน (Current State)
- **Entry Point:** `index.html`
- **ไฟล์ Render Stock:** `app.js` (ฟังก์ชัน `renderData()`, `renderTableView()`, `renderCardView()`, `getItemStock()`, `renderStockValue()`, `stockText()`)
- **ไฟล์ Render Promotion:** `app.js` (ฟังก์ชัน `getApprovedPromotion()`, `setupCashierModal()`, `renderCashierSummary()`, `setupAuditModal()`)
- **ไฟล์ Styling:** `style.css` (พร้อม Cache-Busting `?v=20260907-v1`)
- **ไฟล์ Data Runtime:**
  - `stock_data.js` (สร้าง `window.STOCK_DATABASE` 218 รายการ และ `window.STOCK_METADATA`)
  - `promotion_variants.js` (สร้าง `window.PROMOTION_VARIANTS` 554 รายการ และ `window.PROMOTION_BATCH_METADATA`)
- **ระบบ Routing เดิม:** ไม่มี (เป็น Single Page Dashboard หน้าเดียวที่แสดงผลสต็อกทันทีเมื่อโหลดหน้าเว็บ)
- **ระบบ Authentication เดิม:** ไม่มีระบบ Login หรือ User Session

---

## 2. Global Variables ที่ตรวจพบ
1. `window.STOCK_DATABASE` (Array 218 รายการ)
2. `window.STOCK_METADATA` (Object บันทึกสถิติและเวลาอัปเดตสต็อก)
3. `window.PROMOTION_VARIANTS` (Array 554 รายการ)
4. `window.PROMOTION_BATCH_METADATA` (Object บันทึก Batch ID และ Hashes)
5. ตัวแปร State ภายใน `app.js`:
   - `currentFilter`, `currentSearch`, `currentView`, `selectedSaleMode`
   - `masterStockData`

---

## 3. Element IDs สำคัญที่ต้องรักษาไว้ (Strict Preservation)
เพื่อไม่ให้ฟังก์ชันใน `app.js` เกิด Uncaught TypeError (null reference):
- **ชุดค้นหาและตัวกรอง:** `searchInput`, `btnClearSearch`, `btnResetSearch`, `categoryFilters`, `categoryPills`
- **ชุดเปลี่ยนมุมมอง:** `btnViewTable`, `btnViewCards`, `stockTableBody`, `cardViewContainer`, `stockCountBadge`
- **KPI สต็อกเดิม:** `totalCoreStock`, `totalAccStock`, `totalFloor1Stock`, `totalFloor2Stock`, `totalShopStock`
- **ปุ่มเปิด Modal:** `btnAuditModal`, `btnPromoExpiry`, `btnDailyEmail`, `headerAuditBadge`
- **Modals:** `cashierModal`, `auditModal`, `promoExpiryModal`, `dailyEmailModal`, `toast`, `toastMessage`
- **Banner วันหมดอายุ:** `expiryBanner`, `expiryTitle`, `expiryCountdown`, `expiryStatus`

---

## 4. การประเมินความเสี่ยงต่อ Stock Module
- **ระดับความเสี่ยง:** **ต่ำ (Low Risk)** หากใช้วิธี **Wrapper View Container Architecture**
- **กลยุทธ์ป้องกัน:**
  - ไม่ลบหรือแยก Element IDs เดิมของ Stock Dashboard ออกจาก DOM
  - ห่อหุ้มโครงสร้างหน้า Stock เดิมไว้ใน Container `<div id="view-stock" class="app-view">`
  - สร้าง Container แยกสำหรับหน้าใหม่:
    - `<div id="view-login" class="app-view">`
    - `<div id="view-home" class="app-view">`
    - `<div id="view-promotions" class="app-view">`
    - `<div id="view-reports" class="app-view">`
    - `<div id="view-knowledge" class="app-view">`
    - `<div id="view-settings" class="app-view">`
  - ใช้ **Client-Side Hash Router (`/#/...`)** ในการสลับการแสดงผล (Toggle Display / Active Class) ซึ่งป้องกันปัญหา Vercel Static 404 ได้อย่างสมบูรณ์แบบ 100%

---

## 5. แผนการเปลี่ยนแปลงไฟล์ใน Phase A
1. **สร้าง Directory โครงสร้างใหม่:**
   - `assets/css/` (shell.css, login.css, navigation.css, home.css, responsive.css)
   - `assets/js/` (config.js, auth.js, router.js, navigation.js, home.js)
   - `reports/` (phase_a_precheck.md, phase_a_test_results.json, phase_a_walkthrough.md, phase_a_known_limitations.md)
2. **สร้าง `assets/js/config.js`:**
   - กำหนด `FEATURES` Object แบบ `Object.freeze()` ควบคุม Feature Flags
3. **สร้าง `assets/js/auth.js`:**
   - `AuthAdapter` รองรับ `DEVELOPMENT` Mode (เก็บ Session เฉพาะใน `sessionStorage`, หมดอายุเมื่อปิด Tab, ไม่แตะ `localStorage`, ไม่มี Hardcoded Password)
4. **สร้าง `assets/js/router.js`:**
   - จัดการ Hash Routing (`/#/login`, `/#/home`, `/#/stock`, `/#/promotions`, `/#/reports`, `/#/knowledge`, `/#/settings`)
   - Route Guard ตรวจสถานะ Session: หากยังไม่ Login ให้ Redirect ไป `/#/login`
5. **สร้าง Navigation (Desktop Sidebar & Mobile Bottom Nav):**
   - แสดงเมนูหลัก พร้อม Active State ตาม Route ปัจจุบัน
6. **สร้าง `assets/js/home.js`:**
   - แสดงภาพรวมสาขา, สถานะระบบ, Stock Summary คำนวณสด, Quick Actions
   - Sales KPI แสดง `NOT_CONNECTED` (รอเชื่อมต่อข้อมูล) ไม่มีตัวเลขจำลองหรือเลข 0
7. **เชื่อมโยงเข้า `index.html`:**
   - โหลดตามลำดับ: `config.js` -> `auth.js` -> `stock_data.js` -> `promotion_variants.js` -> `app.js` -> `home.js` -> `navigation.js` -> `router.js`
