-- Fix Entity Parent Accounts (Customers, Suppliers, Employees)
-- Goal: Ensure Level 3 Control Accounts exist so we can create Level 4 entities under them.

DO $$
DECLARE
    v_parent_id UUID;
    v_account_type_id UUID;
BEGIN
    -- 1. Suppliers (2110)
    -- Parent should be 211 (Trade Payables) or 21 (Liabilities)
    -- Let's try to find 211 first
    SELECT id INTO v_parent_id FROM accounts WHERE account_code = '211';
    IF v_parent_id IS NULL THEN
         SELECT id INTO v_parent_id FROM accounts WHERE account_code = '2000' OR account_code = '21' LIMIT 1;
    END IF;

    -- Get Account Type for Liability
    SELECT id INTO v_account_type_id FROM account_types WHERE name_en = 'Liabilities' OR normal_balance = 'credit' LIMIT 1;

    -- Create 2110 if not exists
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE account_code = '2110') THEN
        INSERT INTO accounts (id, account_code, name_ar, name_en, parent_id, level, is_parent, is_active, account_type_id, currency, created_at, updated_at)
        VALUES (
            uuid_generate_v4(), 
            '2110', 
            'الموردين', 
            'Suppliers', 
            v_parent_id, 
            3, 
            true, 
            true, 
            v_account_type_id, 
            'LYD', 
            NOW(), 
            NOW()
        );
        RAISE NOTICE 'Created Suppliers Account 2110';
    ELSE
        -- Ensure it is Level 3 and is_parent=true
        UPDATE accounts SET level = 3, is_parent = true WHERE account_code = '2110';
        RAISE NOTICE 'Updated Suppliers Account 2110 to Level 3';
    END IF;

    -- 2. Customers (1120)
    -- Parent should be 112 (Trade Receivables) or 11 (Current Assets)
    SELECT id INTO v_parent_id FROM accounts WHERE account_code = '112';
    IF v_parent_id IS NULL THEN
         SELECT id INTO v_parent_id FROM accounts WHERE account_code = '1000' OR account_code = '11' LIMIT 1;
    END IF;

    -- Get Account Type for Asset
    SELECT id INTO v_account_type_id FROM account_types WHERE name_en = 'Assets' OR normal_balance = 'debit' LIMIT 1;

    -- Create 1120 if not exists
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE account_code = '1120') THEN
        INSERT INTO accounts (id, account_code, name_ar, name_en, parent_id, level, is_parent, is_active, account_type_id, currency, created_at, updated_at)
        VALUES (
            uuid_generate_v4(), 
            '1120', 
            'العملاء', 
            'Customers', 
            v_parent_id, 
            3, 
            true, 
            true, 
            v_account_type_id, 
            'LYD', 
            NOW(), 
            NOW()
        );
        RAISE NOTICE 'Created Customers Account 1120';
    ELSE
        -- Ensure it is Level 3 and is_parent=true
        UPDATE accounts SET level = 3, is_parent = true WHERE account_code = '1120';
        RAISE NOTICE 'Updated Customers Account 1120 to Level 3';
    END IF;

     -- 3. Employees (2130) - Accrued Salaries
    -- Parent should be 213 (Accrued Liabilities) or similar
    SELECT id INTO v_parent_id FROM accounts WHERE account_code = '213';
    IF v_parent_id IS NULL THEN
         SELECT id INTO v_parent_id FROM accounts WHERE account_code = '2000' OR account_code = '21' LIMIT 1;
    END IF;

    -- Get Account Type for Liability
    SELECT id INTO v_account_type_id FROM account_types WHERE name_en = 'Liabilities' OR normal_balance = 'credit' LIMIT 1;

    -- Create 2130 if not exists
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE account_code = '2130') THEN
        INSERT INTO accounts (id, account_code, name_ar, name_en, parent_id, level, is_parent, is_active, account_type_id, currency, created_at, updated_at)
        VALUES (
            uuid_generate_v4(), 
            '2130', 
            'رواتب مستحقة (الموظفين)', 
            'Employees Payable', 
            v_parent_id, 
            3, 
            true, 
            true, 
            v_account_type_id, 
            'LYD', 
            NOW(), 
            NOW()
        );
        RAISE NOTICE 'Created Employees Account 2130';
    ELSE
        -- Ensure it is Level 3 and is_parent=true
        UPDATE accounts SET level = 3, is_parent = true WHERE account_code = '2130';
        RAISE NOTICE 'Updated Employees Account 2130 to Level 3';
    END IF;
    
END $$;
