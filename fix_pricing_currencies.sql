-- Ensure customerWeightCostCurrency column exists
ALTER TABLE public.orders_v4
ADD COLUMN IF NOT EXISTS "customerWeightCostCurrency" TEXT;

-- Verify companyWeightCostCurrency also exists (just in case)
ALTER TABLE public.orders_v4
ADD COLUMN IF NOT EXISTS "companyWeightCostCurrency" TEXT;

COMMENT ON COLUMN public.orders_v4."customerWeightCostCurrency" IS 'Currency for the customer selling price (LYD or USD)';
