-- ============================================================================
-- SAMSUNG BRANCH OPERATIONS - PROMOTION DRAFT DATABASE VERIFICATION SUITE
-- Comprehensive 19-Query Verification Suite for Supabase SQL Editor / psql
--
-- Instructions:
-- 1. Replace 'BATCH_UUID' with the actual Batch ID shown on the banner
-- 2. Replace 'CAMPAIGN_UUID' with the actual Campaign ID shown on the banner
-- ============================================================================

-- ============================================================================
-- 1. CHECK RPC EXISTENCE & LEAST-PRIVILEGE SECURITY
-- ============================================================================
-- 1.1 Verify create_promotion_draft_batch function exists
select
  routine_schema,
  routine_name,
  routine_type,
  data_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'create_promotion_draft_batch';
-- Expected: 1 row | routine_type = FUNCTION

-- 1.2 Verify RPC Execution Privileges (Only postgres and service_role allowed)
select
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name = 'create_promotion_draft_batch'
order by grantee;

-- 1.3 Strict Security Gate: Must return 0 rows for open public privileges
select
  grantee,
  privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name = 'create_promotion_draft_batch'
  and grantee in ('anon', 'authenticated', 'public');
-- Expected: 0 rows

-- ============================================================================
-- 2. CHECK IMPORT BATCH
-- ============================================================================
-- 2.1 Verify Batch Metadata
select
  id,
  branch_code,
  source_file_name,
  source_file_sha256,
  status,
  total_rows,
  passed_rows,
  warning_rows,
  blocked_rows,
  validation_summary,
  imported_by,
  imported_at,
  approved_by,
  approved_at,
  activated_at
from public.promotion_import_batches
where id = 'BATCH_UUID'::uuid;
-- Expected: status = 'DRAFT', approved_by = null, activated_at = null

-- 2.2 Verify Row Count Integrity Equation
select
  id,
  total_rows,
  passed_rows,
  warning_rows,
  blocked_rows,
  passed_rows + warning_rows + blocked_rows as categorized_rows,
  case
    when passed_rows + warning_rows + blocked_rows <= total_rows
    then 'PASS'
    else 'FAIL'
  end as row_count_gate
from public.promotion_import_batches
where id = 'BATCH_UUID'::uuid;
-- Expected: row_count_gate = PASS

-- ============================================================================
-- 3. CHECK CAMPAIGN RELATIONSHIP & METADATA
-- ============================================================================
-- 3.1 Verify Campaign Record
select
  id,
  import_batch_id,
  branch_code,
  campaign_code,
  campaign_name,
  start_at,
  end_at,
  timezone,
  priority,
  status,
  created_by,
  created_at,
  approved_by,
  approved_at
from public.promotion_campaigns
where id = 'CAMPAIGN_UUID'::uuid;
-- Expected: status = 'DRAFT', approved_by = null

-- 3.2 Verify Campaign & Batch Provenance Link
select
  c.id as campaign_id,
  c.import_batch_id,
  b.id as batch_id,
  c.branch_code as campaign_branch,
  b.branch_code as batch_branch,
  c.status as campaign_status,
  b.status as batch_status,
  case
    when c.import_batch_id = b.id
     and c.branch_code = b.branch_code
    then 'PASS'
    else 'FAIL'
  end as relationship_gate
from public.promotion_campaigns c
join public.promotion_import_batches b
  on b.id = c.import_batch_id
where c.id = 'CAMPAIGN_UUID'::uuid;
-- Expected: relationship_gate = PASS, campaign_status = 'DRAFT', batch_status = 'DRAFT'

-- ============================================================================
-- 4. CHECK PROMOTION OFFERS SAMPLE & STATUS
-- ============================================================================
select
  id,
  inventory_pn,
  model_name,
  capacity,
  offer_code,
  promotion_type,
  coupon_code,
  regular_price,
  discount_type,
  discount_amount,
  discount_percent,
  payment_condition,
  customer_segment,
  requires_trade_in,
  down_payment_max_percent,
  estimated_down_payment,
  stacking_policy,
  exclusive_group,
  blocks_all_other_promotions,
  priority,
  status,
  source_sheet,
  source_row
from public.promotion_offers
where campaign_id = 'CAMPAIGN_UUID'::uuid
order by
  model_name,
  capacity,
  inventory_pn,
  priority
