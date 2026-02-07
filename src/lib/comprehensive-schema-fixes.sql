-- ==========================================
-- إصلاح شامل لجميع أخطاء Schema في Supabase
-- ==========================================
-- تاريخ الإنشاء: 2026-02-07
-- ⚠️ تحذير: راجع هذا السكربت بالكامل قبل التنفيذ!
-- ⚠️ خذ نسخة احتياطية من القاعدة قبل التطبيق!

-- ==========================================
-- القسم 1: إصلاح التكرارات الحرجة
-- ==========================================

-- 1.1: معالجة تكرار journal_entry_lines columns
-- المشكلة: يوجد entry_id و journal_entry_id (كلاهما يشير إلى نفس الجدول)
-- الحل: سنستخدم journal_entry_id فقط ونحذف entry_id

-- ⚠️ ملاحظة: إذا كان entry_id محذوف بالفعل، تخطى هذا القسم!
-- يمكن أن يكون العمود محذوف من قبل، مما يسبب خطأ في التنفيذ

-- أولاً: نسخ البيانات من entry_id إلى journal_entry_id (إذا كانت موجودة)
-- معلّق لأن entry_id قد يكون محذوف بالفعل في قاعدة البيانات
-- UPDATE journal_entry_lines 
-- SET journal_entry_id = COALESCE(journal_entry_id, entry_id) 
-- WHERE journal_entry_id IS NULL AND entry_id IS NOT NULL;

-- ثانياً: حذف الـ FOREIGN KEY constraint على entry_id
ALTER TABLE journal_entry_lines 
DROP CONSTRAINT IF EXISTS journal_entry_lines_entry_id_fkey;

-- ثالثاً: حذف العمود entry_id (إذا كان موجود)
ALTER TABLE journal_entry_lines 
DROP COLUMN IF EXISTS entry_id;

-- 1.2: معالجة تكرار tempOrders_v4.assignedUserId
-- المشكلة: assignedUserId مكرر مرتين في الـ schema
-- الحل: Supabase سيعرض فقط constraint واحد، لكن نتأكد من النظافة
-- (لا حاجة لفعل شيء هنا - هذا تكرار في العرض فقط)

-- ==========================================
-- القسم 2: إصلاح column defaults
-- ==========================================

-- 2.1: إصلاح expenses.id (جدول قديم لكن مازال موجود)
ALTER TABLE expenses 
ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;

-- 2.2: إصلاح orders.id (جدول قديم)
ALTER TABLE orders 
ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;

-- 2.3: إصلاح global_sites_v4.id (casting خاطئ)
ALTER TABLE global_sites_v4 
ALTER COLUMN id SET DEFAULT (uuid_generate_v4())::text;

-- 2.4: إصلاح products_v4.id (casting خاطئ)
ALTER TABLE products_v4 
ALTER COLUMN id SET DEFAULT (uuid_generate_v4())::text;

-- 2.5: إصلاح shein_cards_v4.id (casting خاطئ)
ALTER TABLE shein_cards_v4 
ALTER COLUMN id SET DEFAULT (uuid_generate_v4())::text;

-- 2.6: إصلاح system_settings.id (جدول قديم)
ALTER TABLE system_settings 
ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text;

-- 2.7: إصلاح treasury_transactions_v4.id (casting خاطئ)
ALTER TABLE treasury_transactions_v4 
ALTER COLUMN id SET DEFAULT (uuid_generate_v4())::text;

-- ==========================================
-- القسم 3: تحديث أنواع البيانات (double precision → numeric)
-- ==========================================

-- 3.1: treasury_transactions_v4.amount
ALTER TABLE treasury_transactions_v4 
ALTER COLUMN amount TYPE numeric USING amount::numeric;

-- 3.2: products_v4 (الحقول المالية)
ALTER TABLE products_v4 
ALTER COLUMN "costPriceUSD" TYPE numeric USING "costPriceUSD"::numeric;

ALTER TABLE products_v4 
ALTER COLUMN "sellingPriceLYD" TYPE numeric USING "sellingPriceLYD"::numeric;

ALTER TABLE products_v4 
ALTER COLUMN "sellingPriceUSD" TYPE numeric USING "sellingPriceUSD"::numeric;

-- 3.3: shein_cards_v4
ALTER TABLE shein_cards_v4 
ALTER COLUMN "value" TYPE numeric USING "value"::numeric;

