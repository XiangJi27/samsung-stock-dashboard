-- ============================================================================
-- SAMSUNG BRANCH OPERATIONS SYSTEM - USER FEEDBACK PILOT
-- MIGRATION DELTA: Active User Gate & Database-Level Access Revocation
-- Target: Supabase Preview Database (Incremental & Idempotent Update)
-- 
-- Description:
-- Safely applies the active user verification gate (private.is_active_user())
-- and updates all Row Level Security (RLS) policies, trigger functions,
-- and secure RPCs without dropping tables, recreating schemas, or modifying
-- existing user data.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Helper Function: Check User Account Active Status
-- ============================================================================
CREATE OR REPLACE FUNCTION private.is_active_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.profiles 
        WHERE id = auth.uid() 
          AND status = 'ACTIVE'
    );
END;
$$;

-- Enforce strict routine privileges: only authenticated users can evaluate
REVOKE ALL ON FUNCTION private.is_active_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_active_user() TO authenticated;

-- ============================================================================
-- 2. Update RPC Functions with Active User Gate
-- ============================================================================

-- 2.1 Update Own Display Name RPC
CREATE OR REPLACE FUNCTION public.update_own_display_name(new_display_name TEXT)
RETURNS VOID AS $$
DECLARE
    cleaned_name TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;
    IF NOT private.is_active_user() THEN
        RAISE EXCEPTION 'Forbidden: User account is suspended or inactive.';
    END IF;
    cleaned_name := TRIM(new_display_name);
    IF cleaned_name IS NULL OR LENGTH(cleaned_name) < 2 OR LENGTH(cleaned_name) > 60 THEN
        RAISE EXCEPTION 'Display name must be between 2 and 60 characters.';
    END IF;

    UPDATE public.profiles
    SET display_name = cleaned_name,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

