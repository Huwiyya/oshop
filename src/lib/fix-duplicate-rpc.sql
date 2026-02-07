-- ==========================================
-- إصلاح تكرار دالة create_journal_entry_rpc
-- ==========================================
-- المشكلة: هناك نسخ متعددة من الدالة بتوقيعات مختلفة
-- الخطأ: "function create_journal_entry_rpc is not unique"
-- الحل: حذف جميع النسخ وإنشاء النسخة الصحيحة فقط

-- ==========================================
-- الخطوة 1: حذف جميع النسخ القديمة
-- ==========================================

-- حذف النسخة القديمة بدون is_hidden parameter
DROP FUNCTION IF EXISTS create_journal_entry_rpc(date, text, text, text, jsonb);

-- حذف النسخة الجديدة مع is_hidden parameter (سنعيد إنشاءها)
DROP FUNCTION IF EXISTS create_journal_entry_rpc(date, text, text, text, jsonb, boolean);

-- حذف أي نسخ أخرى محتملة
DROP FUNCTION IF EXISTS create_journal_entry_rpc CASCADE;

-- ==========================================
-- الخطوة 2: إنشاء النسخة الصحيحة النهائية
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

    -- Strict Balance Check
    IF abs(v_total_debit - v_total_credit) > 0.0001 THEN
        RAISE EXCEPTION 'Journal Entry is not balanced! Debit: %, Credit: %', v_total_debit, v_total_credit;
    END IF;

    -- B. Generate Entry Number
    year_prefix := to_char(p_entry_date, 'YYYYMMDD');
    new_entry_number := 'JE-' || year_prefix || '-' || floor(random() * 10000)::text;

    -- C. Insert Header
    INSERT INTO journal_entries (
        entry_number,
        entry_date,
        description,
        reference_type,
        reference_id,
        total_debit,
        total_credit,
        status,
        is_system_hidden,
        created_at,
        updated_at
    ) VALUES (
        new_entry_number,
        p_entry_date,
        p_description,
        COALESCE(p_reference_type, 'manual'),
        p_reference_id,
        v_total_debit,
        v_total_credit,
        'posted',
        p_is_hidden,
        NOW(),
        NOW()
    ) RETURNING id INTO new_entry_id;

    -- D. Insert Lines (✅ استخدام journal_entry_id فقط - تم حذف entry_id)
    FOR rec IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        INSERT INTO journal_entry_lines (
            journal_entry_id,   -- ✅ فقط journal_entry_id
            account_id,
            description,
            debit,
            credit
        ) VALUES (
            new_entry_id,
            rec->>'accountId',
            COALESCE(rec->>'description', p_description),
            COALESCE((rec->>'debit')::DECIMAL, 0),
            COALESCE((rec->>'credit')::DECIMAL, 0)
        );
    END LOOP;

    -- E. Return ID
    RETURN new_entry_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- الخطوة 3: التحقق من النجاح
-- ==========================================

-- يجب أن ترى دالة واحدة فقط
SELECT 
    proname as function_name,
    pronargs as parameter_count,
    pg_get_function_arguments(oid) as parameters,
    '✅ Function exists' as status
FROM pg_proc 
WHERE proname = 'create_journal_entry_rpc';

-- يجب أن تكون النتيجة:
-- function_name: create_journal_entry_rpc
-- parameter_count: 6
-- parameters: p_entry_date date, p_description text, p_reference_type text, p_reference_id text, p_lines jsonb, p_is_hidden boolean DEFAULT false