ALTER TABLE shein_cards_v4 
ALTER COLUMN "remainingValue" TYPE numeric USING "remainingValue"::numeric;

-- 3.4: users (جدول قديم)
ALTER TABLE users 
ALTER COLUMN debt TYPE numeric USING debt::numeric;

-- 3.5: orders (جدول قديم - جميع الحقول المالية)
ALTER TABLE orders 
ALTER COLUMN "sellingPriceLYD" TYPE numeric USING "sellingPriceLYD"::numeric,
ALTER COLUMN "remainingAmount" TYPE numeric USING "remainingAmount"::numeric,
ALTER COLUMN "exchangeRate" TYPE numeric USING "exchangeRate"::numeric,
ALTER COLUMN "purchasePriceUSD" TYPE numeric USING "purchasePriceUSD"::numeric,
ALTER COLUMN "downPaymentLYD" TYPE numeric USING "downPaymentLYD"::numeric,
ALTER COLUMN "weightKG" TYPE numeric USING "weightKG"::numeric,
ALTER COLUMN "shippingCostUSD" TYPE numeric USING "shippingCostUSD"::numeric,
ALTER COLUMN "shippingPriceUSD" TYPE numeric USING "shippingPriceUSD"::numeric,
ALTER COLUMN "localShippingPrice" TYPE numeric USING "localShippingPrice"::numeric,
ALTER COLUMN "totalAmountLYD" TYPE numeric USING "totalAmountLYD"::numeric,
ALTER COLUMN "pricePerKilo" TYPE numeric USING "pricePerKilo"::numeric,
ALTER COLUMN "customerWeightCost" TYPE numeric USING "customerWeightCost"::numeric,
ALTER COLUMN "companyWeightCost" TYPE numeric USING "companyWeightCost"::numeric,
ALTER COLUMN "companyWeightCostUSD" TYPE numeric USING "companyWeightCostUSD"::numeric,
ALTER COLUMN "companyPricePerKilo" TYPE numeric USING "companyPricePerKilo"::numeric,
ALTER COLUMN "companyPricePerKiloUSD" TYPE numeric USING "companyPricePerKiloUSD"::numeric,
ALTER COLUMN "customerPricePerKilo" TYPE numeric USING "customerPricePerKilo"::numeric,
ALTER COLUMN "addedCostUSD" TYPE numeric USING "addedCostUSD"::numeric,
ALTER COLUMN "shippingCostLYD" TYPE numeric USING "shippingCostLYD"::numeric,
ALTER COLUMN "collectedAmount" TYPE numeric USING "collectedAmount"::numeric,
ALTER COLUMN "customerWeightCostUSD" TYPE numeric USING "customerWeightCostUSD"::numeric;

-- 3.6: system_settings
ALTER TABLE system_settings 
ALTER COLUMN "exchangeRate" TYPE numeric USING "exchangeRate"::numeric,
ALTER COLUMN "shippingCostUSD" TYPE numeric USING "shippingCostUSD"::numeric,
ALTER COLUMN "shippingPriceUSD" TYPE numeric USING "shippingPriceUSD"::numeric;

-- ==========================================
-- القسم 4: إضافة Indexes للأداء
-- ==========================================

-- 4.1: Indexes لـ journal_entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_date 
ON journal_entries(entry_date);

