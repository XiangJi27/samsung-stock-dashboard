-- ============================================================================
-- SQL Verification Script: Promotion Engine Schema & Constraint Auditing
-- Run these queries sequentially in Supabase SQL Editor after applying
-- 20260917_promotion_engine_tables.sql
-- ============================================================================

-- 1. Check All 9 Promotion Engine Tables
select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'promotion_import_batches',
    'promotion_campaigns',
    'promotion_offers',
    'promotion_conditions',
    'promotion_stacking_rules',
    'promotion_calculations',
    'promotion_validation_errors',
    'promotion_correction_rules',
    'promotion_audit_logs'
  )
order by table_name;
-- Expected: 9 rows

-- 2. Check RPCs (Both activate and rollback)
select
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'activate_promotion_campaign',
    'rollback_promotion_campaign'
  )
order by routine_name;
-- Expected: 2 rows (activate_promotion_campaign, rollback_promotion_campaign)

-- 3. Check Constraints
select
  c.conrelid::regclass as table_name,
  c.conname as constraint_name,
  c.contype as constraint_type
from pg_constraint c
where c.connamespace = 'public'::regnamespace
  and c.conrelid::regclass::text like 'promotion_%'
order by
  table_name,
  constraint_name;
-- Must verify:
-- regular_price > 0
-- discount_amount >= 0
-- discount_percent ระหว่าง 0 ถึง 100
-- discount_amount <= regular_price
-- start_at <= end_at
-- Studentcrd เป็น Exclusive (student_offer_configuration)
-- Trade Up ต้อง requires_trade_in = true (trade_up_configuration)
-- Mutually Exclusive ต้องมี exclusive_group (exclusive_group_required)
-- Net Price ต้องตรงสมการ (calculation_equation_check)

-- 4. Check Active Stock Snapshot Pointer for Branch
select
  a.branch_code,
  a.active_batch_id,
  b.status,
  b.total_rows,
  b.f1_total,
  b.f2_total,
  b.source_file_name,
  b.activated_at
from public.active_stock_snapshot a
join public.stock_import_batches b
  on b.id = a.active_batch_id
where a.branch_code = 'AYUTTHAYA_CITY_PARK';

