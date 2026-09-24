-- ============================================================================
-- Migration: Harden Execute Privileges on Stock Batch RPC Functions
-- Description: Revokes EXECUTE from PUBLIC, anon, and authenticated.
--              Grants EXECUTE strictly to service_role.
-- ============================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.activate_stock_batch(TEXT, UUID, UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.activate_stock_batch(TEXT, UUID, UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.activate_stock_batch(TEXT, UUID, UUID, UUID) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.activate_stock_batch(TEXT, UUID, UUID, UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.rollback_stock_batch(TEXT, UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rollback_stock_batch(TEXT, UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rollback_stock_batch(TEXT, UUID, UUID) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.rollback_stock_batch(TEXT, UUID, UUID) TO service_role;

COMMIT;
