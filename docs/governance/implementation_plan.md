# Implementation Plan: User Feedback Pilot (4-User Store Model)

**Branch**: `feature/user-feedback-pilot`  
**Scope**: Ayutthaya City Park Store (`AYUTTHAYA_CITY_PARK`)  
**Target Users**: 4 Users (1 Manager/Admin + 3 Sales Staff)  
**Primary Workflow**: Stock Lookup (`/#/stock`) + Issue Reporting & Tracking  

---

## 1. Governance State

- `PILOT_USERS = 4`
- `OPERATIONAL_BRANCHES = 1`
- `PRIMARY_USE_CASE = STOCK_LOOKUP`
- `ACTIVE_ROLES = MEMBER, STORE_LEADER, SYSTEM_ADMIN`
- `SUPPORT_ROLE_UI = DEFERRED` (Security canary retained in pgTAP)
- `AUDITOR_ROLE_UI = DEFERRED` (Security canary retained in pgTAP)
- `MULTI_BRANCH_UI = DEFERRED` (Security canary retained in pgTAP)
- `BASELINE_RUNTIME_INTEGRITY = PASS (23/23 MATCHED, Commit a7c3390)`
- `FEEDBACK_PILOT_RUNTIME = BUILT (Separate pilot.html & samsung_stock_dashboard_feedback_pilot.zip)`
- `EMPLOYEE_PILOT = HOLD (Until API & Browser Acceptance)`
- `PRODUCTION = HOLD`
- `MAIN_MERGE = HOLD`

---

## 2. Milestone A: Automated Database RLS Tests (`supabase/tests/`)

Standardized pgTAP test suites (35 assertions) testing database security rules:
- `01_issue_number_and_audit.test.sql` (Issue number auto-generation & audit trigger)
- `02_internal_comments_scope.test.sql` (Public vs Internal comment visibility isolation)
- `03_issue_status_transitions.test.sql` (State machine allow-list & role guardrails)
- `04_boundary_branch_b_canary.test.sql` (Cross-branch boundary isolation canary)
- `05_private_schema_surface.test.sql` (Private helper function attack surface)
- `06_role_management.test.sql` (Admin-only role management & privilege separation)
- `07_profile_update_rpc.test.sql` (Profile direct tampering prevention)
- `08_audit_immutability.test.sql` (Immutable audit trail enforcement)

All suites are enclosed in `BEGIN; ... SELECT * FROM finish(); ROLLBACK;` (Zero persistent fixtures).

---

## 3. Milestone B: Streamlined Real Data API Test Runner (`scripts/`)

Tailored for 4-User Store Pilot:
- Roles: `ANON`, `ADMIN`, `MEMBER_A`, `MEMBER_B`
- Configuration Check: Exit Code 2 on missing `.env.feedback-pilot.local`
- Test Failure: Exit Code 1
- Success: Exit Code 0 (`MEMBER_API_SMOKE_TEST` or `PILOT_STORE_MATRIX_PASSED`)
- Zero Residual Data: Automatically cleans up `[RLS-TEST]%` fixtures

---

## 4. Milestone C: Pilot UI & Packaging (`pilot.html`)

- Dedicated entrypoint: `pilot.html` (preserves `index.html` 100% bit-for-bit untouched).
- Landing page after login: Auto-redirects to `/#/stock`.
- Simplified 5-field Issue Reporting Modal:
  1. พบปัญหาที่หน้าไหน (Screen)
  2. หัวข้อปัญหา (Title)
  3. รายละเอียด (Description)
  4. ระดับผลกระทบ (Human Thai terms: ใช้งานต่อไม่ได้, ข้อมูลอาจผิด, ใช้งานได้แต่ไม่สะดวก, ข้อเสนอแนะ)
  5. ภาพหน้าจอ (Placeholder: COMING SOON)
- User Status Bar: Thai role badges (`ผู้จัดการสาขา / Admin` vs `พนักงานขาย`), branch label, and Logout.
- Issue Tracking Modal:
  - Sales Staff: "ปัญหาที่ฉันรายงาน" (My Issues) + Public comments
  - Manager: "ปัญหาทั้งหมดในสาขา" (Branch Issues) + Internal notes + Status changes + On-demand AI Analyze button
- Dedicated Package: `samsung_stock_dashboard_feedback_pilot.zip` (36 files total).