limit 20;
-- Expected: All rows have status = 'DRAFT'

-- ============================================================================
-- 5. RECONCILE THREE-DIMENSIONAL COUNTS
-- ============================================================================
select
  count(*) as database_offer_records,
  count(distinct inventory_pn) as confirmed_target_pns,
  count(distinct source_row) as represented_source_rows,
  count(distinct promotion_type) as promotion_type_count
from public.promotion_offers
where campaign_id = 'CAMPAIGN_UUID'::uuid;
-- Expected: Matches Database Preview (e.g. 84 - 100 offers, 57 - 71 P/Ns, 25 - 31 source rows)

-- ============================================================================
-- 6. MULTI-OFFER PER TARGET P/N AUDIT
-- ============================================================================
select
  inventory_pn,
  model_name,
  capacity,
  count(*) as offer_count,
  array_agg(promotion_type order by priority) as promotion_types,
  array_agg(coalesce(coupon_code, 'NO_COUPON') order by priority) as coupon_codes
from public.promotion_offers
where campaign_id = 'CAMPAIGN_UUID'::uuid
group by
  inventory_pn,
  model_name,
  capacity
order by
  model_name,
  capacity,
  inventory_pn;

-- ============================================================================
-- 7. FIXED AMOUNT DISCOUNT MATHEMATICAL SANITY
-- ============================================================================
select
  inventory_pn,
  model_name,
  capacity,
  promotion_type,
  regular_price,
  discount_amount,
  regular_price - discount_amount as calculated_net_price,
  case
    when regular_price > 0
     and discount_amount >= 0
     and discount_amount <= regular_price
    then 'PASS'
    else 'FAIL'
  end as amount_discount_gate
from public.promotion_offers
where campaign_id = 'CAMPAIGN_UUID'::uuid
  and discount_type = 'FIXED_AMOUNT'
order by model_name, capacity, promotion_type;

-- Check for invalid discount rows (Must be 0 rows)
select
  inventory_pn,
  model_name,
  capacity,
  promotion_type,
  regular_price,
  discount_amount
from public.promotion_offers
where campaign_id = 'CAMPAIGN_UUID'::uuid
  and (
       regular_price <= 0
    or discount_amount < 0
    or discount_amount > regular_price
  );
-- Expected: 0 rows

-- ============================================================================
-- 8. STUDENT EXCLUSIVE DISCOUNT AUDITING (Studentcrd)
-- ============================================================================
select
  inventory_pn,
  model_name,
  capacity,
  coupon_code,
  regular_price,
  discount_percent,
  round(regular_price * discount_percent / 100, 2) as calculated_discount,
  regular_price - round(regular_price * discount_percent / 100, 2) as calculated_net_price,
  customer_segment,
  requires_trade_in,
  stacking_policy,
  blocks_all_other_promotions
from public.promotion_offers
where campaign_id = 'CAMPAIGN_UUID'::uuid
  and promotion_type = 'STUDENT_EXCLUSIVE'
order by model_name, capacity;

-- Check for violations in student promotions (Must be 0 rows)
select
  inventory_pn,
  model_name,
  capacity,
  coupon_code,
  discount_type,
  discount_amount,
  discount_percent,
  customer_segment,
  requires_trade_in,
  stacking_policy,
  blocks_all_other_promotions
from public.promotion_offers
where campaign_id = 'CAMPAIGN_UUID'::uuid
  and promotion_type = 'STUDENT_EXCLUSIVE'
  and (
       coupon_code is distinct from 'Studentcrd'
    or discount_type <> 'PERCENT'
    or discount_percent <> 15
    or discount_amount <> 0
    or customer_segment <> 'STUDENT'
    or requires_trade_in <> false
    or stacking_policy <> 'EXCLUSIVE'
    or blocks_all_other_promotions <> true
  );
-- Expected: 0 rows

-- ============================================================================
-- 9. TRADE UP MANDATORY FLAG AUDITING
-- ============================================================================
select
  inventory_pn,
  model_name,
  capacity,
  promotion_type,
  requires_trade_in
from public.promotion_offers
where campaign_id = 'CAMPAIGN_UUID'::uuid
  and promotion_type in ('TRADE_UP_CONDITIONAL', 'TRADE_UP_ONLY')
  and requires_trade_in <> true;
