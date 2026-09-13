-- ============================================================================
-- TEST 05: Private Schema Surface - Zero Public Exposure of Internal Helpers
-- Framework: pgTAP (Test Anything Protocol for PostgreSQL)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent fixtures)
-- ============================================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(4);

-- 1. Assert: anon role has NO usage on schema private (throws 42501)
SET LOCAL ROLE anon;

SELECT throws_ok(
    $$SELECT private.has_global_role('SYSTEM_ADMIN')$$,
    '42501',
    NULL,
    'Anonymous client must NOT be permitted to execute private.has_global_role'
);

-- 2. Assert: authenticated caller cannot execute internal trigger validate_issue_write (throws 42501)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
    $$SELECT private.validate_issue_write()$$,
    '42501',
    NULL,
    'Authenticated client must NOT have EXECUTE grant on trigger function private.validate_issue_write'
);

-- 3. Assert: authenticated caller cannot execute audit trigger function directly (throws 42501)
SELECT throws_ok(
    $$SELECT private.write_issue_audit_event()$$,
    '42501',
    NULL,
    'Authenticated client must NOT have EXECUTE grant on audit function private.write_issue_audit_event'
);

-- 4. Assert: authenticated caller cannot execute role inspection helper directly (throws 42501)
SELECT throws_ok(
    $$SELECT private.user_has_role('00000000-0000-0000-0000-000000000001', 'SYSTEM_ADMIN')$$,
    '42501',
    NULL,
    'Direct execution of private.user_has_role must be denied to authenticated client'
);

SELECT * FROM finish();
ROLLBACK;
