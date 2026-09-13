-- ============================================================================
-- TEST 04: Boundary Canary - Cross-Branch Isolation Verification
-- Framework: pgTAP (Test Anything Protocol for PostgreSQL)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent fixtures)
-- ============================================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(4);

-- 1. Setup Fixtures (Branch A and Branch B)
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member_a@store.local', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leader_a@store.local', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member_b@store.local', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, employee_code, display_name, branch_id, status)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'MEM_A', 'Member Branch A', 'AYUTTHAYA_CITY_PARK', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000003', 'LEAD_A', 'Leader Branch A', 'AYUTTHAYA_CITY_PARK', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000005', 'MEM_B', 'Member Branch B', 'TEST_BRANCH_B', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, branch_id)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'MEMBER', 'AYUTTHAYA_CITY_PARK'),
  ('00000000-0000-0000-0000-000000000003', 'STORE_LEADER', 'AYUTTHAYA_CITY_PARK'),
  ('00000000-0000-0000-0000-000000000005', 'MEMBER', 'TEST_BRANCH_B')
ON CONFLICT DO NOTHING;

-- Create Issue in Branch A
INSERT INTO public.issues (id, issue_number, title, description, category, severity, reporter_id, branch_id)
VALUES ('00000000-0000-0000-0000-000000000401', 'ISS-2026-BRA001', 'Branch A Issue', 'Issue in Ayutthaya', 'OTHER', 'P3_MEDIUM', '00000000-0000-0000-0000-000000000001', 'AYUTTHAYA_CITY_PARK');

-- Create Issue in Branch B
INSERT INTO public.issues (id, issue_number, title, description, category, severity, reporter_id, branch_id)
VALUES ('00000000-0000-0000-0000-000000000402', 'ISS-2026-BRB001', 'Branch B Issue', 'Issue in Test Branch B', 'OTHER', 'P3_MEDIUM', '00000000-0000-0000-0000-000000000005', 'TEST_BRANCH_B');

-- 2. Member Branch A context: can see Branch A issue, but Branch B issue is completely hidden
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is(
    (SELECT count(*)::int FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000401'),
    1,
    'Member Branch A must be able to view their own branch issue'
);

SELECT is(
    (SELECT count(*)::int FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000402'),
    0,
    'Branch B issue must be completely hidden from Member Branch A (RLS filter count = 0)'
);

-- 3. Member Branch A attempts to insert issue pretending to be Branch B -> trigger forces Branch A
INSERT INTO public.issues (id, issue_number, title, description, category, severity, reporter_id, branch_id)
VALUES ('00000000-0000-0000-0000-000000000403', 'ISS-2026-SPOOF', 'Spoofed Branch', 'Trying to inject into Branch B', 'OTHER', 'P3_MEDIUM', '00000000-0000-0000-0000-000000000001', 'TEST_BRANCH_B');

SELECT is(
    (SELECT branch_id FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000403'),
    'AYUTTHAYA_CITY_PARK',
    'Trigger must overwrite spoofed branch_id with caller verified profile branch'
);

-- 4. Store Leader Branch A context: cannot see Branch B issue
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT is(
    (SELECT count(*)::int FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000402'),
    0,
    'Store Leader Branch A must NOT see issues from Branch B'
);

SELECT * FROM finish();
ROLLBACK;
