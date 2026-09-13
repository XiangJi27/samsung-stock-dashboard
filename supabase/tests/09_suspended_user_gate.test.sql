-- ============================================================================
-- TEST 09: Database-Level Active User Gate & Suspended Account Enforcement
-- Framework: pgTAP (Test Anything Protocol for PostgreSQL)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent fixtures)
-- ============================================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(7);

-- 1. Setup Test Fixtures: Active Staff & Suspended Staff
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES 
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'active_staff@store.local', NOW(), NOW()),
    ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'suspended_staff@store.local', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, employee_code, display_name, branch_id, status)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'CPW1001', 'Active Sales Staff', 'AYUTTHAYA_CITY_PARK', 'ACTIVE'),
    ('00000000-0000-0000-0000-000000000002', 'CPW1002', 'Suspended Sales Staff', 'AYUTTHAYA_CITY_PARK', 'SUSPENDED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, branch_id)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'MEMBER', 'AYUTTHAYA_CITY_PARK'),
    ('00000000-0000-0000-0000-000000000002', 'MEMBER', 'AYUTTHAYA_CITY_PARK')
ON CONFLICT DO NOTHING;

-- Seed an issue created by Active Staff
INSERT INTO public.issues (
    id, issue_number, title, description, category, severity, status, 
    branch_id, reporter_id, created_at, updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000100', 'ISS-2026-90001', 'Test Active Issue', 'Description', 'APP_BUG', 'LOW', 'NEW',
    'AYUTTHAYA_CITY_PARK', '00000000-0000-0000-0000-000000000001', NOW(), NOW()
);

-- 2. Test helper private.is_active_user()
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';
SELECT ok(private.is_active_user(), 'Active user must return TRUE from private.is_active_user()');

SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';
SELECT ok(NOT private.is_active_user(), 'Suspended user must return FALSE from private.is_active_user()');

-- 3. Suspended user querying issues -> RLS yields 0 rows
SELECT is_empty(
    $$SELECT id FROM public.issues$$,
    'Suspended user must be blocked by RLS from viewing any issues'
);

-- 4. Suspended user querying user_roles -> RLS yields 0 rows
SELECT is_empty(
    $$SELECT role FROM public.user_roles$$,
    'Suspended user must be blocked by RLS from querying user_roles'
);

-- 5. Suspended user querying profiles -> RLS allows only self (to read status for logout), 0 other rows
SELECT is(
    (SELECT COUNT(*)::INTEGER FROM public.profiles),
    1,
    'Suspended user can only query their own profile row to read suspension status; others blocked'
);

-- 6. Suspended user attempting public RPC update_own_display_name -> throws exception
SELECT throws_ok(
    $$SELECT public.update_own_display_name('Suspended Name Tamper')$$,
    'P0001',
    'Forbidden: User account is suspended or inactive.',
    'Suspended user must be rejected when executing public.update_own_display_name'
);

-- 7. Suspended user attempting INSERT on issues -> blocked by RLS
SELECT throws_ok(
    $$INSERT INTO public.issues (title, description, category, severity) VALUES ('Illegal', 'Desc', 'APP_BUG', 'LOW')$$,
    '42501',
    NULL,
    'Suspended user direct INSERT on issues must be rejected by RLS'
);

SELECT * FROM finish();
ROLLBACK;
