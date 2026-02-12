-- ============================================
-- النظام المحاسبي المتكامل - Oshop Accounting
-- ============================================
-- Created: 2026-02-05
-- Version: 1.0.0
-- ============================================

-- إسقاط الجداول القديمة إذا كانت موجودة (للتطوير فقط)
DROP TABLE IF EXISTS account_transactions CASCADE;
DROP TABLE IF EXISTS journal_entry_lines CASCADE;
DROP TABLE IF EXISTS journal_entries CASCADE;
DROP TABLE IF EXISTS receipt_lines CASCADE;
DROP TABLE IF EXISTS receipts CASCADE;
DROP TABLE IF EXISTS payment_lines CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS inventory_layers CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS purchase_invoice_lines CASCADE;
DROP TABLE IF EXISTS purchase_invoices CASCADE;
DROP TABLE IF EXISTS sales_invoice_lines CASCADE;
DROP TABLE IF EXISTS sales_invoices CASCADE;
DROP TABLE IF EXISTS payroll_slips CASCADE;
DROP TABLE IF EXISTS fixed_assets CASCADE;
DROP TABLE IF EXISTS asset_categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS account_types CASCADE;

-- ============================================
-- 1. دليل الحسابات (Chart of Accounts)
-- ============================================

-- أنواع الحسابات الرئيسية
CREATE TABLE account_types (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
    normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- شجرة الحسابات
CREATE TABLE accounts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    account_code TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    account_type_id TEXT REFERENCES account_types(id),
    parent_id TEXT REFERENCES accounts(id),
    level INTEGER DEFAULT 1,
    is_parent BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    opening_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    currency TEXT DEFAULT 'LYD' CHECK (currency IN ('LYD', 'USD', 'EUR')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT
);

-- ============================================
-- 2. القيود اليومية (Journal Entries)
-- ============================================

CREATE TABLE journal_entries (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    entry_number TEXT UNIQUE NOT NULL,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    reference_type TEXT, -- 'manual', 'receipt', 'payment', 'invoice', 'payroll', etc.
    reference_id TEXT,
    total_debit DECIMAL(15,2) DEFAULT 0,
    total_credit DECIMAL(15,2) DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'cancelled')),
    posted_at TIMESTAMP WITH TIME ZONE,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE journal_entry_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    description TEXT,
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0,
    line_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. سندات القبض (Receipts)
-- ============================================

CREATE TABLE receipts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    receipt_number TEXT UNIQUE NOT NULL,
    receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id TEXT, -- يمكن ربطه مع جدول العملاء أو الحسابات
    total_amount DECIMAL(15,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'bank', 'card')),
    bank_account_id TEXT REFERENCES accounts(id), -- الحساب البنكي أو الخزينة
    main_description TEXT,
    status TEXT DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'cancelled')),
    journal_entry_id TEXT REFERENCES journal_entries(id),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE receipt_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    receipt_id TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT DEFAULT 'LYD',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0,
    amount_in_base_currency DECIMAL(15,2),
    description TEXT,
    line_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. سندات الدفع (Payments)
-- ============================================

CREATE TABLE payments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    payment_number TEXT UNIQUE NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_id TEXT, -- يمكن ربطه مع جدول الموردين أو الحسابات
    total_amount DECIMAL(15,2) NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('cash', 'bank', 'card', 'check')),
    bank_account_id TEXT REFERENCES accounts(id),
    check_number TEXT,
    main_description TEXT,
    status TEXT DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'cancelled')),
    journal_entry_id TEXT REFERENCES journal_entries(id),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE payment_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    amount DECIMAL(15,2) NOT NULL,
    currency TEXT DEFAULT 'LYD',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0,
    amount_in_base_currency DECIMAL(15,2),
    description TEXT,
    line_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. نظام المخزون (Inventory Management)
-- ============================================

