-- ============================================
-- إصلاح جميع النواقص في السكيما - الإصدار المصحح
-- Complete Schema Missing Parts Fix - Fixed Version
-- ============================================
-- تاريخ الإنشاء: 2026-02-06
-- الهدف: إصلاح جميع الجداول والأعمدة الناقصة
-- التحديث: إضافة جدول customers أولاً قبل استخدامه
-- ============================================

-- 0. إنشاء جدول customers أولاً (إذا لم يكن موجوداً)
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    customer_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_name_ar TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'ليبيا',
    tax_number TEXT,
    credit_limit NUMERIC(15,2) DEFAULT 0,
    current_balance NUMERIC(15,2) DEFAULT 0,
    customer_type TEXT CHECK (customer_type IN ('individual', 'company', 'government')),
    payment_terms TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    -- Accounting Integration
    receivable_account_id TEXT REFERENCES accounts(id),
    sales_account_id TEXT REFERENCES accounts(id),
    -- Metadata
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for customers
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_number ON customers(customer_number);
CREATE INDEX IF NOT EXISTS idx_customers_balance ON customers(current_balance);

COMMENT ON TABLE customers IS 'العملاء - Customers';

-- 1. إضافة is_posted لجدول journal_entries (CRITICAL!)
-- ============================================
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT FALSE;

-- Update existing entries based on status
UPDATE journal_entries 
SET is_posted = (status = 'posted' OR status = 'approved')
WHERE is_posted IS NULL OR is_posted = FALSE;

-- Index للأداء
CREATE INDEX IF NOT EXISTS idx_journal_entries_posted 
ON journal_entries(is_posted) WHERE is_posted = TRUE;

COMMENT ON COLUMN journal_entries.is_posted IS 'القيد مرحّل - لا يمكن حذفه';

