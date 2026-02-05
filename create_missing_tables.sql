-- Create missing instant_sales_v4 table
CREATE TABLE IF NOT EXISTS public.instant_sales_v4 (
    id TEXT PRIMARY KEY,
    "productName" TEXT,
    "costUSD" NUMERIC,
    "costExchangeRate" NUMERIC,
    "totalCostLYD" NUMERIC,
    "salePriceMode" TEXT,
    "salePriceLYD" NUMERIC,
    "salePriceUSD" NUMERIC,
    "saleExchangeRate" NUMERIC,
    "finalSalePriceLYD" NUMERIC,
    "netProfit" NUMERIC,
    "createdAt" TEXT
);

-- Enable RLS
ALTER TABLE public.instant_sales_v4 ENABLE ROW LEVEL SECURITY;

-- Create Policy
CREATE POLICY "Enable all access for all users" ON public.instant_sales_v4 FOR ALL USING (true) WITH CHECK (true);