REVOKE ALL ON FUNCTION public.update_own_display_name(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_display_name(TEXT) TO authenticated;

-- 2.2 Update Own New Issue RPC
CREATE OR REPLACE FUNCTION public.update_own_new_issue(
    target_issue_id UUID,
    new_title TEXT,
    new_description TEXT,
    new_expected_result TEXT,
    new_actual_result TEXT,
    new_reproduction_steps TEXT,
    new_reproducibility TEXT
)
RETURNS VOID AS $$
DECLARE
    curr_issue RECORD;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;
    IF NOT private.is_active_user() THEN
        RAISE EXCEPTION 'Forbidden: User account is suspended or inactive.';
    END IF;

    SELECT * INTO curr_issue FROM public.issues WHERE id = target_issue_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Issue not found.';
    END IF;

    IF curr_issue.reporter_id != auth.uid() AND NOT private.has_role('SYSTEM_ADMIN') THEN
        RAISE EXCEPTION 'Forbidden: You can only edit your own issues.';
    END IF;

    IF curr_issue.status != 'NEW' THEN
        RAISE EXCEPTION 'Forbidden: Issue can only be edited while in NEW status.';
    END IF;

    UPDATE public.issues
    SET title = COALESCE(TRIM(new_title), title),
        description = COALESCE(TRIM(new_description), description),
        expected_result = new_expected_result,
        actual_result = new_actual_result,
        reproduction_steps = new_reproduction_steps,
        reproducibility = COALESCE(new_reproducibility, reproducibility),
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = target_issue_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth, pg_temp;

REVOKE ALL ON FUNCTION public.update_own_new_issue FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_new_issue TO authenticated;

-- ============================================================================
-- 3. Update Trigger Function: Enforce Active Gate on Issue Writes
-- ============================================================================
CREATE OR REPLACE FUNCTION private.validate_issue_write()
RETURNS TRIGGER AS $$
DECLARE
    actor UUID;
    act_type TEXT;
    user_branch TEXT;
    is_admin BOOLEAN;
    is_store_leader BOOLEAN;
    is_support BOOLEAN;
    is_reporter BOOLEAN;
    is_valid_transition BOOLEAN;
BEGIN
    actor := auth.uid();
    IF actor IS NULL THEN
        act_type := 'SYSTEM';
    ELSE
        act_type := 'USER';
    END IF;

    -- 1. BEFORE INSERT
    IF (TG_OP = 'INSERT') THEN
        IF (act_type = 'USER') THEN
            IF NOT private.is_active_user() THEN
                RAISE EXCEPTION 'Forbidden: User account is suspended or inactive.';
            END IF;
            NEW.reporter_id := auth.uid();
            NEW.branch_id := private.get_user_branch_id();
            NEW.status := 'NEW';
            NEW.assigned_to := NULL;
            NEW.issue_number := private.generate_issue_number();
        ELSE
            IF NEW.issue_number IS NULL OR BTRIM(NEW.issue_number) = '' THEN
                NEW.issue_number := private.generate_issue_number();
            END IF;
        END IF;

        NEW.created_at := TIMEZONE('utc'::text, NOW());
        NEW.updated_at := TIMEZONE('utc'::text, NOW());
        RETURN NEW;
    END IF;

    -- 2. BEFORE UPDATE
    IF (TG_OP = 'UPDATE') THEN
        IF (act_type = 'USER') THEN
            IF NOT private.is_active_user() THEN
                RAISE EXCEPTION 'Forbidden: User account is suspended or inactive.';
            END IF;
        END IF;
        -- Immutable Fields Enforcement
        IF (OLD.branch_id IS DISTINCT FROM NEW.branch_id) THEN
            RAISE EXCEPTION 'Forbidden: issue branch_id is immutable once created.';
        END IF;
        IF (OLD.reporter_id IS DISTINCT FROM NEW.reporter_id) THEN
            RAISE EXCEPTION 'Forbidden: issue reporter_id is immutable.';
        END IF;
        IF (OLD.issue_number IS DISTINCT FROM NEW.issue_number) THEN
            RAISE EXCEPTION 'Forbidden: issue_number is immutable.';
        END IF;
        IF (OLD.created_at IS DISTINCT FROM NEW.created_at) THEN
            RAISE EXCEPTION 'Forbidden: created_at timestamp is immutable.';
        END IF;

        -- Role and Branch Context
        user_branch := private.get_user_branch_id();
        is_admin := private.has_global_role('SYSTEM_ADMIN');
        is_store_leader := private.has_branch_role('STORE_LEADER', OLD.branch_id);
        is_support := private.has_role('SUPPORT');
        is_reporter := (OLD.reporter_id = actor);

        -- System updates
        IF act_type = 'SYSTEM' THEN
            NEW.updated_at := TIMEZONE('utc'::text, NOW());
            RETURN NEW;
        END IF;

        -- Check Status Transition Rules
        IF (OLD.status IS DISTINCT FROM NEW.status) THEN
            is_valid_transition := FALSE;

            IF is_admin THEN
                is_valid_transition := TRUE;
            ELSIF (is_store_leader OR is_support) THEN
                IF OLD.status = 'NEW' AND NEW.status IN ('INVESTIGATING', 'TRIAGED', 'CLOSED') THEN
                    is_valid_transition := TRUE;
                ELSIF OLD.status = 'INVESTIGATING' AND NEW.status IN ('TRIAGED', 'FIX_IN_PROGRESS', 'CLOSED') THEN
                    is_valid_transition := TRUE;
                ELSIF OLD.status = 'TRIAGED' AND NEW.status IN ('FIX_IN_PROGRESS', 'CLOSED') THEN
                    is_valid_transition := TRUE;
                ELSIF OLD.status = 'FIX_IN_PROGRESS' AND NEW.status IN ('RESOLVED', 'INVESTIGATING') THEN
                    is_valid_transition := TRUE;
                ELSIF OLD.status = 'RESOLVED' AND NEW.status IN ('CLOSED', 'INVESTIGATING') THEN
                    is_valid_transition := TRUE;
                ELSIF OLD.status = 'CLOSED' AND NEW.status = 'INVESTIGATING' THEN
                    is_valid_transition := TRUE;
                END IF;
            END IF;

            IF NOT is_valid_transition THEN
                RAISE EXCEPTION 'Forbidden: Invalid status transition from % to % for caller role.', OLD.status, NEW.status;
            END IF;
        END IF;

        NEW.updated_at := TIMEZONE('utc'::text, NOW());
        RETURN NEW;
    END IF;

    -- 3. BEFORE DELETE
    IF (TG_OP = 'DELETE') THEN
        IF act_type = 'USER' AND NOT private.has_global_role('SYSTEM_ADMIN') THEN
            RAISE EXCEPTION 'Forbidden: Only SYSTEM_ADMIN may hard-delete issues.';
        END IF;
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth, pg_temp;

-- ============================================================================
-- 4. Idempotent Policy Refresh: Profiles
-- ============================================================================
DROP POLICY IF EXISTS "Profiles viewable in same branch or by admin" ON public.profiles;
CREATE POLICY "Profiles viewable in same branch or by admin" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        id = auth.uid() OR 
        (private.is_active_user() AND (
            private.has_global_role('SYSTEM_ADMIN') OR 
            private.has_role('AUDITOR') OR
            (branch_id = private.get_user_branch_id())
        ))
    );

