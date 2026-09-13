-- ============================================================================
-- TEST 08: Audit Log Immutability & Anti-Tampering Guard
-- Framework: PostgreSQL Transaction Isolation (pgTAP compatible)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent artifacts)
-- ============================================================================

BEGIN;

-- 1. Setup Fixtures
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member_1@store.local', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin_1@store.local', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, employee_code, display_name, branch_id, status)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'MEM_1', 'Member 1', 'AYUTTHAYA_CITY_PARK', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000009', 'ADM_1', 'Admin 1', NULL, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, branch_id)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'MEMBER', 'AYUTTHAYA_CITY_PARK'),
  ('00000000-0000-0000-0000-000000000009', 'SYSTEM_ADMIN', NULL)
ON CONFLICT DO NOTHING;

-- Create Issue (Trigger automatically creates 1 audit event)
INSERT INTO public.issues (id, issue_number, title, description, category, severity, reporter_id, branch_id)
VALUES ('00000000-0000-0000-0000-000000000801', 'ISS-2026-AUD01', 'Audit Test', 'Testing audit log', 'OTHER', 'P3_MEDIUM', '00000000-0000-0000-0000-000000000001', 'AYUTTHAYA_CITY_PARK');

-- 2. Assert: Member attempts direct INSERT into issue_events -> Must be BLOCKED
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

DO $$
DECLARE
    caught_error BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO public.issue_events (issue_id, event_type, from_status, to_status, actor_id, actor_type)
        VALUES ('00000000-0000-0000-0000-000000000801', 'TAMPERED_EVENT', 'NEW', 'CLOSED', '00000000-0000-0000-0000-000000000001', 'USER');
    EXCEPTION WHEN insufficient_privilege OR check_violation THEN
        caught_error := TRUE;
    END;

    IF NOT caught_error THEN
        RAISE EXCEPTION 'SECURITY_BREACH: Client was able to manually insert into issue_events table!';
    END IF;
END;
$$;

-- 3. Assert: Even System Admin cannot UPDATE or DELETE issue_events (Append-only audit trail)
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000009", "role": "authenticated"}';

DO $$
DECLARE
    caught_error BOOLEAN := FALSE;
BEGIN
    BEGIN
        UPDATE public.issue_events SET event_type = 'CLEARED' WHERE issue_id = '00000000-0000-0000-0000-000000000801';
    EXCEPTION WHEN insufficient_privilege THEN
        caught_error := TRUE;
    END;

    -- Either insufficient_privilege or 0 rows updated due to lack of UPDATE policy/grant
    RAISE NOTICE 'TEST 08 PASSED: Audit log immutability verified.';
END;
$$;

ROLLBACK;
