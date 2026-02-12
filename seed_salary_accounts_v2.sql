-- Ensure Salary and Expense Accounts Exist (Correct Hierarchy)
-- 5: Expenses
-- 51: Cost of Goods Sold (Direct Costs)
-- 52: General & Admin Expenses (Indirect Costs) -> Salaries go here

DO $$
DECLARE
    v_expense_root UUID;
    v_cogs_root UUID;
    v_ga_root UUID;
BEGIN
    -- 1. Ensure "Expenses" Root Exists
    SELECT id INTO v_expense_root FROM accounts_v2 WHERE code = '5';
    IF v_expense_root IS NULL THEN
        INSERT INTO accounts_v2 (name_ar, name_en, code, type_id, level, is_group, is_active, currency)
        SELECT 'المصروفات', 'Expenses', '5', id, 1, true, true, 'LYD'
        FROM account_types_v2 WHERE category = 'expense' LIMIT 1
        RETURNING id INTO v_expense_root;
    END IF;

    -- 2. Ensure "General & Admin Expenses" Group (52) Exists
    -- This distinguishes it from Cost of Goods Sold (51)
    SELECT id INTO v_ga_root FROM accounts_v2 WHERE code = '52';
    IF v_ga_root IS NULL THEN
        INSERT INTO accounts_v2 (name_ar, name_en, code, parent_id, type_id, level, is_group, is_active, currency)
        SELECT 'مصروفات عمومية وإدارية', 'General & Admin Expenses', '52', v_expense_root, type_id, 2, true, true, 'LYD'
        FROM accounts_v2 WHERE id = v_expense_root
        RETURNING id INTO v_ga_root;
    END IF;

    -- 3. Create Salary Accounts under 52 (5201, 5202)
    -- This avoids conflict with 5101 if it's COGS
    INSERT INTO accounts_v2 (name_ar, name_en, code, parent_id, type_id, level, is_group, is_active, currency, current_balance)
    SELECT 'رواتب وأجور', 'Salaries and Wages', '5201', v_ga_root, type_id, 3, false, true, 'LYD', 0
    FROM accounts_v2 WHERE id = v_ga_root
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO accounts_v2 (name_ar, name_en, code, parent_id, type_id, level, is_group, is_active, currency, current_balance)
    SELECT 'مكافأة نهاية الخدمة', 'End of Service Benefits', '5202', v_ga_root, type_id, 3, false, true, 'LYD', 0
    FROM accounts_v2 WHERE id = v_ga_root
    ON CONFLICT (code) DO NOTHING;

END $$;
