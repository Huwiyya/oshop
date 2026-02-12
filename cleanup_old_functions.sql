-- ============================================
-- تنظيف الـ Functions القديمة قبل التطبيق
-- ============================================
-- شغّل هذا السكريبت أولاً لحذف أي functions قديمة

DROP FUNCTION IF EXISTS update_account_balance();
DROP FUNCTION IF EXISTS update_account_balance(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS update_account_balance(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS safe_delete_journal_entry(TEXT);
DROP FUNCTION IF EXISTS safe_delete_journal_entry(TEXT, TEXT);
DROP FUNCTION IF EXISTS safe_delete_journal_entry(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS validate_journal_entry_balance(TEXT);
DROP FUNCTION IF EXISTS create_reversing_entry(TEXT);
DROP FUNCTION IF EXISTS create_reversing_entry(TEXT, TEXT);
DROP FUNCTION IF EXISTS create_reversing_entry(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS auto_update_account_balance();

-- حذف الـ Trigger القديم إن وجد
DROP TRIGGER IF EXISTS trigger_update_account_balance ON journal_entry_lines;

SELECT '✅ تم تنظيف الـ Functions القديمة بنجاح! الآن يمكنك تشغيل accounting_fixes_database.sql' as status;
