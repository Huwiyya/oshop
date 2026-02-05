-- =====================================================
-- إضافة isFreeShipping إلى orders_v4
-- =====================================================

ALTER TABLE orders_v4 
ADD COLUMN IF NOT EXISTS "isFreeShipping" BOOLEAN DEFAULT FALSE;

-- Index على الشحن المجاني
CREATE INDEX IF NOT EXISTS idx_orders_isFreeShipping 
ON orders_v4("isFreeShipping") 
WHERE "isFreeShipping" = TRUE;

-- تحديث السجلات القديمة
UPDATE orders_v4 
SET "isFreeShipping" = FALSE 
WHERE "isFreeShipping" IS NULL;

-- ملاحظة: بعد تطبيق هذا الملف، يمكنك إزالة التعليق من isFreeShipping في form.tsx (السطر 401)
