-- ============================================================================
-- TEST 06: Role Management - Admin-Only Privilege Isolation
-- Framework: pgTAP (Test Anything Protocol for PostgreSQL)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent fixtures)
-- ============================================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(4);

-- 1. Setup Fixtures (Member, Leader, Admin)
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member_1@store.local', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leader_1@store.local', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin_1@store.local', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, employee_code, display_name, branch_id, status)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'MEM_1', 'Member One', 'AYUTTHAYA_CITY_PARK', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000003', 'LEAD_1', 'Leader One', 'AYUTTHAYA_CITY_PARK', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000099', 'ADM_1', 'Admin One', 'AYUTTHAYA_CITY_PARK', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, branch_id)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'MEMBER', 'AYUTTHAYA_CITY_PARK'),
  ('00000000-0000-0000-0000-000000000003', 'STORE_LEADER', 'AYUTTHAYA_CITY_PARK'),
  ('00000000-0000-0000-0000-000000000099', 'SYSTEM_ADMIN', NULL)
ON CONFLICT DO NOTHING;

-- 2. Member attempts privilege escalation by inserting role -> throws 42501
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
    $$INSERT INTO public.user_roles (user_id, role, branch_id) VALUES ('00000000-0000-0000-0000-000000000001', 'SYSTEM_ADMIN', NULL)$$,
    '42501',
    NULL,
    'Member insertion into user_roles must be blocked with permission denied (42501)'
);

-- 3. Store Leader attempts to grant SYSTEM_ADMIN -> throws 42501
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT throws_ok(
    $$INSERT INTO public.user_roles (user_id, role, branch_id) VALUES ('00000000-0000-0000-0000-000000000001', 'SYSTEM_ADMIN', NULL)$$,
    '42501',
    NULL,
    'Store Leader cannot grant SYSTEM_ADMIN (denied by user_roles RLS)'
);

-- 4. Member attempts to delete another user role -> throws 42501
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
    $$DELETE FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000003'$$,
    '42501',
    NULL,
    'Member role deletion must be blocked with permission denied'
);

-- 5. System Admin grants role -> lives_ok
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated"}';

SELECT lives_ok(
    $$INSERT INTO public.user_roles (user_id, role, branch_id) VALUES ('00000000-0000-0000-0000-000000000001', 'AUDITOR', NULL)$$,
    'SYSTEM_ADMIN must be authorized to manage user roles'
);

SELECT * FROM finish();
ROLLBACK;
