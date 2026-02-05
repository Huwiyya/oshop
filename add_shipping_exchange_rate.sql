-- Add shippingExchangeRate column to system_settings_v4 table
ALTER TABLE system_settings_v4
ADD COLUMN IF NOT EXISTS "shippingExchangeRate" NUMERIC DEFAULT 5.0;

-- Update existing row to use current exchangeRate as default shippingExchangeRate
UPDATE system_settings_v4
SET "shippingExchangeRate" = "exchangeRate"
WHERE "shippingExchangeRate" IS NULL;

-- Verify the update
SELECT id, "exchangeRate", "shippingExchangeRate", "shippingCostUSD", "shippingPriceUSD" FROM system_settings_v4;
