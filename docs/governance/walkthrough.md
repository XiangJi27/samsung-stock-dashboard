# Walkthrough: User Feedback Pilot (Dashboard-First 4-User Store Model)

**Branch**: `feature/user-feedback-pilot`  
**Target Store**: Ayutthaya City Park (`AYUTTHAYA_CITY_PARK`)  
**Production Baseline Freeze**: `23/23 MATCHED (100% Verified, Commit a7c3390)`  
**Pilot Runtime Package**: `samsung_stock_dashboard_feedback_pilot.zip` (40 files total)  

---

## 1. Dashboard-First Navigation & Widget Registry

- **Default Route after Login**: `/#/home` (Dashboard as central hub)
- **Extensible `WIDGET_REGISTRY`**:
  - Live Widgets: Total Stock (760 units), Floor 1 (379 units), Floor 2 (381 units), Promotions, Issues
  - Future Expansion Slots: Daily Sales, Sales Target, Monthly Sales, Bill Count (`NOT_CONNECTED`)
  - Quick Actions: Stock search, Promotions, Report Issue, Issue tracking, Manager actions

---

## 2. Role-Aware Navigation & Route Guard

- `assets/js/pilot-navigation.js`: Dynamically adjusts menus based on active user role.
- `assets/js/session-guard.js`: Blocks unauthorized navigation to manager routes (`/#/admin/members`, `/#/stock-import`, `/#/promotion-import`, `/#/issues/branch`), shows access denied toast, and redirects to `/#/home`.
- Enforces account suspension (`profiles.status === 'SUSPENDED'`) upon login and token refresh with forced sign-out.

---

## 3. Secure Member Administration Architecture

- `/#/admin/members`: Manager UI displaying the 4-user store team, status toggling, and member creation dialog.
- `api/admin/members.js`: Serverless handler verifying caller has `SYSTEM_ADMIN` before invoking Supabase Admin API with server-side `SUPABASE_SERVICE_ROLE_KEY`.

---

## 4. Verification & Baseline Integrity

- `index.html`: Bit-for-bit identical to `a7c3390` (SHA256: `90fcdaacb7bf77fb59918be8dd155ef5565dc68e7a3ea2694ab5c3139195b70c`).
- `python scripts/verify_runtime_zip.py`: `23/23 MATCHED (100% Verified)`.
- `pilot.html`: Generated dedicated entrypoint loading all modular pilot scripts.
- `samsung_stock_dashboard_feedback_pilot.zip`: Built and verified cleanly with 40 runtime files.