-- Expected: 0 rows

-- ============================================================================
-- 10. FINANCING (SF+ / NON-SF+) MUTUAL EXCLUSIVITY AUDITING
-- ============================================================================
select
  inventory_pn,
  model_name,
  capacity,
  promotion_type,
  payment_condition,
  stacking_policy,
  exclusive_group
from public.promotion_offers
where campaign_id = 'CAMPAIGN_UUID'::uuid
  and (
       (promotion_type = 'SF_PLUS_FINANCING' and payment_condition <> 'SF_PLUS')
    or (promotion_type = 'NON_SF_PLUS_DISCOUNT' and payment_condition <> 'NON_SF_PLUS')
    or (stacking_policy = 'MUTUALLY_EXCLUSIVE' and nullif(trim(exclusive_group), '') is null)
  );
-- Expected: 0 rows

-- ============================================================================
-- 11. DOWN-PAYMENT LEAKAGE AUDIT (Must NOT be recorded as discount)
-- ============================================================================
select
  inventory_pn,
  model_name,
  capacity,
  discount_amount,
  estimated_down_payment
from public.promotion_offers
where campaign_id = 'CAMPAIGN_UUID'::uuid
  and promotion_type = 'SF_PLUS_FINANCING'
  and estimated_down_payment is not null
  and discount_amount = estimated_down_payment;
-- Expected: 0 rows

-- ============================================================================
-- 12. ACCESSORY P/N LEAKAGE AUDIT (Hard Guard: EF-, GP-, EP-, EE-, ITFIT)
-- ============================================================================
select
  id,
  inventory_pn,
  model_name,
  capacity,
  promotion_type,
  source_row
from public.promotion_offers
where campaign_id = 'CAMPAIGN_UUID'::uuid
  and (
       upper(inventory_pn) like 'EF-%'
    or upper(inventory_pn) like 'GP-%'
    or upper(inventory_pn) like 'EP-%'
    or upper(inventory_pn) like 'EE-%'
    or upper(inventory_pn) like 'ITFIT%'
  );
-- Expected: 0 rows

-- ============================================================================
-- 13. VALIDATION ERRORS & REVIEW/BLOCKED BREAKDOWN
-- ============================================================================
select
  severity,
  resolution_status,
  count(*) as error_count
from public.promotion_validation_errors
where import_batch_id = 'BATCH_UUID'::uuid
group by
  severity,
  resolution_status
order by
  severity,
  resolution_status;

-- ============================================================================
-- 14. GALAXY S26 ULTRA 1TB FAIL-CLOSED ISOLATION AUDIT
-- ============================================================================
-- Must NOT exist in promotion_offers
select
  inventory_pn,
  model_name,
  capacity,
  promotion_type,
  source_row
from public.promotion_offers
where campaign_id = 'CAMPAIGN_UUID'::uuid
  and lower(model_name) like '%s26 ultra%'
  and upper(replace(capacity, ' ', '')) = '1TB';
-- Expected: 0 rows

-- Must exist in promotion_validation_errors with PN_NOT_FOUND
select
  severity,
  error_code,
  source_row,
  message,
  resolution_status
from public.promotion_validation_errors
where import_batch_id = 'BATCH_UUID'::uuid
  and error_code = 'PN_NOT_FOUND'
  and lower(message) like '%s26 ultra%'
  and lower(message) like '%1tb%';
-- Expected: At least 1 row, severity = 'REVIEW_REQUIRED', resolution_status = 'OPEN'

-- ============================================================================
-- 15. AUDIT LOG VERIFICATION (CREATE_DRAFT_BATCH Present, No Activate)
-- ============================================================================
select
  action,
  campaign_id,
  offer_id,
  previous_value,
  new_value,
  performed_by,
  performed_at,
  reason
from public.promotion_audit_logs
where campaign_id = 'CAMPAIGN_UUID'::uuid
order by performed_at;
-- Expected: Action includes 'CREATE_DRAFT_BATCH'; does NOT include 'APPROVE' or 'ACTIVATE'

