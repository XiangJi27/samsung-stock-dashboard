# Stock Batch Privilege Security Hardening & Release Preparation Report

**Date:** September 24, 2026  
**Project:** Samsung Branch Operations (Ayutthaya City Park)  
**Target Component:** Stock Batch Activation & Rollback RPC Functions (`activate_stock_batch`, `rollback_stock_batch`)  
**Document Classification:** Internal Engineering Security & Release Governance Report  

---

## 1. Executive Summary
This report documents the security audit, least-privilege hardening plan, migration file review, pgTAP regression test suite verification, server-side API dependency analysis, and production deployment release checklist for the core stock batch management RPC functions:
- `public.activate_stock_batch(text, uuid, uuid, uuid)`
- `public.rollback_stock_batch(text, uuid, uuid)`

Following manual execution of the privilege hardening patch in the production Supabase SQL Editor, this report establishes a complete reproducibility record, verifies git safety regarding 35 pre-existing staged files, and outlines strict post-deployment verification procedures and rollback policies.

---

## 2. Incident Description
During security review of RPC surface exposure in Supabase PostgreSQL databases, it was identified that stored functions defined with `SECURITY DEFINER` inherit public execution rights by default in PostgreSQL unless explicitly revoked. Specifically:
- `public.activate_stock_batch` and `public.rollback_stock_batch` were created with `SECURITY DEFINER = true`.
- Initial migration `20260916_central_stock_snapshot.sql` correctly revoked execution privileges from `authenticated` users but did not explicitly revoke privileges from `PUBLIC` or `anon` roles.
- Consequently, unauthenticated (`anon`) and general database clients could potentially invoke stock batch lifecycle control procedures directly via PostgREST endpoint `rpc/activate_stock_batch` and `rpc/rollback_stock_batch`.

---

## 3. Original Effective Privileges
Prior to hardening, the deployed database effective privileges were:
- **`PUBLIC`**: Can `EXECUTE` (default PostgreSQL behavior for newly created functions without explicit revocation).
- **`anon`**: Can `EXECUTE`.
- **`authenticated`**: Can `EXECUTE` (partially revoked in line 316-317 of `20260916_central_stock_snapshot.sql`, but remained accessible via `PUBLIC`).
- **`service_role`**: Can `EXECUTE`.

---

## 4. Required Effective Privileges
To achieve compliance with least-privilege architecture and secure server-mediated ingestion invariants:
- **`PUBLIC`**: Cannot `EXECUTE` (`REVOKE EXECUTE FROM PUBLIC`)
- **`anon`**: Cannot `EXECUTE` (`REVOKE EXECUTE FROM anon`)
- **`authenticated`**: Cannot `EXECUTE` (`REVOKE EXECUTE FROM authenticated`)
- **`service_role`**: Can `EXECUTE` (`GRANT EXECUTE TO service_role`)

---

## 5. Exact Function Signatures
1. `public.activate_stock_batch(text, uuid, uuid, uuid)`
2. `public.rollback_stock_batch(text, uuid, uuid)`

---

## 6. Function Owner, SECURITY DEFINER, and `search_path` Findings
Inspection of `supabase/migrations/20260916_central_stock_snapshot.sql` and supplied database evidence:
- **Function Owner (`postgres`):** Confirmed by a supplied production database catalog query using `pg_get_userbyid(p.proowner)`. (Note: This is supplied database evidence, not source-file evidence).
- **`SECURITY DEFINER`:** Enabled (`SECURITY DEFINER = true`, Lines 91 & 190) and confirmed by supplied production database evidence.
- **`search_path`:** Explicitly set to `public, pg_temp` (`SET search_path = public, pg_temp`, Lines 92 & 191) to prevent schema-spoofing attacks, and confirmed by supplied production database evidence.
- **Evidence Citation:** `supabase/migrations/20260916_central_stock_snapshot.sql`, lines 83–93 and 182–192, alongside supplied production database catalog query results.

---

## 7. Migration-File Review
**File Path:** `supabase/migrations/20260924_harden_stock_batch_rpc_privileges.sql` (Lines 1–21)
- Begins with `BEGIN;` and ends with `COMMIT;`.
- Uses exact function signatures.
- Revokes `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`.
- Grants `EXECUTE` to `service_role`.
- Does not alter function bodies, `SECURITY DEFINER`, or `search_path`.
- Does not grant access back to `PUBLIC`, `anon`, or `authenticated`.
- Contains zero destructive statements.

---

## 8. Regression-Test Review
**File Path:** `supabase/tests/10_stock_batch_privileges.test.sql` (Lines 1–64)
- Follows existing pgTAP conventions (observed in `supabase/tests/05_private_schema_surface.test.sql`).
- Begins a transaction with `BEGIN;` and `CREATE EXTENSION IF NOT EXISTS pgtap;`.
- Uses `SELECT plan(8);` and contains exactly 8 assertions.
- Checks both exact function signatures for `public`, `anon`, `authenticated` (expecting `false`), and `service_role` (expecting `true`).
- Uses `has_function_privilege` exclusively without invoking stock functions.
- Ends with `SELECT * FROM finish();` and `ROLLBACK;`.

---

