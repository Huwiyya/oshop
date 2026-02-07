-- ==========================================
-- سكربت الإصلاح الشامل لجميع RPC Functions
-- ==========================================
-- التاريخ: 2026-02-07
-- الهدف: إصلاح جميع مشاكل entry_id والدوال المكررة في Supabase

-- ⚠️ ملاحظة مهمة: يجب تشغيل السكربتات بالترتيب التالي:
-- 1. comprehensive-schema-fixes.sql (حذف entry_id من journal_entry_lines)
-- 2. fix-all-rpc-functions.sql (هذا الملف)

-- ==========================================
-- التحقق من البيئة قبل البدء
-- ==========================================

DO $$
BEGIN
    RAISE NOTICE 'بدء عملية الإصلاح الشامل...';
    RAISE NOTICE 'التاريخ: %', NOW();
END $$;

-- التحقق من حذف entry_id
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ entry_id removed successfully'
        ELSE '❌ ERROR: entry_id still exists - run comprehensive-schema-fixes.sql first!'
    END as entry_id_status
FROM information_schema.columns 
WHERE table_name = 'journal_entry_lines' AND column_name = 'entry_id';

-- ==========================================
-- الخطوة 1: حذف جميع النسخ المكررة من create_journal_entry_rpc
-- ==========================================

DROP FUNCTION IF EXISTS create_journal_entry_rpc(date, text, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS create_journal_entry_rpc(date, text, text, text, jsonb, boolean) CASCADE;
DROP FUNCTION IF EXISTS create_journal_entry_rpc CASCADE;

-- ==========================================
-- الخطوة 2: إنشاء النسخة الصحيحة الوحيدة
-- ==========================================

CREATE OR REPLACE FUNCTION create_journal_entry_rpc(
    p_entry_date DATE,
    p_description TEXT,
    p_reference_type TEXT,
    p_reference_id TEXT,
    p_lines JSONB,
    p_is_hidden BOOLEAN DEFAULT FALSE
)
RETURNS TEXT AS $func$
DECLARE
    new_entry_id TEXT;
    new_entry_number TEXT;
    rec JSONB;
    v_total_debit DECIMAL(19,4) := 0;
    v_total_credit DECIMAL(19,4) := 0;
    line_debit DECIMAL(19,4);
    line_credit DECIMAL(19,4);
    year_prefix TEXT;
BEGIN
    -- A. Calculate Totals & Verify Balance
    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        line_debit := COALESCE((rec->>'debit')::DECIMAL, 0);
        line_credit := COALESCE((rec->>'credit')::DECIMAL, 0);
        
        v_total_debit := v_total_debit + line_debit;
        v_total_credit := v_total_credit + line_credit;
    END LOOP;

    IF abs(v_total_debit - v_total_credit) > 0.0001 THEN
        RAISE EXCEPTION 'Journal Entry is not balanced! Debit: %, Credit: %', v_total_debit, v_total_credit;
    END IF;

    -- B. Generate Entry Number
    year_prefix := to_char(p_entry_date, 'YYYYMMDD');
    new_entry_number := 'JE-' || year_prefix || '-' || floor(random() * 10000)::text;

    -- C. Insert Header
    INSERT INTO journal_entries (
        entry_number, entry_date, description,
        reference_type, reference_id,
        total_debit, total_credit, status,
        is_system_hidden, created_at, updated_at
    ) VALUES (
        new_entry_number, p_entry_date, p_description,
        COALESCE(p_reference_type, 'manual'), p_reference_id,
        v_total_debit, v_total_credit, 'posted',
        p_is_hidden, NOW(), NOW()
    ) RETURNING id INTO new_entry_id;

    -- D. Insert Lines (✅ journal_entry_id فقط)
    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO journal_entry_lines (
            journal_entry_id, account_id, description, debit, credit
        ) VALUES (
            new_entry_id,
            rec->>'accountId',
            COALESCE(rec->>'description', p_description),
            COALESCE((rec->>'debit')::DECIMAL, 0),
            COALESCE((rec->>'credit')::DECIMAL, 0)
        );
    END LOOP;

    RETURN new_entry_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- الخطوة 3: التحقق من نجاح الإصلاح
-- ==========================================

SELECT 
    proname as function_name,
    pronargs as param_count,
    '✅ Function created successfully' as status
FROM pg_proc 
WHERE proname = 'create_journal_entry_rpc'
LIMIT 1;

-- ==========================================
-- الخطوة 4: تقرير نهائي
-- ==========================================

DO $$
DECLARE
    func_count INTEGER;
    je_count INTEGER;
    entry_id_count INTEGER;
BEGIN
    -- عدد الدوال
    SELECT COUNT(*) INTO func_count FROM pg_proc WHERE proname = 'create_journal_entry_rpc';
    
    -- عدد القيود
    SELECT COUNT(*) INTO je_count FROM journal_entries;
    
    -- التحقق من entry_id
    SELECT COUNT(*) INTO entry_id_count 
    FROM information_schema.columns 
    WHERE table_name = 'journal_entry_lines' AND column_name = 'entry_id';
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'تقرير الإصلاح النهائي';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'عدد دوال create_journal_entry_rpc: %', func_count;
    RAISE NOTICE 'عدد القيود في journal_entries: %', je_count;
    RAISE NOTICE 'وجود عمود entry_id: %', 
        CASE WHEN entry_id_count = 0 THEN '❌ محذوف (صحيح)' ELSE '✅ موجود (خطأ!)' END;
    RAISE NOTICE '';
    
    IF func_count = 1 AND entry_id_count = 0 THEN
        RAISE NOTICE '✅ جميع الإصلاحات مُطبقة بنجاح!';
        RAISE NOTICE '';
        RAISE NOTICE 'الآن يمكن:';
        RAISE NOTICE '- ✅ حفظ القيود المحاسبية';
        RAISE NOTICE '- ✅ حفظ فواتير الشراء/المبيعات';
        RAISE NOTICE '- ✅ حفظ سندات القبض/الصرف';
        RAISE NOTICE '- ✅ ترحيل قسائم الرواتب';
        RAISE NOTICE '- ✅ إنشاء الأصول الثابتة';
    ELSE
        RAISE WARNING '⚠️ لم تكتمل الإصلاحات!';
        IF func_count != 1 THEN
            RAISE WARNING 'مشكلة: يوجد % دالة create_journal_entry_rpc (يجب 1 فقط)', func_count;
        END IF;
        IF entry_id_count != 0 THEN
            RAISE WARNING 'مشكلة: عمود entry_id مازال موجود (يجب حذفه)';
        END IF;
    END IF;
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
END $$;
