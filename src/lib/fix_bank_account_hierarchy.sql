
-- Fix missing Bank (1112) and Cash (1111) parent accounts in legacy 'accounts' table

DO $$
DECLARE
    v_asset_type_id UUID;
    v_assets_id UUID;
    v_current_assets_id UUID;
    v_cash_equiv_id UUID;
    v_banks_id UUID;
    v_cash_id UUID;
BEGIN
    -- 1. Get Asset Type ID (assuming 'asset' category exists in account_types)
    SELECT id INTO v_asset_type_id FROM account_types WHERE category = 'asset' LIMIT 1;
    
    IF v_asset_type_id IS NULL THEN
        RAISE NOTICE 'Asset account type not found, using first available or manual ID';
        -- Fallback or error? Let's check if we can find by name
        SELECT id INTO v_asset_type_id FROM account_types WHERE name_en = 'Assets' LIMIT 1;
    END IF;

    -- 2. Ensure Level 1: Assets (Code 1)
    SELECT id INTO v_assets_id FROM accounts WHERE account_code = '1';
    
    IF v_assets_id IS NULL THEN
        INSERT INTO accounts (account_code, name_ar, name_en, type_id, level, is_parent, is_active)
        VALUES ('1', 'الأصول', 'Assets', v_asset_type_id, 1, true, true)
        RETURNING id INTO v_assets_id;
    END IF;

    -- 3. Ensure Level 2: Current Assets (Code 11)
    SELECT id INTO v_current_assets_id FROM accounts WHERE account_code = '11';
    
    IF v_current_assets_id IS NULL THEN
        INSERT INTO accounts (account_code, name_ar, name_en, type_id, level, is_parent, parent_id, is_active)
        VALUES ('11', 'الأصول المتداولة', 'Current Assets', v_asset_type_id, 2, true, v_assets_id, true)
        RETURNING id INTO v_current_assets_id;
    END IF;

    -- 4. Ensure Level 3: Cash and Cash Equivalents (Code 111)
    SELECT id INTO v_cash_equiv_id FROM accounts WHERE account_code = '111';
    
    IF v_cash_equiv_id IS NULL THEN
        INSERT INTO accounts (account_code, name_ar, name_en, type_id, level, is_parent, parent_id, is_active)
        VALUES ('111', 'النقدية وما في حكمها', 'Cash and Cash Equivalents', v_asset_type_id, 3, true, v_current_assets_id, true)
        RETURNING id INTO v_cash_equiv_id;
    END IF;

    -- 5. Ensure Level 4: Banks (Code 1112) - The exact missing account
    SELECT id INTO v_banks_id FROM accounts WHERE account_code = '1112';
    
    IF v_banks_id IS NULL THEN
        INSERT INTO accounts (account_code, name_ar, name_en, type_id, level, is_parent, parent_id, is_active)
        VALUES ('1112', 'البنوك', 'Banks', v_asset_type_id, 4, true, v_cash_equiv_id, true)
        RETURNING id INTO v_banks_id;
        RAISE NOTICE 'Created Banks account (1112)';
    ELSE
        -- Ensure it is set as parent
        UPDATE accounts SET is_parent = true WHERE id = v_banks_id;
        RAISE NOTICE 'Banks account (1112) already exists, ensured is_parent=true';
    END IF;

    -- 6. Ensure Level 4: Cash (Code 1111) - Just in case
    SELECT id INTO v_cash_id FROM accounts WHERE account_code = '1111';
    
    IF v_cash_id IS NULL THEN
        INSERT INTO accounts (account_code, name_ar, name_en, type_id, level, is_parent, parent_id, is_active)
        VALUES ('1111', 'الصناديق (النقدية)', 'Cash on Hand', v_asset_type_id, 4, true, v_cash_equiv_id, true)
        RETURNING id INTO v_cash_id;
        RAISE NOTICE 'Created Cash account (1111)';
    ELSE
        UPDATE accounts SET is_parent = true WHERE id = v_cash_id;
    END IF;

END $$;
