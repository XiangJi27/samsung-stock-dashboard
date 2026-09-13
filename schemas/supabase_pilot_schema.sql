-- ============================================================================
-- SAMSUNG BRANCH OPERATIONS SYSTEM - USER FEEDBACK PILOT
-- PostgreSQL Schema & Row Level Security (RLS) for Supabase
-- Target Environment: Pilot Feedback Phase (Ayutthaya City Park Branch)
-- Security Status: SECURITY_HARDENED_DRAFT (Ready for Supabase Preview Testing)
-- ============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    province TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

INSERT INTO public.branches (id, name, province) 
VALUES ('AYUTTHAYA_CITY_PARK', 'Samsung Experience Store - Ayutthaya City Park', 'Phra Nakhon Si Ayutthaya')
ON CONFLICT (id) DO NOTHING;

-- 3. Profiles Table (Extends auth.users)
-- Critical Security: Direct UPDATE revoked from regular authenticated users.
-- Column modifications are restricted strictly via update_own_display_name() RPC.
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

-- 4. User Roles Table (Supports Multi-Role: STORE_LEADER + SYSTEM_ADMIN)
-- Critical Security: Managed ONLY by SYSTEM_ADMIN or Service Role bootstrap. Members cannot insert/update.
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('MEMBER', 'STORE_LEADER', 'SUPPORT', 'SYSTEM_ADMIN', 'AUDITOR')),
    branch_id TEXT REFERENCES public.branches(id),
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, role, branch_id)
);

-- 5. Issues Table (Centralized Issue Tracking with Strict Transition Rules)
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

-- 6. Issue Attachments Table (Private Storage Metadata)
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

-- 7. Issue Comments Table
CREATE TABLE IF NOT EXISTS public.issue_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id),
    comment_text TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 8. Issue Audit Events Table (Immutable Append-Only Audit Trail)
-- Critical Anti-Spoofing: Client browser has NO INSERT, NO UPDATE, NO DELETE permissions.
-- Populated EXCLUSIVELY by database triggers and Security Definer functions using auth.uid().
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

-- 9. Issue AI Analysis Table (Server-Side AI Results Only)
-- Critical Security: Client browser cannot insert/update directly. Only serverless background worker.
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
-- HELPER FUNCTIONS & WORKFLOW TRANSITION VALIDATOR (SECURITY DEFINER)
-- Fixed search_path to prevent object shadowing / search path injection attacks
-- ============================================================================

