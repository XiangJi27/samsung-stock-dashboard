-- ============================================================================
-- SAMSUNG BRANCH OPERATIONS SYSTEM - USER FEEDBACK PILOT
-- PostgreSQL Schema & Row Level Security (RLS) for Supabase
-- Target Environment: Pilot Feedback Phase (Ayutthaya City Park Branch)
-- Security Status: PREVIEW_HARDENED_PENDING_LIVE_RLS_VERIFICATION
-- ============================================================================

-- 1. Enable UUID Extension & Create Private Schema for Internal Functions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS private;

-- 2. Issue Number Sequence (Database-Generated: ISS-2026-000001)
-- Managed exclusively inside private schema, never accessed directly by client
CREATE SEQUENCE IF NOT EXISTS private.issue_number_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION private.generate_issue_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'ISS-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(NEXTVAL('private.issue_number_seq')::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = private, pg_temp;

-- 3. Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    province TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

INSERT INTO public.branches (id, name, province) 
VALUES 
  ('AYUTTHAYA_CITY_PARK', 'Samsung Experience Store - Ayutthaya City Park', 'Phra Nakhon Si Ayutthaya'),
  ('TEST_BRANCH_B', 'Samsung Experience Store - Test Branch B', 'Bangkok')
ON CONFLICT (id) DO NOTHING;

-- 4. Profiles Table (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_code TEXT UNIQUE,
    display_name TEXT NOT NULL,
    branch_id TEXT REFERENCES public.branches(id),
    job_title TEXT,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'PENDING')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. User Roles Table (Supports Multi-Role: STORE_LEADER + SYSTEM_ADMIN)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('MEMBER', 'STORE_LEADER', 'SUPPORT', 'SYSTEM_ADMIN', 'AUDITOR')),
    branch_id TEXT REFERENCES public.branches(id),
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Partial Unique Indexes for Multi-Role with NULL branch (Postgres standard)
CREATE UNIQUE INDEX IF NOT EXISTS uq_global_user_role
    ON public.user_roles(user_id, role)
    WHERE branch_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_user_role
    ON public.user_roles(user_id, role, branch_id)
    WHERE branch_id IS NOT NULL;

-- 6. Issues Table (Centralized Issue Tracking)
-- Notice: issue_number has NO column default; generated strictly by BEFORE INSERT trigger!
CREATE TABLE IF NOT EXISTS public.issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'LOGIN_AUTH', 'DASHBOARD', 'STOCK_DATA', 'STOCK_IMPORT', 
        'PROMOTION_DATA', 'PROMOTION_IMPORT', 'EXACT_PN_MATCHING', 
        'TRADE_UP', 'SF_PLUS', 'STUDENT_PROMOTION', 'AI_IMAGE_EXTRACTION', 
        'PERFORMANCE', 'DISPLAY_MOBILE', 'DATA_INCONSISTENCY', 'OTHER'
    )),
    severity TEXT NOT NULL DEFAULT 'P3_MEDIUM' CHECK (severity IN ('P1_CRITICAL', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW')),
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN (
        'NEW', 'TRIAGED', 'VERIFIED', 'IN_PROGRESS', 'FIX_READY', 
        'READY_FOR_RETEST', 'RESOLVED', 'CLOSED', 'NEEDS_MORE_INFO', 
        'DUPLICATE', 'CANNOT_REPRODUCE', 'WONT_FIX', 'SECURITY_REVIEW'
    )),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id),
    branch_id TEXT NOT NULL REFERENCES public.branches(id),
    assigned_to UUID REFERENCES public.profiles(id),
    current_route TEXT,
    expected_result TEXT,
    actual_result TEXT,
    reproduction_steps TEXT,
    reproducibility TEXT DEFAULT 'ALWAYS',
    stock_batch_id TEXT,
    promotion_batch_id TEXT,
    application_version TEXT DEFAULT '1.0.0-pilot',
    application_commit TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

