-- Fix missing totalAmountLYD column
ALTER TABLE public.orders_v4
ADD COLUMN IF NOT EXISTS "totalAmountLYD" NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.orders_v4."totalAmountLYD" IS 'Total amount of the order in LYD';

-- Also ensure other potentially missing columns from recent updates are present
ALTER TABLE public.orders_v4
ADD COLUMN IF NOT EXISTS "customerWeightCostCurrency" TEXT,
ADD COLUMN IF NOT EXISTS "companyWeightCostCurrency" TEXT,
ADD COLUMN IF NOT EXISTS "companyWeightCost" NUMERIC,
ADD COLUMN IF NOT EXISTS "companyWeightCostUSD" NUMERIC;
