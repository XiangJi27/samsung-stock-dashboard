-- ============================================================================
-- TEST 02: Internal Comments Scope & Anti-Spoofing Guard
-- Framework: PostgreSQL Transaction Isolation (pgTAP compatible)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent artifacts)
-- ============================================================================

BEGIN;

-- 1. Setup Test Fixtures (Member 1, Member 2, Store Leader)
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_m1@store.local', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_m2@store.local', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_leader@store.local', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, employee_code, display_name, branch_id, status)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'TEST_M1', 'Member 1', 'AYUTTHAYA_CITY_PARK', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000002', 'TEST_M2', 'Member 2', 'AYUTTHAYA_CITY_PARK', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000003', 'TEST_L1', 'Leader 1', 'AYUTTHAYA_CITY_PARK', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, branch_id)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'MEMBER', 'AYUTTHAYA_CITY_PARK'),
  ('00000000-0000-0000-0000-000000000002', 'MEMBER', 'AYUTTHAYA_CITY_PARK'),
  ('00000000-0000-0000-0000-000000000003', 'STORE_LEADER', 'AYUTTHAYA_CITY_PARK')
ON CONFLICT DO NOTHING;

-- Create Issue by Member 1
INSERT INTO public.issues (id, issue_number, title, description, category, severity, reporter_id, branch_id)
VALUES ('00000000-0000-0000-0000-000000000201', 'ISS-2026-TEST02', 'Comments Test', 'Testing comment visibility', 'OTHER', 'P3_MEDIUM', '00000000-0000-0000-0000-000000000001', 'AYUTTHAYA_CITY_PARK');

-- Member 1 posts public comment
INSERT INTO public.issue_comments (id, issue_id, author_id, comment_text, is_internal)
VALUES ('00000000-0000-0000-0000-000000000211', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'Public Note by Member 1', FALSE);

-- Store Leader posts internal comment
INSERT INTO public.issue_comments (id, issue_id, author_id, comment_text, is_internal)
VALUES ('00000000-0000-0000-0000-000000000212', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000003', 'Internal Note by Leader', TRUE);

-- 2. Assert: Member 1 sees ONLY 1 comment (Public only)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

DO $$
DECLARE
    cnt INT;
BEGIN
    SELECT count(*) INTO cnt FROM public.issue_comments WHERE issue_id = '00000000-0000-0000-0000-000000000201';
    IF cnt != 1 THEN
        RAISE EXCEPTION 'TEST_FAILED: Member 1 saw % comments, expected exactly 1!', cnt;
    END IF;
END;
$$;

-- 3. Assert: Store Leader sees BOTH comments (2 comments)
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';

DO $$
DECLARE
    cnt INT;
BEGIN
    SELECT count(*) INTO cnt FROM public.issue_comments WHERE issue_id = '00000000-0000-0000-0000-000000000201';
    IF cnt != 2 THEN
        RAISE EXCEPTION 'TEST_FAILED: Store Leader saw % comments, expected 2!', cnt;
    END IF;
END;
$$;

-- 4. Assert: Member 2 attempts to insert is_internal = TRUE -> Must be BLOCKED
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}';

DO $$
DECLARE
    caught_expected_error BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO public.issue_comments (issue_id, author_id, comment_text, is_internal)
        VALUES ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000002', 'Unauthorized Note', TRUE);
    EXCEPTION WHEN check_violation OR insufficient_privilege THEN
        caught_expected_error := TRUE;
    END;

    IF NOT caught_expected_error THEN
        RAISE EXCEPTION 'TEST_FAILED: Member 2 was able to insert an internal comment!';
    END IF;

    RAISE NOTICE 'TEST 02 PASSED: Internal comments scope and spoofing guard verified.';
END;
$$;

ROLLBACK;
