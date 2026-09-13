-- ============================================================================
-- TEST 01: Issue Number Auto-Generation & Immutable Audit Trigger
-- Framework: pgTAP (Test Anything Protocol for PostgreSQL)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent fixtures)
-- ============================================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(8);

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

-- 4. pgTAP Assertions for Issue Generation & Enforcement
SELECT isnt(
    (SELECT issue_number FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000101'),
    'FAKE-999999',
    'Issue number must be overwritten by database BEFORE INSERT trigger'
);

SELECT ok(
    (SELECT issue_number FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000101') LIKE 'ISS-2026-%',
    'Issue number must follow ISS-2026-% format pattern'
);

SELECT is(
    (SELECT status FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000101'),
    'NEW',
    'Initial status must be forced to NEW by database trigger'
);

SELECT is(
    (SELECT reporter_id FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000101'),
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Reporter ID must be bound to auth.uid()'
);

SELECT is(
    (SELECT branch_id FROM public.issues WHERE id = '00000000-0000-0000-0000-000000000101'),
    'AYUTTHAYA_CITY_PARK',
    'Branch ID must be bound to reporter profile branch'
);

-- 5. pgTAP Assertions for Immutable AFTER INSERT Audit Event
SELECT is(
    (SELECT event_type FROM public.issue_events WHERE issue_id = '00000000-0000-0000-0000-000000000101'),
    'ISSUE_CREATED',
    'Audit event must be auto-generated with event_type ISSUE_CREATED'
);

SELECT is(
    (SELECT actor_id FROM public.issue_events WHERE issue_id = '00000000-0000-0000-0000-000000000101'),
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Audit actor_id must match authenticated caller'
);

SELECT is(
    (SELECT actor_type FROM public.issue_events WHERE issue_id = '00000000-0000-0000-0000-000000000101'),
    'USER',
    'Audit actor_type must be USER'
);

SELECT * FROM finish();
ROLLBACK;