-- 7. Issue Attachments Table (Private Storage Metadata)
CREATE TABLE IF NOT EXISTS public.issue_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 TEXT,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 8. Issue Comments Table
CREATE TABLE IF NOT EXISTS public.issue_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id),
    comment_text TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 9. Issue Audit Events Table (Immutable Append-Only Audit Trail)
-- Populated EXCLUSIVELY by AFTER Trigger on issues table.
CREATE TABLE IF NOT EXISTS public.issue_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    actor_id UUID REFERENCES public.profiles(id),
    actor_type TEXT NOT NULL DEFAULT 'USER' CHECK (actor_type IN ('USER', 'SYSTEM', 'SERVICE_ROLE')),
    service_name TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 10. Issue AI Analysis Table (Server-Side AI Results Only)
CREATE TABLE IF NOT EXISTS public.issue_ai_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    analysis_version TEXT DEFAULT '1.0.0',
    model_name TEXT DEFAULT 'claude-3-5-sonnet',
    prompt_version TEXT DEFAULT 'v1-triage',
    category_suggestion TEXT,
    severity_suggestion TEXT,
    summary TEXT,
    probable_root_cause TEXT,
    duplicate_candidates JSONB DEFAULT '[]'::jsonb,
    suggested_next_steps JSONB DEFAULT '[]'::jsonb,
    confidence NUMERIC(4,3) CHECK (confidence >= 0 AND confidence <= 1.0),
    requires_human_review BOOLEAN DEFAULT TRUE,
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================================================
-- INTERNAL HELPER FUNCTIONS (PRIVATE SCHEMA - NOT EXPOSED TO DATA API)
-- Security Definer with strict search_path prevents search path injection
-- ============================================================================