-- ============================================================================
-- 16. ZERO ORPHAN RECORDS AUDIT
-- ============================================================================
-- 16.1 Campaign without Batch
select c.id, c.campaign_code
from public.promotion_campaigns c
left join public.promotion_import_batches b on b.id = c.import_batch_id
where c.id = 'CAMPAIGN_UUID'::uuid and b.id is null;
-- Expected: 0 rows

-- 16.2 Offer without Campaign
select o.id, o.inventory_pn, o.offer_code
from public.promotion_offers o
left join public.promotion_campaigns c on c.id = o.campaign_id
where o.campaign_id = 'CAMPAIGN_UUID'::uuid and c.id is null;
-- Expected: 0 rows

-- 16.3 Error without Batch
select e.id, e.error_code
from public.promotion_validation_errors e
left join public.promotion_import_batches b on b.id = e.import_batch_id
where e.import_batch_id = 'BATCH_UUID'::uuid and b.id is null;
-- Expected: 0 rows

-- ============================================================================
-- 17. PRESERVATION OF EXISTING ACTIVE PROMOTIONS
-- ============================================================================
select id, campaign_code, status, created_at
from public.promotion_campaigns
where branch_code = 'AYUTTHAYA_CITY_PARK' and status = 'ACTIVE'
order by created_at desc;
-- Expected: Active campaign remains untouched; new campaign is status = 'DRAFT'

-- ============================================================================
-- 18. ZERO STOCK MUTATION INVARIANT
-- ============================================================================
select
  a.branch_code,
  a.active_batch_id,
  b.total_rows,
  b.f1_total,
  b.f2_total,
  b.f1_total + b.f2_total as total_quantity
from public.active_stock_snapshot a
join public.stock_import_batches b on b.id = a.active_batch_id
where a.branch_code = 'AYUTTHAYA_CITY_PARK';
-- Invariant: Must equal STOCK-20260914-LATEST (399 P/N | F1: 1,701 | F2: 1,635)

-- ============================================================================
-- 19. COMPOSITE CLOSING GATE QUERY (Single Evaluation Gate)
-- ============================================================================
with selected_batch as (
  select * from public.promotion_import_batches where id = 'BATCH_UUID'::uuid
),
selected_campaign as (
  select * from public.promotion_campaigns where id = 'CAMPAIGN_UUID'::uuid
),
offer_summary as (
  select
    count(*) as offer_records,
    count(distinct inventory_pn) as target_pns,
    count(distinct source_row) as source_rows
  from public.promotion_offers
  where campaign_id = 'CAMPAIGN_UUID'::uuid
),
error_summary as (
  select
    count(*) as total_errors,
    count(*) filter (where severity = 'BLOCKER' and resolution_status = 'OPEN') as open_blockers,
    count(*) filter (where severity = 'REVIEW_REQUIRED' and resolution_status = 'OPEN') as open_reviews,
    count(*) filter (where severity = 'WARNING') as warnings
  from public.promotion_validation_errors
  where import_batch_id = 'BATCH_UUID'::uuid
),
accessory_summary as (
  select count(*) as accessory_offer_count
  from public.promotion_offers
  where campaign_id = 'CAMPAIGN_UUID'::uuid
    and (
         upper(inventory_pn) like 'EF-%'
      or upper(inventory_pn) like 'GP-%'
      or upper(inventory_pn) like 'EP-%'
      or upper(inventory_pn) like 'EE-%'
      or upper(inventory_pn) like 'ITFIT%'
    )
)
select
  b.id as batch_id,
  b.status as batch_status,
  c.id as campaign_id,
  c.status as campaign_status,
  o.offer_records,
  o.target_pns,
  o.source_rows,
  e.total_errors,
  e.open_blockers,
  e.open_reviews,
  e.warnings,
  a.accessory_offer_count,
  case
    when b.status = 'DRAFT'
     and c.status = 'DRAFT'
     and a.accessory_offer_count = 0
     and o.offer_records > 0
    then 'DRAFT_SAVE_PASS'
    else 'DRAFT_SAVE_FAIL'
  end as draft_save_gate
from selected_batch b
join selected_campaign c on c.import_batch_id = b.id
cross join offer_summary o
cross join error_summary e
cross join accessory_summary a;
-- Expected: batch_status = 'DRAFT', campaign_status = 'DRAFT', accessory_offer_count = 0, draft_save_gate = 'DRAFT_SAVE_PASS'
