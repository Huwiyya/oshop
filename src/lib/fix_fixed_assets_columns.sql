
DO $$ 
BEGIN 
    -- 1. useful_life_years
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_assets_v2' AND column_name = 'useful_life_years') THEN
        ALTER TABLE fixed_assets_v2 ADD COLUMN useful_life_years INTEGER DEFAULT 0;
    END IF;

    -- 2. salvage_value (Covered before but good to include)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_assets_v2' AND column_name = 'salvage_value') THEN
        ALTER TABLE fixed_assets_v2 ADD COLUMN salvage_value DECIMAL(20, 4) DEFAULT 0;
    END IF;

    -- 3. asset_category
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_assets_v2' AND column_name = 'asset_category') THEN
        ALTER TABLE fixed_assets_v2 ADD COLUMN asset_category TEXT;
    END IF;

    -- 4. asset_subcategory
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_assets_v2' AND column_name = 'asset_subcategory') THEN
        ALTER TABLE fixed_assets_v2 ADD COLUMN asset_subcategory TEXT;
    END IF;

    -- 5. location
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_assets_v2' AND column_name = 'location') THEN
        ALTER TABLE fixed_assets_v2 ADD COLUMN location TEXT;
    END IF;

    -- 6. responsible_person
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_assets_v2' AND column_name = 'responsible_person') THEN
        ALTER TABLE fixed_assets_v2 ADD COLUMN responsible_person TEXT;
    END IF;

    -- 7. serial_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_assets_v2' AND column_name = 'serial_number') THEN
        ALTER TABLE fixed_assets_v2 ADD COLUMN serial_number TEXT;
    END IF;

    -- 8. warranty_expiry
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_assets_v2' AND column_name = 'warranty_expiry') THEN
        ALTER TABLE fixed_assets_v2 ADD COLUMN warranty_expiry TEXT;
    END IF;

    -- 9. description
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_assets_v2' AND column_name = 'description') THEN
        ALTER TABLE fixed_assets_v2 ADD COLUMN description TEXT;
    END IF;
    
    -- 10. book_value (Usually calculated, but let's check if code expects it - Interface has it, but DB usually doesn't store computed unless generated)
    -- The code calculates it on fetch, so we don't need a column.
    
    -- 11. status (Usually exists, check just in case)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_assets_v2' AND column_name = 'status') THEN
        ALTER TABLE fixed_assets_v2 ADD COLUMN status TEXT DEFAULT 'active';
    END IF;

END $$;
