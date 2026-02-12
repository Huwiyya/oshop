-- ============================================
-- إصلاح جدول journal_entry_lines
-- ============================================
-- إضافة عمود journal_entry_id كبديل لـ entry_id
-- للتوافق مع الكود الحالي
-- ============================================

-- 1. إضافة عمود journal_entry_id (إذا لم يكن موجوداً)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'journal_entry_lines' 
        AND column_name = 'journal_entry_id'
    ) THEN
        -- إضافة العمود الجديد
        ALTER TABLE journal_entry_lines 
        ADD COLUMN journal_entry_id TEXT REFERENCES journal_entries(id) ON DELETE CASCADE;
        
        -- نسخ القيم من entry_id إلى journal_entry_id
        UPDATE journal_entry_lines 
        SET journal_entry_id = entry_id;
        
        -- جعل العمود NOT NULL بعد النسخ
        ALTER TABLE journal_entry_lines 
        ALTER COLUMN journal_entry_id SET NOT NULL;
        
        RAISE NOTICE 'تم إضافة عمود journal_entry_id بنجاح';
    ELSE
        RAISE NOTICE 'عمود journal_entry_id موجود مسبقاً';
    END IF;
END $$;

-- 2. إنشاء index للأداء
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_journal_entry 
ON journal_entry_lines(journal_entry_id);

-- 3. التحقق من النتيجة
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'journal_entry_lines' 
AND column_name IN ('entry_id', 'journal_entry_id')
ORDER BY column_name;

-- عرض رسالة نجاح
SELECT 'تم إصلاح جدول journal_entry_lines بنجاح!' as status;
