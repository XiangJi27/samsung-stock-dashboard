-- ============================================================================
-- SAMSUNG BRANCH OPERATIONS SYSTEM - PILOT SEED DATA
-- Target: Supabase Local / Preview Environments
-- ============================================================================

INSERT INTO public.branches (id, name, province, is_active)
VALUES 
  ('AYUTTHAYA_CITY_PARK', 'Samsung Experience Store - Ayutthaya City Park', 'Phra Nakhon Si Ayutthaya', TRUE),
  ('TEST_BRANCH_B', 'Samsung Experience Store - Test Branch B', 'Bangkok', TRUE)
ON CONFLICT (id) DO NOTHING;
