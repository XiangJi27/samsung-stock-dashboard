-- ============================================================================
-- TEST 07: Profile Update RPC & Direct Tampering Prevention
-- Framework: PostgreSQL Transaction Isolation (pgTAP compatible)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent artifacts)
-- ============================================================================

BEGIN;

-- 1. Setup Fixtures
INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member_1@store.local', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, employee_code, display_name, branch_id, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'MEM_1', 'Original Name', 'AYUTTHAYA_CITY_PARK', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role, branch_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'MEMBER', 'AYUTTHAYA_CITY_PARK')
ON CONFLICT DO NOTHING;

-- 2. Assert: Member attempts direct UPDATE on profiles table (tampering branch_id) -> 0 rows updated
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}';

UPDATE public.profiles SET branch_id = 'TEST_BRANCH_B' WHERE id = '00000000-0000-0000-0000-000000000001';

DO $$
DECLARE
    curr_branch TEXT;
BEGIN
    SELECT branch_id INTO curr_branch FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001';
    IF curr_branch != 'AYUTTHAYA_CITY_PARK' THEN
        RAISE EXCEPTION 'SECURITY_BREACH: Member was able to directly tamper with branch_id in profiles table!';
    END IF;
END;
$$;

-- 3. Assert: Member invokes secure RPC update_own_display_name -> SUCCEEDS
SELECT public.update_own_display_name('Updated Member Name');

DO $$
DECLARE
    curr_name TEXT;
BEGIN
    SELECT display_name INTO curr_name FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001';
    IF curr_name != 'Updated Member Name' THEN
        RAISE EXCEPTION 'TEST_FAILED: update_own_display_name RPC failed to update display name!';
    END IF;

    RAISE NOTICE 'TEST 07 PASSED: Profile update RPC and direct tampering prevention verified.';
END;
$$;

ROLLBACK;
