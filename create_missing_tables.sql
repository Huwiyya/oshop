-- ============================================
-- إنشاء الجداول المفقودة للنظام المحاسبي
-- ============================================
-- هذا الملف يحتوي على الجداول التي قد تكون غير موجودة
-- يمكن تشغيله بأمان - سيتخطى الجداول الموجودة
-- ============================================

-- ✅ جدول سجلات الرواتب (payroll_records)
-- إذا كنت تستخدم payroll_slips في قاعدة البيانات، لا حاجة لهذا الجدول
CREATE TABLE IF NOT EXISTS payroll_records (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    record_number TEXT UNIQUE NOT NULL,
    employee_id TEXT,
    employee_name TEXT NOT NULL,
    period_month INTEGER NOT NULL,
    period_year INTEGER NOT NULL,
    basic_salary DECIMAL(15,2) NOT NULL,
    overtime DECIMAL(15,2) DEFAULT 0,
    allowances DECIMAL(15,2) DEFAULT 0,
    absences DECIMAL(15,2) DEFAULT 0,
    deductions DECIMAL(15,2) DEFAULT 0,
    advances DECIMAL(15,2) DEFAULT 0,
    net_salary DECIMAL(15,2) NOT NULL,
    payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
    journal_entry_id TEXT REFERENCES journal_entries(id),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ✅ جدول جداول الإهلاك (depreciation_schedule)
CREATE TABLE IF NOT EXISTS depreciation_schedule (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    asset_id TEXT REFERENCES fixed_assets(id) ON DELETE CASCADE,
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL,
    depreciation_amount DECIMAL(15,2) NOT NULL,
    accumulated_depreciation DECIMAL(15,2) NOT NULL,
    net_book_value DECIMAL(15,2) NOT NULL,
    journal_entry_id TEXT REFERENCES journal_entries(id),
    is_posted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(asset_id, period_year, period_month)
);

-- ✅ Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_payroll_records_employee ON payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_period ON payroll_records(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_depreciation_schedule_asset ON depreciation_schedule(asset_id);
CREATE INDEX IF NOT EXISTS idx_depreciation_schedule_period ON depreciation_schedule(period_year, period_month);

-- ملاحظة: جداول أخرى قد تحتاجها
COMMENT ON TABLE payroll_records IS 'سجلات الرواتب - Payroll Records (بديل لـ payroll_slips)';
COMMENT ON TABLE depreciation_schedule IS 'جدول إهلاك الأصول الثابتة - Depreciation Schedule';

-- عرض النتيجة
SELECT 
    'تم التحقق من الجداول المفقودة بنجاح!' as status,
    COUNT(*) as total_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('payroll_records', 'depreciation_schedule');
