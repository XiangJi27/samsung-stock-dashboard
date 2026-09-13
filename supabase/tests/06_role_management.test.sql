-- ============================================================================
-- TEST 06: Role Management & Privilege Separation
-- Framework: PostgreSQL Transaction Isolation (pgTAP compatible)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent artifacts)
-- ============================================================================

BEGIN;

-- 1. Setup Fixtures
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member_1@store.local', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'leader_1@store.local', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin_1@store.local', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, employee_code, display_name, branch_id, status)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'MEM_1', 'Member 1', 'AYUTTHAYA_CITY_PARK', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000003', 'LEAD_1', 'Leader 1', 'AYUTTHAYA_CITY_PARK', 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000009', 'ADM_1', 'Admin 1', NULL, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, branch_id)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'MEMBER', 'AYUTTHAYA_CITY_PARK'),
  ('00000000-0000-0000-0000-000000000003', 'STORE_LEADER', 'AYUTTHAYA_CITY_PARK'),
  ('00000000-0000-0000-0000-000000000009', 'SYSTEM_ADMIN', NULL)
ON CONFLICT DO NOTHING;

-- 2. Assert: Member attempts to grant themselves SYSTEM_ADMIN -> Must be BLOCKED
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

DO $$
DECLARE
    caught_error BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO public.user_roles (user_id, role, branch_id)
        VALUES ('00000000-0000-0000-0000-000000000001', 'SYSTEM_ADMIN', NULL);
    EXCEPTION WHEN check_violation OR insufficient_privilege THEN
        caught_error := TRUE;
    END;

    IF NOT caught_error THEN
        RAISE EXCEPTION 'SECURITY_BREACH: Regular member was able to self-promote to SYSTEM_ADMIN!';
    END IF;
END;
$$;

-- 3. Assert: Store Leader attempts to grant SYSTEM_ADMIN -> Must be BLOCKED
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000003", "role": "authenticated"}';

DO $$
DECLARE
    caught_error BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO public.user_roles (user_id, role, branch_id)
        VALUES ('00000000-0000-0000-0000-000000000003', 'SYSTEM_ADMIN', NULL);
    EXCEPTION WHEN check_violation OR insufficient_privilege THEN
        caught_error := TRUE;
    END;

    IF NOT caught_error THEN
        RAISE EXCEPTION 'SECURITY_BREACH: Store Leader was able to grant SYSTEM_ADMIN!';
    END IF;
END;
$$;

-- 4. Assert: System Admin grants SUPPORT role to Member -> SUCCEEDS
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000009", "role": "authenticated"}';

INSERT INTO public.user_roles (user_id, role, branch_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'SUPPORT', NULL);

DO $$
DECLARE
    cnt INT;
BEGIN
    SELECT count(*) INTO cnt FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000001' AND role = 'SUPPORT';
    IF cnt != 1 THEN
        RAISE EXCEPTION 'TEST_FAILED: System Admin could not assign role!';
    END IF;

    RAISE NOTICE 'TEST 06 PASSED: Role management and privilege separation verified.';
END;
$$;

ROLLBACK;