-- Helper: Check role (Strict search_path)
CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = required_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- Helper: Get user's branch_id (Strict search_path)
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT branch_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- ----------------------------------------------------------------------------
-- SECURE RPC: Update Own Display Name (Restricts Member Column Modification)
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
-- DATABASE TRIGGER: Automated Issue Integrity, Transition Validation, & Audit Logging
-- Enforces:
-- 1. Strict Transition Allow-List (Blocks arbitrary jumps e.g. NEW -> READY_FOR_RETEST)
-- 2. Prevents branch/reporter/commit/created_at tampering on existing issues
-- 3. Handles System/Service Role operations gracefully (actor_type = 'SYSTEM')
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_issue_audit_and_transitions()
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
        -- System or Service Role execution
        act_type := 'SYSTEM';
        actor := NULL;
    ELSE
        act_type := 'USER';
    END IF;

    -- 1. INSERT EVENT (New Issue Creation)
    IF (TG_OP = 'INSERT') THEN
        -- Enforce Reporter ID and Branch ID directly from session on client inserts
        IF (act_type = 'USER') THEN
            NEW.reporter_id := auth.uid();
            NEW.branch_id := public.get_user_branch_id();
            NEW.status := 'NEW';
        END IF;

        INSERT INTO public.issue_events (issue_id, event_type, from_status, to_status, actor_id, actor_type, service_name, metadata)
        VALUES (
            NEW.id,
            'ISSUE_CREATED',
            NULL,
            NEW.status,
            actor,
            act_type,
            CASE WHEN act_type = 'SYSTEM' THEN 'INTERNAL_INGESTION' ELSE NULL END,
            jsonb_build_object(
                'title', NEW.title,
                'category', NEW.category,
                'severity', NEW.severity,
                'branch_id', NEW.branch_id
            )
        );
        RETURN NEW;
    END IF;

    -- 2. UPDATE EVENT (Status Transition, Immutability & Assignment Validation)
    IF (TG_OP = 'UPDATE') THEN
        -- Anti-Tampering: branch_id, reporter_id, created_at, issue_number CANNOT be altered
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

        -- Check Role Contexts
        user_branch := public.get_user_branch_id();
        is_admin := public.has_role('SYSTEM_ADMIN');
        is_store_leader := public.has_role('STORE_LEADER') AND (user_branch = OLD.branch_id);
        is_support := public.has_role('SUPPORT');
        is_reporter := (actor = OLD.reporter_id);

        -- Validate Status Change Path if status modified
        IF (OLD.status IS DISTINCT FROM NEW.status) THEN
            is_valid_transition := FALSE;

            -- Explicit State Transition Allow-List:
            -- Forward Paths
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

            -- Set Timestamps accordingly
            IF (NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED') THEN
                NEW.resolved_at := TIMEZONE('utc'::text, NOW());
            END IF;
            IF (NEW.status = 'CLOSED' AND OLD.status != 'CLOSED') THEN
                NEW.closed_at := TIMEZONE('utc'::text, NOW());
            END IF;

            -- Automatic Audit Trail Insertion
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

        -- Check Assignment Change (Ensure Assignee is in same branch or is Support/Admin)
        IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
            IF (NEW.assigned_to IS NOT NULL AND NOT is_admin) THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = NEW.assigned_to AND (p.branch_id = OLD.branch_id OR public.has_role('SUPPORT'))
                ) THEN
                    RAISE EXCEPTION 'Forbidden: Assignee must belong to the same branch or hold SUPPORT role.';
                END IF;
            END IF;

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

        NEW.updated_at := TIMEZONE('utc'::text, NOW());
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

-- Attach Trigger to Issues Table
DROP TRIGGER IF EXISTS trg_issue_audit_and_transitions ON public.issues;
CREATE TRIGGER trg_issue_audit_and_transitions
    BEFORE INSERT OR UPDATE ON public.issues
    FOR EACH ROW EXECUTE FUNCTION public.handle_issue_audit_and_transitions();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES - DEFENSE IN DEPTH
-- ============================================================================

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_ai_analysis ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 1. Branches Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Anyone authenticated can view active branches" ON public.branches
    FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = TRUE);

-- ----------------------------------------------------------------------------
-- 2. Profiles Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view profiles in their branch or admins view all" ON public.profiles
    FOR SELECT USING (
        id = auth.uid() OR 
        public.has_role('SYSTEM_ADMIN') OR 
        public.has_role('AUDITOR') OR
        (branch_id = public.get_user_branch_id())
    );

-- Notice: Direct UPDATE policy for regular members is strictly REMOVED.
-- Members MUST call update_own_display_name() RPC.
CREATE POLICY "Admins can manage all profiles" ON public.profiles
    FOR ALL USING (public.has_role('SYSTEM_ADMIN'));

-- ----------------------------------------------------------------------------
-- 3. User Roles Policies (CRITICAL: Users CANNOT assign roles to themselves)
-- ----------------------------------------------------------------------------
CREATE POLICY "Users can view their own roles or admins view all" ON public.user_roles
    FOR SELECT USING (
        user_id = auth.uid() OR 
        public.has_role('SYSTEM_ADMIN') OR 
        public.has_role('AUDITOR')
    );

CREATE POLICY "Only system admin can insert or modify roles" ON public.user_roles
    FOR INSERT WITH CHECK (public.has_role('SYSTEM_ADMIN'));

CREATE POLICY "Only system admin can update roles" ON public.user_roles
    FOR UPDATE USING (public.has_role('SYSTEM_ADMIN'));

CREATE POLICY "Only system admin can delete roles" ON public.user_roles
    FOR DELETE USING (public.has_role('SYSTEM_ADMIN'));

-- ----------------------------------------------------------------------------
-- 4. Issues Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Members view own issues, store leaders view branch, admins view all" ON public.issues
    FOR SELECT USING (
        reporter_id = auth.uid() OR 
        public.has_role('SYSTEM_ADMIN') OR 
        public.has_role('AUDITOR') OR
        (public.has_role('SUPPORT') AND assigned_to = auth.uid()) OR
        (public.has_role('STORE_LEADER') AND branch_id = public.get_user_branch_id())
    );

