-- ============================================================================
-- Migration: 20260917_promotion_engine_tables.sql
-- Description: Enterprise Promotion Knowledge Base, Multi-tier Stacking Rules,
--              Validation Errors, and Fail-Closed Transactional Activation RPC.
-- ============================================================================

-- 1. PROMOTION IMPORT BATCHES
create table if not exists public.promotion_import_batches (
  id uuid primary key default gen_random_uuid(),
  branch_code text not null,
  source_file_name text not null,
  source_file_sha256 text not null,
  status text not null default 'VALIDATING'
    check (
      status in (
        'VALIDATING',
        'DRAFT',
        'REVIEW_REQUIRED',
        'READY_TO_APPROVE',
        'APPROVED',
        'ACTIVE',
        'SUPERSEDED',
        'REJECTED',
        'FAILED'
      )
    ),
  total_rows integer not null default 0
    check (total_rows >= 0),
  passed_rows integer not null default 0
    check (passed_rows >= 0),
  warning_rows integer not null default 0
    check (warning_rows >= 0),
  blocked_rows integer not null default 0
    check (blocked_rows >= 0),
  validation_summary jsonb not null default '{}'::jsonb,
  imported_by uuid not null,
  imported_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  activated_at timestamptz,

  unique (branch_code, source_file_sha256),
  constraint promotion_batch_row_totals_check
    check (passed_rows + warning_rows + blocked_rows <= total_rows)
);

-- 2. PROMOTION CAMPAIGNS
create table if not exists public.promotion_campaigns (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null
    references public.promotion_import_batches(id)
    on delete restrict,
  branch_code text not null,
  campaign_code text not null,
  campaign_name text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'Asia/Bangkok',
  status text not null default 'DRAFT'
    check (
      status in (
        'DRAFT',
        'REVIEW_REQUIRED',
        'APPROVED',
        'ACTIVE',
        'SUPERSEDED',
        'ROLLED_BACK',
        'EXPIRED',
        'REJECTED'
      )
    ),
  priority integer not null default 100,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,

  unique (branch_code, campaign_code),
  constraint promotion_campaign_dates_check check (start_at <= end_at),
  constraint promotion_campaign_priority_check check (priority between 1 and 1000)
);