-- Helper: Check global role
CREATE OR REPLACE FUNCTION private.has_global_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = required_role AND branch_id IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- Helper: Check branch role
CREATE OR REPLACE FUNCTION private.has_branch_role(required_role TEXT, target_branch_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = required_role AND (branch_id = target_branch_id OR branch_id IS NULL)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- Helper: Check if target user has role (Used only internally by validate_issue_write trigger)
CREATE OR REPLACE FUNCTION private.user_has_role(target_user_id UUID, required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF target_user_id IS NULL THEN RETURN FALSE; END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = target_user_id AND role = required_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- Helper: Check if caller has role (any scope)
CREATE OR REPLACE FUNCTION private.has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = required_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- Helper: Get user's branch_id
CREATE OR REPLACE FUNCTION private.get_user_branch_id()
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT branch_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- ----------------------------------------------------------------------------
-- SECURE RPC: Update Own Display Name (Restricts Profile Modifications)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_own_display_name(new_display_name TEXT)
RETURNS VOID AS $$
DECLARE
    cleaned_name TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
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

-- ----------------------------------------------------------------------------
-- SECURE RPC: Member Update Own New Issue (Column-Restricted Update)
-- Prevents tampering with severity, assigned_to, batches, commits, or timestamps
-- ----------------------------------------------------------------------------
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
-- TRIGGER 1: BEFORE INSERT OR UPDATE ON issues (Validation & Guardrails Only)
-- Does NOT insert into issue_events to prevent Foreign Key Violations!
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_issue_write()
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
            NEW.reporter_id := auth.uid();
            NEW.branch_id := private.get_user_branch_id();
            NEW.status := 'NEW';
            NEW.assigned_to := NULL; -- Regular member cannot assign on create
            NEW.issue_number := private.generate_issue_number(); -- Unconditionally database-generated (prevents client spoofing)
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
            RAISE EXCEPTION 'Forbidden: issue created_at is immutable.';
        END IF;
        IF (OLD.stock_batch_id IS DISTINCT FROM NEW.stock_batch_id) THEN
            RAISE EXCEPTION 'Forbidden: stock_batch_id is immutable.';
        END IF;
        IF (OLD.promotion_batch_id IS DISTINCT FROM NEW.promotion_batch_id) THEN
            RAISE EXCEPTION 'Forbidden: promotion_batch_id is immutable.';
        END IF;
        IF (OLD.application_commit IS DISTINCT FROM NEW.application_commit) THEN
            RAISE EXCEPTION 'Forbidden: application_commit is immutable.';
        END IF;

        user_branch := private.get_user_branch_id();
        is_admin := private.has_role('SYSTEM_ADMIN');
        is_store_leader := private.has_branch_role('STORE_LEADER', OLD.branch_id);
        is_support := private.has_role('SUPPORT');
        is_reporter := (actor = OLD.reporter_id);

        -- Assignment Validation: Assignee must belong to same branch OR hold SUPPORT role
        IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
            -- Check Caller Authority to Assign
            IF (NOT is_admin AND NOT is_store_leader AND NOT is_support) THEN
                RAISE EXCEPTION 'Forbidden: Only Store Leaders, Support, or Admins can assign issues.';
            END IF;

            -- Check Assignee Role & Branch (Target User Validation)
            IF (NEW.assigned_to IS NOT NULL AND NOT is_admin) THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = NEW.assigned_to 
                      AND (p.branch_id = OLD.branch_id OR private.user_has_role(NEW.assigned_to, 'SUPPORT'))
                ) THEN
                    RAISE EXCEPTION 'Forbidden: Assignee must belong to the issue branch or hold SUPPORT role.';
                END IF;
            END IF;
        END IF;

        -- Status Transition Validation
        IF (OLD.status IS DISTINCT FROM NEW.status) THEN
            is_valid_transition := FALSE;

            -- Allow-List State Machine
            IF (OLD.status = 'NEW' AND NEW.status IN ('TRIAGED', 'NEEDS_MORE_INFO', 'WONT_FIX')) THEN is_valid_transition := TRUE; END IF;
            IF (OLD.status = 'TRIAGED' AND NEW.status IN ('VERIFIED', 'NEEDS_MORE_INFO', 'DUPLICATE', 'CANNOT_REPRODUCE', 'WONT_FIX')) THEN is_valid_transition := TRUE; END IF;
            IF (OLD.status = 'VERIFIED' AND NEW.status IN ('IN_PROGRESS', 'NEEDS_MORE_INFO', 'WONT_FIX')) THEN is_valid_transition := TRUE; END IF;
            IF (OLD.status = 'IN_PROGRESS' AND NEW.status IN ('FIX_READY', 'NEEDS_MORE_INFO', 'CANNOT_REPRODUCE')) THEN is_valid_transition := TRUE; END IF;
            IF (OLD.status = 'FIX_READY' AND NEW.status IN ('READY_FOR_RETEST', 'IN_PROGRESS')) THEN is_valid_transition := TRUE; END IF;
            IF (OLD.status = 'READY_FOR_RETEST' AND NEW.status IN ('RESOLVED', 'IN_PROGRESS')) THEN is_valid_transition := TRUE; END IF;
            IF (OLD.status = 'RESOLVED' AND NEW.status IN ('CLOSED', 'IN_PROGRESS')) THEN is_valid_transition := TRUE; END IF;

            -- Reverse / Re-evaluation Paths
            IF (OLD.status = 'NEEDS_MORE_INFO' AND NEW.status IN ('NEW', 'TRIAGED', 'WONT_FIX')) THEN is_valid_transition := TRUE; END IF;
            IF (OLD.status = 'CLOSED' AND NEW.status = 'IN_PROGRESS' AND is_admin) THEN is_valid_transition := TRUE; END IF;

            IF NOT is_valid_transition AND NOT is_admin THEN
                RAISE EXCEPTION 'Invalid status transition path from % to %', OLD.status, NEW.status;
            END IF;

            -- Role Authority Checks
            IF (NOT is_admin AND NOT is_store_leader AND NOT is_support AND (NEW.status IN ('RESOLVED', 'CLOSED'))) THEN
                RAISE EXCEPTION 'Forbidden: Members cannot set status to RESOLVED or CLOSED directly.';
            END IF;
            IF (NEW.status = 'VERIFIED' AND NOT is_store_leader AND NOT is_admin) THEN
                RAISE EXCEPTION 'Forbidden: Only Store Leader or Admin can verify issues.';
            END IF;
            IF (NEW.status IN ('IN_PROGRESS', 'FIX_READY') AND NOT is_support AND NOT is_admin) THEN
                RAISE EXCEPTION 'Forbidden: Only Support or Admin can take issue into progress or mark fix ready.';
            END IF;
            IF (NEW.status = 'RESOLVED' AND NOT is_reporter AND NOT is_store_leader AND NOT is_admin) THEN
                RAISE EXCEPTION 'Forbidden: Retest resolution must be confirmed by Reporter, Store Leader, or Admin.';
            END IF;

            IF (NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED') THEN
                NEW.resolved_at := TIMEZONE('utc'::text, NOW());
            END IF;
            IF (NEW.status = 'CLOSED' AND OLD.status != 'CLOSED') THEN
                NEW.closed_at := TIMEZONE('utc'::text, NOW());
            END IF;
        END IF;

        NEW.updated_at := TIMEZONE('utc'::text, NOW());
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth, pg_temp;

-- ============================================================================
-- TRIGGER 2: AFTER INSERT OR UPDATE ON issues (Audit Event Logging)
-- Parent row in issues is GUARANTEED to exist. Zero FK violation risk!
-- ============================================================================
CREATE OR REPLACE FUNCTION public.write_issue_audit_event()
RETURNS TRIGGER AS $$
DECLARE
    actor UUID;
    act_type TEXT;
BEGIN
    actor := auth.uid();
    IF actor IS NULL THEN
        act_type := 'SYSTEM';
    ELSE
        act_type := 'USER';
    END IF;

    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.issue_events (issue_id, event_type, from_status, to_status, actor_id, actor_type, service_name, metadata)
        VALUES (
            NEW.id,
            'ISSUE_CREATED',
            NULL,
            NEW.status,
            actor,
            act_type,
            CASE WHEN act_type = 'SYSTEM' THEN 'SYSTEM_INSERT' ELSE NULL END,
            jsonb_build_object(
                'issue_number', NEW.issue_number,
                'title', NEW.title,
                'category', NEW.category,
                'severity', NEW.severity,
                'branch_id', NEW.branch_id
            )
        );
        RETURN NEW;
    END IF;

    IF (TG_OP = 'UPDATE') THEN
        IF (OLD.status IS DISTINCT FROM NEW.status) THEN
            INSERT INTO public.issue_events (issue_id, event_type, from_status, to_status, actor_id, actor_type, metadata)
            VALUES (
                NEW.id,
                'STATUS_CHANGED',
                OLD.status,
                NEW.status,
                actor,
                act_type,
                jsonb_build_object(
                    'severity', NEW.severity,
                    'assigned_to', NEW.assigned_to
                )
            );
        END IF;

        IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
            INSERT INTO public.issue_events (issue_id, event_type, from_status, to_status, actor_id, actor_type, metadata)
            VALUES (
                NEW.id,
                'ASSIGNMENT_CHANGED',
                OLD.status,
                NEW.status,
                actor,
                act_type,
                jsonb_build_object(
                    'from_assigned_to', OLD.assigned_to,
                    'to_assigned_to', NEW.assigned_to
                )
            );
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- Attach Triggers in Precise Chronological Order
DROP TRIGGER IF EXISTS trg_issue_validate ON public.issues;
CREATE TRIGGER trg_issue_validate
    BEFORE INSERT OR UPDATE ON public.issues
    FOR EACH ROW EXECUTE FUNCTION public.validate_issue_write();

DROP TRIGGER IF EXISTS trg_issue_audit ON public.issues;
CREATE TRIGGER trg_issue_audit
    AFTER INSERT OR UPDATE ON public.issues
    FOR EACH ROW EXECUTE FUNCTION public.write_issue_audit_event();

-- ============================================================================
-- EXPLICIT GRANTS & PRIVILEGE HARDENING (LEAST PRIVILEGE REVOKE & GRANT)
-- ============================================================================

-- 1. Revoke all default permissions on public & private schemas from anon and authenticated
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

REVOKE ALL ON ALL TABLES IN SCHEMA private FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA private FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC, anon, authenticated;

-- 2. Revoke default privileges for future objects created in schema public and private
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- 3. Explicitly revoke EXECUTE on public trigger functions
-- Triggers are invoked directly by the Postgres engine and do not need client EXECUTE privileges
REVOKE EXECUTE ON FUNCTION public.validate_issue_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.write_issue_audit_event() FROM PUBLIC, anon, authenticated;

-- 4. Revoke sequence access from Client
-- Sequences are consumed internally by private.generate_issue_number()
REVOKE ALL ON SEQUENCE private.issue_number_seq FROM anon, authenticated;

-- 5. Grant minimal necessary table access to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT ON public.branches TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.issues TO authenticated;
GRANT SELECT, INSERT ON public.issue_attachments TO authenticated;
GRANT SELECT, INSERT ON public.issue_comments TO authenticated;
GRANT SELECT ON public.issue_events TO authenticated;
GRANT SELECT ON public.issue_ai_analysis TO authenticated;

-- 6. Grant USAGE on private schema & EXECUTE on helper functions required by RLS
-- The private schema is NOT exposed via PostgREST / Data API, eliminating RPC attack surface
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_global_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_branch_role(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_user_branch_id() TO authenticated;

-- Note: private.user_has_role and private.generate_issue_number are NOT granted
-- to authenticated because they are called exclusively inside SECURITY DEFINER triggers.

-- 7. Grant EXECUTE exclusively to whitelisted client RPC functions in public
GRANT EXECUTE ON FUNCTION public.update_own_display_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_own_new_issue(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES WITH EXPLICIT 'TO authenticated'
-- ============================================================================

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_ai_analysis ENABLE ROW LEVEL SECURITY;

-- 1. Branches Policies
CREATE POLICY "Branches viewable by authenticated users" ON public.branches
    FOR SELECT TO authenticated
    USING (is_active = TRUE);

-- 2. Profiles Policies
CREATE POLICY "Profiles viewable in same branch or by admin" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        id = auth.uid() OR 
        private.has_global_role('SYSTEM_ADMIN') OR 
        private.has_role('AUDITOR') OR
        (branch_id = private.get_user_branch_id())
    );

CREATE POLICY "Admins insert profiles" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (private.has_global_role('SYSTEM_ADMIN'));

CREATE POLICY "Admins update profiles" ON public.profiles
    FOR UPDATE TO authenticated
    USING (private.has_global_role('SYSTEM_ADMIN'))
    WITH CHECK (private.has_global_role('SYSTEM_ADMIN'));

CREATE POLICY "Admins delete profiles" ON public.profiles
    FOR DELETE TO authenticated
    USING (private.has_global_role('SYSTEM_ADMIN'));

-- 3. User Roles Policies
CREATE POLICY "Roles viewable by owner or admin" ON public.user_roles
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() OR 
        private.has_global_role('SYSTEM_ADMIN') OR 
        private.has_role('AUDITOR')
    );

CREATE POLICY "Admins insert user roles" ON public.user_roles
    FOR INSERT TO authenticated
    WITH CHECK (private.has_global_role('SYSTEM_ADMIN'));

CREATE POLICY "Admins update user roles" ON public.user_roles
    FOR UPDATE TO authenticated
    USING (private.has_global_role('SYSTEM_ADMIN'))
    WITH CHECK (private.has_global_role('SYSTEM_ADMIN'));

CREATE POLICY "Admins delete user roles" ON public.user_roles
    FOR DELETE TO authenticated
    USING (private.has_global_role('SYSTEM_ADMIN'));

-- 4. Issues Policies
CREATE POLICY "Issues viewable according to role scope" ON public.issues
    FOR SELECT TO authenticated
    USING (
        reporter_id = auth.uid() OR 
        private.has_global_role('SYSTEM_ADMIN') OR 
        private.has_role('AUDITOR') OR
        (private.has_role('SUPPORT') AND assigned_to = auth.uid()) OR
        (private.has_branch_role('STORE_LEADER', branch_id))
    );

CREATE POLICY "Members insert new issues for own branch" ON public.issues
    FOR INSERT TO authenticated
    WITH CHECK (
        status = 'NEW' AND 
        reporter_id = auth.uid() AND
        branch_id = private.get_user_branch_id()
    );

CREATE POLICY "Store leaders support and admins update issues" ON public.issues
    FOR UPDATE TO authenticated
    USING (
        private.has_global_role('SYSTEM_ADMIN') OR 
        private.has_branch_role('STORE_LEADER', branch_id) OR
        (private.has_role('SUPPORT') AND assigned_to = auth.uid())
    );

-- Notice: Members update their own NEW issues strictly via update_own_new_issue() RPC

-- 5. Issue Attachments Policies (Private Storage Metadata)
CREATE POLICY "Attachments viewable on readable issues" ON public.issue_attachments
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.issues WHERE id = issue_attachments.issue_id)
    );