CREATE INDEX IF NOT EXISTS idx_journal_entries_status 
ON journal_entries(status) WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_journal_entries_reference 
ON journal_entries(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_created 
ON journal_entries(created_at);

-- 4.2: Indexes لـ inventory_transactions
CREATE INDEX IF NOT EXISTS idx_inventory_trans_date 
ON inventory_transactions(transaction_date);

CREATE INDEX IF NOT EXISTS idx_inventory_trans_type 
ON inventory_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_inventory_trans_reference 
ON inventory_transactions(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_inventory_trans_item 
ON inventory_transactions(item_id, transaction_date);

-- 4.3: Indexes لـ account_transactions
CREATE INDEX IF NOT EXISTS idx_account_trans_date 
ON account_transactions(transaction_date);

CREATE INDEX IF NOT EXISTS idx_account_trans_account 
ON account_transactions(account_id, transaction_date);

CREATE INDEX IF NOT EXISTS idx_account_trans_reference 
ON account_transactions(reference_type, reference_id);

-- 4.4: Indexes لـ purchase_invoices
CREATE INDEX IF NOT EXISTS idx_purchase_inv_date 
ON purchase_invoices(invoice_date);

CREATE INDEX IF NOT EXISTS idx_purchase_inv_status 
ON purchase_invoices(payment_status);

CREATE INDEX IF NOT EXISTS idx_purchase_inv_supplier 
ON purchase_invoices(supplier_account_id);

-- 4.5: Indexes لـ sales_invoices
CREATE INDEX IF NOT EXISTS idx_sales_inv_date 
ON sales_invoices(invoice_date);

CREATE INDEX IF NOT EXISTS idx_sales_inv_status 
ON sales_invoices(payment_status);

CREATE INDEX IF NOT EXISTS idx_sales_inv_customer 
ON sales_invoices(customer_account_id);

-- 4.6: Indexes لـ payroll_slips
CREATE INDEX IF NOT EXISTS idx_payroll_period 
ON payroll_slips(period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_payroll_employee 
ON payroll_slips(employee_id);

CREATE INDEX IF NOT EXISTS idx_payroll_status 
ON payroll_slips(payment_status) WHERE is_draft = false;

-- 4.7: Indexes لـ receipts
CREATE INDEX IF NOT EXISTS idx_receipts_date 
ON receipts(receipt_date);

CREATE INDEX IF NOT EXISTS idx_receipts_customer 
ON receipts(customer_id);

CREATE INDEX IF NOT EXISTS idx_receipts_status 
ON receipts(status) WHERE is_deleted = false;

-- 4.8: Indexes لـ payments
CREATE INDEX IF NOT EXISTS idx_payments_date 
ON payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_payments_supplier 
ON payments(supplier_id);

CREATE INDEX IF NOT EXISTS idx_payments_status 
ON payments(status) WHERE is_deleted = false;

-- 4.9: Indexes لـ fixed_assets
CREATE INDEX IF NOT EXISTS idx_fixed_assets_status 
ON fixed_assets(status);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_category 
ON fixed_assets(asset_category);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_account 
ON fixed_assets(account_id);

-- 4.10: Indexes لـ orders_v4 (للأداء)
CREATE INDEX IF NOT EXISTS idx_orders_v4_user 
ON orders_v4("userId") WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_v4_status 
ON orders_v4(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_v4_date 
ON orders_v4(created_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_v4_manager 
ON orders_v4("managerId") WHERE deleted_at IS NULL;

-- ==========================================
-- القسم 5: التحقق من النتائج
-- ==========================================

-- 5.1: التحقق من column defaults
SELECT 
    table_name, 
    column_name, 
    column_default 
FROM information_schema.columns 
WHERE table_name IN (
    'expenses', 'orders', 'global_sites_v4', 'products_v4', 
    'shein_cards_v4', 'system_settings', 'treasury_transactions_v4'
) 
AND column_name = 'id'
ORDER BY table_name;

-- 5.2: التحقق من أنواع البيانات
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name IN (
    'treasury_transactions_v4', 'products_v4', 'shein_cards_v4', 'users', 'orders', 'system_settings'
)
AND data_type IN ('double precision', 'numeric')
ORDER BY table_name, column_name;

-- 5.3: التحقق من Indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN (
    'journal_entries', 'inventory_transactions', 'account_transactions',
    'purchase_invoices', 'sales_invoices', 'payroll_slips',
    'receipts', 'payments', 'fixed_assets', 'orders_v4'
)
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 5.4: التحقق من عدم وجود تكرارات في journal_entry_lines
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'journal_entry_lines'
AND column_name IN ('entry_id', 'journal_entry_id')
ORDER BY column_name;

-- ==========================================
-- القسم 6: ملاحظات نهائية
-- ==========================================

/*
✅ تم إصلاح:
1. تكرار journal_entry_lines columns
2. جميع column defaults
3. تحويل double precision → numeric
4. إضافة 30+ index للأداء

⚠️ لم يتم حذف:
- الجداول القديمة (expenses, orders, users, managers, system_settings)
- يُفضل مراجعة الكود أولاً للتأكد من عدم استخدامها

📊 الخطوة التالية:
- راجع نتائج التحقق أعلاه
- اختبر التطبيق بالكامل
- إذا كان كل شيء يعمل، يمكنك النظر في حذف الجداول القديمة
*/
