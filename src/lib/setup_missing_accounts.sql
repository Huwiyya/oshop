-- Setup Missing Root Account Categories (Equity, Revenue, Expenses)

-- First, get the type IDs
DO $$
DECLARE
    equity_type_id UUID;
    revenue_type_id UUID;
    expense_type_id UUID;
BEGIN
    -- Get type IDs
    SELECT id INTO equity_type_id FROM account_types_v2 WHERE category = 'equity' LIMIT 1;
    SELECT id INTO revenue_type_id FROM account_types_v2 WHERE category = 'revenue' LIMIT 1;
    SELECT id INTO expense_type_id FROM account_types_v2 WHERE category = 'expense' LIMIT 1;

    -- Insert Equity (3) if not exists
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, parent_id, level, is_group, is_active, is_system, current_balance, currency, description)
    SELECT '3', 'حقوق الملكية', 'Equity', equity_type_id, NULL, 1, true, true, true, 0, 'LYD', 'Root equity accounts'
    WHERE NOT EXISTS (SELECT 1 FROM accounts_v2 WHERE code = '3');

    -- Insert Revenue (4) if not exists
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, parent_id, level, is_group, is_active, is_system, current_balance, currency, description)
    SELECT '4', 'الإيرادات', 'Revenue', revenue_type_id, NULL, 1, true, true, true, 0, 'LYD', 'Root revenue accounts'
    WHERE NOT EXISTS (SELECT 1 FROM accounts_v2 WHERE code = '4');

    -- Insert Expenses (5) if not exists
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, parent_id, level, is_group, is_active, is_system, current_balance, currency, description)
    SELECT '5', 'المصروفات', 'Expenses', expense_type_id, NULL, 1, true, true, true, 0, 'LYD', 'Root expense accounts'
    WHERE NOT EXISTS (SELECT 1 FROM accounts_v2 WHERE code = '5');

    RAISE NOTICE 'Root accounts setup complete!';
END $$;

-- Verify results
SELECT code, name_ar, name_en, level 
FROM accounts_v2 
WHERE level = 1 
ORDER BY code;
