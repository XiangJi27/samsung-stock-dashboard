-- DRAFT ONLY — do not apply until Pilot schema approval. Append-only migration.
-- This migration deliberately creates no activation, publish, or stock mutations.

alter table public.promotion_offers
  add column if not exists standard_discount_amount numeric(12,2),
  add column if not exists finance_discount_amount numeric(12,2),
  add column if not exists non_sf_plus_discount_amount numeric(12,2),
  add column if not exists student_discount_amount numeric(12,2),
  add column if not exists student_discount_percent numeric(5,2),
  add column if not exists trade_up_bonus_amount numeric(12,2),
  add column if not exists calculation_status text not null default 'REVIEW_REQUIRED',
  add column if not exists calculation_error_code text,
  add column if not exists pricing_breakdown jsonb,
  add column if not exists pricing_engine_version text;

-- Existing Trade Up aggregate discounts are intentionally not split or inferred.
update public.promotion_offers
set calculation_status = 'REVIEW_REQUIRED',
    calculation_error_code = 'LEGACY_DISCOUNT_BREAKDOWN_REQUIRED'
where promotion_type in ('TRADE_UP_CONDITIONAL', 'TRADE_UP_ONLY')
  and trade_up_bonus_amount is null;

create table if not exists public.promotion_bundle_items_v2 (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.promotion_offers(id) on delete cascade,
  primary_inventory_pn text not null,
  bundle_inventory_pn text not null,
  bundle_regular_price numeric(12,2) not null,
  bundle_discount_amount numeric(12,2) not null default 0,
  bundle_finance_eligibility text not null default 'REVIEW_REQUIRED',
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  check (primary_inventory_pn <> bundle_inventory_pn),
  check (bundle_regular_price > 0),
  check (bundle_discount_amount >= 0 and bundle_discount_amount <= bundle_regular_price),
  check (bundle_finance_eligibility in ('FINANCE_ELIGIBLE', 'CASH_ONLY', 'REVIEW_REQUIRED')),
  check (quantity > 0)
);

-- Transaction facts belong outside promotion_offers and are never backfilled from offers.
create table if not exists public.promotion_checkout_transactions_v2 (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid references public.promotion_offers(id),
  trade_in_appraised_value numeric(12,2),
  selected_down_payment_amount numeric(12,2),
  selected_down_payment_percent numeric(5,2),
  down_payment_type text,
  upfront_fees numeric(12,2) not null default 0,
  other_fees numeric(12,2) not null default 0,
  final_checkout_amount numeric(12,2),
  pricing_breakdown jsonb,
  pricing_engine_version text,
  created_at timestamptz not null default now(),
  check (trade_in_appraised_value is null or trade_in_appraised_value >= 0),
  check (selected_down_payment_amount is null or selected_down_payment_amount >= 0),
  check (selected_down_payment_percent is null or (selected_down_payment_percent >= 0 and selected_down_payment_percent <= 100)),
  check (down_payment_type is null or down_payment_type in ('AMOUNT', 'PERCENT', 'MAX_PERCENT')),
  check (upfront_fees >= 0 and other_fees >= 0),
  check (final_checkout_amount is null or final_checkout_amount >= 0)
);

-- Add validation constraints only after Pilot data remediation and review.
-- Example: ALTER TABLE public.promotion_offers ADD CONSTRAINT ... NOT VALID;