## 9. Server Service-Role Dependency
Inspection of `api/stock-imports.js` (Lines 26–27 & 76–89):
- **Environment Variables:** `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.
- **Priority Order:** `secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()`
- **API Key & Authorization Headers:**
  - `queryKey = secretKey || publishableKey;`
  - `authHeaderValue = secretKey ? 'Bearer ' + secretKey : (token ? 'Bearer ' + token : 'Bearer ' + publishableKey);`
- Server-side API compatibility after privilege hardening depends entirely on a correctly configured service-role credential (`SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`).

---

## 10. Missing-Secret Fallback Behavior
- If the service-role key is missing or unconfigured, `queryPostgrest` falls back to `publishableKey` and the user JWT token or publishable key in authorization headers.
- PostgREST requests executing `rpc/activate_stock_batch` or `rpc/rollback_stock_batch` under `publishableKey` or `authenticated` role will fail closed with a permission error (HTTP 403 / PostgreSQL `42501` insufficient privilege), preventing unauthorized client-side invocation.
- Note: A dedicated startup guard rejecting requests at server boot if `secretKey` is missing is not explicitly present in `api/stock-imports.js`, meaning misconfiguration manifests as a fail-closed database denial during RPC execution.

---

## 11. Production Database Status
- Both functions are owned by `postgres`, configured as `SECURITY DEFINER`, with `search_path = public, pg_temp`.
- The production database currently enforces the required privilege state (`PUBLIC`, `anon`, and `authenticated` cannot execute; `service_role` can execute).

---

## 12. Manual Application Disclosure
The database privilege modification was applied manually through the Supabase SQL Editor during emergency hardening.

---

## 13. Migration File Retention
The migration file `supabase/migrations/20260924_harden_stock_batch_rpc_privileges.sql` remains present in the repository workspace to ensure complete reproducibility, history alignment, and automated test execution across other environments (staging/local CI).

---

## 14. Repository Migration Workflow Status
The migration has **not** been deployed through the repository automated migration CI/CD workflow; it was applied out-of-band via Supabase SQL Editor.

---

## 15. Git State Warning (35 Staged Files)
There are 35 pre-existing files in Git that are already staged relating to promotion pricing, Trade Up, pilot runtime, reports, tests, and packaging. These files must remain staged exactly as they were, and must not be modified, unstaged, reset, restored, or included in the dedicated security commit.

---

## 16. Safe Deployment Checklist
1. Preserve or commit the unrelated staged work separately.
2. Review the two security files (`supabase/migrations/20260924_harden_stock_batch_rpc_privileges.sql` and `supabase/tests/10_stock_batch_privileges.test.sql`).
3. Confirm the production service-role environment variable exists (`SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`).
4. Confirm that the latest production deployment was created after the environment variable update.
5. Add only the two security files and the hardening report to a dedicated security commit.
6. Do not include the unrelated 35 staged files in that security commit.
7. Run pgTAP against an isolated local or test database.
8. Compare local and remote migration histories first.
9. Do not modify `supabase_migrations.schema_migrations` directly.
10. Do not run migration repair until a history mismatch is confirmed. If repair is required, use the documented Supabase CLI migration-repair workflow after review.
11. Do not reapply the migration blindly without reconciling migration history.
12. Verify effective privileges after deployment.
13. Confirm that the server-side activate and rollback routes still work through `service_role`.
14. Never test activation or rollback against production stock without an approved test batch.

---

## 17. Safe Post-Deployment Verification Query
Run the following read-only SQL query to verify effective privileges:

```sql
SELECT 
    p.oid::regprocedure::text AS exact_signature,
    has_function_privilege('public', p.oid::regprocedure, 'EXECUTE') AS public_can_execute,
    has_function_privilege('anon', p.oid::regprocedure, 'EXECUTE') AS anon_can_execute,
    has_function_privilege('authenticated', p.oid::regprocedure, 'EXECUTE') AS authenticated_can_execute,
    has_function_privilege('service_role', p.oid::regprocedure, 'EXECUTE') AS service_role_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('activate_stock_batch', 'rollback_stock_batch')
ORDER BY p.proname;
```

**Expected Result for Both Functions:**
- `public_can_execute` = `false`
- `anon_can_execute` = `false`
- `authenticated_can_execute` = `false`
- `service_role_can_execute` = `true`

---

## 18. Rollback Policy
Security rollback must **never** restore `EXECUTE` permissions to `PUBLIC`, `anon`, or `authenticated`. If server-side API execution fails due to privilege errors, investigate `service_role` authentication and API key environment configuration rather than weakening database function security grants.

---

## 19. Remaining Risk: Branch Authorization Fails Open
*Note:* As identified in architectural security reviews, branch-scoped authorization helpers (such as `is_branch_leader_or_admin`) should be inspected to ensure that if a user record has a role entry where `branch_id IS NULL`, it does not unintentionally grant cross-branch administrative access. This is noted as a secondary governance item outside the immediate RPC execution privilege scope.

---

## 20. Current Decision & Next Recommended Task
- **Current Decision:** Database privileges are hardened, migration and pgTAP test files are created, and this governance report is documented.
- **Next Recommended Task:** Reconcile migration history in local/staging environments and commit the security files and report into a dedicated security commit without touching the 35 pre-existing staged files.

