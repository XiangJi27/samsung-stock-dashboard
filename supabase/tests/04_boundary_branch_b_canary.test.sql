-- ============================================================================
-- TEST 04: Boundary Canary - Cross-Branch Isolation Verification
-- Framework: PostgreSQL Transaction Isolation (pgTAP compatible)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent artifacts)
-- ============================================================================

BEGIN;

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

-- 2. Assert: Member Branch A can see Issue A, but Issue B is COMPLETELY HIDDEN
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

DO $$
DECLARE
    cnt_a INT;
    cnt_b INT;
BEGIN
    SELECT count(*) INTO cnt_a FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000401';
    SELECT count(*) INTO cnt_b FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000402';

    IF cnt_a != 1 THEN
        RAISE EXCEPTION 'TEST_FAILED: Member A cannot see own issue!';
    END IF;

    IF cnt_b != 0 THEN
        RAISE EXCEPTION 'SECURITY_BREACH: Member A was able to read Branch B issue!';
    END IF;
END;
$$;

-- 3. Assert: Leader Branch A can see Issue A, but CANNOT see Issue B
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';

DO $$
DECLARE
    cnt_b INT;
BEGIN
    SELECT count(*) INTO cnt_b FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000402';

    IF cnt_b != 0 THEN
        RAISE EXCEPTION 'SECURITY_BREACH: Leader Branch A was able to read Branch B issue!';
    END IF;

    RAISE NOTICE 'TEST 04 PASSED: Cross-branch boundary isolation verified.';
END;
$$;

ROLLBACK;
