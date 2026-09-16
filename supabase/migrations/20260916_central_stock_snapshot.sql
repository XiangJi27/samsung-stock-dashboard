-- ============================================================================
-- SAMSUNG BRANCH OPERATIONS SYSTEM - CENTRALIZED STOCK SNAPSHOT ARCHITECTURE
-- Migration: 20260916_central_stock_snapshot.sql
-- Purpose: Immutable Snapshot Batches, Active Pointer, and Atomic Activation
-- Target Environment: Supabase PostgreSQL
-- ============================================================================

-- 1. Table: stock_import_batches
-- Stores immutable metadata and reconciliation totals for every upload attempt.
CREATE TABLE IF NOT EXISTS public.stock_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_code TEXT NOT NULL REFERENCES public.branches(id) ON UPDATE CASCADE,
    source_type TEXT NOT NULL DEFAULT 'NIMBUS_EXCEL',
    source_file_name TEXT NOT NULL,
    source_file_sha256 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN (
            'VALIDATING',
            'DRAFT',
            'ACTIVE',
            'SUPERSEDED',
            'REJECTED',
            'FAILED'
        )
    ),
    total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
    f1_total INTEGER NOT NULL DEFAULT 0 CHECK (f1_total >= 0),
    f2_total INTEGER NOT NULL DEFAULT 0 CHECK (f2_total >= 0),
    imported_by UUID NOT NULL REFERENCES auth.users(id),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    activated_at TIMESTAMPTZ,
    validation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    previous_batch_id UUID REFERENCES public.stock_import_batches(id),
    CONSTRAINT uq_branch_source_file_hash UNIQUE (branch_code, source_file_sha256)
);

-- 2. Table: stock_snapshot_items
-- Stores individual product lines for a given batch. Immutable per batch.
CREATE TABLE IF NOT EXISTS public.stock_snapshot_items (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    batch_id UUID NOT NULL REFERENCES public.stock_import_batches(id) ON DELETE CASCADE,
    branch_code TEXT NOT NULL REFERENCES public.branches(id) ON UPDATE CASCADE,
    inventory_pn TEXT NOT NULL,
    barcode TEXT,
    description TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    cat1 TEXT,
    cat2 TEXT,
    cat3 TEXT,
    color TEXT,
    erp_rrp NUMERIC(12, 2) CHECK (erp_rrp IS NULL OR erp_rrp >= 0),
    f1 INTEGER NOT NULL DEFAULT 0 CHECK (f1 >= 0),
    f2 INTEGER NOT NULL DEFAULT 0 CHECK (f2 >= 0),
    total INTEGER GENERATED ALWAYS AS (f1 + f2) STORED,
    source_rows JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    CONSTRAINT uq_stock_item_batch_pn UNIQUE (batch_id, inventory_pn)
);

