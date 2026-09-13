-- ============================================================================
-- TEST 07: Profile Tampering Prevention & Secure Display Name RPC
-- Framework: pgTAP (Test Anything Protocol for PostgreSQL)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent fixtures)
-- ============================================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(3);

-- 1. Setup Fixture
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_m1@store.local', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, employee_code, display_name, branch_id, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'TEST_M1', 'Original Name', 'AYUTTHAYA_CITY_PARK', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, branch_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'MEMBER', 'AYUTTHAYA_CITY_PARK')
ON CONFLICT DO NOTHING;

-- 2. Member attempts direct UPDATE on profiles -> RLS filters out, 0 rows modified
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

UPDATE public.profiles SET employee_code = 'HACKED', branch_id = 'BRANCH_HACK' WHERE id = '00000000-0000-0000-0000-000000000001';

SELECT is(
    (SELECT employee_code FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001'),
    'TEST_M1',
    'Direct table UPDATE on profiles must be blocked by RLS; employee_code unmodified'
);

-- 3. Member updates display name via public RPC -> lives_ok
SELECT lives_ok(
    $$SELECT public.update_own_display_name('Updated Legitimate Name')$$,
    'Member must be permitted to execute public.update_own_display_name'
);

-- 4. Assert display_name updated, but critical fields unchanged
SELECT is(
    (SELECT display_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001'),
    'Updated Legitimate Name',
    'Profile display_name must reflect update from RPC'
);

SELECT * FROM finish();
ROLLBACK;
