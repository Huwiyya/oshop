-- =============================================
-- Recreate Accounting Schema & Seed Data
-- =============================================
-- Run this script to restore the accounting tables after a full wipe.

BEGIN;

-- 1. Create account_types table
CREATE TABLE IF NOT EXISTS public.account_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create accounts table
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    parent_id UUID REFERENCES public.accounts(id),
    account_type_id UUID REFERENCES public.account_types(id) NOT NULL,
    level INTEGER NOT NULL,
    is_parent BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    currency TEXT DEFAULT 'LYD',
    description TEXT,
    cash_flow_type TEXT CHECK (cash_flow_type IN ('operating', 'investing', 'financing')),
    current_balance DECIMAL(19,4) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_code)
);

-- 3. Seed Account Types
-- We use a DO block to insert only if empty, or we can just insert on conflict do nothing.
-- But since we are "starting from zero", we assume empty.

INSERT INTO public.account_types (name_ar, name_en, category, normal_balance) VALUES
('أصول', 'Assets', 'asset', 'debit'),
('خصوم', 'Liabilities', 'liability', 'credit'),
('حقوق ملكية', 'Equity', 'equity', 'credit'),
('إيرادات', 'Revenue', 'revenue', 'credit'),
('مصروفات', 'Expenses', 'expense', 'debit')
ON CONFLICT DO NOTHING;

-- ============================================
-- 4. Seed Root Accounts (Level 1)
-- ============================================

DO $$
DECLARE
    v_asset_type UUID;
    v_liability_type UUID;
    v_equity_type UUID;
    v_revenue_type UUID;
    v_expense_type UUID;

    -- Parent IDs
    v_assets_id UUID;
    v_liabilities_id UUID;
    v_equity_id UUID;
    v_revenue_id UUID;
    v_expenses_id UUID;

    -- Level 2 IDs
    v_curr_assets_id UUID;
    v_curr_liab_id UUID;
    v_shipping_rev_id UUID;
    v_gen_rev_id UUID;
    v_cos_id UUID;
    v_admin_exp_id UUID;
    v_marketing_exp_id UUID;

    -- Level 3 IDs
    v_cash_id UUID;
    v_receivables_id UUID;
    v_inventory_id UUID;
    v_payables_id UUID;

