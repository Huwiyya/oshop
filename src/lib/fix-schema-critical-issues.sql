-- ==========================================
-- إصلاح المشاكل الحرجة في Schema
-- ==========================================
-- ⚠️ تحذير: راجع هذا السكربت قبل التنفيذ!

-- ==========================================
-- 1. إصلاح column_default للجداول
-- ==========================================

-- إصلاح expenses.id
ALTER TABLE expenses 
ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;

-- إصلاح global_sites_v4.id
ALTER TABLE global_sites_v4 
ALTER COLUMN id SET DEFAULT (uuid_generate_v4())::text;

-- ==========================================
-- 2. تحسين نوع البيانات
-- ==========================================

-- تحديث treasury_transactions_v4.amount من double precision إلى numeric
-- ⚠️ سيتطلب إعادة إنشاء العمود إذا كان يحتوي على بيانات
ALTER TABLE treasury_transactions_v4 
ALTER COLUMN amount TYPE numeric USING amount::numeric;

-- ==========================================
-- 3. إضافة Indexes للأداء
-- ==========================================

-- Indexes لـ journal_entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_date 
ON journal_entries(entry_date);

CREATE INDEX IF NOT EXISTS idx_journal_entries_status 
ON journal_entries(status) WHERE status != 'deleted';

CREATE INDEX IF NOT EXISTS idx_journal_entries_reference 
ON journal_entries(reference_type, reference_id);

-- Indexes لـ inventory_transactions
CREATE INDEX IF NOT EXISTS idx_inventory_trans_date 
ON inventory_transactions(transaction_date);

CREATE INDEX IF NOT EXISTS idx_inventory_trans_type 
ON inventory_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_inventory_trans_reference 
ON inventory_transactions(reference_type, reference_id);

-- Indexes لـ account_transactions
CREATE INDEX IF NOT EXISTS idx_account_trans_date 
ON account_transactions(transaction_date);

CREATE INDEX IF NOT EXISTS idx_account_trans_reference 
ON account_transactions(reference_type, reference_id);

-- ==========================================
-- 4. التحقق من النتائج
-- ==========================================

-- تحقق من defaults
SELECT 
    table_name, 
    column_name, 
    column_default 
FROM information_schema.columns 
WHERE table_name IN ('expenses', 'global_sites_v4') 
  AND column_name = 'id';

-- تحقق من indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('journal_entries', 'inventory_transactions', 'account_transactions')
ORDER BY tablename, indexname;
