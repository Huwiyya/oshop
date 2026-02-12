-- Comprehensive fix for accounts 3, 4, 5
-- This will UPDATE existing accounts or INSERT new ones

DO $$
DECLARE
    equity_type_id UUID;
    revenue_type_id UUID;
    expense_type_id UUID;
    account_3_exists BOOLEAN;
    account_4_exists BOOLEAN;
    account_5_exists BOOLEAN;
BEGIN
    -- Get type IDs
    SELECT id INTO equity_type_id FROM account_types_v2 WHERE category = 'equity' LIMIT 1;
    SELECT id INTO revenue_type_id FROM account_types_v2 WHERE category = 'revenue' LIMIT 1;
    SELECT id INTO expense_type_id FROM account_types_v2 WHERE category = 'expense' LIMIT 1;

    -- Check if accounts exist
    SELECT EXISTS(SELECT 1 FROM accounts_v2 WHERE code = '3') INTO account_3_exists;
    SELECT EXISTS(SELECT 1 FROM accounts_v2 WHERE code = '4') INTO account_4_exists;
    SELECT EXISTS(SELECT 1 FROM accounts_v2 WHERE code = '5') INTO account_5_exists;

    -- UPDATE or INSERT account 3 (Equity)
    IF account_3_exists THEN
        UPDATE accounts_v2 
        SET name_ar = 'حقوق الملكية',
            name_en = 'Equity',
            type_id = equity_type_id,
            parent_id = NULL,
            level = 1,
            is_group = true,
            updated_at = NOW()
        WHERE code = '3';
        RAISE NOTICE 'Updated account 3 (Equity)';
    ELSE
        INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, parent_id, level, is_group, current_balance)
        VALUES ('3', 'حقوق الملكية', 'Equity', equity_type_id, NULL, 1, true, 0);
        RAISE NOTICE 'Inserted account 3 (Equity)';
    END IF;

    -- UPDATE or INSERT account 4 (Revenue)
    IF account_4_exists THEN
        UPDATE accounts_v2 
        SET name_ar = 'الإيرادات',
            name_en = 'Revenue',
            type_id = revenue_type_id,
            parent_id = NULL,
            level = 1,
            is_group = true,
            updated_at = NOW()
        WHERE code = '4';
        RAISE NOTICE 'Updated account 4 (Revenue)';
    ELSE
        INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, parent_id, level, is_group, current_balance)
        VALUES ('4', 'الإيرادات', 'Revenue', revenue_type_id, NULL, 1, true, 0);
        RAISE NOTICE 'Inserted account 4 (Revenue)';
    END IF;

    -- UPDATE or INSERT account 5 (Expenses)
    IF account_5_exists THEN
        UPDATE accounts_v2 
        SET name_ar = 'المصروفات',
            name_en = 'Expenses',
            type_id = expense_type_id,
            parent_id = NULL,
            level = 1,
            is_group = true,
            updated_at = NOW()
        WHERE code = '5';
        RAISE NOTICE 'Updated account 5 (Expenses)';
    ELSE
        INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, parent_id, level, is_group, current_balance)
        VALUES ('5', 'المصروفات', 'Expenses', expense_type_id, NULL, 1, true, 0);
        RAISE NOTICE 'Inserted account 5 (Expenses)';
    END IF;

END $$;

-- Verify all level 1 accounts
SELECT code, name_ar, name_en, level, is_group, updated_at
FROM accounts_v2 
WHERE level = 1
ORDER BY code;
