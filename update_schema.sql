-- ============================================
-- Treasury Cards & System Settings Update
-- ============================================
-- Run this in your Supabase SQL editor

-- 1. Create/Update System Settings Table
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings_v4 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "exchangeRate" NUMERIC DEFAULT 5.0,
    "shippingCostUSD" NUMERIC DEFAULT 4.5,
    "shippingPriceUSD" NUMERIC DEFAULT 5.0,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS for system_settings_v4 (service role has full access)
ALTER TABLE system_settings_v4 DISABLE ROW LEVEL SECURITY;

-- Insert default settings if table is empty
INSERT INTO system_settings_v4 ("exchangeRate", "shippingCostUSD", "shippingPriceUSD")
SELECT 5.0, 4.5, 5.0
WHERE NOT EXISTS (SELECT 1 FROM system_settings_v4);

-- Update existing settings to ensure valid exchange rate (if needed)
UPDATE system_settings_v4
SET "exchangeRate" = 5.0,
    "updatedAt" = NOW()
WHERE "exchangeRate" IS NULL OR "exchangeRate" <= 1;

-- 2. Create Treasury Cards Table
-- ============================================
CREATE TABLE IF NOT EXISTS treasury_cards_v4 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL UNIQUE CHECK (type IN ('cash_libyan', 'bank', 'cash_dollar')),
    balance NUMERIC DEFAULT 0,
    currency TEXT NOT NULL CHECK (currency IN ('LYD', 'USD')),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS for treasury_cards_v4
ALTER TABLE treasury_cards_v4 DISABLE ROW LEVEL SECURITY;

-- Insert the three treasury cards with initial zero balances (skip if already exist)
INSERT INTO treasury_cards_v4 (name, type, balance, currency) VALUES
('كاش ليبي', 'cash_libyan', 0, 'LYD'),
('مصرف', 'bank', 0, 'LYD'),
('دولار كاش', 'cash_dollar', 0, 'USD')
ON CONFLICT (type) DO NOTHING;


-- 3. Verification Queries
-- ============================================
-- Check system settings
SELECT 
    "exchangeRate" as "سعر_الصرف",
    "shippingCostUSD" as "تكلفة_الشحن_USD",
    "shippingPriceUSD" as "سعر_الشحن_للزبون_USD"
FROM system_settings_v4;

-- Check treasury cards
SELECT 
    name as "اسم_البطاقة",
    type as "النوع",
    balance as "الرصيد",
    currency as "العملة"
FROM treasury_cards_v4 
ORDER BY type;

-- Summary
SELECT 'التحديثات تمت بنجاح! ✅' as status;
