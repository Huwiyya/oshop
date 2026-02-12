-- ==========================================
-- إصلاح مشكلة حفظ الفواتير
-- ==========================================
-- التاريخ: 2026-02-07
-- المشكلة: فواتير الشراء/المبيعات لا تُحذف بسبب استخدام entry_id المحذوف
-- الحل: تحديث atomic-financial-actions.sql لاستخدام journal_entry_id

-- ⚠️ ملاحظة: هذه الدوال مُعقدة - يُفضل تطبيقها من الكود الكامل
-- يمكنك تطبيق comprehensive-schema-fixes.sql أولاً إذا لم يتم

-- للتحقق من أن الإصلاح مطلوب:
SELECT 
    COUNT(*) as entry_id_count,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ entry_id removed - تم الحذف'
        ELSE '❌ entry_id still exists - مازال موجود'
    END as status
FROM information_schema.columns 
WHERE table_name = 'journal_entry_lines' 
AND column_name = 'entry_id';

-- إذا كانت النتيجة "تم الحذف" فأنت بحاجة لتطبيق الإصلاحات التالية:

-- ==========================================
-- الحل الكامل
-- ==========================================
-- نشّغل السكربتات بالترتيب:

-- 1. أولاً: comprehensive-schema-fixes.sql
--    (يحذف entry_id من journal_entry_lines)

-- 2. ثانياً: fix-journal-entry-save.sql  
--    (يُصلح create_journal_entry_rpc)

-- 3. ثالثاً: نحتاج لإعادة نشر atomic-financial-actions.sql كاملاً
--    (لكنه ملف كبير جداً - 594 سطر)

-- ==========================================
-- ملاحظة مهمة
-- ==========================================
/*
الملفات المتأثرة:
✅ accounting-triggers.sql (تم إصلاحه via fix-journal-entry-save.sql)
✅ atomic-financial-actions.sql (تم إصلاحه في الكود)
✅ comprehensive-schema-fixes.sql (يحذف entry_id)

يجب تطبيق الملفات الكاملة من GitHub أو Supabase Dashboard
*/

-- للتحقق السريع بعد التطبيق:
SELECT 
    'Verification' as test,
    COUNT(*) as functions_count
FROM pg_proc 
WHERE proname IN (
    'create_journal_entry_rpc',
    'create_sales_invoice_rpc', 
    'delete_sales_invoice_rpc',
    'create_purchase_invoice_rpc',
    'delete_purchase_invoice_rpc'
);

-- يجب أن تكون النتيجة 5 functions
