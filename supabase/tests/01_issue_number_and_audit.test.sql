-- ============================================================================
-- TEST 01: Issue Number Auto-Generation & Immutable Audit Trigger
-- Framework: PostgreSQL Transaction Isolation (pgTAP compatible)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent artifacts)
-- ============================================================================

BEGIN;

-- 1. Setup Test Fixture (Mock Member)
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test_m1@store.local', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, employee_code, display_name, branch_id, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'TEST_M1', 'Test Member 1', 'AYUTTHAYA_CITY_PARK', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, branch_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'MEMBER', 'AYUTTHAYA_CITY_PARK')
ON CONFLICT DO NOTHING;

-- 2. Switch to Authenticated Member Context
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

-- 3. Execute Insert with Client Spoofed Issue Number
INSERT INTO public.issues (
    id,
    issue_number,
    title,
    description,
    category,
    severity
)
VALUES (
    '00000000-0000-0000-0000-000000000101',
    'FAKE-999999',
    'Test Issue Title',
    'Test Issue Description',
    'OTHER',
    'P3_MEDIUM'
);

-- 4. Assert Issue Number Overwritten by Database Trigger
DO $$
DECLARE
    rec RECORD;
    evt RECORD;
BEGIN
    SELECT * INTO rec FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000101';
    
    IF rec.issue_number = 'FAKE-999999' THEN
        RAISE EXCEPTION 'TEST_FAILED: issue_number was not overwritten by database trigger!';
    END IF;

    IF rec.issue_number NOT LIKE 'ISS-2026-%' THEN
        RAISE EXCEPTION 'TEST_FAILED: issue_number does not match ISS-2026-%% format! Got: %', rec.issue_number;
    END IF;

    IF rec.status != 'NEW' THEN
        RAISE EXCEPTION 'TEST_FAILED: status was not forced to NEW! Got: %', rec.status;
    END IF;

    IF rec.reporter_id != '00000000-0000-0000-0000-000000000001'::uuid THEN
        RAISE EXCEPTION 'TEST_FAILED: reporter_id was not bound to auth.uid()!';
    END IF;

    IF rec.branch_id != 'AYUTTHAYA_CITY_PARK' THEN
        RAISE EXCEPTION 'TEST_FAILED: branch_id was not bound to profile branch!';
    END IF;

    -- 5. Assert Immutable Audit Event Created via AFTER Trigger
    SELECT * INTO evt FROM public.issue_events WHERE issue_id = '00000000-0000-0000-0000-000000000101';
    
    IF evt.event_type != 'ISSUE_CREATED' THEN
        RAISE EXCEPTION 'TEST_FAILED: audit event_type is not ISSUE_CREATED! Got: %', evt.event_type;
    END IF;

    IF evt.actor_id != '00000000-0000-0000-0000-000000000001'::uuid THEN
        RAISE EXCEPTION 'TEST_FAILED: audit actor_id does not match caller!';
    END IF;

    IF evt.actor_type != 'USER' THEN
        RAISE EXCEPTION 'TEST_FAILED: audit actor_type is not USER! Got: %', evt.actor_type;
    END IF;

    RAISE NOTICE 'TEST 01 PASSED: Issue number database generation and audit trigger verified.';
END;
$$;

ROLLBACK;