DROP POLICY IF EXISTS "Admins insert profiles" ON public.profiles;
CREATE POLICY "Admins insert profiles" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (private.is_active_user() AND private.has_global_role('SYSTEM_ADMIN'));

DROP POLICY IF EXISTS "Admins update profiles" ON public.profiles;
CREATE POLICY "Admins update profiles" ON public.profiles
    FOR UPDATE TO authenticated
    USING (private.is_active_user() AND private.has_global_role('SYSTEM_ADMIN'))
    WITH CHECK (private.is_active_user() AND private.has_global_role('SYSTEM_ADMIN'));

DROP POLICY IF EXISTS "Admins delete profiles" ON public.profiles;
CREATE POLICY "Admins delete profiles" ON public.profiles
    FOR DELETE TO authenticated
    USING (private.is_active_user() AND private.has_global_role('SYSTEM_ADMIN'));

-- ============================================================================
-- 5. Idempotent Policy Refresh: User Roles
-- ============================================================================
DROP POLICY IF EXISTS "Roles viewable by owner or admin" ON public.user_roles;
CREATE POLICY "Roles viewable by owner or admin" ON public.user_roles
    FOR SELECT TO authenticated
    USING (
        private.is_active_user() AND (
            user_id = auth.uid() OR 
            private.has_global_role('SYSTEM_ADMIN') OR 
            private.has_role('AUDITOR')
        )
    );

DROP POLICY IF EXISTS "Admins insert user roles" ON public.user_roles;
CREATE POLICY "Admins insert user roles" ON public.user_roles
    FOR INSERT TO authenticated
    WITH CHECK (private.is_active_user() AND private.has_global_role('SYSTEM_ADMIN'));

DROP POLICY IF EXISTS "Admins update user roles" ON public.user_roles;
CREATE POLICY "Admins update user roles" ON public.user_roles
    FOR UPDATE TO authenticated
    USING (private.is_active_user() AND private.has_global_role('SYSTEM_ADMIN'))
    WITH CHECK (private.is_active_user() AND private.has_global_role('SYSTEM_ADMIN'));

DROP POLICY IF EXISTS "Admins delete user roles" ON public.user_roles;
CREATE POLICY "Admins delete user roles" ON public.user_roles
    FOR DELETE TO authenticated
    USING (private.is_active_user() AND private.has_global_role('SYSTEM_ADMIN'));

-- ============================================================================
-- 6. Idempotent Policy Refresh: Issues
-- ============================================================================
DROP POLICY IF EXISTS "Issues viewable according to role scope" ON public.issues;
CREATE POLICY "Issues viewable according to role scope" ON public.issues
    FOR SELECT TO authenticated
    USING (
        private.is_active_user() AND (
            reporter_id = auth.uid() OR 
            private.has_global_role('SYSTEM_ADMIN') OR 
            private.has_role('AUDITOR') OR
            (private.has_role('SUPPORT') AND assigned_to = auth.uid()) OR
            (private.has_branch_role('STORE_LEADER', branch_id))
        )
    );

