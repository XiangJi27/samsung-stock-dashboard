-- ============================================================================
-- SAMSUNG BRANCH OPERATIONS (Ayutthaya City Park)
-- MIGRATION: COLOR_SCOPE, RESOLUTION_CODE, AND SOURCE PROVENANCE ENHANCEMENTS
-- ============================================================================

-- -- 1. ADD RESOLUTION_CODE & VERIFY RESOLUTION_STATUS IN PROMOTION_VALIDATION_ERRORS
alter table public.promotion_validation_errors
drop constraint if exists promotion_validation_errors_resolution_status_check;

alter table public.promotion_validation_errors
add constraint promotion_validation_errors_resolution_status_check
check (
  resolution_status in (
    'OPEN',
    'ACKNOWLEDGED',
    'CORRECTED',
    'WAIVED',
    'REJECTED'
  )
);

alter table public.promotion_validation_errors
add column if not exists resolution_code text;

alter table public.promotion_validation_errors
drop constraint if exists promotion_error_resolution_code_check;

alter table public.promotion_validation_errors
add constraint promotion_error_resolution_code_check
check (
  resolution_code is null
  or resolution_code in (
    'CORRECTED',
    'ACKNOWLEDGED',
    'REJECTED_FOR_CURRENT_CAMPAIGN',
    'REJECTED_NOT_IN_ACTIVE_STOCK',
    'REJECTED_INVALID_SOURCE',
    'REQUIRES_STOCK_REFRESH'
  )
);

-- 2. ADD COLOR_SCOPE & PROVENANCE COLUMNS TO PROMOTION_OFFERS
alter table public.promotion_offers
add column if not exists color_scope text not null default 'REVIEW_REQUIRED';

alter table public.promotion_offers
add column if not exists source_color text;

alter table public.promotion_offers
add column if not exists source_model_name text;

alter table public.promotion_offers
add column if not exists source_capacity text;

alter table public.promotion_offers
add column if not exists source_evidence_hash text;

alter table public.promotion_offers
add column if not exists source_evidence_origin text not null default 'PARSER_CAPTURED';

-- 3. ADD COLOR_SCOPE & EVIDENCE CONSTRAINTS
alter table public.promotion_offers
drop constraint if exists promotion_offer_color_scope_check;

alter table public.promotion_offers
add constraint promotion_offer_color_scope_check
check (
  color_scope in (
    'ALL_COLORS',
    'SPECIFIC_COLOR',
    'REVIEW_REQUIRED'
  )
);

alter table public.promotion_offers
drop constraint if exists promotion_offer_color_consistency_check;

alter table public.promotion_offers
add constraint promotion_offer_color_consistency_check
check (
  (
    color_scope = 'ALL_COLORS'
    and source_color is null
  )
  or
  (
    color_scope = 'SPECIFIC_COLOR'
    and nullif(trim(source_color), '') is not null
  )
  or
  (
    color_scope = 'REVIEW_REQUIRED'
  )
);

alter table public.promotion_offers
drop constraint if exists promotion_source_evidence_origin_check;

alter table public.promotion_offers
add constraint promotion_source_evidence_origin_check
check (
  source_evidence_origin in (
    'PARSER_CAPTURED',
    'MANUALLY_REVIEWED',
    'LEGACY_BACKFILL'
  )
);

-- 4. UPDATE ATOMIC DRAFT RPC TO PERSIST COLOR_SCOPE & EVIDENCE
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
  v_pn text;
  v_offer_count integer := 0;
  v_error_count integer := 0;
