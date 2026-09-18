-- ============================================================================
-- SAMSUNG BRANCH OPERATIONS - ATOMIC PROMOTION CAMPAIGN REJECTION RPC
-- File: supabase/migrations/20260917_reject_promotion_campaign_rpc.sql
-- ============================================================================

create or replace function public.reject_promotion_campaign(
  p_campaign_id uuid,
  p_user_id uuid,
  p_reason text,
  p_expected_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.promotion_campaigns%rowtype;
  v_batch public.promotion_import_batches%rowtype;

  v_offer_count integer := 0;
  v_open_error_count integer := 0;

  v_allowed_statuses constant text[] := array[
    'DRAFT',
    'REVIEW_REQUIRED',
    'READY_TO_APPROVE',
    'APPROVED'
  ];
begin
  -- --------------------------------------------------------------------------
  -- 1. Validate input
  -- --------------------------------------------------------------------------

  if p_campaign_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_ID_REQUIRED';
  end if;

  if p_user_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'USER_ID_REQUIRED';
  end if;

  if nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception using
      errcode = 'P0001',
      message = 'REJECTION_REASON_REQUIRED';
  end if;

  -- --------------------------------------------------------------------------
  -- 2. Lock campaign row
  -- --------------------------------------------------------------------------

  select *
  into v_campaign
  from public.promotion_campaigns
  where id = p_campaign_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_NOT_FOUND';
  end if;

  -- --------------------------------------------------------------------------
  -- 3. Optional optimistic concurrency check
  -- --------------------------------------------------------------------------

  if p_expected_status is not null
     and v_campaign.status is distinct from upper(trim(p_expected_status))
  then
    raise exception using
      errcode = 'P0001',
      message = 'EXPECTED_CAMPAIGN_STATUS_MISMATCH',
      detail = format(
        'Expected status %s but current status is %s',
        upper(trim(p_expected_status)),
        v_campaign.status
      );
  end if;

  -- --------------------------------------------------------------------------
  -- 4. Rejecting an active campaign is not allowed
  -- --------------------------------------------------------------------------

  if v_campaign.status = 'ACTIVE' then
    raise exception using
      errcode = 'P0001',
      message = 'ACTIVE_CAMPAIGN_REJECTION_NOT_ALLOWED',
      detail =
        'Use rollback_promotion_campaign or activate a replacement campaign.';
  end if;

  if v_campaign.status = 'REJECTED' then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_ALREADY_REJECTED';
  end if;

  if v_campaign.status = 'ROLLED_BACK' then
    raise exception using
      errcode = 'P0001',
      message = 'ROLLED_BACK_CAMPAIGN_REJECTION_NOT_ALLOWED';
  end if;

  if v_campaign.status = 'SUPERSEDED' then
    raise exception using
      errcode = 'P0001',
      message = 'SUPERSEDED_CAMPAIGN_REJECTION_NOT_ALLOWED';
  end if;

  if not (
    v_campaign.status = any(v_allowed_statuses)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_STATUS_NOT_REJECTABLE',
      detail = format(
        'Current campaign status is %s',
        v_campaign.status
      );
  end if;

  -- --------------------------------------------------------------------------
  -- 5. Lock related import batch
  -- --------------------------------------------------------------------------

  select *
  into v_batch
  from public.promotion_import_batches
  where id = v_campaign.import_batch_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PROMOTION_IMPORT_BATCH_NOT_FOUND';
  end if;

  if v_batch.branch_code is distinct from v_campaign.branch_code then
    raise exception using
      errcode = 'P0001',
      message = 'CAMPAIGN_BATCH_BRANCH_MISMATCH';
  end if;

  -- --------------------------------------------------------------------------
  -- 6. Count records for audit reporting
  -- --------------------------------------------------------------------------

  select count(*)::integer
  into v_offer_count
  from public.promotion_offers
  where campaign_id = p_campaign_id;

  select count(*)::integer
  into v_open_error_count
  from public.promotion_validation_errors
  where campaign_id = p_campaign_id
    and resolution_status = 'OPEN';

  -- --------------------------------------------------------------------------
  -- 7. Reject offers
  -- --------------------------------------------------------------------------

  update public.promotion_offers
  set status = 'REJECTED'
  where campaign_id = p_campaign_id
    and status in (
      'DRAFT',
      'REVIEW_REQUIRED',
      'READY_TO_APPROVE',
      'APPROVED',
      'BLOCKED'
    );

  -- --------------------------------------------------------------------------
  -- 8. Reject campaign
  -- --------------------------------------------------------------------------

  update public.promotion_campaigns
  set
    status = 'REJECTED',
    approved_by = null,
    approved_at = null
  where id = p_campaign_id;

  -- --------------------------------------------------------------------------
  -- 9. Reject import batch
  -- --------------------------------------------------------------------------

  update public.promotion_import_batches
  set
    status = 'REJECTED',
    approved_by = null,
    approved_at = null,
    activated_at = null
  where id = v_campaign.import_batch_id;

  -- --------------------------------------------------------------------------
  -- 10. Keep validation errors for audit
  -- Do not convert OPEN errors to CORRECTED.
  -- The campaign rejection is stored separately in the audit log.
  -- --------------------------------------------------------------------------

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
    p_campaign_id,
    'REJECT',
    jsonb_build_object(
      'campaignStatus',
      v_campaign.status,
      'batchStatus',
      v_batch.status,
      'approvedBy',
      v_campaign.approved_by,
      'approvedAt',
      v_campaign.approved_at
    ),
    jsonb_build_object(
      'campaignStatus',
      'REJECTED',
      'batchStatus',
      'REJECTED',
      'offerCount',
      v_offer_count,
      'openValidationErrorCount',
      v_open_error_count
    ),
    p_user_id,
    now(),
    trim(p_reason)
  );

  -- --------------------------------------------------------------------------
  -- 11. Return result
  -- --------------------------------------------------------------------------

  return jsonb_build_object(
    'status',
    'REJECTED',

    'campaignId',
    p_campaign_id,

    'importBatchId',
    v_campaign.import_batch_id,

    'branchCode',
    v_campaign.branch_code,

    'previousCampaignStatus',
    v_campaign.status,

    'previousBatchStatus',
    v_batch.status,

    'offerCount',
    v_offer_count,

    'openValidationErrorCount',
    v_open_error_count,

    'rejectedBy',
    p_user_id,

    'reason',
    trim(p_reason),

    'transactionType',
    'ATOMIC_DATABASE_RPC'
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Permissions and Access Control
-- ----------------------------------------------------------------------------
revoke all
on function public.reject_promotion_campaign(
  uuid,
  uuid,
  text,
  text
)
from public;

revoke execute
on function public.reject_promotion_campaign(
  uuid,
  uuid,
  text,
  text
)
from anon, authenticated;

grant execute
on function public.reject_promotion_campaign(
  uuid,
  uuid,
  text,
  text
)
to service_role, postgres;
