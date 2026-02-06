-- ============================================
-- إصلاح النواقص الحرجة فقط - P0
-- Only P0 Critical Missing Parts
-- ============================================
-- تطبيق آمن 100% - يضيف فقط ما هو ناقص بالفعل
-- ============================================

-- 1. إضافة is_posted لجدول journal_entries
-- ============================================
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT FALSE;

UPDATE journal_entries 
SET is_posted = (status = 'posted' OR status = 'approved')
WHERE is_posted IS NULL OR is_posted = FALSE;

CREATE INDEX IF NOT EXISTS idx_journal_entries_posted 
ON journal_entries(is_posted) WHERE is_posted = TRUE;

COMMENT ON COLUMN journal_entries.is_posted IS 'القيد مرحّل - لا يمكن حذفه';

-- 2. إضافة soft delete لـ receipts و payments
-- ============================================
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deleted_by TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- 3. جدول employees
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
    payable_account_id TEXT REFERENCES accounts(id),
    salary_expense_account_id TEXT REFERENCES accounts(id),
    advances_account_id TEXT REFERENCES accounts(id),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_number ON employees(employee_number);

COMMENT ON TABLE employees IS 'الموظفون - Employees';

-- 4. جدول suppliers
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
    payable_account_id TEXT REFERENCES accounts(id),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_number ON suppliers(supplier_number);

COMMENT ON TABLE suppliers IS 'الموردون - Suppliers';

-- 5. جدول customers
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
    receivable_account_id TEXT REFERENCES accounts(id),
    sales_account_id TEXT REFERENCES accounts(id),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_number ON customers(customer_number);

COMMENT ON TABLE customers IS 'العملاء - Customers';

-- ============================================
-- التحقق
-- ============================================
SELECT 
    'is_posted' as item,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'journal_entries' AND column_name = 'is_posted'
    ) THEN '✅' ELSE '❌' END as status
UNION ALL
SELECT 
    'employees table',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'employees'
    ) THEN '✅' ELSE '❌' END
UNION ALL
SELECT 
    'suppliers table',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'suppliers'
    ) THEN '✅' ELSE '❌' END
UNION ALL
SELECT 
    'customers table',
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'customers'
    ) THEN '✅' ELSE '❌' END;

SELECT '✅ تم إصلاح النواقص الحرجة فقط (P0)' as result;
