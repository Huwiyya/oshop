-- Fixed Assets V2 Schema Verification and Enhancement
-- This script checks for missing columns and adds necessary indexes

-- 1. Check and add missing columns
DO $$ 
BEGIN
    -- Check for updated_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='fixed_assets_v2' AND column_name='updated_at'
    ) THEN
        ALTER TABLE fixed_assets_v2 ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column';
    END IF;

    -- Ensure asset_category is TEXT (some records have UUID, some have code)
    -- We'll keep it as TEXT for flexibility but document proper usage
    
END $$;

-- 2. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_fixed_assets_v2_status 
    ON fixed_assets_v2(status) 
    WHERE status != 'disposed';

CREATE INDEX IF NOT EXISTS idx_fixed_assets_v2_acquisition_date 
    ON fixed_assets_v2(acquisition_date DESC);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_v2_asset_account 
    ON fixed_assets_v2(asset_account_id);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_v2_category 
    ON fixed_assets_v2(asset_category);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_v2_created_at 
    ON fixed_assets_v2(created_at DESC);

-- 3. Add constraints for data integrity
DO $$
BEGIN
    -- Ensure cost is positive
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fixed_assets_v2_cost_positive'
    ) THEN
        ALTER TABLE fixed_assets_v2 
        ADD CONSTRAINT fixed_assets_v2_cost_positive 
        CHECK (cost > 0);
        RAISE NOTICE 'Added cost positive constraint';
    END IF;

    -- Ensure useful_life_years is positive
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fixed_assets_v2_life_positive'
    ) THEN
        ALTER TABLE fixed_assets_v2 
        ADD CONSTRAINT fixed_assets_v2_life_positive 
        CHECK (useful_life_years > 0);
        RAISE NOTICE 'Added useful_life positive constraint';
    END IF;

    -- Ensure salvage_value >= 0
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fixed_assets_v2_salvage_nonnegative'
    ) THEN
        ALTER TABLE fixed_assets_v2 
        ADD CONSTRAINT fixed_assets_v2_salvage_nonnegative 
        CHECK (salvage_value >= 0);
        RAISE NOTICE 'Added salvage_value non-negative constraint';
    END IF;

    -- Ensure accumulated_depreciation >= 0
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fixed_assets_v2_accum_nonnegative'
    ) THEN
        ALTER TABLE fixed_assets_v2 
        ADD CONSTRAINT fixed_assets_v2_accum_nonnegative 
        CHECK (accumulated_depreciation >= 0);
        RAISE NOTICE 'Added accumulated_depreciation non-negative constraint';
    END IF;
END $$;

-- 4. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_fixed_assets_v2_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fixed_assets_v2_updated_at ON fixed_assets_v2;
CREATE TRIGGER trg_fixed_assets_v2_updated_at
    BEFORE UPDATE ON fixed_assets_v2
    FOR EACH ROW
    EXECUTE FUNCTION update_fixed_assets_v2_timestamp();

-- 5. Verification Query
SELECT 
    'Schema Verification Complete' as status,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='fixed_assets_v2') as column_count,
    (SELECT COUNT(*) FROM pg_indexes WHERE tablename='fixed_assets_v2') as index_count,
    (SELECT COUNT(*) FROM pg_constraint WHERE conrelid='fixed_assets_v2'::regclass) as constraint_count;

-- 6. Show current schema
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'fixed_assets_v2'
ORDER BY ordinal_position;
