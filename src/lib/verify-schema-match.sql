-- ==========================================
-- التحقق الشامل من مطابقة Schema
-- ==========================================
-- يقارن schema الحالي في Supabase مع الكود المحلي

-- ==========================================
-- 1. فحص الجداول الأساسية
-- ==========================================

SELECT 
    '✅ جداول المحاسبة' as category,
    CASE 
        WHEN COUNT(*) = 13 THEN '✅ PASS'
        ELSE '❌ FAIL: Expected 13, Found ' || COUNT(*)
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN (
    'accounts', 'account_types', 'account_transactions',
    'journal_entries', 'journal_entry_lines',
    'receipts', 'receipt_lines',
    'payments', 'payment_lines',
    'purchase_invoices', 'purchase_invoice_lines',
    'sales_invoices', 'sales_invoice_lines'
)

UNION ALL

SELECT 
    '✅ جداول المخزون',
    CASE 
        WHEN COUNT(*) = 3 THEN '✅ PASS'
        ELSE '❌ FAIL: Expected 3, Found ' || COUNT(*)
    END
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN (
    'inventory_items', 'inventory_layers', 'inventory_transactions'
)

UNION ALL

SELECT 
    '✅ جداول الأصول الثابتة',
    CASE 
        WHEN COUNT(*) = 3 THEN '✅ PASS'
        ELSE '❌ FAIL: Expected 3, Found ' || COUNT(*)
    END
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN (
    'fixed_assets', 'asset_depreciation_log', 'depreciation_schedule'
)

UNION ALL

SELECT 
    '✅ جداول الموارد البشرية',
    CASE 
        WHEN COUNT(*) = 3 THEN '✅ PASS'
        ELSE '❌ FAIL: Expected 3, Found ' || COUNT(*)
    END
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN (
    'employees', 'payroll_slips', 'payroll_slip_lines'
);

-- ==========================================
-- 2. فحص الأعمدة المهمة في جداول رئيسية
-- ==========================================

-- فحص fixed_assets
SELECT 
    'fixed_assets structure' as test_name,
    CASE 
        WHEN COUNT(*) >= 20 THEN '✅ PASS: ' || COUNT(*) || ' columns'
        ELSE '❌ FAIL: Expected 20+, Found ' || COUNT(*)
    END as status
FROM information_schema.columns 
WHERE table_name = 'fixed_assets'

UNION ALL

-- فحص journal_entry_lines (يجب ألا يحتوي على entry_id)
SELECT 
    'journal_entry_lines (no entry_id)',
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS: entry_id removed'
        ELSE '❌ FAIL: entry_id still exists'
    END
FROM information_schema.columns 
WHERE table_name = 'journal_entry_lines'
AND column_name = 'entry_id'

UNION ALL

-- فحص journal_entry_lines (يجب أن يحتوي على journal_entry_id)
SELECT 
    'journal_entry_lines (has journal_entry_id)',
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ PASS'
        ELSE '❌ FAIL: journal_entry_id missing'
    END
FROM information_schema.columns 
WHERE table_name = 'journal_entry_lines'
AND column_name = 'journal_entry_id';

-- ==========================================
-- 3. فحص أنواع البيانات (يجب أن تكون numeric وليس double precision)
-- ==========================================

SELECT 
    'Data Types: numeric vs double precision' as category,
    table_name,
    column_name,
    data_type,
    CASE 
        WHEN data_type = 'numeric' THEN '✅ CORRECT'
        WHEN data_type = 'double precision' THEN '❌ NEEDS FIX'
        ELSE '⚠️ OTHER'
    END as status
FROM information_schema.columns 
WHERE table_name IN (
    'treasury_transactions_v4', 'products_v4', 'shein_cards_v4', 
    'orders', 'system_settings'
)
AND data_type IN ('double precision', 'numeric')
ORDER BY 
    CASE WHEN data_type = 'double precision' THEN 0 ELSE 1 END,
    table_name, column_name;

-- ==========================================
-- 4. فحص column defaults للجداول المهمة
-- ==========================================

SELECT 
    'Column Defaults Check' as category,
    table_name,
    column_name,
    CASE 
        WHEN column_default IS NOT NULL THEN '✅ HAS DEFAULT'
        ELSE '❌ MISSING DEFAULT'
    END as status,
    column_default
FROM information_schema.columns 
WHERE table_name IN (
    'expenses', 'orders', 'global_sites_v4', 'products_v4', 
    'shein_cards_v4', 'system_settings', 'treasury_transactions_v4',
    'fixed_assets', 'journal_entries', 'accounts'
)
AND column_name = 'id'
ORDER BY 
    CASE WHEN column_default IS NULL THEN 0 ELSE 1 END,
    table_name;

-- ==========================================
-- 5. فحص PRIMARY KEYs
-- ==========================================

SELECT 
    'Primary Keys' as category,
    tc.table_name,
    STRING_AGG(kcu.column_name, ', ') as pk_columns,
    '✅ OK' as status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
AND tc.table_name IN (
    'accounts', 'fixed_assets', 'journal_entries', 
    'employees', 'payroll_slips', 'inventory_items'
)
GROUP BY tc.table_name
ORDER BY tc.table_name;

-- ==========================================
-- 6. فحص FOREIGN KEYs المهمة
-- ==========================================

SELECT 
    'Foreign Keys' as category,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    '✅ OK' as status
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN (
    'fixed_assets', 'journal_entry_lines', 'payroll_slips',
    'inventory_transactions', 'account_transactions'
)
ORDER BY tc.table_name, kcu.column_name
LIMIT 20;

