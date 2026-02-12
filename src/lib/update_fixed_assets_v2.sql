
BEGIN;

-- Add missing columns to fixed_assets_v2
ALTER TABLE public.fixed_assets_v2
ADD COLUMN IF NOT EXISTS asset_category TEXT,
ADD COLUMN IF NOT EXISTS asset_subcategory TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS responsible_person TEXT,
ADD COLUMN IF NOT EXISTS serial_number TEXT,
ADD COLUMN IF NOT EXISTS warranty_expiry DATE,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_fixed_assets_v2_category ON public.fixed_assets_v2(asset_category);

COMMIT;