DROP POLICY IF EXISTS "Members insert new issues for own branch" ON public.issues;
CREATE POLICY "Members insert new issues for own branch" ON public.issues
    FOR INSERT TO authenticated
    WITH CHECK (
        private.is_active_user() AND
        status = 'NEW' AND 
        reporter_id = auth.uid() AND
        branch_id = private.get_user_branch_id()
    );

DROP POLICY IF EXISTS "Store leaders support and admins update issues" ON public.issues;
CREATE POLICY "Store leaders support and admins update issues" ON public.issues
    FOR UPDATE TO authenticated
    USING (
        private.is_active_user() AND (
            private.has_global_role('SYSTEM_ADMIN') OR 
            private.has_branch_role('STORE_LEADER', branch_id) OR
            (private.has_role('SUPPORT') AND assigned_to = auth.uid())
        )
    );

-- ============================================================================
-- 7. Idempotent Policy Refresh: Issue Attachments
-- ============================================================================
DROP POLICY IF EXISTS "Attachments viewable on readable issues" ON public.issue_attachments;
CREATE POLICY "Attachments viewable on readable issues" ON public.issue_attachments
    FOR SELECT TO authenticated
    USING (
        private.is_active_user() AND
        EXISTS (SELECT 1 FROM public.issues WHERE id = issue_attachments.issue_id)
    );

DROP POLICY IF EXISTS "Attachments insertable by reporter or branch leaders" ON public.issue_attachments;
CREATE POLICY "Attachments insertable by reporter or branch leaders" ON public.issue_attachments
    FOR INSERT TO authenticated
    WITH CHECK (
        private.is_active_user() AND
        uploaded_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.issues 
            WHERE id = issue_attachments.issue_id 
              AND (reporter_id = auth.uid() OR private.has_branch_role('STORE_LEADER', branch_id) OR private.has_global_role('SYSTEM_ADMIN'))
        )
    );

-- ============================================================================
-- 8. Idempotent Policy Refresh: Issue Comments
-- ============================================================================
DROP POLICY IF EXISTS "Comments viewable according to issue scope" ON public.issue_comments;
CREATE POLICY "Comments viewable according to issue scope" ON public.issue_comments
    FOR SELECT TO authenticated
    USING (
        private.is_active_user() AND
        EXISTS (
            SELECT 1
            FROM public.issues i
            WHERE i.id = issue_comments.issue_id
              AND (
                  is_internal = FALSE
                  OR private.has_global_role('SYSTEM_ADMIN')
                  OR (private.has_role('SUPPORT') AND i.assigned_to = auth.uid())
                  OR private.has_branch_role('STORE_LEADER', i.branch_id)
              )
        )
    );

DROP POLICY IF EXISTS "Comments insertable on readable issues" ON public.issue_comments;
CREATE POLICY "Comments insertable on readable issues" ON public.issue_comments
    FOR INSERT TO authenticated
    WITH CHECK (
        private.is_active_user() AND
        author_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.issues i
            WHERE i.id = issue_comments.issue_id
              AND (
                  is_internal = FALSE
                  OR private.has_global_role('SYSTEM_ADMIN')
                  OR (private.has_role('SUPPORT') AND i.assigned_to = auth.uid())
                  OR private.has_branch_role('STORE_LEADER', i.branch_id)
              )
        )
    );

-- ============================================================================
-- 9. Idempotent Policy Refresh: Issue Events & AI Analysis
-- ============================================================================
DROP POLICY IF EXISTS "Audit events viewable on readable issues" ON public.issue_events;
CREATE POLICY "Audit events viewable on readable issues" ON public.issue_events
    FOR SELECT TO authenticated
    USING (
        private.is_active_user() AND
        EXISTS (SELECT 1 FROM public.issues WHERE id = issue_events.issue_id)
    );

DROP POLICY IF EXISTS "AI analysis viewable on readable issues" ON public.issue_ai_analysis;
CREATE POLICY "AI analysis viewable on readable issues" ON public.issue_ai_analysis
    FOR SELECT TO authenticated
    USING (
        private.is_active_user() AND
        EXISTS (SELECT 1 FROM public.issues WHERE id = issue_ai_analysis.issue_id)
    );

COMMIT;
