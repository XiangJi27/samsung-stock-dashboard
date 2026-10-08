-- ============================================================================
-- SAMSUNG BRANCH OPERATIONS: PRODUCT SPECS MANAGEMENT TABLE SETUP
-- Run this script once in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- Project: anhxzffcmrihymrptsgd
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create product_specs Table
CREATE TABLE IF NOT EXISTS public.product_specs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    part_number TEXT UNIQUE NOT NULL,
    model_group TEXT NOT NULL,
    official_name TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'Samsung Thailand Official (samsung.com/th)',
    source_url TEXT,
    market_region TEXT NOT NULL DEFAULT 'Thailand (THL)',
    category TEXT NOT NULL DEFAULT 'SmartPhone',
    display JSONB NOT NULL DEFAULT '{}'::jsonb,
    performance JSONB NOT NULL DEFAULT '{}'::jsonb,
    memory JSONB NOT NULL DEFAULT '{}'::jsonb,
    camera JSONB NOT NULL DEFAULT '{}'::jsonb,
    battery JSONB NOT NULL DEFAULT '{}'::jsonb,
    connectivity_and_build JSONB NOT NULL DEFAULT '{}'::jsonb,
    scrape_method TEXT DEFAULT '1click_on_demand_cloud_sync',
    scraped_at TIMESTAMPTZ,
    screenshot_url TEXT,
    field_count INTEGER,
    data_quality_score NUMERIC(3,2),
    validation_status TEXT DEFAULT 'VALIDATED',
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Indexes for Fast Resolution
CREATE INDEX IF NOT EXISTS idx_product_specs_pn ON public.product_specs(part_number);
CREATE INDEX IF NOT EXISTS idx_product_specs_model ON public.product_specs(model_group);
CREATE INDEX IF NOT EXISTS idx_product_specs_active ON public.product_specs(is_active) WHERE is_active = TRUE;

-- 3. Row Level Security (RLS) Policies
ALTER TABLE public.product_specs ENABLE ROW LEVEL SECURITY;

-- Allow public & branch devices to read all active specs
DROP POLICY IF EXISTS "Public can view active specs" ON public.product_specs;
CREATE POLICY "Public can view active specs"
    ON public.product_specs FOR SELECT
    USING (is_active = TRUE);

-- Allow serverless function & branch admins to insert/update specs
DROP POLICY IF EXISTS "Allow spec upsert" ON public.product_specs;
CREATE POLICY "Allow spec upsert"
    ON public.product_specs FOR ALL
    USING (TRUE)
    WITH CHECK (TRUE);

-- 4. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
