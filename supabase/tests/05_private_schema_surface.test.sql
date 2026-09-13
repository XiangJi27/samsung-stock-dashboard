-- ============================================================================
-- TEST 05: Private Schema & RPC Surface Isolation
-- Framework: PostgreSQL Transaction Isolation (pgTAP compatible)
-- Safety: Enclosed in BEGIN ... ROLLBACK (Zero persistent artifacts)
-- ============================================================================

BEGIN;

DO $$
DECLARE
    unauthorized_public_rpc INT;
    unauthorized_private_anon INT;
    unauthorized_trigger_grants INT;
BEGIN
    -- 1. Check Public RPC surface: ONLY update_own_display_name and update_own_new_issue allowed
    SELECT count(*) INTO unauthorized_public_rpc
    FROM information_schema.role_routine_grants
    WHERE routine_schema = 'public'
      AND grantee = 'authenticated'
      AND privilege_type = 'EXECUTE'
      AND routine_name NOT IN ('update_own_display_name', 'update_own_new_issue');

    IF unauthorized_public_rpc > 0 THEN
        RAISE EXCEPTION 'SECURITY_BREACH: Found % unauthorized functions granted EXECUTE to authenticated in public schema!', unauthorized_public_rpc;
    END IF;

    -- 2. Check Private Schema: Zero grants to PUBLIC or anon
    SELECT count(*) INTO unauthorized_private_anon
    FROM information_schema.role_routine_grants
    WHERE routine_schema = 'private'
      AND grantee IN ('PUBLIC', 'anon');

    IF unauthorized_private_anon > 0 THEN
        RAISE EXCEPTION 'SECURITY_BREACH: Found % functions in private schema accessible by PUBLIC or anon!', unauthorized_private_anon;
    END IF;

    -- 3. Check Triggers: validate_issue_write and write_issue_audit_event must NOT be callable by authenticated
    SELECT count(*) INTO unauthorized_trigger_grants
    FROM information_schema.role_routine_grants
    WHERE routine_schema = 'public'
      AND routine_name IN ('validate_issue_write', 'write_issue_audit_event')
      AND grantee = 'authenticated';

    IF unauthorized_trigger_grants > 0 THEN
        RAISE EXCEPTION 'SECURITY_BREACH: Triggers must not have EXECUTE granted to authenticated users!';
    END IF;

    RAISE NOTICE 'TEST 05 PASSED: Function execution and private schema surface verified.';
END;
$$;

ROLLBACK;
