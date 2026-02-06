-- ============================================
-- إصلاح النواقص الحرجة فقط - نسخة مبسطة
-- Critical Missing Parts Only - Simplified Version
-- ============================================
-- تاريخ: 2026-02-06
-- الهدف: إضافة الأعمدة والجداول الناقصة فقط
-- ملاحظة: هذا السكريبت آمن ويمكن تشغيله عدة مرات
-- ============================================

-- ============================================
-- الجزء 1: إضافة الأعمدة الناقصة فقط
-- ============================================

-- 1. إضافة is_posted لجدول journal_entries
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT FALSE;

-- Update existing entries
UPDATE journal_entries 
SET is_posted = (status = 'posted' OR status = 'approved')
WHERE is_posted IS NULL OR is_posted = FALSE;

CREATE INDEX IF NOT EXISTS idx_journal_entries_posted 
ON journal_entries(is_posted) WHERE is_posted = TRUE;

-- 2. إضافة الأعمدة الناقصة لـ receipts
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- 3. إضافة الأعمدة الناقصة لـ payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- ============================================
-- الجزء 2: إنشاء الجداول المفقودة تماماً
-- ============================================

-- 1. جدول customers
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
    receivable_account_id TEXT REFERENCES accounts(id),
    sales_account_id TEXT REFERENCES accounts(id),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_number ON customers(customer_number);
CREATE INDEX IF NOT EXISTS idx_customers_balance ON customers(current_balance);

-- 2. جدول employees
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
    payable_account_id TEXT REFERENCES accounts(id),
    salary_expense_account_id TEXT REFERENCES accounts(id),
    advances_account_id TEXT REFERENCES accounts(id),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_number ON employees(employee_number);
CREATE INDEX IF NOT EXISTS idx_employees_national_id ON employees(national_id);

-- 3. جدول suppliers
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
    payable_account_id TEXT REFERENCES accounts(id),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_number ON suppliers(supplier_number);
CREATE INDEX IF NOT EXISTS idx_suppliers_balance ON suppliers(current_balance);

-- 4. جدول sales_invoices
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
    journal_entry_id TEXT REFERENCES journal_entries(id),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON sales_invoices(status);

-- 5. جدول purchase_invoices
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
    journal_entry_id TEXT REFERENCES journal_entries(id),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON purchase_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_status ON purchase_invoices(status);

-- 6. جدول sales_invoice_lines
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

-- 7. جدول purchase_invoice_lines
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

-- ============================================
-- الجزء 3: التحقق من النجاح
-- ============================================

-- التحقق من is_posted
SELECT 
    'is_posted column' as item,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'journal_entries' AND column_name = 'is_posted'
    ) THEN '✅ Added' ELSE '❌ Missing' END as status;

-- عرض الجداول المحاسبية
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN (
    'customers', 'employees', 'suppliers',
    'sales_invoices', 'purchase_invoices',
    'receipts', 'payments'
)
ORDER BY table_name;

SELECT '✅ تم تطبيق جميع الإصلاحات بنجاح!' as result;
