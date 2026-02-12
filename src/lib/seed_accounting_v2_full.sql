
-- =============================================================================
-- SEED ACCOUNTING V2 (FULL RESET)
-- =============================================================================

DO $$
DECLARE
    -- Type IDs
    v_asset_type_id UUID;
    v_liability_type_id UUID;
    v_equity_type_id UUID;
    v_revenue_type_id UUID;
    v_expense_type_id UUID;
    
    -- Account IDs
    v_assets_id UUID;
    v_liabilities_id UUID;
    v_equity_id UUID;
    v_revenue_id UUID;
    v_expenses_id UUID;
    
    v_curr_assets_id UUID;
    v_curr_liab_id UUID;
    
    v_cash_control_id UUID;
    v_bank_control_id UUID;
    
    v_receivables_id UUID;
    v_customers_control_id UUID;
    
    v_payables_id UUID;
    v_suppliers_control_id UUID;
    v_employees_payable_id UUID;

    v_inventory_id UUID;
    v_cogs_id UUID;
    v_sales_revenue_id UUID;

BEGIN
    RAISE NOTICE 'Starting V2 System Reset & Seed...';

    -- 1. Truncate Data (Order matters for FKs)
    -- We use CASCADE to clean up children, journals, lines
    -- Check if tables exist first to avoid errors if run on clean DB
    TRUNCATE TABLE journal_lines_v2, journal_entries_v2, accounts_v2 CASCADE;
    
    -- Clear specific system account mappings to avoid conflicts (or set to NULL)
    UPDATE system_accounts SET account_id = NULL WHERE key IN ('CUSTOMERS_CONTROL', 'SUPPLIERS_CONTROL', 'EMPLOYEES_PAYABLE', 'EMPLOYEES_CONTROL');

    -- 2. Ensure Account Types
    
    -- Assets
    SELECT id INTO v_asset_type_id FROM account_types_v2 WHERE name_en = 'Assets';
    IF v_asset_type_id IS NULL THEN
        INSERT INTO account_types_v2 (name_ar, name_en, category, normal_balance) VALUES ('أصول', 'Assets', 'asset', 'debit') RETURNING id INTO v_asset_type_id;
    END IF;

    -- Liabilities
    SELECT id INTO v_liability_type_id FROM account_types_v2 WHERE name_en = 'Liabilities';
    IF v_liability_type_id IS NULL THEN
        INSERT INTO account_types_v2 (name_ar, name_en, category, normal_balance) VALUES ('خصوم', 'Liabilities', 'liability', 'credit') RETURNING id INTO v_liability_type_id;
    END IF;

    -- Equity
    SELECT id INTO v_equity_type_id FROM account_types_v2 WHERE name_en = 'Equity';
    IF v_equity_type_id IS NULL THEN
        INSERT INTO account_types_v2 (name_ar, name_en, category, normal_balance) VALUES ('حقوق ملكية', 'Equity', 'equity', 'credit') RETURNING id INTO v_equity_type_id;
    END IF;

    -- Revenue
    SELECT id INTO v_revenue_type_id FROM account_types_v2 WHERE name_en = 'Revenue';
    IF v_revenue_type_id IS NULL THEN
        INSERT INTO account_types_v2 (name_ar, name_en, category, normal_balance) VALUES ('إيرادات', 'Revenue', 'revenue', 'credit') RETURNING id INTO v_revenue_type_id;
    END IF;

    -- Expenses
    SELECT id INTO v_expense_type_id FROM account_types_v2 WHERE name_en = 'Expenses';
    IF v_expense_type_id IS NULL THEN
        INSERT INTO account_types_v2 (name_ar, name_en, category, normal_balance) VALUES ('مصروفات', 'Expenses', 'expense', 'debit') RETURNING id INTO v_expense_type_id;
    END IF;

    -- 3. Create Root Accounts (Level 1)
    
    -- 1 Assets
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, current_balance, is_system)
    VALUES ('1', 'الأصول', 'Assets', v_asset_type_id, 1, true, 0, true) RETURNING id INTO v_assets_id;

    -- 2 Liabilities
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, current_balance, is_system)
    VALUES ('2', 'الخصوم', 'Liabilities', v_liability_type_id, 1, true, 0, true) RETURNING id INTO v_liabilities_id;

    -- 3 Equity
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, current_balance, is_system)
    VALUES ('3', 'حقوق الملكية', 'Equity', v_equity_type_id, 1, true, 0, true) RETURNING id INTO v_equity_id;

    -- 4 Revenue
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, current_balance, is_system)
    VALUES ('4', 'الإيرادات', 'Revenue', v_revenue_type_id, 1, true, 0, true) RETURNING id INTO v_revenue_id;

    -- 5 Expenses
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, current_balance, is_system)
    VALUES ('5', 'المصروفات', 'Expenses', v_expense_type_id, 1, true, 0, true) RETURNING id INTO v_expenses_id;

    -- 4. Create Level 2 (Sub-groups)
    
    -- 11 Current Assets
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, parent_id, is_system)
    VALUES ('11', 'الأصول المتداولة', 'Current Assets', v_asset_type_id, 2, true, v_assets_id, true) RETURNING id INTO v_curr_assets_id;

    -- 21 Current Liabilities
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, parent_id, is_system)
    VALUES ('21', 'الخصوم المتداولة', 'Current Liabilities', v_liability_type_id, 2, true, v_liabilities_id, true) RETURNING id INTO v_curr_liab_id;

    -- 5. Create Level 3 (Controls & Categories)
    
    -- 111 Cash and Banks (Group) - Or separate
    -- Let's follow the user's implicit structure: 1110 Cash, 1111 Banks
    
    -- 1110 Cash Control
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, parent_id, is_system)
    VALUES ('1110', 'الخزينة (الصناديق)', 'Cash Accounts', v_asset_type_id, 3, true, v_curr_assets_id, true) RETURNING id INTO v_cash_control_id;

    -- 1111 Banks Control
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, parent_id, is_system)
    VALUES ('1111', 'البنوك', 'Bank Accounts', v_asset_type_id, 3, true, v_curr_assets_id, true) RETURNING id INTO v_bank_control_id;

    -- 112 Receivables / Customers
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, parent_id, is_system)
    VALUES ('1121', 'العملاء', 'Customers', v_asset_type_id, 3, true, v_curr_assets_id, true) RETURNING id INTO v_customers_control_id;

    -- 113 Inventory
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, parent_id, is_system)
    VALUES ('1131', 'المخزون', 'Inventory', v_asset_type_id, 3, true, v_curr_assets_id, true) RETURNING id INTO v_inventory_id;

    -- 211 Payables / Suppliers
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, parent_id, is_system)
    VALUES ('2111', 'الموردين', 'Suppliers', v_liability_type_id, 3, true, v_curr_liab_id, true) RETURNING id INTO v_suppliers_control_id;

    -- 213 Employees Payable
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, parent_id, is_system)
    VALUES ('2130', 'مستحقات الموظفين', 'Employees Payable', v_liability_type_id, 3, true, v_curr_liab_id, true) RETURNING id INTO v_employees_payable_id;

    -- 41 Sales Revenue
    INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, parent_id, is_system)
    VALUES ('4101', 'إيرادات المبيعات', 'Sales Revenue', v_revenue_type_id, 2, false, v_revenue_id, true) RETURNING id INTO v_sales_revenue_id;
    
    -- 51 COGS (Cost of Goods Sold)
     INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, parent_id, is_system)
    VALUES ('5101', 'تكلفة البضاعة المباعة', 'Cost of Goods Sold', v_expense_type_id, 2, false, v_expenses_id, true) RETURNING id INTO v_cogs_id;

    -- 6. Update System Accounts
    
    -- CUSTOMERS_CONTROL
    IF EXISTS (SELECT 1 FROM system_accounts WHERE key = 'CUSTOMERS_CONTROL') THEN
        UPDATE system_accounts SET account_id = v_customers_control_id WHERE key = 'CUSTOMERS_CONTROL';
    ELSE
        INSERT INTO system_accounts (key, account_id) VALUES ('CUSTOMERS_CONTROL', v_customers_control_id);
    END IF;

    -- SUPPLIERS_CONTROL
    IF EXISTS (SELECT 1 FROM system_accounts WHERE key = 'SUPPLIERS_CONTROL') THEN
        UPDATE system_accounts SET account_id = v_suppliers_control_id WHERE key = 'SUPPLIERS_CONTROL';
    ELSE
        INSERT INTO system_accounts (key, account_id) VALUES ('SUPPLIERS_CONTROL', v_suppliers_control_id);
    END IF;

    -- EMPLOYEES_PAYABLE
    IF EXISTS (SELECT 1 FROM system_accounts WHERE key = 'EMPLOYEES_PAYABLE') THEN
        UPDATE system_accounts SET account_id = v_employees_payable_id WHERE key = 'EMPLOYEES_PAYABLE';
    ELSE
        INSERT INTO system_accounts (key, account_id) VALUES ('EMPLOYEES_PAYABLE', v_employees_payable_id);
    END IF;



    RAISE NOTICE 'V2 System Reset & Seeded Successfully!';
END $$;
