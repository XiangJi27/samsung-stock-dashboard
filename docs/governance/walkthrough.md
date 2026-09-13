# Walkthrough: User Feedback Pilot (Dashboard-First 4-User Store Model)

**Branch**: `feature/user-feedback-pilot`  
**Target Store**: Ayutthaya City Park (`AYUTTHAYA_CITY_PARK`)  
**Production Baseline Freeze**: `23/23 MATCHED (100% Verified, Commit a7c3390)`  
**Pilot Runtime Package**: `samsung_stock_dashboard_feedback_pilot.zip` (39 files in manifest)  

---

## 1. Live Integration Gates Verification Results

| Gate | Description | Status | Evidence |
|---|---|---|---|
| **Gate 1** | Baseline Runtime Freeze | **PASS** | 23/23 files matched (`a7c3390`) |
| **Gate 2** | Pilot Package Integrity | **PASS** | 39/39 files matched, Drift = FALSE |
| **Gate 3** | Migration Delta | **PASS** | `20260913_add_active_user_gate.sql` Deployed to SUPABASE_PREVIEW_REDACTED |
| **Gate 4** | Member Real Data API Smoke | **PASS** | 19/19 Passed, Verdict: `REAL_DATA_API_MEMBER_SMOKE_PASSED` |
| **Gate 5** | Suspended Account Live Token Gate | **PASS** | 10/10 Passed, Verdict: `REAL_SUSPENDED_TOKEN_GATE_PASSED` |

### Masked Verification Evidence

#### Suite: Member Live Data API (`scripts/test_live_api_sessions.js --mode=live`)
- Target: `SUPABASE_PREVIEW_REDACTED`
- Member Actor: `TEST_MEMBER_A`
- Admin Actor: `TEST_ADMIN_A`
- Attack surface defense: 6/6 tests passed (Anon SELECT/INSERT/RPC blocked, internal functions hidden).
- Member operations: 9/9 tests passed (Sign-in, branch read, profile read, issue auto-numbering, public comment, internal comment RLS blocked, status change blocked, event insert blocked).
- Admin operations: 4/4 tests passed (Sign-in, cross-store issue visibility, internal comment allowed, status transition allowed).
- Verdict: `REAL_DATA_API_MEMBER_SMOKE_PASSED`

#### Suite: Suspended Account Lifecycle Gate (`scripts/test_suspended_user_live.js --mode=live`)
- Step 1-3: Member signs in, creates issue, retains valid access token.
- Step 4: Admin transitions profile status to `SUSPENDED`.
- Step 5-8: With the existing token, SELECT returns 0 rows, INSERT issue blocked (403), INSERT comment blocked (403), protected RPC blocked (400).
- Step 9-10: Profile restored to `ACTIVE`, verified user can access normally.
- Verdict: `REAL_SUSPENDED_TOKEN_GATE_PASSED`

---

## 2. Dashboard-First Navigation & Widget Registry

- **Default Route after Login**: `/#/home` (Dashboard as central hub)
- **Extensible `WIDGET_REGISTRY`**:
  - Live Widgets: Total Stock (760 units), Floor 1 (379 units), Floor 2 (381 units), Promotions, Issues
  - Future Expansion Slots: Daily Sales, Sales Target, Monthly Sales, Bill Count (`NOT_CONNECTED`)
  - Quick Actions: Stock search, Promotions, Report Issue, Issue tracking, Manager actions

---

## 3. Role-Aware Navigation & Route Guard

- `assets/js/pilot-navigation.js`: Dynamically adjusts menus based on active user role.
- `assets/js/session-guard.js`: Blocks unauthorized navigation to manager routes (`/#/admin/members`, `/#/stock-import`, `/#/promotion-import`, `/#/issues/branch`), shows access denied toast, and redirects to `/#/home`.
- Enforces account suspension (`profiles.status === 'SUSPENDED'`) upon login and token refresh with forced sign-out.

---

## 4. Secure Member Administration Architecture

- `/#/admin/members`: Manager UI displaying the 4-user store team, status toggling, and member creation dialog.
- `api/admin/members.js`: Serverless handler verifying caller has `SYSTEM_ADMIN` before invoking Supabase Admin API with server-side `SUPABASE_SECRET_KEY`.

---

## 5. Verification & Baseline Integrity

- `index.html`: Bit-for-bit identical to `a7c3390`.
- `python scripts/verify_runtime_zip.py`: `23/23 MATCHED (100% Verified)`.
- `python scripts/verify_pilot_zip.py`: `39/39 MATCHED (100% Verified)`.
- `pilot.html`: Dedicated entrypoint loading all modular pilot scripts.
- `samsung_stock_dashboard_feedback_pilot.zip`: Built and verified cleanly with 39 runtime files.