-- 2. إنشاء جدول employees
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    employee_number TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    national_id TEXT UNIQUE,
    hire_date DATE,
    birth_date DATE,
    job_title TEXT,
    department TEXT,
    basic_salary NUMERIC(15,2) DEFAULT 0,
    allowances NUMERIC(15,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    termination_date DATE,
    termination_reason TEXT,
    notes TEXT,
    -- Accounting Integration
    payable_account_id TEXT REFERENCES accounts(id),
    salary_expense_account_id TEXT REFERENCES accounts(id),
    advances_account_id TEXT REFERENCES accounts(id),
    -- Metadata
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_number ON employees(employee_number);
CREATE INDEX IF NOT EXISTS idx_employees_national_id ON employees(national_id);

COMMENT ON TABLE employees IS 'الموظفون - Employees';

-- 3. إنشاء جدول suppliers
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    supplier_number TEXT UNIQUE NOT NULL,
    supplier_name TEXT NOT NULL,
    supplier_name_ar TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'ليبيا',
    tax_number TEXT,
    credit_limit NUMERIC(15,2) DEFAULT 0,
    current_balance NUMERIC(15,2) DEFAULT 0,
    supplier_type TEXT CHECK (supplier_type IN ('local', 'international', 'service', 'goods')),
    payment_terms TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    -- Accounting Integration
    payable_account_id TEXT REFERENCES accounts(id),
    -- Metadata
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_number ON suppliers(supplier_number);
CREATE INDEX IF NOT EXISTS idx_suppliers_balance ON suppliers(current_balance);

COMMENT ON TABLE suppliers IS 'الموردون - Suppliers';

-- 4. إنشاء sales_invoices
-- ============================================
CREATE TABLE IF NOT EXISTS sales_invoices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    customer_id TEXT REFERENCES customers(id),
    subtotal NUMERIC(15,2) DEFAULT 0,
    tax_amount NUMERIC(15,2) DEFAULT 0,
    discount_amount NUMERIC(15,2) DEFAULT 0,
    total_amount NUMERIC(15,2) DEFAULT 0,
    paid_amount NUMERIC(15,2) DEFAULT 0,
    remaining_amount NUMERIC(15,2) DEFAULT 0,
    status TEXT CHECK (status IN ('draft', 'pending', 'paid', 'partial', 'overdue', 'cancelled')) DEFAULT 'pending',
    payment_terms TEXT,
    notes TEXT,
    -- Accounting Integration
    journal_entry_id TEXT REFERENCES journal_entries(id),
    -- Metadata
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_journal ON sales_invoices(journal_entry_id);

COMMENT ON TABLE sales_invoices IS 'فواتير المبيعات - Sales Invoices';

-- 5. إنشاء purchase_invoices
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE,
    supplier_id TEXT REFERENCES suppliers(id),
    subtotal NUMERIC(15,2) DEFAULT 0,
    tax_amount NUMERIC(15,2) DEFAULT 0,
    discount_amount NUMERIC(15,2) DEFAULT 0,
    total_amount NUMERIC(15,2) DEFAULT 0,
    paid_amount NUMERIC(15,2) DEFAULT 0,
    remaining_amount NUMERIC(15,2) DEFAULT 0,
    status TEXT CHECK (status IN ('draft', 'pending', 'paid', 'partial', 'overdue', 'cancelled')) DEFAULT 'pending',
    payment_terms TEXT,
    notes TEXT,
    -- Accounting Integration
    journal_entry_id TEXT REFERENCES journal_entries(id),
    -- Metadata
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON purchase_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_status ON purchase_invoices(status);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_journal ON purchase_invoices(journal_entry_id);

COMMENT ON TABLE purchase_invoices IS 'فواتير المشتريات - Purchase Invoices';

-- 6. إنشاء sales_invoice_lines
-- ============================================
CREATE TABLE IF NOT EXISTS sales_invoice_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_id TEXT REFERENCES sales_invoices(id) ON DELETE CASCADE,
    item_id TEXT REFERENCES inventory_items(id),
    description TEXT,
    quantity NUMERIC(15,3) NOT NULL,
    unit_price NUMERIC(15,2) NOT NULL,
    discount_rate NUMERIC(5,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    line_total NUMERIC(15,2) NOT NULL,
    line_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_invoice_lines_invoice ON sales_invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_lines_item ON sales_invoice_lines(item_id);

-- 7. إنشاء purchase_invoice_lines
-- ============================================
CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    invoice_id TEXT REFERENCES purchase_invoices(id) ON DELETE CASCADE,
    item_id TEXT REFERENCES inventory_items(id),
    description TEXT,
    quantity NUMERIC(15,3) NOT NULL,
    unit_cost NUMERIC(15,2) NOT NULL,
    discount_rate NUMERIC(5,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    line_total NUMERIC(15,2) NOT NULL,
    line_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoice_lines_invoice ON purchase_invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_lines_item ON purchase_invoice_lines(item_id);

-- 8. التأكد من وجود receipts table أو تحديثه
-- ============================================
-- إذا كان موجوداً، نضيف العمود الناقص فقط
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receipts') THEN
        -- إضافة is_deleted إذا لم يكن موجوداً
        ALTER TABLE receipts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
        ALTER TABLE receipts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE receipts ADD COLUMN IF NOT EXISTS deleted_by TEXT;
    ELSE
        -- إنشاء الجدول من الصفر
        CREATE TABLE receipts (
            id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            receipt_number TEXT UNIQUE NOT NULL,
            receipt_date DATE NOT NULL,
            customer_id TEXT REFERENCES customers(id),
            total_amount NUMERIC(15,2) DEFAULT 0,
            payment_method TEXT CHECK (payment_method IN ('cash', 'check', 'transfer', 'card')),
            bank_account_id TEXT REFERENCES accounts(id),
            check_number TEXT,
            main_description TEXT,
            status TEXT DEFAULT 'approved',
            journal_entry_id TEXT REFERENCES journal_entries(id),
            created_by TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMP WITH TIME ZONE,
            deleted_by TEXT
        );
        
        CREATE INDEX idx_receipts_customer ON receipts(customer_id);
        CREATE INDEX idx_receipts_date ON receipts(receipt_date);
        CREATE INDEX idx_receipts_journal ON receipts(journal_entry_id);
    END IF;
END $$;

COMMENT ON TABLE receipts IS 'سندات القبض - Receipts';

-- 9. التأكد من وجود receipt_lines
-- ============================================
CREATE TABLE IF NOT EXISTS receipt_lines (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    receipt_id TEXT REFERENCES receipts(id) ON DELETE CASCADE,
    account_id TEXT REFERENCES accounts(id),
    amount NUMERIC(15,2) NOT NULL,
    currency TEXT DEFAULT 'LYD',
    exchange_rate NUMERIC(10,6) DEFAULT 1,
    amount_in_base_currency NUMERIC(15,2) NOT NULL,
    description TEXT,
    line_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipt_lines_receipt ON receipt_lines(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_lines_account ON receipt_lines(account_id);

-- 10. إضافة is_deleted لـ payments إذا لم يكن موجوداً
-- ============================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- 11. إضافة Foreign Keys للجداول الموجودة (إذا لم تكن موجودة)
-- ============================================

-- Update payroll_slips (فقط إذا لم يكن FK موجوداً)
DO $$
BEGIN
    -- التحقق من وجود الجدول أولاً
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_slips') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_payroll_slips_employee'
        ) THEN
            ALTER TABLE payroll_slips 
            ADD CONSTRAINT fk_payroll_slips_employee 
            FOREIGN KEY (employee_id) REFERENCES employees(id);
        END IF;
    END IF;
END $$;

-- Update payroll_records
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_records') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_payroll_records_employee'
        ) THEN
            ALTER TABLE payroll_records 
            ADD CONSTRAINT fk_payroll_records_employee 
            FOREIGN KEY (employee_id) REFERENCES employees(id);
        END IF;
    END IF;
END $$;

-- Update payments (تغيير supplier_id من TEXT إلى FK)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_payments_supplier'
    ) THEN
        -- التحقق من أن العمود موجود
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'payments' AND column_name = 'supplier_id'
        ) THEN
            ALTER TABLE payments 
            ADD CONSTRAINT fk_payments_supplier 
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
        END IF;
    END IF;
END $$;

-- ============================================
-- التحقق من النجاح
-- ============================================

-- عرض جميع الجداول المحاسبية
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN (
    'accounts', 'journal_entries', 'journal_entry_lines',
    'employees', 'suppliers', 'customers',
    'receipts', 'receipt_lines', 'payments', 'payment_lines',
    'sales_invoices', 'sales_invoice_lines',
    'purchase_invoices', 'purchase_invoices_lines',
    'inventory_items', 'fixed_assets', 'audit_log'
)
ORDER BY table_name;

-- التحقق من عمود is_posted
SELECT 
    'journal_entries.is_posted' as check_item,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'journal_entries' 
        AND column_name = 'is_posted'
    ) THEN '✅ موجود' ELSE '❌ ناقص' END as status;

SELECT 
    '✅ تم إصلاح جميع النواقص في السكيما بنجاح!' as status,
    'جميع الجداول والأعمدة المطلوبة أصبحت موجودة الآن' as message;