CREATE TABLE inventory_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    item_code TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    category TEXT,
    unit TEXT DEFAULT 'piece',
    quantity_on_hand DECIMAL(15,3) DEFAULT 0,
    average_cost DECIMAL(15,4) DEFAULT 0,
    inventory_account_id TEXT REFERENCES accounts(id),
    cogs_account_id TEXT REFERENCES accounts(id), -- حساب تكلفة البضاعة المباعة
    is_active BOOLEAN DEFAULT TRUE,
    is_shein_card BOOLEAN DEFAULT FALSE, -- خاص ببطاقات شي ان
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- طبقات FIFO للمخزون
CREATE TABLE inventory_layers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    purchase_date DATE NOT NULL,
    purchase_reference TEXT, -- رقم فاتورة الشراء
    quantity DECIMAL(15,3) NOT NULL,
    remaining_quantity DECIMAL(15,3) NOT NULL,
    unit_cost DECIMAL(15,4) NOT NULL,
    card_number TEXT, -- رقم البطاقة إذا كان الصنف بطاقة شي ان
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- حركات المخزون
CREATE TABLE inventory_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    item_id TEXT NOT NULL REFERENCES inventory_items(id),
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'sale', 'adjustment', 'transfer')),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity DECIMAL(15,3) NOT NULL,
    unit_cost DECIMAL(15,4),
    total_cost DECIMAL(15,2),
    reference_type TEXT, -- 'purchase_invoice', 'sales_invoice', 'journal_entry'
    reference_id TEXT,
    layer_id TEXT REFERENCES inventory_layers(id),
    journal_entry_id TEXT REFERENCES journal_entries(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. فواتير الشراء (Purchase Invoices)
-- ============================================

CREATE TABLE purchase_invoices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_account_id TEXT REFERENCES accounts(id),
    currency TEXT DEFAULT 'LYD',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    paid_amount DECIMAL(15,2) DEFAULT 0,
    remaining_amount DECIMAL(15,2),
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    journal_entry_id TEXT REFERENCES journal_entries(id),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE purchase_invoice_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_id TEXT NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    item_id TEXT REFERENCES inventory_items(id),
    description TEXT NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,4) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    card_number TEXT, -- رقم البطاقة إذا كان الصنف بطاقة شي ان
    line_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. فواتير البيع (Sales Invoices)
-- ============================================

CREATE TABLE sales_invoices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_account_id TEXT REFERENCES accounts(id),
    currency TEXT DEFAULT 'LYD',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0,
    subtotal DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    total_cost DECIMAL(15,2) DEFAULT 0, -- تكلفة البضاعة المباعة
    paid_amount DECIMAL(15,2) DEFAULT 0,
    remaining_amount DECIMAL(15,2),
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
    journal_entry_id TEXT REFERENCES journal_entries(id),
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE sales_invoice_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_id TEXT NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    item_id TEXT REFERENCES inventory_items(id),
    description TEXT NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,4) NOT NULL,
    unit_cost DECIMAL(15,4), -- التكلفة من FIFO
    total DECIMAL(15,2) NOT NULL,
    card_number TEXT, -- رقم البطاقة المستخدمة
    line_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. نظام الرواتب (Payroll)
-- ============================================