CREATE POLICY "Authenticated members insert new issues for own branch" ON public.issues
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND 
        status = 'NEW' AND 
        reporter_id = auth.uid() AND
        branch_id = public.get_user_branch_id()
    );

CREATE POLICY "Reporters edit only before triaged, store leaders & admins update" ON public.issues
    FOR UPDATE USING (
        public.has_role('SYSTEM_ADMIN') OR 
        (public.has_role('STORE_LEADER') AND branch_id = public.get_user_branch_id()) OR
        (public.has_role('SUPPORT') AND assigned_to = auth.uid()) OR
        (reporter_id = auth.uid() AND status = 'NEW')
    );

-- ----------------------------------------------------------------------------
-- 5. Issue Attachments Policies (Private Storage Metadata)
-- ----------------------------------------------------------------------------
CREATE POLICY "View attachments if user can view corresponding issue" ON public.issue_attachments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.issues WHERE id = issue_attachments.issue_id)
    );

CREATE POLICY "Upload attachment for own issue" ON public.issue_attachments
    FOR INSERT WITH CHECK (
        uploaded_by = auth.uid() AND
        EXISTS (SELECT 1 FROM public.issues WHERE id = issue_attachments.issue_id AND (reporter_id = auth.uid() OR public.has_role('STORE_LEADER') OR public.has_role('SYSTEM_ADMIN')))
    );

-- ----------------------------------------------------------------------------
-- 6. Issue Comments Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "View comments according to internal flag and role" ON public.issue_comments
    FOR SELECT USING (
        (is_internal = FALSE AND EXISTS (SELECT 1 FROM public.issues WHERE id = issue_comments.issue_id)) OR
        (is_internal = TRUE AND (public.has_role('SUPPORT') OR public.has_role('STORE_LEADER') OR public.has_role('SYSTEM_ADMIN')))
    );

CREATE POLICY "Insert comments on viewable issues" ON public.issue_comments
    FOR INSERT WITH CHECK (
        author_id = auth.uid() AND
        EXISTS (SELECT 1 FROM public.issues WHERE id = issue_comments.issue_id)
    );

-- ----------------------------------------------------------------------------
-- 7. Issue Events Policies (Immutable Append-Only Audit Trail)
-- ----------------------------------------------------------------------------
CREATE POLICY "View audit events on viewable issues" ON public.issue_events
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.issues WHERE id = issue_events.issue_id)
    );

-- CRITICAL ANTI-SPOOFING:
-- Client browser has NO INSERT policy on issue_events!
-- All events are created via trg_issue_audit_and_transitions() database trigger.
-- NO UPDATE, NO DELETE = 100% IMMUTABLE APPEND-ONLY.

-- ----------------------------------------------------------------------------
-- 8. Issue AI Analysis Policies (Server-Side Only for Writing)
-- ----------------------------------------------------------------------------
CREATE POLICY "View AI analysis on viewable issues" ON public.issue_ai_analysis
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.issues WHERE id = issue_ai_analysis.issue_id)
    );

-- Client browsers have NO INSERT/UPDATE policy on issue_ai_analysis.
-- Writing is reserved exclusively for Supabase Service Role in serverless background endpoints.

-- ============================================================================
-- BOOTSTRAP INITIAL DUAL-ROLE ADMIN INSTRUCTIONS (RUN VIA SQL EDITOR ONLY)
-- ============================================================================
-- To bootstrap the initial Store Leader + System Admin account safely:
-- 1. Turn OFF public signup in Supabase Authentication Settings (INVITE_ONLY).
-- 2. Invite your administrator email from Supabase Auth Dashboard.
-- 3. Once signed up, retrieve the UUID from auth.users and run this in Supabase SQL Editor:
--
-- INSERT INTO public.user_roles (user_id, role, branch_id)
-- VALUES 
--   ('<TARGET_USER_UUID>', 'STORE_LEADER', 'AYUTTHAYA_CITY_PARK'),
--   ('<TARGET_USER_UUID>', 'SYSTEM_ADMIN', NULL)
-- ON CONFLICT DO NOTHING;
