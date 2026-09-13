# Walkthrough: User Feedback Pilot (4-User Store Model)

**Branch**: `feature/user-feedback-pilot`  
**Target Store**: Ayutthaya City Park (`AYUTTHAYA_CITY_PARK`)  
**Production Baseline Freeze**: `23/23 MATCHED (100% Verified, Commit a7c3390)`  
**Pilot Runtime Package**: `samsung_stock_dashboard_feedback_pilot.zip` (36 files total)  

---

## 1. Milestone A: Automated Database RLS Tests (`supabase/tests/`)

- 8 standardized pgTAP test suites covering 35 assertions
- Enclosed in `BEGIN; ... SELECT * FROM finish(); ROLLBACK;`
- Zero residual test records
- Roles covered in DB logic: `MEMBER`, `STORE_LEADER`, `SYSTEM_ADMIN`
- Security canaries retained: `SUPPORT`, `AUDITOR`, `BRANCH_B`

---

## 2. Milestone B: Streamlined Real Data API Test Runner (`scripts/`)

- `scripts/fixtures/rls-test-users.example.json`: 4-context role definition
- `scripts/test_live_api_sessions.js`:
  - `ANON`: Public unauthenticated access defense
  - `MEMBER_A`: Sales staff primary workflow & RLS defense
  - `MEMBER_B`: Peer-to-peer personal issue privacy defense
  - `ADMIN`: Manager triage, internal notes, and status transitions
  - Exit 0: All executed tests pass (`MEMBER_API_SMOKE_TEST` or `PILOT_STORE_MATRIX_PASSED`)
  - Exit 1: Assertion failure
  - Exit 2: Configuration missing (.env.feedback-pilot.local)
  - Automatic purging of `[RLS-TEST]%` fixtures

---

## 3. Milestone C: Pilot UI & Packaging (`pilot.html`)

- `pilot.html`: Dedicated pilot entrypoint without modifying `index.html`
- Direct landing to `/#/stock` after login and session restore
- Simplified 5-field Issue Reporting Modal:
  - 1. พบปัญหาที่หน้าไหน (Screen)
  - 2. หัวข้อปัญหา (Title)
  - 3. รายละเอียด (Description)
  - 4. ระดับผลกระทบ (ใช้งานต่อไม่ได้, ข้อมูลอาจผิด, ใช้งานได้แต่ไม่สะดวก, ข้อเสนอแนะ)
  - 5. ภาพหน้าจอ (COMING SOON)
- Issue Tracking Modal with Manager controls:
  - Status transitions (`กำลังตรวจสอบ`, `กำลังแก้ไข`, `รอทดลองใหม่`, `แก้ไขแล้ว`, `ปิดงาน`, `ต้องการข้อมูลเพิ่ม`, `ปัญหาซ้ำ`)
  - Internal manager notes
  - On-demand "วิเคราะห์ปัญหาด้วย AI" button
- Packaging: `scripts/build_pilot_package.py` creates `samsung_stock_dashboard_feedback_pilot.zip` while verifying `samsung_stock_dashboard_runtime.zip` remains untouched.
