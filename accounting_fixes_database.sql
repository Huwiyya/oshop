-- ============================================
-- إصلاحات محاسبية شاملة للنظام
-- Comprehensive Accounting Fixes
-- ============================================
-- المرحلة 1: إنشاء البنية التحتية الأساسية
-- ============================================

-- 1. جدول سجل المراجعة (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'REVERSE')),
    old_values JSONB,
    new_values JSONB,
    user_id TEXT,
    user_email TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT
);

-- Index للأداء
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

-- 2. إضافة حقول Soft Delete للجداول الرئيسية
-- ============================================

-- إضافة حقول للقيود اليومية
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by TEXT,
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- إضافة حقول لسندات القبض والصرف
ALTER TABLE receipts 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by TEXT;

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- 3. Database Function لتحديث رصيد الحساب بشكل آمن
-- ============================================

-- حذف النسخة القديمة إن وجدت
DROP FUNCTION IF EXISTS update_account_balance();
DROP FUNCTION IF EXISTS update_account_balance(TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION update_account_balance(
    p_account_id TEXT,
    p_amount NUMERIC,
    p_operation TEXT DEFAULT 'ADD' -- 'ADD' or 'SUBTRACT'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- قفل الصف لتجنب Race Conditions
    SELECT current_balance INTO v_current_balance
    FROM accounts
    WHERE id = p_account_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Account not found: %', p_account_id;
    END IF;
    
    -- حساب الرصيد الجديد
    IF p_operation = 'ADD' THEN
        v_new_balance := v_current_balance + p_amount;
    ELSIF p_operation = 'SUBTRACT' THEN
        v_new_balance := v_current_balance - p_amount;
    ELSE
        RAISE EXCEPTION 'Invalid operation: %. Use ADD or SUBTRACT', p_operation;
    END IF;
    
    -- تحديث الرصيد
    UPDATE accounts
    SET current_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = p_account_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 4. Function لحذف قيد يومي مع تحديث الأرصدة (Safe Delete)
-- ============================================

CREATE OR REPLACE FUNCTION safe_delete_journal_entry(
    p_entry_id TEXT,
    p_user_id TEXT DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_entry RECORD;
    v_line RECORD;
    v_result JSON;
    v_affected_accounts INTEGER := 0;
BEGIN
    -- 1. التحقق من وجود القيد
    SELECT * INTO v_entry
    FROM journal_entries
    WHERE id = p_entry_id AND is_deleted = FALSE;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'القيد غير موجود أو محذوف مسبقاً'
        );
    END IF;
    
    -- 2. منع حذف القيود المرحّلة (Critical Fix #4)
    IF v_entry.is_posted THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'لا يمكن حذف قيد مرحّل. يجب إنشاء قيد عكسي (Reversing Entry) بدلاً من ذلك.'
        );
    END IF;
    
    -- 3. تسجيل في Audit Log قبل الحذف
    INSERT INTO audit_log (
        table_name, record_id, action, old_values, user_id, reason
    ) VALUES (
        'journal_entries',
        p_entry_id,
        'DELETE',
        row_to_json(v_entry),
        p_user_id,
        p_reason
    );
    
    -- 4. عكس القيد - تحديث الأرصدة (Critical Fix #1)
    FOR v_line IN 
        SELECT account_id, debit, credit
        FROM journal_entry_lines
        WHERE journal_entry_id = p_entry_id
    LOOP
        -- عكس التأثير: المدين يصبح دائن والعكس
        IF v_line.debit > 0 THEN
            PERFORM update_account_balance(
                v_line.account_id,
                v_line.debit,
                'SUBTRACT'
            );
        END IF;
        
        IF v_line.credit > 0 THEN
            PERFORM update_account_balance(
                v_line.account_id,
                v_line.credit,
                'ADD'
            );
        END IF;
        
        v_affected_accounts := v_affected_accounts + 1;
    END LOOP;
    
    -- 5. Soft Delete بدلاً من Hard Delete (Critical Fix #3)
    UPDATE journal_entries
    SET is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = p_user_id,
        deletion_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_entry_id;
    
    -- 6. "حذف" الأسطر (Soft Delete أيضاً إذا أضفنا الحقول)
    -- أو يمكن الإبقاء عليها للتدقيق
    
    -- 7. إرجاع النتيجة
    RETURN json_build_object(
        'success', TRUE,
        'affected_accounts', v_affected_accounts,
        'entry_number', v_entry.entry_number
    );
    
EXCEPTION WHEN OTHERS THEN
    -- في حالة أي خطأ، rollback تلقائي
    RETURN json_build_object(
        'success', FALSE,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger لتحديث الأرصدة تلقائياً (Critical Fix #2)
-- ============================================

-- Function للـ Trigger
CREATE OR REPLACE FUNCTION auto_update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_balance_change NUMERIC;
BEGIN
    -- عند INSERT
    IF (TG_OP = 'INSERT') THEN
        -- المدين يزيد الرصيد، الدائن ينقصه
        v_balance_change := NEW.debit - NEW.credit;
        
        UPDATE accounts
        SET current_balance = current_balance + v_balance_change,
            updated_at = NOW()
        WHERE id = NEW.account_id;
        
        RETURN NEW;
    
    -- عند DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        -- عكس التأثير
        v_balance_change := OLD.debit - OLD.credit;
        
        UPDATE accounts
        SET current_balance = current_balance - v_balance_change,
            updated_at = NOW()
        WHERE id = OLD.account_id;
        
        RETURN OLD;
    
    -- عند UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        -- إزالة التأثير القديم
        v_balance_change := OLD.debit - OLD.credit;
        UPDATE accounts
        SET current_balance = current_balance - v_balance_change
        WHERE id = OLD.account_id;
        
        -- إضافة التأثير الجديد
        v_balance_change := NEW.debit - NEW.credit;
        UPDATE accounts
        SET current_balance = current_balance + v_balance_change,
            updated_at = NOW()
        WHERE id = NEW.account_id;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- إنشاء الـ Trigger
DROP TRIGGER IF EXISTS trigger_update_account_balance ON journal_entry_lines;
CREATE TRIGGER trigger_update_account_balance
    AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
    FOR EACH ROW
    EXECUTE FUNCTION auto_update_account_balance();

-- 6. Function للتحقق من توازن القيد (Critical Fix #5)
-- ============================================

CREATE OR REPLACE FUNCTION validate_journal_entry_balance(
    p_entry_id TEXT
)
RETURNS JSON AS $$
DECLARE
    v_total_debit NUMERIC;
    v_total_credit NUMERIC;
    v_difference NUMERIC;
BEGIN
    SELECT 
        COALESCE(SUM(debit), 0),
        COALESCE(SUM(credit), 0)
    INTO v_total_debit, v_total_credit
    FROM journal_entry_lines
    WHERE journal_entry_id = p_entry_id;
    
    v_difference := ABS(v_total_debit - v_total_credit);
    
    IF v_difference > 0.01 THEN
        RETURN json_build_object(
            'valid', FALSE,
            'total_debit', v_total_debit,
            'total_credit', v_total_credit,
            'difference', v_difference,
            'error', 'القيد غير متوازن: المدين ≠ الدائن'
        );
    END IF;
    
    RETURN json_build_object(
        'valid', TRUE,
        'total_debit', v_total_debit,
        'total_credit', v_total_credit
    );
END;
$$ LANGUAGE plpgsql;

-- 7. Function لإنشاء قيد عكسي (Reversing Entry)
-- ============================================

CREATE OR REPLACE FUNCTION create_reversing_entry(
    p_original_entry_id TEXT,
    p_user_id TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_original RECORD;
    v_new_entry_id TEXT;
    v_new_entry_number TEXT;
    v_line RECORD;
BEGIN
    -- 1. جلب القيد الأصلي
    SELECT * INTO v_original
    FROM journal_entries
    WHERE id = p_original_entry_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', FALSE, 'error', 'القيد الأصلي غير موجود');
    END IF;
    
    -- 2. إنشاء رقم قيد جديد
    v_new_entry_number := 'JE-REV-' || to_char(NOW(), 'YYYYMMDD-HH24MISS');
    v_new_entry_id := gen_random_uuid()::text;
    
    -- 3. إنشاء القيد العكسي
    INSERT INTO journal_entries (
        id, entry_number, entry_date, description, 
        reference_type, reference_id, is_posted, created_by
    ) VALUES (
        v_new_entry_id,
        v_new_entry_number,
        CURRENT_DATE,
        COALESCE(p_description, 'قيد عكسي لـ: ' || v_original.description),
        'reversal',
        p_original_entry_id,
        FALSE,
        p_user_id
    );
    
    -- 4. نسخ الأسطر مع عكس المدين والدائن
    FOR v_line IN
        SELECT * FROM journal_entry_lines
        WHERE journal_entry_id = p_original_entry_id
    LOOP
        INSERT INTO journal_entry_lines (
            id, journal_entry_id, entry_id, account_id,
            description, debit, credit, line_number
        ) VALUES (
            gen_random_uuid()::text,
            v_new_entry_id,
            v_new_entry_id,
            v_line.account_id,
            v_line.description,
            v_line.credit,  -- عكس!
            v_line.debit,   -- عكس!
            v_line.line_number
        );
    END LOOP;
    
    -- 5. تسجيل في Audit Log
    INSERT INTO audit_log (
        table_name, record_id, action, new_values, user_id
    ) VALUES (
        'journal_entries',
        v_new_entry_id,
        'REVERSE',
        json_build_object(
            'original_entry_id', p_original_entry_id,
            'new_entry_id', v_new_entry_id
        ),
        p_user_id
    );
    
    RETURN json_build_object(
        'success', TRUE,
        'new_entry_id', v_new_entry_id,
        'new_entry_number', v_new_entry_number
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', FALSE, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- التعليقات والتوثيق
-- ============================================

COMMENT ON TABLE audit_log IS 'سجل المراجعة - Audit Trail';
COMMENT ON FUNCTION safe_delete_journal_entry IS 'حذف آمن للقيد مع تحديث الأرصدة وSoft Delete';
COMMENT ON FUNCTION validate_journal_entry_balance IS 'التحقق من توازن القيد (المدين = الدائن)';
COMMENT ON FUNCTION create_reversing_entry IS 'إنشاء قيد عكسي للقيود المرحّلة';
COMMENT ON FUNCTION update_account_balance IS 'تحديث رصيد حساب بشكل آمن (Thread-Safe)';

-- ============================================
-- رسالة نجاح
-- ============================================

SELECT 
    '✅ تم تطبيق جميع الإصلاحات المحاسبية بنجاح!' as status,
    'جميع المشاكل الحرجة تم حلها' as message;
