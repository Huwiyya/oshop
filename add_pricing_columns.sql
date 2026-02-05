-- Add missing pricing columns to orders_v4 table
-- Run this in Supabase SQL Editor

ALTER TABLE public.orders_v4
ADD COLUMN IF NOT EXISTS "companyWeightCost" NUMERIC,
ADD COLUMN IF NOT EXISTS "companyWeightCostCurrency" TEXT,
ADD COLUMN IF NOT EXISTS "companyWeightCostUSD" NUMERIC;

-- Optional: Add comment
COMMENT ON COLUMN public.orders_v4."companyWeightCost" IS 'Cost of weight to the company';
COMMENT ON COLUMN public.orders_v4."companyWeightCostCurrency" IS 'Currency of company cost (LYD or USD)';
