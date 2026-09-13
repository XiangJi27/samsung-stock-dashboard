# Implementation Plan: User Feedback Pilot - Milestones A, B & C Scaffolding

**Branch**: `feature/user-feedback-pilot`  
**Governance State**:
- `DATABASE_RLS_TEST_AUTOMATION = IN_PROGRESS`
- `REAL_DATA_API_TESTS = IN_PROGRESS`
- `AUTH_UI_SCAFFOLDING = IN_PROGRESS`
- `ATTACHMENT_UPLOAD = HOLD`
- `AI_ISSUE_TRIAGE = HOLD`
- `EMPLOYEE_PILOT = HOLD`
- `PRODUCTION = HOLD`
- `MAIN_MERGE = HOLD`

---

## 1. Milestone A: Automated Database RLS Tests (`supabase/tests/`)

Standardized pgTAP SQL test suite executing in isolated transactions with automatic rollback:

- [NEW] `supabase/migrations/20260913_feedback_pilot_schema.sql` (Versioned active schema)
- [NEW] `supabase/tests/01_issue_number_and_audit.test.sql` (Database issue generation & immutable audit trigger)
- [NEW] `supabase/tests/02_internal_comments_scope.test.sql` (Public vs Internal comment visibility & anti-spoofing)
- [NEW] `supabase/tests/03_issue_status_transitions.test.sql` (State machine allow-list & role guardrails)
- [NEW] `supabase/tests/04_boundary_branch_b_canary.test.sql` (Cross-branch isolation boundary check)
- [NEW] `supabase/tests/05_private_schema_surface.test.sql` (Verify private helpers not exposed to client)
- [NEW] `supabase/tests/06_role_management.test.sql` (Admin-only role manipulation & privilege separation)
- [NEW] `supabase/tests/07_profile_update_rpc.test.sql` (Direct table update block & RPC validation)
- [NEW] `supabase/tests/08_audit_immutability.test.sql` (Client insert/update/delete blocked on audit events)

---

## 2. Milestone B: Real Data API Test Runner (`scripts/`)

Automated client-side testing against real PostgREST endpoints and Auth Sessions with masked telemetry:

- [NEW] `scripts/lib/load-local-env.js` (Safe env loader reading `.env.feedback-pilot.local`)
- [NEW] `scripts/lib/test-user-session.js` (Auth session sign-in and token wrapper)
- [NEW] `scripts/lib/redact-test-output.js` (PII & Token redactor for test reports)
- [NEW] `scripts/fixtures/rls-test-users.example.json` (Sanitized test user role matrix template)
- [NEW] `scripts/test_live_api_sessions.js` (Multi-role Data API runner testing Anon, Member, Store Leader, Support, Auditor, Admin)

---

## 3. Milestone C: Auth UI & Issue Reporting Scaffolding (`assets/js/`)

Modular, decoupled client adapters and UI components with role-aware rendering:

- [NEW] `assets/js/supabase-client.js` (Runtime config loader & single Supabase client instance)
- [NEW] `assets/js/auth-service.js` (Session management, login, logout, token refresh abstraction)
- [NEW] `assets/js/permission-service.js` (Role and branch permission evaluator)
- [NEW] `assets/js/session-guard.js` (Session persistence and active route guard)
- [NEW] `assets/js/issue-service.js` (Issue creation, listing, and RPC interaction)
- [NEW] `assets/js/auth-modal.js` (Employee code login dialog with generic error messaging)
- [NEW] `assets/js/user-status-bar.js` (Header role badge and user identity banner)
- [NEW] `assets/js/issue-report-modal.js` (Issue reporting form with disabled attachment placeholder)
- [NEW] `assets/js/issue-list.js` (Issue list view categorized by My Issues and Branch Issues)

---

## 4. Verification & Baseline Integrity

- Verify `verify_runtime_zip.py` strictly matches `23/23 MATCHED` across all operations.
- Ensure all test credentials, UUIDs, and tokens are masked.
