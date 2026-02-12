
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'fixed_assets_v2' AND column_name = 'salvage_value') THEN
        ALTER TABLE fixed_assets_v2 ADD COLUMN salvage_value DECIMAL(20, 4) DEFAULT 0;
    END IF;
END $$;
