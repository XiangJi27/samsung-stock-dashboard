-- ============================================================================
-- SAMSUNG BRANCH OPERATIONS SYSTEM - USER FEEDBACK PILOT
-- Post-Deployment Verification Queries
-- Run these queries sequentially in Supabase SQL Editor after schema execution.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Check Row Level Security (RLS) is ENABLED on ALL pilot tables
-- Expected: rowsecurity = true for all 8 tables
-- ----------------------------------------------------------------------------
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- ----------------------------------------------------------------------------
-- 2. Check Policy Inventory
-- Expected: roles = {authenticated} for all user policies, no broad {public}
-- ----------------------------------------------------------------------------
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- ----------------------------------------------------------------------------
-- 3. Check Table Grants for anon vs authenticated
-- Expected: anon has NO permissions, authenticated has strictly limited permissions
-- ----------------------------------------------------------------------------
SELECT 
    grantee, 
    table_schema, 
    table_name, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, table_name, privilege_type;

-- ----------------------------------------------------------------------------
-- 4. Check SECURITY DEFINER and strict search_path on Functions
-- Expected: prosecdef = true, proconfig contains search_path = public, auth, pg_temp
-- ----------------------------------------------------------------------------
SELECT 
    n.nspname AS schema_name, 
    p.proname AS function_name, 
    p.prosecdef AS security_definer, 
    p.proconfig AS function_settings
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- ----------------------------------------------------------------------------
-- 5. Check Function Routine Grants for PUBLIC, anon, and authenticated
-- Expected: Only update_own_display_name and update_own_new_issue have EXECUTE for authenticated.
-- All helper and trigger functions must have NO grants to PUBLIC, anon, or authenticated.
-- ----------------------------------------------------------------------------
SELECT 
    routine_schema, 
    routine_name, 
    grantee, 
    privilege_type 
FROM information_schema.role_routine_grants 
WHERE routine_schema = 'public' 
  AND grantee IN ('PUBLIC', 'anon', 'authenticated')
ORDER BY routine_name, grantee;

-- ----------------------------------------------------------------------------
-- 6. Template: Bootstrap Your Initial Dual-Role Admin Account
-- Replace <TARGET_USER_UUID> with your actual UUID from auth.users
-- DO NOT commit your real UUID or Employee Code to Git!
-- ----------------------------------------------------------------------------
/*
INSERT INTO public.profiles (
    id,
    employee_code,
    display_name,
    branch_id,
    job_title,
    status
)
VALUES (
    '<TARGET_USER_UUID>',
    '<EMPLOYEE_CODE>',
    '<DISPLAY_NAME>',
    'AYUTTHAYA_CITY_PARK',
    'Store Leader / System Administrator',
    'ACTIVE'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (
    user_id,
    role,
    branch_id
)
VALUES 
    ('<TARGET_USER_UUID>', 'STORE_LEADER', 'AYUTTHAYA_CITY_PARK'),
    ('<TARGET_USER_UUID>', 'SYSTEM_ADMIN', NULL)
ON CONFLICT DO NOTHING;
*/

-- ----------------------------------------------------------------------------
-- 7. Check Dual-Role Bootstrap Verification
-- Expected: Exactly 2 rows for your account:
-- 1) STORE_LEADER / AYUTTHAYA_CITY_PARK
-- 2) SYSTEM_ADMIN / NULL
-- ----------------------------------------------------------------------------
/*
SELECT 
    p.id,
    p.employee_code,
    p.display_name,
    p.branch_id,
    p.status,
    ur.role,
    ur.branch_id AS role_branch_id
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.id = '<TARGET_USER_UUID>';
*/
