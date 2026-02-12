-- =====================================================
-- إضافة الأعمدة المفقودة للـ Soft Delete و Audit
-- =====================================================

-- 1. إضافة deleted_at للجداول الرئيسية
ALTER TABLE orders_v4 ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE users_v4 ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE representatives_v4 ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE managers_v4 ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE shein_cards_v4 ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- 2. إضافة walletBalance إذا لم يكن موجوداً
ALTER TABLE users_v4 ADD COLUMN IF NOT EXISTS "walletBalance" NUMERIC DEFAULT 0;

-- 3. إنشاء جدول Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    user_id TEXT,                    -- المستخدم/المشرف الذي قام بالعملية
    action TEXT NOT NULL,            -- 'create', 'update', 'delete', 'restore'
    table_name TEXT NOT NULL,        -- اسم الجدول
    record_id TEXT NOT NULL,         -- معرف السجل
    old_values JSONB,                -- القيم القديمة (للتحديث والحذف)
    new_values JSONB,                -- القيم الجديدة (للإنشاء والتحديث)
    ip_address TEXT,                 -- عنوان IP
    user_agent TEXT,                 -- معلومات المتصفح
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. إنشاء Indexes على audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

-- 5. دالة مساعدة لتسجيل Audit
CREATE OR REPLACE FUNCTION log_audit(
    p_user_id TEXT,
    p_action TEXT,
    p_table_name TEXT,
    p_record_id TEXT,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    v_audit_id TEXT;
BEGIN
    v_audit_id := uuid_generate_v4()::TEXT;
    
    INSERT INTO audit_log (
        id, user_id, action, table_name, record_id, old_values, new_values, created_at
    ) VALUES (
        v_audit_id,
        p_user_id,
        p_action,
        p_table_name,
        p_record_id,
        p_old_values,
        p_new_values,
        NOW()
    );
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- تم بنجاح