BEGIN
    -- Get Types
    SELECT id INTO v_asset_type FROM public.account_types WHERE category = 'asset' LIMIT 1;
    SELECT id INTO v_liability_type FROM public.account_types WHERE category = 'liability' LIMIT 1;
    SELECT id INTO v_equity_type FROM public.account_types WHERE category = 'equity' LIMIT 1;
    SELECT id INTO v_revenue_type FROM public.account_types WHERE category = 'revenue' LIMIT 1;
    SELECT id INTO v_expense_type FROM public.account_types WHERE category = 'expense' LIMIT 1;

    ---------------------------------------------------------------------------
    -- LEVEL 1: Main Groups
    ---------------------------------------------------------------------------
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, level, is_parent, is_active)
    VALUES ('1', 'الأصول', 'Assets', v_asset_type, 1, TRUE, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_assets_id;

    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, level, is_parent, is_active)
    VALUES ('2', 'الخصوم', 'Liabilities', v_liability_type, 1, TRUE, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_liabilities_id;

    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, level, is_parent, is_active)
    VALUES ('3', 'حقوق الملكية', 'Equity', v_equity_type, 1, TRUE, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_equity_id;

    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, level, is_parent, is_active)
    VALUES ('4', 'الإيرادات', 'Revenue', v_revenue_type, 1, TRUE, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_revenue_id;

    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, level, is_parent, is_active)
    VALUES ('5', 'المصروفات', 'Expenses', v_expense_type, 1, TRUE, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_expenses_id;

    ---------------------------------------------------------------------------
    -- LEVEL 2: Sub-Groups
    ---------------------------------------------------------------------------
    
    -- Assets -> Current Assets (11)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('11', 'الأصول المتداولة', 'Current Assets', v_asset_type, v_assets_id, 2, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_curr_assets_id;

    -- Liabilities -> Current Liabilities (21)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('21', 'الالتزامات المتداولة', 'Current Liabilities', v_liability_type, v_liabilities_id, 2, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_curr_liab_id;

    -- Revenue -> Shipping Services (41)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('41', 'خدمات الشحن', 'Shipping Services', v_revenue_type, v_revenue_id, 2, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_shipping_rev_id;

    -- Revenue -> General Services (42)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('42', 'خدمات عامة', 'General Services', v_revenue_type, v_revenue_id, 2, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_gen_rev_id;

    -- Expenses -> Cost of Sales (51)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('51', 'تكلفة المبيعات', 'Cost of Sales', v_expense_type, v_expenses_id, 2, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_cos_id;

    -- Expenses -> General & Admin (52)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('52', 'مصروفات عمومية وإدارية', 'General & Admin Expenses', v_expense_type, v_expenses_id, 2, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_admin_exp_id;

    -- Expenses -> Selling & Marketing (53)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('53', 'مصروفات بيع وتسويق', 'Selling & Marketing Expenses', v_expense_type, v_expenses_id, 2, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_marketing_exp_id;


    ---------------------------------------------------------------------------
    -- LEVEL 3 & 4: Detailed Accounts
    ---------------------------------------------------------------------------

    -- 1. ASSETS
    -- Cash & Banks (111)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('111', 'النقدية وما في حكمها', 'Cash and Cash Equivalents', v_asset_type, v_curr_assets_id, 3, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_cash_id;

        -- 1111: Main Treasury
        INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
        VALUES ('1111', 'الخزينة الرئيسية', 'Main Treasury', v_asset_type, v_cash_id, 4, FALSE)
        ON CONFLICT (account_code) DO UPDATE SET name_ar = 'الخزينة الرئيسية', name_en = 'Main Treasury';

        -- 1112: Sales Treasury
        INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
        VALUES ('1112', 'خزينة المبيعات', 'Sales Treasury', v_asset_type, v_cash_id, 4, FALSE)
        ON CONFLICT (account_code) DO NOTHING;

        -- 1113: Bank (Keeping for reference)
        INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
        VALUES ('1113', 'المصرف', 'Bank Account', v_asset_type, v_cash_id, 4, FALSE)
        ON CONFLICT (account_code) DO NOTHING;

    -- Receivables (112)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('112', 'الذمم المدينة', 'Accounts Receivable', v_asset_type, v_curr_assets_id, 3, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_receivables_id;

        INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
        VALUES ('1120', 'العملاء', 'Customers', v_asset_type, v_receivables_id, 4, TRUE) -- Control Account
        ON CONFLICT (account_code) DO NOTHING;

    -- Inventory (113)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('113', 'المخزون', 'Inventory', v_asset_type, v_curr_assets_id, 3, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_inventory_id;

        INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
        VALUES ('1130', 'المخزون الحالي', 'Current Inventory', v_asset_type, v_inventory_id, 4, TRUE) -- Control Account
        ON CONFLICT (account_code) DO NOTHING;

        INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
        VALUES ('1131', 'تسوية مخزون سالب', 'Negative Inventory Clearing', v_asset_type, v_inventory_id, 4, FALSE)
        ON CONFLICT (account_code) DO NOTHING;

    -- Wallets (114)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('114', 'أرصدة المحافظ الإلكترونية', 'Electronic Wallet Balances', v_asset_type, v_curr_assets_id, 3, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_assets_id; -- Reusing variable temporarily
    
        INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
        VALUES ('1141', 'محفظة عامة', 'Wallet - General', v_asset_type, v_assets_id, 4, FALSE)
        ON CONFLICT (account_code) DO NOTHING;

    -- Related Parties (115)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('115', 'أرصدة أطراف ذات علاقة', 'Due from Related Parties', v_asset_type, v_curr_assets_id, 3, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_assets_id;

        INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
        VALUES ('1151', 'Oshop Tripoli', 'Oshop Tripoli', v_asset_type, v_assets_id, 4, FALSE)
        ON CONFLICT (account_code) DO NOTHING;


    -- 2. LIABILITIES
    -- Payables (211)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('211', 'الذمم الدائنة', 'Accounts Payable', v_liability_type, v_curr_liab_id, 3, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_payables_id;

        INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
        VALUES ('2110', 'الموردين', 'Suppliers', v_liability_type, v_payables_id, 4, TRUE) -- Control Account
        ON CONFLICT (account_code) DO NOTHING;

    -- Accrued Expenses (212)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('212', 'مصروفات مستحقة', 'Accrued Expenses', v_liability_type, v_curr_liab_id, 3, FALSE)
    ON CONFLICT (account_code) DO NOTHING;

    -- Employee Clearing (213)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('213', 'حساب تسوية الموظفين', 'Employee Clearing Account', v_liability_type, v_curr_liab_id, 3, FALSE)
    ON CONFLICT (account_code) DO NOTHING;


    -- 3. EQUITY
    -- Capital, Retained Earnings
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('3001', 'رأس المال', 'Capital', v_equity_type, v_equity_id, 2, FALSE)
    ON CONFLICT (account_code) DO NOTHING;

    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('3002', 'الأرباح المحتجزة', 'Retained Earnings', v_equity_type, v_equity_id, 2, FALSE)
    ON CONFLICT (account_code) DO NOTHING;

    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('3003', 'تحويلات بين الحسابات', 'Inter-account Transfers', v_equity_type, v_equity_id, 2, FALSE)
    ON CONFLICT (account_code) DO NOTHING;

    -- Partners (31)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('31', 'جاري الشركاء', 'Partners Current Accounts', v_equity_type, v_equity_id, 2, TRUE)
    ON CONFLICT (account_code) DO UPDATE SET updated_at = NOW() RETURNING id INTO v_assets_id; -- Reuse

        INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
        VALUES ('3101', 'فخر الدين', 'Fakhruddin', v_equity_type, v_assets_id, 3, FALSE),
               ('3102', 'فراس', 'Firas', v_equity_type, v_assets_id, 3, FALSE),
               ('3103', 'سيف الدين', 'Saifuddin', v_equity_type, v_assets_id, 3, FALSE)
        ON CONFLICT (account_code) DO NOTHING;


    -- 4. REVENUE
    -- Shipping Services (41)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('4101', 'شحن جوي - أمريكا', 'Air Freight - US', v_revenue_type, v_shipping_rev_id, 3, FALSE),
           ('4102', 'شحن جوي - الإمارات', 'Air Freight - UAE', v_revenue_type, v_shipping_rev_id, 3, FALSE),
           ('4103', 'شحن جوي - السعودية', 'Air Freight - KSA', v_revenue_type, v_shipping_rev_id, 3, FALSE),
           ('4104', 'شحن جوي - الصين', 'Air Freight - China', v_revenue_type, v_shipping_rev_id, 3, FALSE),
           ('4105', 'شحن جوي - تركيا', 'Air Freight - Turkey', v_revenue_type, v_shipping_rev_id, 3, FALSE),
           ('4106', 'شحن بحري - الإمارات', 'Sea Freight - UAE', v_revenue_type, v_shipping_rev_id, 3, FALSE),
           ('4107', 'شحن بحري - السعودية', 'Sea Freight - KSA', v_revenue_type, v_shipping_rev_id, 3, FALSE)
    ON CONFLICT (account_code) DO NOTHING;

    -- General Services (42)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('4201', 'مبيعات مخزون', 'Inventory Sales', v_revenue_type, v_gen_rev_id, 3, FALSE),
           ('4202', 'خدمات شي إن', 'Shein Services', v_revenue_type, v_gen_rev_id, 3, FALSE),
           ('4203', 'شحن مجاني', 'Free Shipping', v_revenue_type, v_gen_rev_id, 3, FALSE),
           ('4204', 'وساطة شراء', 'Purchase Mediation', v_revenue_type, v_gen_rev_id, 3, FALSE)
    ON CONFLICT (account_code) DO NOTHING;


    -- 5. EXPENSES
    -- Cost of Sales (51)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('5101', 'تكلفة البضاعة المباعة', 'Cost of Goods Sold', v_expense_type, v_cos_id, 3, FALSE),
           ('5102', 'خسائر وتلفيات الشحن', 'Shipping Losses and Damages', v_expense_type, v_cos_id, 3, FALSE)
    ON CONFLICT (account_code) DO NOTHING;

    -- General & Admin (52)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('5201', 'رواتب', 'Salaries', v_expense_type, v_admin_exp_id, 3, FALSE),
           ('5202', 'إيجار', 'Rent', v_expense_type, v_admin_exp_id, 3, FALSE),
           ('5203', 'كهرباء ومرافق', 'Electricity & Utilities', v_expense_type, v_admin_exp_id, 3, FALSE),
           ('5204', 'خدمات الفرع', 'Branch Services', v_expense_type, v_admin_exp_id, 3, FALSE),
           ('5205', 'قرطاسية ومطبوعات', 'Stationery & Printing', v_expense_type, v_admin_exp_id, 3, FALSE),
           ('5206', 'صيانة وإصلاح', 'Repairs & Maintenance', v_expense_type, v_admin_exp_id, 3, FALSE),
           ('5207', 'مناديب توصيل', 'Delivery Agents', v_expense_type, v_admin_exp_id, 3, FALSE),
           ('5208', 'مواصلات', 'Transportation', v_expense_type, v_admin_exp_id, 3, FALSE)
    ON CONFLICT (account_code) DO NOTHING;

    -- Selling & Marketing (53)
    INSERT INTO public.accounts (account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent)
    VALUES ('5301', 'إعلانات ممولة', 'Sponsored Ads', v_expense_type, v_marketing_exp_id, 3, FALSE),
           ('5302', 'توصيل للعملاء', 'Delivery to Customers', v_expense_type, v_marketing_exp_id, 3, FALSE)
    ON CONFLICT (account_code) DO NOTHING;

END $$;

COMMIT;

SELECT 'Schema recreated and seeded successfully.' as status;