CREATE POLICY "Attachments insertable by reporter or branch leaders" ON public.issue_attachments
    FOR INSERT TO authenticated
    WITH CHECK (
        uploaded_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.issues 
            WHERE id = issue_attachments.issue_id 
              AND (reporter_id = auth.uid() OR private.has_branch_role('STORE_LEADER', branch_id) OR private.has_global_role('SYSTEM_ADMIN'))
        )
    );

-- 6. Issue Comments Policies
CREATE POLICY "Comments viewable according to issue scope" ON public.issue_comments
    FOR SELECT TO authenticated
    USING (
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

CREATE POLICY "Comments insertable on readable issues" ON public.issue_comments
    FOR INSERT TO authenticated
    WITH CHECK (
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

-- 7. Issue Events Policies (Strictly Append-Only via AFTER Trigger)
CREATE POLICY "Audit events viewable on readable issues" ON public.issue_events
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.issues WHERE id = issue_events.issue_id)
    );

-- Client browsers have NO INSERT, NO UPDATE, NO DELETE policy on issue_events.

-- 8. Issue AI Analysis Policies (Server-Side Only for Writing)
CREATE POLICY "AI analysis viewable on readable issues" ON public.issue_ai_analysis
    FOR SELECT TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.issues WHERE id = issue_ai_analysis.issue_id)
    );

-- Client browsers have NO INSERT/UPDATE policy on issue_ai_analysis.

-- ============================================================================
-- BOOTSTRAP INITIAL DUAL-ROLE ADMIN INSTRUCTIONS (RUN VIA SQL EDITOR ONLY)
-- ============================================================================
-- 1. Invite your email via Supabase Auth Dashboard (Invite user).
-- 2. Once accepted, retrieve your user UUID from auth.users.
-- 3. Run in Supabase SQL Editor:
--
-- INSERT INTO public.user_roles (user_id, role, branch_id)
-- VALUES 
--   ('<TARGET_USER_UUID>', 'STORE_LEADER', 'AYUTTHAYA_CITY_PARK'),
--   ('<TARGET_USER_UUID>', 'SYSTEM_ADMIN', NULL)
-- ON CONFLICT DO NOTHING;