-- ==========================================
-- 7. فحص CHECK Constraints
-- ==========================================

SELECT 
    'CHECK Constraints' as category,
    tc.table_name,
    tc.constraint_name,
    '✅ EXISTS' as status
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'CHECK'
AND tc.table_name IN (
    'fixed_assets', 'journal_entries', 'payroll_slips'
)
ORDER BY tc.table_name, tc.constraint_name;

-- ==========================================
-- 8. فحص Indexes
-- ==========================================

SELECT 
    'Performance Indexes' as category,
    tablename,
    indexname,
    CASE 
        WHEN indexname LIKE 'idx_%' THEN '✅ CUSTOM INDEX'
        ELSE '⚠️ AUTO INDEX'
    END as status
FROM pg_indexes 
WHERE schemaname = 'public'
AND tablename IN (
    'journal_entries', 'inventory_transactions', 'account_transactions',
    'fixed_assets', 'payroll_slips', 'orders_v4'
)
ORDER BY 
    CASE WHEN indexname LIKE 'idx_%' THEN 0 ELSE 1 END,
    tablename, indexname;

-- ==========================================
-- 9. تقرير ملخص شامل
-- ==========================================

WITH table_counts AS (
    SELECT COUNT(*) as total_tables
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
),
column_counts AS (
    SELECT COUNT(*) as total_columns
    FROM information_schema.columns 
    WHERE table_schema = 'public'
),
constraint_counts AS (
    SELECT 
        COUNT(*) FILTER (WHERE constraint_type = 'PRIMARY KEY') as pk_count,
        COUNT(*) FILTER (WHERE constraint_type = 'FOREIGN KEY') as fk_count,
        COUNT(*) FILTER (WHERE constraint_type = 'UNIQUE') as unique_count,
        COUNT(*) FILTER (WHERE constraint_type = 'CHECK') as check_count
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
),
index_counts AS (
    SELECT 
        COUNT(*) as total_indexes,
        COUNT(*) FILTER (WHERE indexname LIKE 'idx_%') as custom_indexes
    FROM pg_indexes 
    WHERE schemaname = 'public'
)
SELECT 
    '📊 SUMMARY REPORT' as category,
    '================================' as divider,
    'Total Tables: ' || total_tables as metric1,
    'Total Columns: ' || total_columns as metric2,
    'Primary Keys: ' || pk_count as metric3,
    'Foreign Keys: ' || fk_count as metric4,
    'Unique Constraints: ' || unique_count as metric5,
    'Check Constraints: ' || check_count as metric6,
    'Total Indexes: ' || total_indexes as metric7,
    'Custom Indexes: ' || custom_indexes as metric8
FROM table_counts, column_counts, constraint_counts, index_counts;

-- ==========================================
-- 10. قائمة بالمشاكل المحتملة
-- ==========================================

-- أعمدة بدون default في جداول مهمة
SELECT 
    '⚠️ POTENTIAL ISSUES' as category,
    'Missing default for: ' || table_name || '.' || column_name as issue,
    'Add DEFAULT value' as recommendation
FROM information_schema.columns 
WHERE table_name IN (
    'expenses', 'orders', 'global_sites_v4', 'products_v4', 
    'shein_cards_v4', 'system_settings'
)
AND column_name = 'id'
AND column_default IS NULL

UNION ALL

-- جداول بدون PRIMARY KEY
SELECT 
    '⚠️ POTENTIAL ISSUES',
    'No PRIMARY KEY: ' || t.table_name,
    'Add PRIMARY KEY'
FROM information_schema.tables t
LEFT JOIN information_schema.table_constraints tc 
    ON t.table_name = tc.table_name 
    AND tc.constraint_type = 'PRIMARY KEY'
WHERE t.table_schema = 'public'
AND t.table_type = 'BASE TABLE'
AND tc.constraint_name IS NULL
AND t.table_name NOT LIKE 'pg_%'

UNION ALL

-- استخدام double precision بدلاً من numeric
SELECT 
    '⚠️ POTENTIAL ISSUES',
    'Wrong type: ' || table_name || '.' || column_name || ' is double precision',
    'Convert to numeric'
FROM information_schema.columns 
WHERE table_name IN (
    'treasury_transactions_v4', 'products_v4', 'shein_cards_v4', 
    'orders', 'system_settings'
)
AND data_type = 'double precision';

-- ==========================================
-- 11. مقارنة مع الملفات المحلية
-- ==========================================

-- فحص أن جميع الجداول في الـ SQL files موجودة
SELECT 
    '📁 Local Files Comparison' as category,
    table_name,
    CASE 
        WHEN table_name IN (
            SELECT tablename FROM pg_tables WHERE schemaname = 'public'
        ) THEN '✅ EXISTS IN DB'
        ELSE '❌ MISSING IN DB'
    END as status
FROM (
    VALUES 
        ('accounts'),
        ('account_types'),
        ('account_transactions'),
        ('fixed_assets'),
        ('asset_depreciation_log'),
        ('depreciation_schedule'),
        ('journal_entries'),
        ('journal_entry_lines'),
        ('inventory_items'),
        ('inventory_layers'),
        ('inventory_transactions'),
        ('employees'),
        ('payroll_slips'),
        ('payroll_slip_lines'),
        ('receipts'),
        ('receipt_lines'),
        ('payments'),
        ('payment_lines'),
        ('purchase_invoices'),
        ('purchase_invoice_lines'),
        ('sales_invoices'),
        ('sales_invoice_lines')
) AS expected_tables(table_name)
ORDER BY 
    CASE 
        WHEN table_name IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
        THEN 1 ELSE 0 
    END,
    table_name;