-- 3. PROMOTION OFFERS
create table if not exists public.promotion_offers (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null
    references public.promotion_campaigns(id)
    on delete cascade,
  branch_code text not null,
  inventory_pn text not null,
  model_name text,
  capacity text,
  offer_code text not null,
  promotion_type text not null
    check (
      promotion_type in (
        'STANDARD_DISCOUNT',
        'TRADE_UP_CONDITIONAL',
        'TRADE_UP_ONLY',
        'SF_PLUS_FINANCING',
        'NON_SF_PLUS_DISCOUNT',
        'STUDENT_EXCLUSIVE'
      )
    ),
  coupon_code text,
  regular_price numeric(12, 2) not null check (regular_price > 0),
  discount_type text not null
    check (discount_type in ('NONE', 'FIXED_AMOUNT', 'PERCENT')),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  discount_percent numeric(5, 2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  payment_condition text not null default 'ANY'
    check (payment_condition in ('ANY', 'SF_PLUS', 'NON_SF_PLUS')),
  customer_segment text not null default 'GENERAL'
    check (customer_segment in ('GENERAL', 'STUDENT')),
  requires_trade_in boolean not null default false,
  down_payment_max_percent numeric(5, 2)
    check (down_payment_max_percent is null or (down_payment_max_percent >= 0 and down_payment_max_percent <= 100)),
  estimated_down_payment numeric(12, 2)
    check (estimated_down_payment is null or estimated_down_payment >= 0),
  stacking_policy text not null
    check (
      stacking_policy in (
        'STACKABLE',
        'STACKABLE_CONDITIONAL',
        'MUTUALLY_EXCLUSIVE',
        'EXCLUSIVE'
      )
    ),
  exclusive_group text,
  blocks_all_other_promotions boolean not null default false,
  priority integer not null default 100,
  status text not null default 'DRAFT'
    check (
      status in (
        'DRAFT',
        'REVIEW_REQUIRED',
        'READY_TO_APPROVE',
        'APPROVED',
        'ACTIVE',
        'SUPERSEDED',
        'ROLLED_BACK',
        'EXPIRED',
        'REJECTED',
        'BLOCKED'
      )
    ),
  source_sheet text,
  source_row integer,
  source_cell_range text,
  source_text text,
  created_at timestamptz not null default now(),

  unique (campaign_id, inventory_pn, offer_code),
  constraint discount_amount_not_above_price check (discount_amount <= regular_price),
  constraint fixed_discount_configuration
    check (discount_type <> 'FIXED_AMOUNT' or (discount_amount > 0 and discount_percent = 0)),
  constraint percent_discount_configuration
    check (discount_type <> 'PERCENT' or (discount_percent > 0 and discount_amount = 0)),
  constraint student_offer_configuration
    check (
      promotion_type <> 'STUDENT_EXCLUSIVE'
      or (
        customer_segment = 'STUDENT'
        and coupon_code = 'Studentcrd'
        and discount_type = 'PERCENT'
        and discount_percent = 15
        and requires_trade_in = false
        and stacking_policy = 'EXCLUSIVE'
        and blocks_all_other_promotions = true
      )
    ),
  constraint trade_up_configuration
    check (promotion_type not in ('TRADE_UP_CONDITIONAL', 'TRADE_UP_ONLY') or requires_trade_in = true),
  constraint sf_plus_configuration
    check (promotion_type <> 'SF_PLUS_FINANCING' or payment_condition = 'SF_PLUS'),
  constraint non_sf_plus_configuration
    check (promotion_type <> 'NON_SF_PLUS_DISCOUNT' or payment_condition = 'NON_SF_PLUS'),
  constraint exclusive_group_required
    check (stacking_policy <> 'MUTUALLY_EXCLUSIVE' or exclusive_group is not null)
);

-- 4. PROMOTION CONDITIONS (Extensible JSONB Predicates)
create table if not exists public.promotion_conditions (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null
    references public.promotion_offers(id)
    on delete cascade,
  condition_type text not null
    check (
      condition_type in (
        'PAYMENT_METHOD',
        'CUSTOMER_SEGMENT',
        'TRADE_IN_REQUIRED',
        'CAPACITY',
        'MODEL',
        'COUPON_REQUIRED',
        'DOWN_PAYMENT_LIMIT',
        'STUDENT_PROOF_REQUIRED',
        'CUSTOM'
      )
    ),
  operator text not null
    check (
      operator in (
        'EQUALS',
        'NOT_EQUALS',
        'IN',
        'NOT_IN',
        'MAX',
        'MIN',
        'REQUIRED'
      )
    ),
  condition_value jsonb not null,
  display_text text not null,
  source_text text,
  created_at timestamptz not null default now()
);

-- 5. PROMOTION STACKING RULES (Binary Pair-wise Combinations)
create table if not exists public.promotion_stacking_rules (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null
    references public.promotion_campaigns(id)
    on delete cascade,
  left_offer_id uuid not null
    references public.promotion_offers(id)
    on delete cascade,
  right_offer_id uuid not null
    references public.promotion_offers(id)
    on delete cascade,
  rule_type text not null
    check (rule_type in ('ALLOW', 'ALLOW_IF_ELIGIBLE', 'DENY', 'REPLACE')),
  reason text not null,
  created_at timestamptz not null default now(),

  constraint stacking_offer_order_check check (left_offer_id <> right_offer_id),
  unique (left_offer_id, right_offer_id)
);

-- 6. PROMOTION CALCULATIONS (Scenario Cache with Strict Equation Check)
create table if not exists public.promotion_calculations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null
    references public.promotion_campaigns(id),
  inventory_pn text not null,
  calculation_scenario text not null
    check (
      calculation_scenario in (
        'STANDARD',
        'STANDARD_WITH_TRADE_UP',
        'SF_PLUS',
        'NON_SF_PLUS',
        'STUDENT'
      )
    ),
  selected_offer_ids uuid[] not null,
  regular_price numeric(12, 2) not null check (regular_price > 0),
  standard_discount numeric(12, 2) not null default 0 check (standard_discount >= 0),
  trade_up_discount numeric(12, 2) not null default 0 check (trade_up_discount >= 0),
  student_discount numeric(12, 2) not null default 0 check (student_discount >= 0),
  net_price numeric(12, 2) not null check (net_price > 0),
  calculation_version text not null,
  calculated_at timestamptz not null default now(),

  constraint calculation_equation_check
    check (net_price = regular_price - standard_discount - trade_up_discount - student_discount)
);

