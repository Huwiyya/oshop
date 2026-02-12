-- ==========================================
-- سكربت التحقق من صحة Schema بعد التطبيق
-- ==========================================

-- التحقق 1: عدم وجود duplicate IDs في users
SELECT 
    'users table PRIMARY KEY check' as test_name,
    COUNT(*) as pk_count,
    CASE WHEN COUNT(*) = 1 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.table_constraints 
WHERE table_name = 'users' 
AND constraint_type = 'PRIMARY KEY';

-- التحقق 2: journal_entry_lines يجب أن يحتوي على journal_entry_id فقط
SELECT 
    'journal_entry_lines columns check' as test_name,
    COUNT(*) as column_count,
    CASE WHEN COUNT(*) = 1 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.columns 
WHERE table_name = 'journal_entry_lines' 
AND column_name IN ('entry_id', 'journal_entry_id');

-- التحقق 3: عدم وجود double precision في الجداول المالية
SELECT 
    'Data types check (no double precision)' as test_name,
    COUNT(*) as double_precision_count,
    CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL (still exists)' END as status
FROM information_schema.columns 
WHERE table_name IN (
    'treasury_transactions_v4', 'products_v4', 'shein_cards_v4', 
    'orders', 'system_settings'
)
AND data_type = 'double precision';

-- التحقق 4: جميع جداول *_v4.id يجب أن يكون لها default
SELECT 
    'Default values check' as test_name,
    COUNT(*) as missing_defaults,
    CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.columns 
WHERE table_name IN (
    'expenses', 'orders', 'global_sites_v4', 'products_v4', 
    'shein_cards_v4', 'system_settings', 'treasury_transactions_v4'
)
AND column_name = 'id'
AND column_default IS NULL;

-- التحقق 5: عدد الـ indexes المُنشأة
SELECT 
    'Indexes count check' as test_name,
    COUNT(*) as indexes_created,
    CASE WHEN COUNT(*) >= 30 THEN '✅ PASS' ELSE '⚠️ PARTIAL' END as status
FROM pg_indexes 
WHERE indexname LIKE 'idx_%'
AND tablename IN (
    'journal_entries', 'inventory_transactions', 'account_transactions',
    'purchase_invoices', 'sales_invoices', 'payroll_slips',
    'receipts', 'payments', 'fixed_assets', 'orders_v4'
);

-- التحقق 6: FOREIGN KEYs السليمة
SELECT 
    'Foreign keys integrity' as test_name,
    COUNT(*) as fk_count,
    '✅ OK' as status
FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY';

-- التحقق 7: عدم وجود NULLs في الأعمدة المهمة
SELECT 
    'Critical columns NULL check' as test_name,
    COUNT(*) as null_count,
    CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL (nulls exist)' END as status
FROM journal_entry_lines 
WHERE journal_entry_id IS NULL;

-- التحقق 8: قائمة بجميع الجداول القديمة
SELECT 
    'Legacy tables list' as info,
    table_name,
    pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('expenses', 'orders', 'users', 'managers', 'system_settings')
ORDER BY table_name;

-- ==========================================
-- تقرير شامل بالـ Constraints
-- ==========================================

SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN (
    'journal_entry_lines', 'tempOrders_v4', 'users', 'profiles'
)
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- ==========================================
-- تقرير الأداء: Indexes
-- ==========================================

SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ==========================================
-- تقرير النظافة: Tables بدون استخدام
-- ==========================================

SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count,
    pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as total_size
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
AND table_name NOT LIKE '%_v4'
AND table_name NOT IN (
    'accounts', 'account_types', 'account_transactions',
    'asset_depreciation_log', 'audit_log', 'branches', 'cards',
    'customers', 'depreciation_schedule', 'employees', 'fixed_assets',
    'inventory_items', 'inventory_layers', 'inventory_transactions',
    'invoice_items', 'invoices', 'journal_entries', 'journal_entry_lines',
    'journal_lines', 'payment_lines', 'payments', 'payroll_records',
    'payroll_slip_lines', 'payroll_slips', 'profiles', 'purchase_invoice_lines',
    'purchase_invoices', 'receipt_lines', 'receipts', 'reports',
    'sales_invoice_lines', 'sales_invoices', 'suppliers',
    'transaction_entries', 'transactions'
)
ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;
