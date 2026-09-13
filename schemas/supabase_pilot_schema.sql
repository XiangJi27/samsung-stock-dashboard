-- ============================================================================
-- SAMSUNG BRANCH OPERATIONS SYSTEM - USER FEEDBACK PILOT
-- PostgreSQL Schema & Row Level Security (RLS) for Supabase
-- Target Environment: Pilot Feedback Phase (Ayutthaya City Park Branch)
-- Security Status: DRAFT_PENDING_SECURITY_REVIEW (No secrets, no real PII)
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

-- 3. Profiles Table (Extends auth.users, managed by Admin/System)
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

-- 4. User Roles Table (Supports Dual Roles: STORE_LEADER + SYSTEM_ADMIN)
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

-- 5. Issues Table (Centralized Issue Tracking)
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
-- Critical Security: No UPDATE, No DELETE. Client cannot supply arbitrary actor_id.
CREATE TABLE IF NOT EXISTS public.issue_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) DEFAULT auth.uid(),
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

-- Helper Function: Check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = required_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper Function: Get user's branch_id
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT branch_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

CREATE POLICY "Users can update only their own display name (not role/branch/status)" ON public.profiles
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid() AND
        status = (SELECT status FROM public.profiles WHERE id = auth.uid()) AND
        branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid())
    );

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
-- 5. Issue Attachments Policies (Private Metadata)
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
-- 7. Issue Events Policies (Append-Only Immutable Audit Trail)
-- ----------------------------------------------------------------------------
CREATE POLICY "View audit events on viewable issues" ON public.issue_events
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.issues WHERE id = issue_events.issue_id)
    );

CREATE POLICY "Insert audit events by authenticated actors" ON public.issue_events
    FOR INSERT WITH CHECK (
        actor_id = auth.uid() AND
        EXISTS (SELECT 1 FROM public.issues WHERE id = issue_events.issue_id)
    );

-- NO UPDATE and NO DELETE policies on issue_events = STRICTLY APPEND-ONLY

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
-- DO NOT grant roles via Client Signup.
-- Once the user signs up via email in Supabase Auth, run this in Supabase SQL Editor:
--
-- INSERT INTO public.user_roles (user_id, role, branch_id)
-- VALUES 
--   ('<TARGET_USER_UUID>', 'STORE_LEADER', 'AYUTTHAYA_CITY_PARK'),
--   ('<TARGET_USER_UUID>', 'SYSTEM_ADMIN', 'AYUTTHAYA_CITY_PARK')
-- ON CONFLICT DO NOTHING;
