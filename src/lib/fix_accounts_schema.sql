
-- Add columns if not exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts_v2' AND column_name = 'is_parent') THEN
        ALTER TABLE accounts_v2 ADD COLUMN is_parent BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounts_v2' AND column_name = 'root_type') THEN
        ALTER TABLE accounts_v2 ADD COLUMN root_type TEXT;
    END IF;
END $$;

-- Seed Data using correct Type IDs
DO $$ 
DECLARE
    asset_type_id UUID;
    expense_type_id UUID;
    root_12_id UUID;
    root_5_id UUID;
BEGIN
    -- Get Type IDs
    SELECT id INTO asset_type_id FROM account_types_v2 WHERE name_en = 'Assets' LIMIT 1;
    SELECT id INTO expense_type_id FROM account_types_v2 WHERE name_en = 'Expenses' LIMIT 1;

    -- Ensure Fixed Assets Root (12) exists
    IF NOT EXISTS (SELECT 1 FROM accounts_v2 WHERE code = '12') THEN
        INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, root_type, level, is_parent, is_active)
        VALUES ('12', 'الأصول غير المتداولة', 'Non-Current Assets', asset_type_id, 'asset', 1, TRUE, TRUE)
        RETURNING id INTO root_12_id;
    ELSE
        SELECT id INTO root_12_id FROM accounts_v2 WHERE code = '12';
    END IF;

    -- Ensure Tangible Assets (121) exists
    IF NOT EXISTS (SELECT 1 FROM accounts_v2 WHERE code = '121') THEN
        INSERT INTO accounts_v2 (code, name_ar, name_en, parent_id, type_id, root_type, level, is_parent, is_active)
        VALUES ('121', 'الأصول الثابتة (الملموسة)', 'Tangible Fixed Assets', root_12_id, asset_type_id, 'asset', 2, TRUE, TRUE);
    END IF;

    -- Ensure Intangible Assets (122) exists
    IF NOT EXISTS (SELECT 1 FROM accounts_v2 WHERE code = '122') THEN
        INSERT INTO accounts_v2 (code, name_ar, name_en, parent_id, type_id, root_type, level, is_parent, is_active)
        VALUES ('122', 'الأصول غير الملموسة', 'Intangible Assets', root_12_id, asset_type_id, 'asset', 2, TRUE, TRUE);
    END IF;

    -- Ensure Accumulated Depreciation Root (123) exists (Contra Asset)
    IF NOT EXISTS (SELECT 1 FROM accounts_v2 WHERE code = '123') THEN
        INSERT INTO accounts_v2 (code, name_ar, name_en, parent_id, type_id, root_type, level, is_parent, is_active)
        VALUES ('123', 'مجمع الإهلاك', 'Accumulated Depreciation', root_12_id, asset_type_id, 'asset', 2, TRUE, TRUE);
    END IF;

    -- Ensure Expenses Root (5) exists
    IF NOT EXISTS (SELECT 1 FROM accounts_v2 WHERE code = '5') THEN
        INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, root_type, level, is_parent, is_active)
        VALUES ('5', 'المصروفات', 'Expenses', expense_type_id, 'expense', 1, TRUE, TRUE)
        RETURNING id INTO root_5_id;
    ELSE
        SELECT id INTO root_5_id FROM accounts_v2 WHERE code = '5';
    END IF;

    -- Ensure Depreciation Expense (55) exists
    IF NOT EXISTS (SELECT 1 FROM accounts_v2 WHERE code = '55') THEN
        INSERT INTO accounts_v2 (code, name_ar, name_en, parent_id, type_id, root_type, level, is_parent, is_active)
        VALUES ('55', 'إهلاك الأصول', 'Depreciation Expense', root_5_id, expense_type_id, 'expense', 2, TRUE, TRUE);
    END IF;

END $$;

