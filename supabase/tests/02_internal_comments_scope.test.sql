-- ============================================================================
-- TEST 02: Internal Comments Scope & Anti-Spoofing Guard
-- Framework: pgTAP (Test Anything Protocol for PostgreSQL)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent fixtures)
-- ============================================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(4);

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

-- 2. Switch to Member 1 Context -> Assert sees ONLY public comment (count = 1)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT is(
    (SELECT count(*)::int FROM public.issue_comments WHERE issue_id = '00000000-0000-0000-0000-000000000201'),
    1,
    'Member must see exactly 1 comment (public comment only, internal hidden)'
);

-- 3. Switch to Store Leader Context -> Assert sees BOTH comments (count = 2)
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT is(
    (SELECT count(*)::int FROM public.issue_comments WHERE issue_id = '00000000-0000-0000-0000-000000000201'),
    2,
    'Store Leader must see both public and internal comments (count = 2)'
);

-- 4. Switch back to Member 1 Context -> Attempt to insert internal comment -> MUST THROW 42501
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

SELECT throws_ok(
    $$INSERT INTO public.issue_comments (id, issue_id, author_id, comment_text, is_internal)
      VALUES ('00000000-0000-0000-0000-000000000213', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'Hacked internal note', TRUE)$$,
    '42501',
    NULL,
    'Member insertion of internal comment (is_internal = TRUE) must be blocked by RLS policy'
);

-- 5. Store Leader inserts internal comment -> MUST SUCCEED
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT lives_ok(
    $$INSERT INTO public.issue_comments (id, issue_id, author_id, comment_text, is_internal)
      VALUES ('00000000-0000-0000-0000-000000000214', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000003', 'Authorized leader note', TRUE)$$,
    'Store Leader must be authorized to insert internal comment'
);

SELECT * FROM finish();
ROLLBACK;
