
DO $$
DECLARE
    v_asset_type_id UUID;
    v_liability_type_id UUID;
    v_equity_type_id UUID;
    v_revenue_type_id UUID;
    v_expense_type_id UUID;
    
    v_customers_id UUID;
    v_suppliers_id UUID;
    v_employees_id UUID;
    v_inventory_id UUID;
    v_sales_id UUID;
    v_cogs_id UUID;
BEGIN
    -- 1. Get Account Types (Create if missing)
    SELECT id INTO v_asset_type_id FROM account_types_v2 WHERE name_en = 'Assets';
    IF v_asset_type_id IS NULL THEN
        INSERT INTO account_types_v2 (name_ar, name_en, category, normal_balance) VALUES ('أصول', 'Assets', 'asset', 'debit') RETURNING id INTO v_asset_type_id;
    END IF;

    SELECT id INTO v_liability_type_id FROM account_types_v2 WHERE name_en = 'Liabilities';
    IF v_liability_type_id IS NULL THEN
        INSERT INTO account_types_v2 (name_ar, name_en, category, normal_balance) VALUES ('خصوم', 'Liabilities', 'liability', 'credit') RETURNING id INTO v_liability_type_id;
    END IF;

    SELECT id INTO v_equity_type_id FROM account_types_v2 WHERE name_en = 'Equity';
        IF v_equity_type_id IS NULL THEN
        INSERT INTO account_types_v2 (name_ar, name_en, category, normal_balance) VALUES ('حقوق ملكية', 'Equity', 'equity', 'credit') RETURNING id INTO v_equity_type_id;
    END IF;

    SELECT id INTO v_revenue_type_id FROM account_types_v2 WHERE name_en = 'Revenue';
    IF v_revenue_type_id IS NULL THEN
        INSERT INTO account_types_v2 (name_ar, name_en, category, normal_balance) VALUES ('إيرادات', 'Revenue', 'revenue', 'credit') RETURNING id INTO v_revenue_type_id;
    END IF;

    SELECT id INTO v_expense_type_id FROM account_types_v2 WHERE name_en = 'Expenses';
    IF v_expense_type_id IS NULL THEN
        INSERT INTO account_types_v2 (name_ar, name_en, category, normal_balance) VALUES ('مصروفات', 'Expenses', 'expense', 'debit') RETURNING id INTO v_expense_type_id;
    END IF;

    -- 2. Create Control Accounts if missing

    -- Customers Control (Assets - 1120)
    SELECT id INTO v_customers_id FROM accounts_v2 WHERE code = '1120';
    IF v_customers_id IS NULL THEN
        INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, current_balance)
        VALUES ('1120', 'العملاء', 'Accounts Receivable', v_asset_type_id, 2, true, 0)
        RETURNING id INTO v_customers_id;
    END IF;

    -- Suppliers Control (Liabilities - 2110)
    SELECT id INTO v_suppliers_id FROM accounts_v2 WHERE code = '2110';
    IF v_suppliers_id IS NULL THEN
        INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, current_balance)
        VALUES ('2110', 'الموردين', 'Accounts Payable', v_liability_type_id, 2, true, 0)
        RETURNING id INTO v_suppliers_id;
    END IF;
    
    -- Employees Control (Liabilities - 2130)
    SELECT id INTO v_employees_id FROM accounts_v2 WHERE code = '2130';
    IF v_employees_id IS NULL THEN
        INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, current_balance)
        VALUES ('2130', 'الموظفين', 'Employees Payable', v_liability_type_id, 2, true, 0)
        RETURNING id INTO v_employees_id;
    END IF;

    -- Inventory Control (Assets - 113001)
    SELECT id INTO v_inventory_id FROM accounts_v2 WHERE code = '113001';
    IF v_inventory_id IS NULL THEN
        INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, current_balance)
        VALUES ('113001', 'مخزون بضاعة', 'Inventory Asset', v_asset_type_id, 4, false, 0)
        RETURNING id INTO v_inventory_id;
    END IF;

    -- Sales Revenue (Revenue - 410001)
    SELECT id INTO v_sales_id FROM accounts_v2 WHERE code = '410001';
    IF v_sales_id IS NULL THEN
        INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, current_balance)
        VALUES ('410001', 'إيرادات مبيعات', 'Sales Revenue', v_revenue_type_id, 4, false, 0)
        RETURNING id INTO v_sales_id;
    END IF;

    -- COGS Expense (Expense - 510001)
    SELECT id INTO v_cogs_id FROM accounts_v2 WHERE code = '510001';
    IF v_cogs_id IS NULL THEN
        INSERT INTO accounts_v2 (code, name_ar, name_en, type_id, level, is_group, current_balance)
        VALUES ('510001', 'تكلفة البضاعة المباعة', 'Cost of Goods Sold', v_expense_type_id, 4, false, 0)
        RETURNING id INTO v_cogs_id;
    END IF;


    -- 3. Populate System Accounts Table
    
    -- Disable specific trigger to bypass "locked" check
    EXECUTE 'ALTER TABLE system_accounts DISABLE TRIGGER prevent_system_account_changes';

    INSERT INTO system_accounts (key, account_id, description, is_locked)
    VALUES ('CUSTOMERS_CONTROL', v_customers_id, 'Accounts Receivable Control', TRUE)
    ON CONFLICT (key) DO UPDATE SET account_id = EXCLUDED.account_id;

    INSERT INTO system_accounts (key, account_id, description, is_locked)
    VALUES ('SUPPLIERS_CONTROL', v_suppliers_id, 'Accounts Payable Control', TRUE)
    ON CONFLICT (key) DO UPDATE SET account_id = EXCLUDED.account_id;

    INSERT INTO system_accounts (key, account_id, description, is_locked)
    VALUES ('EMPLOYEES_PAYABLE', v_employees_id, 'Employees Payable Control', TRUE)
    ON CONFLICT (key) DO UPDATE SET account_id = EXCLUDED.account_id;

    INSERT INTO system_accounts (key, account_id, description, is_locked)
    VALUES ('INVENTORY_ASSET', v_inventory_id, 'Inventory Asset Account', TRUE)
    ON CONFLICT (key) DO UPDATE SET account_id = EXCLUDED.account_id;

    INSERT INTO system_accounts (key, account_id, description, is_locked)
    VALUES ('SALES_REVENUE', v_sales_id, 'Sales Revenue Account', TRUE)
    ON CONFLICT (key) DO UPDATE SET account_id = EXCLUDED.account_id;

    INSERT INTO system_accounts (key, account_id, description, is_locked)
    VALUES ('COGS_EXPENSE', v_cogs_id, 'COGS Expense Account', TRUE)
    ON CONFLICT (key) DO UPDATE SET account_id = EXCLUDED.account_id;

    -- Re-enable triggers
    EXECUTE 'ALTER TABLE system_accounts ENABLE TRIGGER prevent_system_account_changes';

END $$;
