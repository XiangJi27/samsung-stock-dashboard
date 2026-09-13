-- ============================================================================
-- TEST 03: Issue Status Transitions & Role Guardrails
-- Framework: pgTAP (Test Anything Protocol for PostgreSQL)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent fixtures)
-- ============================================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(4);

-- 1. Setup Fixtures
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_m1@store.local', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_leader@store.local', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_support@store.local', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, employee_code, display_name, branch_id, status)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'TEST_M1', 'Member 1', 'AYUTTHAYA_CITY_PARK', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000003', 'TEST_L1', 'Leader 1', 'AYUTTHAYA_CITY_PARK', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000004', 'TEST_S1', 'Support 1', 'AYUTTHAYA_CITY_PARK', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, branch_id)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'MEMBER', 'AYUTTHAYA_CITY_PARK'),
  ('00000000-0000-0000-0000-000000000003', 'STORE_LEADER', 'AYUTTHAYA_CITY_PARK'),
  ('00000000-0000-0000-0000-000000000004', 'SUPPORT', NULL)
ON CONFLICT DO NOTHING;

-- Create Base Issue in NEW status
INSERT INTO public.issues (id, issue_number, title, description, category, severity, reporter_id, branch_id, status)
VALUES ('00000000-0000-0000-0000-000000000301', 'ISS-2026-TEST03', 'Transition Test', 'Testing state machine', 'OTHER', 'P3_MEDIUM', '00000000-0000-0000-0000-000000000001', 'AYUTTHAYA_CITY_PARK', 'NEW');

-- 2. Member attempts direct update to CLOSED -> RLS filters out, status remains NEW
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

UPDATE public.issues SET status = 'CLOSED' WHERE id = '00000000-0000-0000-0000-000000000301';

SELECT is(
    (SELECT status FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000301'),
    'NEW',
    'Member direct status update to CLOSED must be blocked; status remains NEW'
);

-- 3. Store Leader executes valid transition: NEW -> TRIAGED -> VERIFIED
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';

UPDATE public.issues SET status = 'TRIAGED' WHERE id = '00000000-0000-0000-0000-000000000301';
UPDATE public.issues SET status = 'VERIFIED' WHERE id = '00000000-0000-0000-0000-000000000301';

SELECT is(
    (SELECT status FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000301'),
    'VERIFIED',
    'Store Leader valid transitions (NEW -> TRIAGED -> VERIFIED) must succeed'
);

-- 4. Store Leader illegal jump VERIFIED -> CLOSED blocked by trigger state machine
SELECT throws_ok(
    $$UPDATE public.issues SET status = 'CLOSED' WHERE id = '00000000-0000-0000-0000-000000000301'$$,
    'P0001',
    NULL,
    'Illegal state machine skip (VERIFIED -> CLOSED) must be rejected by trigger'
);

-- 5. Support agent can progress VERIFIED -> IN_PROGRESS
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000004", "role": "authenticated"}';

SELECT lives_ok(
    $$UPDATE public.issues SET status = 'IN_PROGRESS', assigned_to = '00000000-0000-0000-0000-000000000004' WHERE id = '00000000-0000-0000-0000-000000000301'$$,
    'Support role must be authorized to transition VERIFIED -> IN_PROGRESS'
);

SELECT * FROM finish();
ROLLBACK;