-- 7. PROMOTION VALIDATION ERRORS (4-Tier Severity Error Store)
create table if not exists public.promotion_validation_errors (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null
    references public.promotion_import_batches(id)
    on delete cascade,
  campaign_id uuid,
  offer_id uuid,
  severity text not null
    check (severity in ('BLOCKER', 'REVIEW_REQUIRED', 'WARNING', 'INFO')),
  error_code text not null,
  field_name text,
  source_sheet text,
  source_row integer,
  source_cell_range text,
  inventory_pn text,
  expected_value jsonb,
  actual_value jsonb,
  message text not null,
  resolution_status text not null default 'OPEN'
    check (
      resolution_status in (
        'OPEN',
        'ACKNOWLEDGED',
        'CORRECTED',
        'WAIVED',
        'REJECTED'
      )
    ),
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);

-- 8. PROMOTION CORRECTION RULES (Knowledge Base of Approved Manager Teachings)
create table if not exists public.promotion_correction_rules (
  id uuid primary key default gen_random_uuid(),
  branch_code text not null,
  correction_type text not null
    check (
      correction_type in (
        'SEMANTIC_MAPPING',
        'FIELD_RECLASSIFICATION',
        'EXCLUSIVITY_OVERRIDE',
        'COUPON_ALIAS'
      )
    ),
  source_text_pattern text not null,
  incorrect_field text,
  correct_field text,
  target_value jsonb,
  scope text not null default 'BRANCH_WIDE'
    check (scope in ('SINGLE_ITEM', 'BRANCH_WIDE', 'GLOBAL')),
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  status text not null default 'ACTIVE_RULE'
    check (status in ('ACTIVE_RULE', 'ARCHIVED_RULE', 'SUPERSEDED_RULE'))
);

-- 9. PROMOTION AUDIT LOGS (Immutable History Trail)
create table if not exists public.promotion_audit_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid,
  offer_id uuid,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  performed_by uuid not null,
  performed_at timestamptz not null default now(),
  reason text
);

-- Indexes for query performance
create index if not exists idx_promo_offers_pn on public.promotion_offers(inventory_pn);
create index if not exists idx_promo_offers_campaign on public.promotion_offers(campaign_id);
create index if not exists idx_promo_errors_batch on public.promotion_validation_errors(import_batch_id);
create index if not exists idx_promo_errors_severity on public.promotion_validation_errors(severity, resolution_status);
create index if not exists idx_promo_calc_pn on public.promotion_calculations(inventory_pn);
create index if not exists idx_promo_corrections_pattern on public.promotion_correction_rules(source_text_pattern);

