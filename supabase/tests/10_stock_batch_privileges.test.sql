-- ============================================================================
-- TEST 10: Stock Batch RPC Privilege Hardening & Least-Privilege Verification
-- Framework: pgTAP (Test Anything Protocol for PostgreSQL)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent fixtures)
-- ============================================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(8);

-- 1. activate_stock_batch privilege checks
SELECT is(
    has_function_privilege('public', 'public.activate_stock_batch(text,uuid,uuid,uuid)', 'EXECUTE'),
    false,
    'PUBLIC must not execute activate_stock_batch'
);

SELECT is(
    has_function_privilege('anon', 'public.activate_stock_batch(text,uuid,uuid,uuid)', 'EXECUTE'),
    false,
    'anon must not execute activate_stock_batch'
);

SELECT is(
    has_function_privilege('authenticated', 'public.activate_stock_batch(text,uuid,uuid,uuid)', 'EXECUTE'),
    false,
    'authenticated must not execute activate_stock_batch'
);

SELECT is(
    has_function_privilege('service_role', 'public.activate_stock_batch(text,uuid,uuid,uuid)', 'EXECUTE'),
    true,
    'service_role must execute activate_stock_batch'
);

-- 2. rollback_stock_batch privilege checks
SELECT is(
    has_function_privilege('public', 'public.rollback_stock_batch(text,uuid,uuid)', 'EXECUTE'),
    false,
    'PUBLIC must not execute rollback_stock_batch'
);

SELECT is(
    has_function_privilege('anon', 'public.rollback_stock_batch(text,uuid,uuid)', 'EXECUTE'),
    false,
    'anon must not execute rollback_stock_batch'
);

SELECT is(
    has_function_privilege('authenticated', 'public.rollback_stock_batch(text,uuid,uuid)', 'EXECUTE'),
    false,
    'authenticated must not execute rollback_stock_batch'
);

SELECT is(
    has_function_privilege('service_role', 'public.rollback_stock_batch(text,uuid,uuid)', 'EXECUTE'),
    true,
    'service_role must execute rollback_stock_batch'
);

SELECT * FROM finish();

ROLLBACK;
