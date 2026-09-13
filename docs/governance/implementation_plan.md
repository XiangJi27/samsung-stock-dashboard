# Implementation Plan: User Feedback Pilot (Dashboard-First 4-User Store Model)

**Branch**: `feature/user-feedback-pilot`  
**Scope**: Ayutthaya City Park Store (`AYUTTHAYA_CITY_PARK`)  
**Target Users**: 4 Users (1 Manager/Admin + 3 Sales Staff)  
**Primary Landing**: Dashboard (`/#/home`) -> Quick Actions to Stock (`/#/stock`)  

---

## 1. Governance State

- `PILOT_SCOPE = SINGLE_BRANCH_SMALL_TEAM`
- `PILOT_USERS = 4`
- `DEFAULT_AFTER_LOGIN = DASHBOARD (/#/home)`
- `PRIMARY_FEATURE = STOCK_LOOKUP`
- `MANAGER_FEATURES = STOCK_IMPORT, PROMOTION_IMPORT, MEMBER_ADMIN`
- `FEEDBACK_FEATURES = REPORT_ISSUE, MY_ISSUES, BRANCH_ISSUES`
- `MEMBERSHIP_MODEL = ADMIN_CREATED_ONLY (Invite-Only)`
- `PUBLIC_SIGNUP = DISABLED`
- `BASELINE_RUNTIME_INTEGRITY = PASS (23/23 MATCHED, Commit a7c3390)`
- `FEEDBACK_PILOT_RUNTIME = BUILT (pilot.html & samsung_stock_dashboard_feedback_pilot.zip)`
- `EMPLOYEE_PILOT = HOLD (Until API & Browser Acceptance)`
- `PRODUCTION = HOLD`
- `MAIN_MERGE = HOLD`

---

## 2. Dashboard Architecture & Widget Registry (`/#/home`)

Extensible `WIDGET_REGISTRY` architecture supporting real store data and future integration slots without refactoring:

### Active Live Widgets (Real Data)
- 📦 **สต็อกเครื่องหลักรวม**: 760 เครื่อง (คำนวณจาก `stock_data.js`)
- 🏪 **ยอดสต็อกแยกชั้น**: ร้านเรา ชั้น 1 (379 เครื่อง) / สาขา ชั้น 2 (381 เครื่อง)
- 🏷️ **โปรโมชั่นพร้อมใช้งาน**: คำนวณจาก `promotion_variants.js`
- 🐞 **ปัญหาหน้าร้าน**: นับจำนวนปัญหาที่รายงานโดยผู้ใช้ พร้อมลิงก์ติดตามสถานะ

### Future Expansion Slots (`NOT_CONNECTED` / `COMING_SOON`)
- 💰 **ยอดขายวันนี้** (`NOT_CONNECTED` - ป้องกันตัวเลขจำลอง)
- 🎯 **เป้าหมายยอดขาย** (`COMING_SOON`)
- 📈 **ยอดขายสะสมเดือนนี้** (`NOT_CONNECTED`)
- 🧾 **จำนวนบิลขาย** (`NOT_CONNECTED`)

---

## 3. Role-Aware Navigation & Route Guards

### Sales Staff (`MEMBER`)
- 📊 แดชบอร์ด (`/#/home`)
- 📦 สต็อกสินค้า (`/#/stock`)
- 🏷️ โปรโมชั่น (`/#/promotions`)
- 🐞 รายงานปัญหา (Modal 5 ช่อง)
- 📋 ปัญหาของฉัน (`IssueListView`)
- 🚪 ออกจากระบบ

### Store Leader & System Admin (`STORE_LEADER` + `SYSTEM_ADMIN`)
- ครบทุกเมนูด้านบน +
- 📥 อัปเดตสต็อก (`/#/stock-import`)
- ⚡ อัปเดตโปรโมชั่น (`/#/promotion-import`)
- 👥 จัดการสมาชิก (`/#/admin/members`)
- 📋 ปัญหาทั้งหมดในสาขา
- 🧠 วิเคราะห์ปัญหาด้วย AI (On-demand)

### Route Guard Enforcement (`assets/js/session-guard.js`)
- บล็อกการเข้าถึง URL ผู้จัดการโดยตรง (`/#/admin/members`, `/#/stock-import`, `/#/promotion-import`, `/#/issues/branch`)
- แสดง Toast Alert "🚫 คุณไม่มีสิทธิ์เข้าถึงหน้านี้" และดีดกลับ `/#/home`
- ตรวจสอบ `profiles.status === 'SUSPENDED'` หากถูกระงับจะบังคับ Logout ทันที

---

## 4. Secure Member Administration API (`api/admin/members.js`)

- Serverless API endpoint: `POST /api/admin/members`
- ตรวจสอบ JWT Caller ว่ามีบทบาท `SYSTEM_ADMIN`
- เรียกใช้ Supabase Admin API บน Server-side ด้วย `SUPABASE_SERVICE_ROLE_KEY`
- สร้าง Auth User (`normalizedCode@staff.internal`), Profile, และ `MEMBER` Role
- **Zero Browser Secret Exposure**: ป้องกัน Service Role Key หลุดสู่ Browser โดยเด็ดขาด