CREATE TABLE payroll_slips (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    slip_number TEXT UNIQUE NOT NULL,
    employee_id TEXT, -- يمكن ربطه مع جدول الموظفين
    employee_name TEXT NOT NULL,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    basic_salary DECIMAL(15,2) NOT NULL,
    basic_salary_account_id TEXT REFERENCES accounts(id), -- حساب مصروف الرواتب
    overtime DECIMAL(15,2) DEFAULT 0,
    overtime_account_id TEXT REFERENCES accounts(id),
    allowances DECIMAL(15,2) DEFAULT 0,
    allowances_account_id TEXT REFERENCES accounts(id),
    absences DECIMAL(15,2) DEFAULT 0,
    deductions DECIMAL(15,2) DEFAULT 0,
    advances DECIMAL(15,2) DEFAULT 0,
    advances_account_id TEXT REFERENCES accounts(id),
    net_salary DECIMAL(15,2) NOT NULL,
    employee_payable_account_id TEXT REFERENCES accounts(id), -- حساب رواتب مستحقة
    journal_entry_id TEXT REFERENCES journal_entries(id),
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 9. الأصول الثابتة (Fixed Assets)
-- ============================================

CREATE TABLE asset_categories (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    depreciation_method TEXT DEFAULT 'straight_line' CHECK (depreciation_method IN ('straight_line', 'declining_balance')),
    useful_life_years INTEGER,
    salvage_value_percent DECIMAL(5,2) DEFAULT 0,
    asset_account_id TEXT REFERENCES accounts(id),
    depreciation_account_id TEXT REFERENCES accounts(id),
    accumulated_depreciation_account_id TEXT REFERENCES accounts(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE fixed_assets (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    asset_code TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    category_id TEXT REFERENCES asset_categories(id),
    purchase_date DATE NOT NULL,
    cost DECIMAL(15,2) NOT NULL,
    salvage_value DECIMAL(15,2) DEFAULT 0,
    useful_life_years INTEGER,
    accumulated_depreciation DECIMAL(15,2) DEFAULT 0,
    net_book_value DECIMAL(15,2),
    is_active BOOLEAN DEFAULT TRUE,
    location TEXT,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 10. جدول معاملات الحسابات (Account Transactions View)
-- ============================================
-- هذا جدول مساعد لتتبع جميع الحركات على الحسابات

CREATE TABLE account_transactions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    transaction_date DATE NOT NULL,
    description TEXT,
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0,
    balance DECIMAL(15,2),
    reference_type TEXT,
    reference_id TEXT,
    journal_entry_id TEXT REFERENCES journal_entries(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Indexes للأداء
-- ============================================

CREATE INDEX idx_accounts_parent ON accounts(parent_id);
CREATE INDEX idx_accounts_type ON accounts(account_type_id);
CREATE INDEX idx_accounts_code ON accounts(account_code);

CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);
CREATE INDEX idx_journal_entry_lines_entry ON journal_entry_lines(entry_id);
CREATE INDEX idx_journal_entry_lines_account ON journal_entry_lines(account_id);

CREATE INDEX idx_receipts_date ON receipts(receipt_date);
CREATE INDEX idx_receipts_customer ON receipts(customer_id);
CREATE INDEX idx_receipt_lines_receipt ON receipt_lines(receipt_id);

CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_supplier ON payments(supplier_id);
CREATE INDEX idx_payment_lines_payment ON payment_lines(payment_id);

CREATE INDEX idx_inventory_items_code ON inventory_items(item_code);
CREATE INDEX idx_inventory_layers_item ON inventory_layers(item_id);
CREATE INDEX idx_inventory_transactions_item ON inventory_transactions(item_id);

CREATE INDEX idx_purchase_invoices_date ON purchase_invoices(invoice_date);
CREATE INDEX idx_sales_invoices_date ON sales_invoices(invoice_date);

CREATE INDEX idx_account_transactions_account ON account_transactions(account_id);
CREATE INDEX idx_account_transactions_date ON account_transactions(transaction_date);

-- ============================================
-- بيانات أولية: أنواع الحسابات
-- ============================================

INSERT INTO account_types (id, name_ar, name_en, category, normal_balance, sort_order) VALUES
('type_asset', 'الأصول', 'Assets', 'asset', 'debit', 1),
('type_liability', 'الالتزامات', 'Liabilities', 'liability', 'credit', 2),
('type_equity', 'حقوق الملكية', 'Equity', 'equity', 'credit', 3),
('type_revenue', 'الإيرادات', 'Revenue', 'revenue', 'credit', 4),
('type_expense', 'المصروفات', 'Expenses', 'expense', 'debit', 5);

-- ============================================
-- بيانات أولية: شجرة حسابات تجريبية
-- ============================================

-- الأصول الرئيسية
INSERT INTO accounts (id, account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent) VALUES
('acc_assets', '1000', 'الأصول', 'Assets', 'type_asset', NULL, 1, true),
('acc_current_assets', '1100', 'الأصول المتداولة', 'Current Assets', 'type_asset', 'acc_assets', 2, true),
('acc_cash', '1110', 'النقدية والبنوك', 'Cash and Banks', 'type_asset', 'acc_current_assets', 3, true),
('acc_cash_lyd', '1111', 'كاش ليبي', 'Cash LYD', 'type_asset', 'acc_cash', 4, false),
('acc_bank_lyd', '1112', 'مصرف', 'Bank Account', 'type_asset', 'acc_cash', 4, false),
('acc_cash_usd', '1113', 'دولار كاش', 'Cash USD', 'type_asset', 'acc_cash', 4, false),
('acc_receivables', '1120', 'الذمم المدينة', 'Accounts Receivable', 'type_asset', 'acc_current_assets', 3, true),
('acc_inventory', '1130', 'المخزون', 'Inventory', 'type_asset', 'acc_current_assets', 3, true);

-- الالتزامات الرئيسية
INSERT INTO accounts (id, account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent) VALUES
('acc_liabilities', '2000', 'الالتزامات', 'Liabilities', 'type_liability', NULL, 1, true),
('acc_current_liab', '2100', 'الالتزامات المتداولة', 'Current Liabilities', 'type_liability', 'acc_liabilities', 2, true),
('acc_payables', '2110', 'الذمم الدائنة', 'Accounts Payable', 'type_liability', 'acc_current_liab', 3, true),
('acc_salaries_payable', '2120', 'رواتب مستحقة', 'Salaries Payable', 'type_liability', 'acc_current_liab', 3, false);

-- حقوق الملكية
INSERT INTO accounts (id, account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent) VALUES
('acc_equity', '3000', 'حقوق الملكية', 'Equity', 'type_equity', NULL, 1, true),
('acc_capital', '3100', 'رأس المال', 'Capital', 'type_equity', 'acc_equity', 2, false),
('acc_retained_earnings', '3200', 'الأرباح المحتجزة', 'Retained Earnings', 'type_equity', 'acc_equity', 2, false);

-- الإيرادات
INSERT INTO accounts (id, account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent) VALUES
('acc_revenue', '4000', 'الإيرادات', 'Revenue', 'type_revenue', NULL, 1, true),
('acc_sales', '4100', 'إيرادات المبيعات', 'Sales Revenue', 'type_revenue', 'acc_revenue', 2, false);

-- المصروفات
INSERT INTO accounts (id, account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent) VALUES
('acc_expenses', '5000', 'المصروفات', 'Expenses', 'type_expense', NULL, 1, true),
('acc_cogs', '5100', 'تكلفة البضاعة المباعة', 'Cost of Goods Sold', 'type_expense', 'acc_expenses', 2, false),
('acc_salaries', '5200', 'مصروف الرواتب', 'Salaries Expense', 'type_expense', 'acc_expenses', 2, false),
('acc_general_exp', '5300', 'مصروفات عمومية', 'General Expenses', 'type_expense', 'acc_expenses', 2, false);

-- ============================================
-- Functions مساعدة
-- ============================================

-- Function لتحديث رصيد الحساب
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- سيتم تطويرها لاحقاً
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- النهاية
-- ============================================

COMMENT ON TABLE accounts IS 'شجرة الحسابات - Chart of Accounts';
COMMENT ON TABLE journal_entries IS 'القيود اليومية - Journal Entries';
COMMENT ON TABLE receipts IS 'سندات القبض - Receipts';
COMMENT ON TABLE payments IS 'سندات الدفع - Payments';
COMMENT ON TABLE inventory_items IS 'أصناف المخزون - Inventory Items';
COMMENT ON TABLE purchase_invoices IS 'فواتير الشراء - Purchase Invoices';
COMMENT ON TABLE sales_invoices IS 'فواتير البيع - Sales Invoices';

-- عرض إحصائيات الجداول المنشأة
SELECT 
    'تم إنشاء النظام المحاسبي بنجاح!' as status,
    COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'accounts', 'account_types', 'journal_entries', 'journal_entry_lines',
    'receipts', 'receipt_lines', 'payments', 'payment_lines',
    'inventory_items', 'inventory_layers', 'inventory_transactions',
    'purchase_invoices', 'purchase_invoice_lines',
    'sales_invoices', 'sales_invoice_lines',
    'payroll_slips', 'fixed_assets', 'asset_categories',
    'account_transactions'
);