-- ============================================================================
-- 10. TRANSACTIONAL ACTIVATION RPC (Fail-Closed)
-- ============================================================================
create or replace function public.activate_promotion_campaign(
  p_campaign_id uuid,
  p_expected_previous_campaign_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign promotion_campaigns%rowtype;
  v_blocker_count integer;
  v_review_count integer;
begin
  -- 1. Select campaign with row lock
  select *
  into v_campaign
  from promotion_campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_NOT_FOUND';
  end if;

  if v_campaign.status <> 'APPROVED' then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_NOT_APPROVED';
  end if;

  -- 2. Fail-closed on any open BLOCKER errors
  select count(*)
  into v_blocker_count
  from promotion_validation_errors
  where campaign_id = p_campaign_id
    and severity = 'BLOCKER'
    and resolution_status = 'OPEN';

  if v_blocker_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'OPEN_PROMOTION_BLOCKERS';
  end if;

  -- 3. Fail-closed on any unreviewed REVIEW_REQUIRED items
  select count(*)
  into v_review_count
  from promotion_validation_errors
  where campaign_id = p_campaign_id
    and severity = 'REVIEW_REQUIRED'
    and resolution_status = 'OPEN';

  if v_review_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'OPEN_PROMOTION_REVIEWS';
  end if;

  -- 4. Check concurrency / previous active campaign sanity
  if p_expected_previous_campaign_id is not null then
    if exists (
      select 1
      from promotion_campaigns
      where branch_code = v_campaign.branch_code
        and status = 'ACTIVE'
        and id <> p_expected_previous_campaign_id
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'EXPECTED_CAMPAIGN_MISMATCH';
    end if;

    -- Supersede expected previous active campaign
    update promotion_campaigns
    set status = 'SUPERSEDED'
    where id = p_expected_previous_campaign_id
      and status = 'ACTIVE';
  end if;

  -- 5. Activate campaign atomically
  update promotion_campaigns
  set
    status = 'ACTIVE',
    approved_by = coalesce(approved_by, p_user_id),
    approved_at = coalesce(approved_at, now())
  where id = p_campaign_id;

  -- 6. Activate all approved offers for this campaign
  update promotion_offers
  set status = 'ACTIVE'
  where campaign_id = p_campaign_id
    and status in ('APPROVED', 'DRAFT');

  -- 7. Log immutable audit entry
  insert into promotion_audit_logs (
    campaign_id,
    action,
    new_value,
    performed_by,
    reason
  )
  values (
    p_campaign_id,
    'ACTIVATE',
    jsonb_build_object(
      'previousCampaignId', p_expected_previous_campaign_id,
      'newCampaignId', p_campaign_id
    ),
    p_user_id,
    'Campaign passed all activation gates'
  );

  return jsonb_build_object(
    'status', 'ACTIVE',
    'campaignId', p_campaign_id
  );
end;
$$;

-- ============================================================================
-- 11. TRANSACTIONAL ROLLBACK RPC (Atomic Reversion)
-- ============================================================================
create or replace function public.rollback_promotion_campaign(
  p_campaign_id uuid,
  p_target_previous_campaign_id uuid,
  p_user_id uuid,
  p_reason text default 'Manager performed rollback to previous promotion campaign'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_campaign promotion_campaigns%rowtype;
  v_target_campaign promotion_campaigns%rowtype;
begin
  -- 1. Select and lock current campaign
  select *
  into v_current_campaign
  from promotion_campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CURRENT_CAMPAIGN_NOT_FOUND';
  end if;

  -- 2. Select and lock target previous campaign
  select *
  into v_target_campaign
  from promotion_campaigns
  where id = p_target_previous_campaign_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'TARGET_CAMPAIGN_NOT_FOUND';
  end if;

  -- Verify branch scope matches
  if v_target_campaign.branch_code <> v_current_campaign.branch_code then
    raise exception using
      errcode = 'P0001',
      message = 'BRANCH_MISMATCH';
  end if;

  -- 3. Revert current campaign to ROLLED_BACK
  update promotion_campaigns
  set status = 'ROLLED_BACK'
  where id = p_campaign_id;

  -- Demote current campaign offers
  update promotion_offers
  set status = 'ROLLED_BACK'
  where campaign_id = p_campaign_id
    and status = 'ACTIVE';

  -- 4. Restore target previous campaign to ACTIVE
  update promotion_campaigns
  set status = 'ACTIVE'
  where id = p_target_previous_campaign_id;

  -- Restore target campaign offers to ACTIVE
  update promotion_offers
  set status = 'ACTIVE'
  where campaign_id = p_target_previous_campaign_id
    and status in ('SUPERSEDED', 'ROLLED_BACK', 'APPROVED');

  -- 5. Log immutable audit entry
  insert into promotion_audit_logs (
    campaign_id,
    action,
    previous_value,
    new_value,
    performed_by,
    reason
  )
  values (
    p_campaign_id,
    'ROLLBACK',
    jsonb_build_object('activeCampaignId', p_campaign_id),
    jsonb_build_object('activeCampaignId', p_target_previous_campaign_id),
    p_user_id,
    coalesce(p_reason, 'Manager performed atomic rollback to previous campaign')
  );

  return jsonb_build_object(
    'status', 'ROLLED_BACK',
    'revertedCampaignId', p_campaign_id,
    'activeCampaignId', p_target_previous_campaign_id
  );
end;
$$;

-- ============================================================================
-- 12. ATOMIC PROMOTION DRAFT INGESTION RPC (Single Transaction Draft Creation)
-- ============================================================================
create or replace function public.create_promotion_draft_batch(
  p_payload jsonb,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_campaign_id uuid;
  v_branch_code text;
  v_file_name text;
  v_sha256 text;
  v_campaign_code text;
  v_campaign_name text;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_offer jsonb;
  v_err jsonb;
  v_offer_count int := 0;
  v_error_count int := 0;
  v_pn text;
begin
  -- 1. Extract and sanitize inputs
  v_branch_code := upper(trim(coalesce(p_payload->>'branchCode', 'AYUTTHAYA_CITY_PARK')));
  v_file_name := trim(coalesce(p_payload->>'sourceFileName', 'Promotion.xlsx'));
  v_sha256 := lower(trim(coalesce(p_payload->>'sourceFileSha256', md5(random()::text))));

  v_campaign_code := coalesce(p_payload->'campaign'->>'campaignCode', 'SEP2026-RETAIL-MOBILE');
  v_campaign_name := coalesce(p_payload->'campaign'->>'campaignName', 'Promotion Campaign Draft');
  v_start_at := coalesce((p_payload->'campaign'->>'startAt')::timestamptz, now());
  v_end_at := coalesce((p_payload->'campaign'->>'endAt')::timestamptz, now() + interval '30 days');

  -- 2. Insert Batch
  insert into promotion_import_batches (
    branch_code,
    source_file_name,
    source_file_sha256,
    status,
    total_rows,
    passed_rows,
    warning_rows,
    blocked_rows,
    validation_summary,
    imported_by
  ) values (
    v_branch_code,
    v_file_name,
    v_sha256,
    'DRAFT',
    coalesce((p_payload->'summary'->>'totalRows')::int, 0),
    coalesce((p_payload->'summary'->>'passedRows')::int, 0),
    coalesce((p_payload->'summary'->>'warningRows')::int, 0),
    coalesce((p_payload->'summary'->>'blockedRows')::int, 0),
    coalesce(p_payload->'summary', '{}'::jsonb),
    p_user_id
  ) returning id into v_batch_id;

  -- 3. Insert Campaign
  insert into promotion_campaigns (
    import_batch_id,
    branch_code,
    campaign_code,
    campaign_name,
    start_at,
    end_at,
    status,
    priority,
    created_by
  ) values (
    v_batch_id,
    v_branch_code,
    v_campaign_code,
    v_campaign_name,
    v_start_at,
    v_end_at,
    'DRAFT',
    100,
    p_user_id
  ) returning id into v_campaign_id;

  -- 4. Insert Offers
  if jsonb_typeof(p_payload->'offers') = 'array' then
    for v_offer in select * from jsonb_array_elements(p_payload->'offers') loop
      v_pn := v_offer->>'inventoryPn';
      
      -- Accessory Guard: Reject accessories like EF-, GP-, EP-, EE- from smartphone campaigns
      if v_pn like 'EF-%' or v_pn like 'GP-%' or v_pn like 'EP-%' or v_pn like 'EE-%' or v_pn like 'ITFIT%' then
        raise exception using
          errcode = 'P0001',
          message = 'ACCESSORY_PN_REJECTED_FROM_SMARTPHONE_CAMPAIGN: ' || v_pn;
      end if;

      insert into promotion_offers (
        campaign_id,
        branch_code,
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
        status,
        source_sheet,
        source_row
      ) values (
        v_campaign_id,
        v_branch_code,
        v_pn,
        v_offer->>'model',
        v_offer->>'capacity',
        coalesce(v_offer->>'offerCode', 'OFFER_' || v_offer_count + 1),
        coalesce(v_offer->>'promotionType', 'STANDARD_DISCOUNT'),
        v_offer->>'couponCode',
        coalesce((v_offer->>'regularPrice')::numeric, 1),
        coalesce(v_offer->>'discountType', 'FIXED_AMOUNT'),
        coalesce((v_offer->>'discountAmount')::numeric, 0),
        coalesce((v_offer->>'discountPercent')::numeric, 0),
        coalesce(v_offer->>'paymentCondition', 'ANY'),
        coalesce(v_offer->>'customerSegment', 'GENERAL'),
        coalesce((v_offer->>'requiresTradeIn')::boolean, false),
        (v_offer->>'downPaymentMaxPercent')::numeric,
        (v_offer->>'estimatedDownPayment')::numeric,
        coalesce(v_offer->>'stackingPolicy', 'STACKABLE_CONDITIONAL'),
        v_offer->>'exclusiveGroup',
        coalesce((v_offer->>'blocksAllOtherPromotions')::boolean, false),
        'DRAFT',
        coalesce(v_offer->>'sourceSheet', 'Promotion'),
        (v_offer->>'sourceRow')::int
      );
      v_offer_count := v_offer_count + 1;
    end loop;
  end if;

  -- 5. Insert Validation Errors (e.g. S26 Ultra 1TB PN_NOT_FOUND)
  if jsonb_typeof(p_payload->'validationErrors') = 'array' then
    for v_err in select * from jsonb_array_elements(p_payload->'validationErrors') loop
      insert into promotion_validation_errors (
        import_batch_id,
        campaign_id,
        severity,
        error_code,
        field_name,
        source_sheet,
        source_row,
        inventory_pn,
        message,
        resolution_status
      ) values (
        v_batch_id,
        v_campaign_id,
        coalesce(v_err->>'severity', 'REVIEW_REQUIRED'),
        coalesce(v_err->>'errorCode', 'VALIDATION_ERROR'),
        v_err->>'fieldName',
        coalesce(v_err->>'sourceSheet', 'Promotion'),
        (v_err->>'sourceRow')::int,
        v_err->>'inventoryPn',
        coalesce(v_err->>'message', 'Validation error reported'),
        'OPEN'
      );
      v_error_count := v_error_count + 1;
    end loop;
  end if;

  -- 6. Insert Audit Log
  insert into promotion_audit_logs (
    campaign_id,
    action,
    new_value,
    performed_by,
    reason
  ) values (
    v_campaign_id,
    'CREATE_DRAFT_BATCH',
    jsonb_build_object(
      'batchId', v_batch_id,
      'campaignId', v_campaign_id,
      'offerCount', v_offer_count,
      'errorCount', v_error_count,
      'fileName', v_file_name
    ),
    p_user_id,
    'Atomic creation of promotion draft batch via PostgreSQL RPC'
  );

  return jsonb_build_object(
    'status', 'DRAFT_CREATED',
    'batchId', v_batch_id,
    'campaignId', v_campaign_id,
    'offerCount', v_offer_count,
    'reviewRequiredCount', v_error_count
  );
end;
$$;

-- ============================================================================
-- 13. ROW LEVEL SECURITY (RLS) & LEAST-PRIVILEGE GRANTS
-- ============================================================================
alter table public.promotion_import_batches enable row level security;
alter table public.promotion_campaigns enable row level security;
alter table public.promotion_offers enable row level security;
alter table public.promotion_conditions enable row level security;
alter table public.promotion_stacking_rules enable row level security;
alter table public.promotion_calculations enable row level security;
alter table public.promotion_validation_errors enable row level security;
alter table public.promotion_correction_rules enable row level security;
alter table public.promotion_audit_logs enable row level security;

-- Policy 1: Authenticated users can view ACTIVE campaigns
drop policy if exists "Staff can view active promotion campaigns" on public.promotion_campaigns;
create policy "Staff can view active promotion campaigns"
  on public.promotion_campaigns
  for select
  to authenticated
  using (status = 'ACTIVE');

-- Policy 2: Authenticated users can view offers of active campaigns
drop policy if exists "Staff can view active promotion offers" on public.promotion_offers;
create policy "Staff can view active promotion offers"
  on public.promotion_offers
  for select
  to authenticated
  using (status = 'ACTIVE');

-- Policy 3: Authenticated users can view calculations of active campaigns
drop policy if exists "Staff can view active calculations" on public.promotion_calculations;
create policy "Staff can view active calculations"
  on public.promotion_calculations
  for select
  to authenticated
  using (
    campaign_id in (
      select id from public.promotion_campaigns where status = 'ACTIVE'
    )
  );

-- Direct client mutation revokes (Server-Mediated Ingestion Architecture)
revoke insert, update, delete on table public.promotion_import_batches from authenticated, anon;
revoke insert, update, delete on table public.promotion_campaigns from authenticated, anon;
revoke insert, update, delete on table public.promotion_offers from authenticated, anon;
revoke insert, update, delete on table public.promotion_conditions from authenticated, anon;
revoke insert, update, delete on table public.promotion_stacking_rules from authenticated, anon;
revoke insert, update, delete on table public.promotion_calculations from authenticated, anon;
revoke insert, update, delete on table public.promotion_validation_errors from authenticated, anon;
revoke insert, update, delete on table public.promotion_correction_rules from authenticated, anon;
revoke insert, update, delete on table public.promotion_audit_logs from authenticated, anon;

-- Read grants for authenticated users
grant select on table public.promotion_campaigns to authenticated;
grant select on table public.promotion_offers to authenticated;
grant select on table public.promotion_calculations to authenticated;

-- Direct RPC execution restricted to service_role and postgres
revoke execute on function public.create_promotion_draft_batch(jsonb, uuid) from authenticated, anon;
revoke execute on function public.activate_promotion_campaign(uuid, uuid, uuid) from authenticated, anon;
revoke execute on function public.rollback_promotion_campaign(uuid, uuid, uuid, text) from authenticated, anon;

grant execute on function public.create_promotion_draft_batch(jsonb, uuid) to postgres, service_role;
grant execute on function public.activate_promotion_campaign(uuid, uuid, uuid) to postgres, service_role;
grant execute on function public.rollback_promotion_campaign(uuid, uuid, uuid, text) to postgres, service_role;

-- Full service_role and postgres permissions for backend API
grant all on table public.promotion_import_batches to postgres, service_role;
grant all on table public.promotion_campaigns to postgres, service_role;
grant all on table public.promotion_offers to postgres, service_role;
grant all on table public.promotion_conditions to postgres, service_role;
grant all on table public.promotion_stacking_rules to postgres, service_role;
grant all on table public.promotion_calculations to postgres, service_role;
grant all on table public.promotion_validation_errors to postgres, service_role;
grant all on table public.promotion_correction_rules to postgres, service_role;
grant all on table public.promotion_audit_logs to postgres, service_role;