begin
  -- 1. Extract payload attributes
  v_branch_code := upper(trim(coalesce(p_payload->>'branchCode', 'AYUTTHAYA_CITY_PARK')));
  v_file_name := coalesce(p_payload->>'sourceFileName', 'unknown.xlsx');
  v_sha256 := coalesce(p_payload->>'sourceFileSha256', 'unknown_hash');
  v_campaign_code := coalesce(p_payload->'campaign'->>'campaignCode', 'CAMP_' || to_char(now(), 'YYYYMMDD_HH24MISS'));
  v_campaign_name := coalesce(p_payload->'campaign'->>'campaignName', 'Promotion Campaign ' || to_char(now(), 'YYYY-MM-DD'));
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
        color_scope,
        source_color,
        source_model_name,
        source_capacity,
        source_evidence_hash,
        source_evidence_origin,
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
        source_row,
        source_cell_range,
        source_text
      ) values (
        v_campaign_id,
        v_branch_code,
        v_pn,
        v_offer->>'model',
        v_offer->>'capacity',
        coalesce(v_offer->>'colorScope', 'REVIEW_REQUIRED'),
        nullif(trim(v_offer->>'sourceColor'), ''),
        v_offer->>'sourceModelName',
        v_offer->>'sourceCapacity',
        v_offer->>'sourceEvidenceHash',
        coalesce(v_offer->>'sourceEvidenceOrigin', 'PARSER_CAPTURED'),
        coalesce(v_offer->>'offerCode', 'OFFER_' || v_offer_count + 1),
        coalesce(v_offer->>'promotionType', 'STANDARD_DISCOUNT'),
        v_offer->>'couponCode',
        coalesce((v_offer->>'regularPrice')::numeric, 1),
        coalesce(
          v_offer->>'discountType',
          case
            when coalesce((v_offer->>'discountPercent')::numeric, 0) > 0 then 'PERCENT'
            when coalesce((v_offer->>'discountAmount')::numeric, (v_offer->>'standardDiscount')::numeric, (v_offer->>'tradeUpDiscount')::numeric, 0) > 0 then 'FIXED_AMOUNT'
            else 'NONE'
          end
        ),
        case
          when coalesce(v_offer->>'discountType', '') = 'PERCENT' or coalesce((v_offer->>'discountPercent')::numeric, 0) > 0 then 0
          else coalesce((v_offer->>'discountAmount')::numeric, (v_offer->>'standardDiscount')::numeric, (v_offer->>'tradeUpDiscount')::numeric, 0)
        end,
        case
          when coalesce(v_offer->>'discountType', '') = 'PERCENT' or coalesce(v_offer->>'promotionType', '') = 'STUDENT_EXCLUSIVE' or coalesce(v_offer->>'couponCode', '') = 'Studentcrd' then coalesce((v_offer->>'discountPercent')::numeric, 15)
          else coalesce((v_offer->>'discountPercent')::numeric, 0)
        end,
        coalesce(v_offer->>'paymentCondition', 'ANY'),
        coalesce(v_offer->>'customerSegment', 'GENERAL'),
        case
          when coalesce(v_offer->>'promotionType', '') in ('TRADE_UP_CONDITIONAL', 'TRADE_UP_ONLY') then true
          else coalesce((v_offer->>'requiresTradeIn')::boolean, false)
        end,
        (v_offer->>'downPaymentMaxPercent')::numeric,
        (v_offer->>'estimatedDownPayment')::numeric,
        coalesce(v_offer->>'stackingPolicy', 'STACKABLE_CONDITIONAL'),
        coalesce(v_offer->>'exclusiveGroup', case when coalesce(v_offer->>'stackingPolicy', '') = 'MUTUALLY_EXCLUSIVE' then 'PAYMENT_EXCLUSIVE' else null end),
        coalesce((v_offer->>'blocksAllOtherPromotions')::boolean, false),
        'DRAFT',
        coalesce(v_offer->>'sourceSheet', 'Promotion'),
        (v_offer->>'sourceRow')::int,
        v_offer->>'sourceCellRange',
        v_offer->>'sourceText'
      );
      v_offer_count := v_offer_count + 1;
    end loop;
  end if;

  -- 5. Insert Validation Errors (Held & Quarantined items)
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
        source_cell_range,
        inventory_pn,
        message,
        resolution_status,
        resolution_code,
        resolution_note
      ) values (
        v_batch_id,
        v_campaign_id,
        coalesce(v_err->>'severity', 'REVIEW_REQUIRED'),
        coalesce(v_err->>'errorCode', 'UNKNOWN_ERROR'),
        v_err->>'fieldName',
        coalesce(v_err->>'sourceSheet', 'Promotion'),
        (v_err->>'sourceRow')::int,
        v_err->>'sourceCellRange',
        v_err->>'inventoryPn',
        coalesce(v_err->>'message', 'Validation error occurred'),
        coalesce(v_err->>'resolutionStatus', 'OPEN'),
        v_err->>'resolutionCode',
        v_err->>'resolutionNote'
      );
      v_error_count := v_error_count + 1;
    end loop;
  end if;

  -- 6. Insert Audit Log
  insert into promotion_audit_logs (
    campaign_id,
    action,
    previous_value,
    new_value,
    performed_by,
    performed_at,
    reason
  ) values (
    v_campaign_id,
    'CREATE_DRAFT',
    null,
    jsonb_build_object(
      'batchId', v_batch_id,
      'campaignCode', v_campaign_code,
      'offerCount', v_offer_count,
      'errorCount', v_error_count
    ),
    p_user_id,
    now(),
    'Pilot draft import created via Atomic PostgreSQL RPC'
  );

  return jsonb_build_object(
    'batchId', v_batch_id,
    'campaignId', v_campaign_id,
    'offerCount', v_offer_count,
    'validationErrorCount', v_error_count,
    'transactionType', 'ATOMIC_DATABASE_RPC'
  );
