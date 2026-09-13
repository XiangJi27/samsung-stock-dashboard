-- ============================================================================
-- TEST 08: Audit Trail Immutability - Zero Client Mutation Permitted
-- Framework: pgTAP (Test Anything Protocol for PostgreSQL)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent fixtures)
-- ============================================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(4);

-- 1. Setup Fixture
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member_1@store.local', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin_1@store.local', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, employee_code, display_name, branch_id, status)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'MEM_1', 'Member One', 'AYUTTHAYA_CITY_PARK', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000099', 'ADM_1', 'Admin One', 'AYUTTHAYA_CITY_PARK', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, branch_id)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'MEMBER', 'AYUTTHAYA_CITY_PARK'),
  ('00000000-0000-0000-0000-000000000099', 'SYSTEM_ADMIN', NULL)
ON CONFLICT DO NOTHING;

-- Seed an existing audit event
INSERT INTO public.issues (id, issue_number, title, description, category, severity, reporter_id, branch_id)
VALUES ('00000000-0000-0000-0000-000000000801', 'ISS-2026-AUD01', 'Audit Test', 'Audit verification', 'OTHER', 'P3_MEDIUM', '00000000-0000-0000-0000-000000000001', 'AYUTTHAYA_CITY_PARK');

-- 2. Authenticated user direct INSERT on issue_events -> throws 42501
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
    $$INSERT INTO public.issue_events (id, issue_id, event_type, actor_id, actor_type)
      VALUES ('00000000-0000-0000-0000-000000000811', '00000000-0000-0000-0000-000000000801', 'TAMPER', '00000000-0000-0000-0000-000000000001', 'USER')$$,
    '42501',
    NULL,
    'Direct client INSERT on issue_events must be blocked (no INSERT grant)'
);

-- 3. Authenticated user direct UPDATE on issue_events -> throws 42501
SELECT throws_ok(
    $$UPDATE public.issue_events SET event_type = 'ALTERED' WHERE issue_id = '00000000-0000-0000-0000-000000000801'$$,
    '42501',
    NULL,
    'Direct client UPDATE on issue_events must be blocked (no UPDATE grant)'
);

-- 4. Authenticated user direct DELETE on issue_events -> throws 42501
SELECT throws_ok(
    $$DELETE FROM public.issue_events WHERE issue_id = '00000000-0000-0000-0000-000000000801'$$,
    '42501',
    NULL,
    'Direct client DELETE on issue_events must be blocked (no DELETE grant)'
);

-- 5. Admin direct UPDATE on issue_events -> throws 42501
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000099", "role": "authenticated"}';

SELECT throws_ok(
    $$UPDATE public.issue_events SET event_type = 'ADMIN_TAMPER' WHERE issue_id = '00000000-0000-0000-0000-000000000801'$$,
    '42501',
    NULL,
    'Even SYSTEM_ADMIN must NOT be granted UPDATE on immutable audit logs'
);

SELECT * FROM finish();
ROLLBACK;
