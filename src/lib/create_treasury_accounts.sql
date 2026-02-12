
DO $$
DECLARE
    v_asset_type_id UUID;
    v_cash_control_id UUID;
    v_bank_control_id UUID;
BEGIN
    -- 1. Get Asset Type ID
    SELECT id INTO v_asset_type_id FROM account_types_v2 WHERE name_en = 'Assets';

    -- 2. Create Cash Control (1110)
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, current_balance)
    VALUES ('1110', 'النقدية وما في حكمها', 'Cash and Cash Equivalents', v_asset_type_id, 2, true, 0)
    ON CONFLICT (code) DO NOTHING
    RETURNING id INTO v_cash_control_id;

    -- If it existed, get the ID
    IF v_cash_control_id IS NULL THEN
        SELECT id INTO v_cash_control_id FROM accounts_v2 WHERE code = '1110';
    END IF;

    -- 3. Create Main Treasury (111001)
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, parent_id, current_balance)
    VALUES ('111001', 'الخزينة الرئيسية', 'Main Treasury', v_asset_type_id, 4, false, v_cash_control_id, 0)
    ON CONFLICT (code) DO NOTHING;

    -- 4. Create Bank Control (1111)
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, current_balance)
    VALUES ('1111', 'البنوك', 'Bank Accounts', v_asset_type_id, 2, true, 0)
    ON CONFLICT (code) DO NOTHING
    RETURNING id INTO v_bank_control_id;

    -- If it existed, get the ID
    IF v_bank_control_id IS NULL THEN
        SELECT id INTO v_bank_control_id FROM accounts_v2 WHERE code = '1111';
    END IF;

    -- 5. Create Main Bank Account (111101)
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, parent_id, current_balance)
    VALUES ('111101', 'البنك الرئيسي', 'Main Bank Account', v_asset_type_id, 4, false, v_bank_control_id, 0)
    ON CONFLICT (code) DO NOTHING;

END $$;
