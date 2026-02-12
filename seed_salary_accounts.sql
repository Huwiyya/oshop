-- Ensure Salary and Expense Accounts Exist
DO $$
DECLARE
    v_expense_root UUID;
    v_liability_root UUID;
BEGIN
    -- 1. Ensure "Expenses" Root Exists (Type=Expense, Level=1, Code=5)
    SELECT id INTO v_expense_root FROM accounts_v2 WHERE code = '5';
    IF v_expense_root IS NULL THEN
        INSERT INTO accounts_v2 (name_ar, name_en, code, type_id, level, is_group, is_active, currency)
        SELECT 'المصروفات', 'Expenses', '5', id, 1, true, true, 'LYD'
        FROM account_types_v2 WHERE category = 'expense' LIMIT 1
        RETURNING id INTO v_expense_root;
    END IF;

    -- 2. Create "General Expenses" Group (51)
    INSERT INTO accounts_v2 (name_ar, name_en, code, parent_id, type_id, level, is_group, is_active, currency)
    SELECT 'مصروفات عمومية وإدارية', 'General & Admin Expenses', '51', v_expense_root, type_id, 2, true, true, 'LYD'
    FROM accounts_v2 WHERE id = v_expense_root
    ON CONFLICT (code) DO NOTHING;

    -- 3. Create Salary Accounts (5101, 5102)
    INSERT INTO accounts_v2 (name_ar, name_en, code, parent_id, type_id, level, is_group, is_active, currency, current_balance)
    SELECT 'رواتب وأجور', 'Salaries and Wages', '5101', a.id, a.type_id, 3, false, true, 'LYD', 0
    FROM accounts_v2 a WHERE code = '51'
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO accounts_v2 (name_ar, name_en, code, parent_id, type_id, level, is_group, is_active, currency, current_balance)
    SELECT 'مكافأة نهاية الخدمة', 'End of Service Benefits', '5102', a.id, a.type_id, 3, false, true, 'LYD', 0
    FROM accounts_v2 a WHERE code = '51'
    ON CONFLICT (code) DO NOTHING;

     -- 4. Ensure "Liabilities" (2) -> "Current Liabilities" (21) exists
    SELECT id INTO v_liability_root FROM accounts_v2 WHERE code = '21';
    
    -- 5. Create "Accrued Salaries" (2131) under Current Liabilities
    -- Assuming 21 exists as per previous check.
    INSERT INTO accounts_v2 (name_ar, name_en, code, parent_id, type_id, level, is_group, is_active, currency, current_balance)
    SELECT 'رواتب مستحقة', 'Accrued Salaries', '2131', a.id, a.type_id, 3, false, true, 'LYD', 0
    FROM accounts_v2 a WHERE code = '21'
    ON CONFLICT (code) DO NOTHING;

END $$;
