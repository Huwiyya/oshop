-- Fix for missing accounts 3, 4, 5
-- This script will delete and recreate them with ONLY the columns that exist

BEGIN;

-- First, delete existing accounts 3, 4, 5 if they exist
DELETE FROM accounts_v2 WHERE code IN ('3', '4', '5');

-- Get type IDs
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

    -- Insert Equity (3)
    INSERT INTO accounts_v2 (
        code, name_ar, name_en, type_id, parent_id, level, is_group, current_balance
    ) VALUES (
        '3', 'حقوق الملكية', 'Equity', equity_type_id, NULL, 1, true, 0
    );

    -- Insert Revenue (4)
    INSERT INTO accounts_v2 (
        code, name_ar, name_en, type_id, parent_id, level, is_group, current_balance
    ) VALUES (
        '4', 'الإيرادات', 'Revenue', revenue_type_id, NULL, 1, true, 0
    );

    -- Insert Expenses (5)
    INSERT INTO accounts_v2 (
        code, name_ar, name_en, type_id, parent_id, level, is_group, current_balance
    ) VALUES (
        '5', 'المصروفات', 'Expenses', expense_type_id, NULL, 1, true, 0
    );

    RAISE NOTICE 'Accounts 3, 4, 5 recreated successfully!';
END $$;

COMMIT;

-- Verify
SELECT code, name_ar, name_en, level, is_group
FROM accounts_v2 
WHERE code IN ('3', '4', '5')
ORDER BY code;