end;
$$;

-- 5. RESOLVE VALIDATION ERROR RPC (Atomic Single Review Decision)
create or replace function public.resolve_promotion_validation_error(
  p_error_id uuid,
  p_user_id uuid,
  p_resolution_status text,
  p_resolution_code text,
  p_resolution_note text,
  p_expected_status text default 'OPEN'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_err promotion_validation_errors%rowtype;
begin
  select * into v_err
  from promotion_validation_errors
  where id = p_error_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'VALIDATION_ERROR_NOT_FOUND';
  end if;

  if p_expected_status is not null and v_err.resolution_status <> p_expected_status then
    raise exception using
      errcode = 'P0001',
      message = 'RESOLUTION_STATUS_MISMATCH: expected ' || p_expected_status || ' but found ' || v_err.resolution_status;
  end if;

  update promotion_validation_errors
  set
    resolution_status = upper(trim(p_resolution_status)),
    resolution_code = trim(p_resolution_code),
    resolution_note = trim(p_resolution_note),
    resolved_by = p_user_id,
    resolved_at = now()
  where id = p_error_id;

  return jsonb_build_object(
    'id', p_error_id,
    'resolutionStatus', upper(trim(p_resolution_status)),
    'resolutionCode', trim(p_resolution_code),
    'resolvedBy', p_user_id,
    'resolvedAt', now()
  );
end;
$$;

-- 5.2 UPDATE ACTIVATE CAMPAIGN RPC (Fail-Closed on LEGACY_BACKFILL and Invalid Color Scope)
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

  -- 4. Fail-closed on LEGACY_BACKFILL (Must be PARSER_CAPTURED for live store activation)
  if exists (
    select 1
    from public.promotion_offers
    where campaign_id = p_campaign_id
      and source_evidence_origin = 'LEGACY_BACKFILL'
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'LEGACY_BACKFILL_ACTIVATION_NOT_ALLOWED';
  end if;

  -- 5. Fail-closed on any invalid color_scope
  if exists (
    select 1
    from public.promotion_offers
    where campaign_id = p_campaign_id
      and (
        color_scope is null
        or color_scope = 'REVIEW_REQUIRED'
        or (color_scope = 'ALL_COLORS' and source_color is not null)
        or (color_scope = 'SPECIFIC_COLOR' and nullif(trim(source_color), '') is null)
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'INVALID_COLOR_SCOPE_IN_OFFERS';
  end if;

  -- 6. Concurrency lock: check expected previous campaign if specified
  if p_expected_previous_campaign_id is not null then
    if not exists (
      select 1
      from promotion_campaigns
      where id = p_expected_previous_campaign_id
        and status = 'ACTIVE'
        and branch_code = v_campaign.branch_code
    ) then
      raise exception using
        errcode = 'P0001',
        message = 'EXPECTED_CAMPAIGN_MISMATCH';
    end if;
  end if;

  -- 7. Supersede currently active campaigns for this branch
  update promotion_campaigns
  set
    status = 'SUPERSEDED',
    updated_at = now()
  where branch_code = v_campaign.branch_code
    and status = 'ACTIVE'
    and id <> p_campaign_id;

  -- 8. Mark new campaign as ACTIVE
  update promotion_campaigns
  set
    status = 'ACTIVE',
    approved_by = coalesce(approved_by, p_user_id),
    approved_at = coalesce(approved_at, now()),
    updated_at = now()
  where id = p_campaign_id;

  -- 9. Mark offers as ACTIVE
  update promotion_offers
  set
    status = 'ACTIVE'
  where campaign_id = p_campaign_id
    and status = 'APPROVED';

  -- 10. Audit Log
  insert into promotion_audit_logs (
    campaign_id,
    action,
    previous_value,
    new_value,
    performed_by,
    performed_at,
    reason
  ) values (
    p_campaign_id,
    'ACTIVATE',
    jsonb_build_object('status', 'APPROVED'),
    jsonb_build_object('status', 'ACTIVE'),
    p_user_id,
    now(),
    'Store leader activated campaign via transactional RPC'
  );

  return jsonb_build_object(
    'campaignId', p_campaign_id,
    'status', 'ACTIVE',
    'activatedBy', p_user_id,
    'activatedAt', now()
  );
end;
$$;

-- Permissions: Only service_role and postgres can execute
revoke execute on function public.create_promotion_draft_batch(jsonb, uuid) from authenticated, anon, public;
grant execute on function public.create_promotion_draft_batch(jsonb, uuid) to postgres, service_role;

revoke execute on function public.resolve_promotion_validation_error(uuid, uuid, text, text, text, text) from authenticated, anon, public;
grant execute on function public.resolve_promotion_validation_error(uuid, uuid, text, text, text, text) to postgres, service_role;

revoke execute on function public.activate_promotion_campaign(uuid, uuid, uuid) from authenticated, anon, public;
grant execute on function public.activate_promotion_campaign(uuid, uuid, uuid) to postgres, service_role;

-- 6. DATA ADJUSTMENTS FOR CURRENT CAMPAIGN (780afa93-9101-474d-a188-4c22c3633601)
-- Set provenance to LEGACY_BACKFILL and Galaxy A57 5G color_scope to ALL_COLORS
update public.promotion_offers
set
  source_evidence_origin = 'LEGACY_BACKFILL',
  color_scope = case when model_name = 'Galaxy A57 5G' then 'ALL_COLORS' else color_scope end,
  source_color = case when model_name = 'Galaxy A57 5G' then null else source_color end,
  source_text = case
    when inventory_pn = 'SM-S948BLBCTHL' then 'Excel Row 5: Galaxy S26 Ultra 512GB'
    when inventory_pn = 'SM-S948BZKCTHL' then 'Excel Row 5: Galaxy S26 Ultra 512GB'
    when inventory_pn = 'SM-S947BLBCTHL' then 'Excel Row 7: Galaxy S26+ 512GB'
    when inventory_pn = 'SM-S741BLGBTHL' then 'Excel Row 13: Galaxy S26 FE NEW 128GB'
    when inventory_pn = 'SM-A576BZATTHL' then 'Excel Row 32: Galaxy A57 5G 12/256GB'
    else source_text
  end
where campaign_id = '780afa93-9101-474d-a188-4c22c3633601'::uuid;

-- Log audit entry for color scope update with verified Store Leader UUID (cpw3862@staff.internal)
insert into public.promotion_audit_logs (
  campaign_id,
  action,
  previous_value,
  new_value,
  performed_by,
  performed_at,
  reason
)
values (
  '780afa93-9101-474d-a188-4c22c3633601'::uuid,
  'UPDATE_COLOR_SCOPE',
  jsonb_build_object(
    'model', 'Galaxy A57 5G',
    'previousColorScope', 'SPECIFIC_COLOR',
    'previousSourceColor', 'AWESOME_NAVY',
    'evidenceOrigin', 'MANUAL_BACKFILL'
  ),
  jsonb_build_object(
    'model', 'Galaxy A57 5G',
    'colorScope', 'ALL_COLORS',
    'sourceColor', null,
    'evidenceOrigin', 'LEGACY_BACKFILL'
  ),
  'bdff6d16-b8d1-4988-89b5-ece63988cba9'::uuid,
  now(),
  'Excel source rows 31-33 do not specify a color. Promotion applies to all colors within the exact model and capacity.'
);
