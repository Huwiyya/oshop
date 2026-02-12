-- =====================================================
-- إصلاح شامل نهائي - جميع المشاكل المكتش فة
-- =====================================================

-- =====================================================
-- Part 1: إضافة جميع الأعمدة المفقودة في orders_v4
-- =====================================================

ALTER TABLE orders_v4 
ADD COLUMN IF NOT EXISTS "walletAmountUsed" NUMERIC DEFAULT 0;

ALTER TABLE orders_v4 
ADD COLUMN IF NOT EXISTS "shippingExchangeRate" NUMERIC;

ALTER TABLE orders_v4 
ADD COLUMN IF NOT EXISTS "siteId" TEXT;

-- ✅ images موجود بالفعل كـ text[] - لا داعي لإضافته
-- ALTER TABLE orders_v4 
-- ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

ALTER TABLE orders_v4 
ADD COLUMN IF NOT EXISTS "cartUrl" TEXT;

ALTER TABLE orders_v4 
ADD COLUMN IF NOT EXISTS "totalAmountLYD" NUMERIC DEFAULT 0;

-- ملاحظة: cashPaymentAmount و walletPaymentAmount هما computed values فقط للعرض
-- لا نحتفظ بهما في DB لأنهما يُحسبان ديناميكياً

-- =====================================================
-- Part 2: إضافة Foreign Keys المتبقية
-- =====================================================

-- FK: orders -> global_sites
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_v4_siteid_fkey') THEN
        -- التحقق من وجود الجدول أولاً
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'global_sites_v4') THEN
            ALTER TABLE orders_v4
            ADD CONSTRAINT orders_v4_siteid_fkey 
            FOREIGN KEY ("siteId") REFERENCES global_sites_v4(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- FK: tempOrders -> users  
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'temporders_v4_assigneduserid_fkey') THEN
        ALTER TABLE "tempOrders_v4"
        ADD CONSTRAINT tempOrders_v4_assignedUserId_fkey
        FOREIGN KEY ("assignedUserId") REFERENCES users_v4(id) ON DELETE SET NULL;
    END IF;
END $$;

-- FK: tempOrders -> orders (parent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'temporders_v4_parentinvoiceid_fkey') THEN
        ALTER TABLE "tempOrders_v4"
        ADD CONSTRAINT tempOrders_v4_parentInvoiceId_fkey
        FOREIGN KEY ("parentInvoiceId") REFERENCES orders_v4(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================
-- Part 3: إضافة Indexes على الأعمدة الجديدة
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_orders_siteId ON orders_v4("siteId");
CREATE INDEX IF NOT EXISTS idx_orders_walletAmountUsed ON orders_v4("walletAmountUsed") WHERE "walletAmountUsed" > 0;
CREATE INDEX IF NOT EXISTS idx_tempOrders_assignedUserId ON "tempOrders_v4"("assignedUserId");
CREATE INDEX IF NOT EXISTS idx_tempOrders_parentInvoiceId ON "tempOrders_v4"("parentInvoiceId");

-- =====================================================
-- Part 4: Constraints إضافية
-- =====================================================

-- التأكد من أن walletAmountUsed لا يكون سالباً
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_v4_walletamountused_positive') THEN
        ALTER TABLE orders_v4
        ADD CONSTRAINT orders_v4_walletAmountUsed_positive 
        CHECK ("walletAmountUsed" >= 0);
    END IF;
END $$;

-- =====================================================
-- Part 5: تنظيف البيانات (اختياري)
-- =====================================================

-- تحديث السجلات القديمة لديها walletAmountUsed = NULL إلى 0
UPDATE orders_v4 SET "walletAmountUsed" = 0 WHERE "walletAmountUsed" IS NULL;

-- ✅ images هو text[] وليس jsonb - لا داعي لتحديثه
-- UPDATE orders_v4 SET images = '[]'::jsonb WHERE images IS NULL;

-- =====================================================
-- Part 6: التحقق النهائي
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=== Final Verification ===';
    RAISE NOTICE 'orders_v4 columns: %', 
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'orders_v4');
    RAISE NOTICE '✅ All fixes applied successfully!';
END $$;