-- 3. Table: active_stock_snapshot
-- Stores the active pointer per branch. Points to exactly one active batch.
CREATE TABLE IF NOT EXISTS public.active_stock_snapshot (
    branch_code TEXT PRIMARY KEY REFERENCES public.branches(id) ON UPDATE CASCADE,
    active_batch_id UUID NOT NULL REFERENCES public.stock_import_batches(id),
    updated_by UUID NOT NULL REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. Indexes for High-Performance Reads & Batch Lookups
CREATE INDEX IF NOT EXISTS stock_items_batch_pn_idx
    ON public.stock_snapshot_items (batch_id, inventory_pn);

CREATE INDEX IF NOT EXISTS stock_items_batch_branch_idx
    ON public.stock_snapshot_items (branch_code, batch_id);

CREATE INDEX IF NOT EXISTS stock_batches_branch_status_idx
    ON public.stock_import_batches (branch_code, status, imported_at DESC);

-- 5. Stored Procedure: Atomic Batch Activation
-- Enforces optimistic concurrency check (EXPECTED_BATCH_MISMATCH) and atomically
-- updates current ACTIVE batch to SUPERSEDED, sets active pointer, and activates new batch.
CREATE OR REPLACE FUNCTION public.activate_stock_batch(
    p_branch_code TEXT,
    p_batch_id UUID,
    p_expected_previous_batch_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_batch_id UUID;
    v_batch_status TEXT;
    v_batch_branch TEXT;
    v_result JSONB;
BEGIN
    -- 1. Lock the active snapshot pointer row for this branch to serialize activations
    SELECT active_batch_id
    INTO v_current_batch_id
    FROM public.active_stock_snapshot
    WHERE branch_code = p_branch_code
    FOR UPDATE;

    -- 2. Verify optimistic concurrency lock
    IF p_expected_previous_batch_id IS NOT NULL AND v_current_batch_id IS DISTINCT FROM p_expected_previous_batch_id THEN
        RAISE EXCEPTION 'EXPECTED_BATCH_MISMATCH: Current active batch is %, expected %',
            COALESCE(v_current_batch_id::TEXT, 'NONE'),
            p_expected_previous_batch_id::TEXT;
    END IF;

    -- 3. Verify target batch exists, belongs to branch, and is currently in DRAFT status
    SELECT status, branch_code
    INTO v_batch_status, v_batch_branch
    FROM public.stock_import_batches
    WHERE id = p_batch_id
    FOR UPDATE;

    IF v_batch_status IS NULL THEN
        RAISE EXCEPTION 'BATCH_NOT_FOUND: %', p_batch_id;
    END IF;

    IF v_batch_branch <> p_branch_code THEN
        RAISE EXCEPTION 'BRANCH_MISMATCH: Batch belongs to %, requested %', v_batch_branch, p_branch_code;
    END IF;

    IF v_batch_status <> 'DRAFT' THEN
        RAISE EXCEPTION 'INVALID_BATCH_STATUS: Expected DRAFT, found %', v_batch_status;
    END IF;

    -- 4. Mark existing active batch as SUPERSEDED (if one exists)
    IF v_current_batch_id IS NOT NULL THEN
        UPDATE public.stock_import_batches
        SET status = 'SUPERSEDED'
        WHERE id = v_current_batch_id
          AND status = 'ACTIVE';
    END IF;

    -- 5. Upsert active snapshot pointer
    INSERT INTO public.active_stock_snapshot (
        branch_code,
        active_batch_id,
        updated_by,
        updated_at
    )
    VALUES (
        p_branch_code,
        p_batch_id,
        p_user_id,
        TIMEZONE('utc'::text, NOW())
    )
    ON CONFLICT (branch_code)
    DO UPDATE SET
        active_batch_id = EXCLUDED.active_batch_id,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at;

    -- 6. Update target batch to ACTIVE
    UPDATE public.stock_import_batches
    SET
        status = 'ACTIVE',
        activated_at = TIMEZONE('utc'::text, NOW()),
        previous_batch_id = v_current_batch_id
    WHERE id = p_batch_id;

    v_result := jsonb_build_object(
        'status', 'ACTIVE',
        'batchId', p_batch_id,
        'branchCode', p_branch_code,
        'previousBatchId', v_current_batch_id,
        'activatedAt', TIMEZONE('utc'::text, NOW())
    );

    RETURN v_result;
END;
$$;

-- 6. Stored Procedure: Batch Rollback
-- Rolls back to a previous batch without deleting data.
CREATE OR REPLACE FUNCTION public.rollback_stock_batch(
    p_branch_code TEXT,
    p_target_batch_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_batch_id UUID;
    v_target_status TEXT;
    v_target_branch TEXT;
    v_result JSONB;
BEGIN
    SELECT active_batch_id
    INTO v_current_batch_id
    FROM public.active_stock_snapshot
    WHERE branch_code = p_branch_code
    FOR UPDATE;

    SELECT status, branch_code
    INTO v_target_status, v_target_branch
    FROM public.stock_import_batches
    WHERE id = p_target_batch_id
    FOR UPDATE;

    IF v_target_status IS NULL THEN
        RAISE EXCEPTION 'TARGET_BATCH_NOT_FOUND: %', p_target_batch_id;
    END IF;

    IF v_target_branch <> p_branch_code THEN
        RAISE EXCEPTION 'BRANCH_MISMATCH: Target belongs to %, requested %', v_target_branch, p_branch_code;
    END IF;

    -- Supersede current active batch
    IF v_current_batch_id IS NOT NULL AND v_current_batch_id <> p_target_batch_id THEN
        UPDATE public.stock_import_batches
        SET status = 'SUPERSEDED'
        WHERE id = v_current_batch_id;
    END IF;

    -- Re-activate target batch
    UPDATE public.stock_import_batches
    SET status = 'ACTIVE',
        activated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_target_batch_id;

    -- Update active pointer
    UPDATE public.active_stock_snapshot
    SET active_batch_id = p_target_batch_id,
        updated_by = p_user_id,
        updated_at = TIMEZONE('utc'::text, NOW())
    WHERE branch_code = p_branch_code;

    v_result := jsonb_build_object(
        'status', 'ROLLED_BACK',
        'activeBatchId', p_target_batch_id,
        'supersededBatchId', v_current_batch_id,
        'branchCode', p_branch_code
    );

    RETURN v_result;
END;
$$;

-- 7. Row Level Security (RLS) Configuration
ALTER TABLE public.stock_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_snapshot_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_stock_snapshot ENABLE ROW LEVEL SECURITY;

-- Helper security function check
CREATE OR REPLACE FUNCTION public.is_branch_leader_or_admin(user_id UUID, p_branch_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_roles.user_id = $1
          AND user_roles.role IN ('STORE_LEADER', 'STORE_MANAGER', 'SYSTEM_ADMIN')
          AND (user_roles.branch_id = $2 OR user_roles.branch_id IS NULL)
    );
$$;

-- 8. Policies for active_stock_snapshot
DROP POLICY IF EXISTS "Anyone in branch can view active snapshot pointer" ON public.active_stock_snapshot;
CREATE POLICY "Anyone in branch can view active snapshot pointer"
    ON public.active_stock_snapshot
    FOR SELECT
    TO authenticated
    USING (true);

-- 9. Policies for stock_import_batches
DROP POLICY IF EXISTS "Staff can view active batch of their branch" ON public.stock_import_batches;
CREATE POLICY "Staff can view active batch of their branch"
    ON public.stock_import_batches
    FOR SELECT
    TO authenticated
    USING (
        status = 'ACTIVE'
        OR public.is_branch_leader_or_admin(auth.uid(), branch_code)
    );

-- 10. Policies for stock_snapshot_items
DROP POLICY IF EXISTS "Staff can view items of active stock batch" ON public.stock_snapshot_items;
CREATE POLICY "Staff can view items of active stock batch"
    ON public.stock_snapshot_items
    FOR SELECT
    TO authenticated
    USING (
        batch_id IN (
            SELECT active_batch_id
            FROM public.active_stock_snapshot
            WHERE branch_code = stock_snapshot_items.branch_code
        )
        OR public.is_branch_leader_or_admin(auth.uid(), branch_code)
    );

-- 11. Least-Privilege Grants (Server-Mediated Ingestion Architecture)
-- Client/Authenticated users can only READ active stock data (enforced by RLS)
REVOKE INSERT, UPDATE, DELETE ON TABLE public.stock_import_batches FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.stock_snapshot_items FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.active_stock_snapshot FROM authenticated;

GRANT SELECT ON TABLE public.stock_import_batches TO authenticated;
GRANT SELECT ON TABLE public.stock_snapshot_items TO authenticated;
GRANT SELECT ON TABLE public.active_stock_snapshot TO authenticated;

-- Direct batch activation & rollback restricted to service_role (Server API only)
REVOKE EXECUTE ON FUNCTION public.activate_stock_batch(TEXT, UUID, UUID, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.rollback_stock_batch(TEXT, UUID, UUID) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.activate_stock_batch(TEXT, UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.rollback_stock_batch(TEXT, UUID, UUID) TO service_role;

-- Full service_role permissions for backend API
GRANT ALL ON TABLE public.stock_import_batches TO postgres, service_role;
GRANT ALL ON TABLE public.stock_snapshot_items TO postgres, service_role;
GRANT ALL ON TABLE public.active_stock_snapshot TO postgres, service_role;

-- Comments on architecture & invariants
COMMENT ON TABLE public.stock_import_batches IS 'Immutable stock import records per Excel upload with source file hash check';
COMMENT ON TABLE public.stock_snapshot_items IS 'Detailed product inventory rows bound to an immutable batch';
COMMENT ON TABLE public.active_stock_snapshot IS 'Branch active batch pointer for atomic switching and rollbacks';

