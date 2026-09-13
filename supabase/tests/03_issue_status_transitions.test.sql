-- ============================================================================
-- TEST 03: Issue Status Transitions & Role Guardrails
-- Framework: PostgreSQL Transaction Isolation (pgTAP compatible)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent artifacts)
-- ============================================================================

BEGIN;

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

-- 2. Assert: Member attempts direct update to CLOSED -> RLS filters to 0 rows updated
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

UPDATE public.issues SET status = 'CLOSED' WHERE id = '00000000-0000-0000-0000-000000000301';

DO $$
DECLARE
    curr_status TEXT;
BEGIN
    -- Verify status remains NEW
    SELECT status INTO curr_status FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000301';
    IF curr_status != 'NEW' THEN
        RAISE EXCEPTION 'TEST_FAILED: Member was able to modify issue status! Current: %', curr_status;
    END IF;
END;
$$;

-- 3. Assert: Store Leader executes valid transition path: NEW -> TRIAGED -> VERIFIED
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';

UPDATE public.issues SET status = 'TRIAGED' WHERE id = '00000000-0000-0000-0000-000000000301';
UPDATE public.issues SET status = 'VERIFIED' WHERE id = '00000000-0000-0000-0000-000000000301';

DO $$
DECLARE
    curr_status TEXT;
BEGIN
    SELECT status INTO curr_status FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000301';
    IF curr_status != 'VERIFIED' THEN
        RAISE EXCEPTION 'TEST_FAILED: Leader failed to transition to VERIFIED! Current: %', curr_status;
    END IF;
END;
$$;

-- 4. Assert: Leader attempts invalid shortcut transition: VERIFIED -> CLOSED (Invalid path) -> Must RAISE EXCEPTION
DO $$
DECLARE
    caught_error BOOLEAN := FALSE;
BEGIN
    BEGIN
        UPDATE public.issues SET status = 'CLOSED' WHERE id = '00000000-0000-0000-0000-000000000301';
    EXCEPTION WHEN OTHERS THEN
        caught_error := TRUE;
    END;

    IF NOT caught_error THEN
        RAISE EXCEPTION 'TEST_FAILED: Invalid status transition was allowed without error!';
    END IF;

    RAISE NOTICE 'TEST 03 PASSED: Issue status transitions and role guardrails verified.';
END;
$$;

ROLLBACK;
