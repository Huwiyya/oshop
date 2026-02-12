-- =====================================================
-- إصلاحات شاملة لـ Schema قاعدة البيانات
-- =====================================================
-- هذا الملف يحل المشاكل المكتشفة من تحليل Schema
-- ملاحظة: الترتيب مهم! إضافة الأعمدة أولاً ثم FKs والـ Indexes

-- =====================================================
-- الجزء 1: إضافة أعمدة مفقودة (أولاً!)
-- =====================================================

-- إضافة managerId لـ expenses (لتتبع من أنشأ المصروف)
ALTER TABLE expenses_v4 
ADD COLUMN IF NOT EXISTS "managerId" TEXT;

-- إضافة userId لـ deposits (ربط العربون بالعميل)
ALTER TABLE deposits_v4 
ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- =====================================================
-- الجزء 2: إضافة Foreign Keys المفقودة
-- =====================================================

-- FK لـ treasury_transactions -> treasury_cards
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'treasury_transactions_v4_cardid_fkey'
    ) THEN
        ALTER TABLE treasury_transactions_v4
        ADD CONSTRAINT treasury_transactions_v4_cardId_fkey 
        FOREIGN KEY ("cardId") REFERENCES treasury_cards_v4(id) ON DELETE CASCADE;
    END IF;
END $$;

-- FK لـ orders -> global_sites (إذا كان موجود)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'global_sites_v4') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_v4_siteid_fkey') THEN
            ALTER TABLE orders_v4
            ADD CONSTRAINT orders_v4_siteId_fkey 
            FOREIGN KEY ("siteId") REFERENCES global_sites_v4(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- FK لـ orders -> managers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_v4_managerid_fkey') THEN
        ALTER TABLE orders_v4
        ADD CONSTRAINT orders_v4_managerId_fkey 
        FOREIGN KEY ("managerId") REFERENCES managers_v4(id) ON DELETE SET NULL;
    END IF;
END $$;

-- FK لـ deposits -> users
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deposits_v4_userid_fkey') THEN
        ALTER TABLE deposits_v4
        ADD CONSTRAINT deposits_v4_userId_fkey 
        FOREIGN KEY ("userId") REFERENCES users_v4(id) ON DELETE SET NULL;
    END IF;
END $$;

-- =====================================================
-- الجزء 3: إضافة Indexes المفقودة
-- =====================================================

-- Indexes على Foreign Keys الجديدة
CREATE INDEX IF NOT EXISTS idx_treasury_tx_cardId ON treasury_transactions_v4("cardId");
CREATE INDEX IF NOT EXISTS idx_orders_siteId ON orders_v4("siteId");
CREATE INDEX IF NOT EXISTS idx_orders_managerId ON orders_v4("managerId");
CREATE INDEX IF NOT EXISTS idx_deposits_userId ON deposits_v4("userId");
CREATE INDEX IF NOT EXISTS idx_expenses_managerId ON expenses_v4("managerId");

-- Indexes إضافية للأداء
CREATE INDEX IF NOT EXISTS idx_deposits_customerPhone ON deposits_v4("customerPhone");
CREATE INDEX IF NOT EXISTS idx_manual_labels_trackingId ON manual_labels_v4("trackingId");
CREATE INDEX IF NOT EXISTS idx_instant_sales_createdAt ON instant_sales_v4("createdAt");

-- =====================================================
-- الجزء 4: إضافة Constraints للتحقق من البيانات
-- =====================================================

-- التأكد من أن الأسعار موجبة
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_v4_sellingprice_positive') THEN
        ALTER TABLE orders_v4
        ADD CONSTRAINT orders_v4_sellingPrice_positive 
        CHECK ("sellingPriceLYD" >= 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_v4_downpayment_valid') THEN
        ALTER TABLE orders_v4
        ADD CONSTRAINT orders_v4_downPayment_valid 
        CHECK ("downPaymentLYD" >= 0 AND "downPaymentLYD" <= "sellingPriceLYD");
    END IF;
END $$;

-- التأكد من أن الوزن موجب
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_v4_weight_positive') THEN
        ALTER TABLE orders_v4
        ADD CONSTRAINT orders_v4_weight_positive 
        CHECK ("weightKG" IS NULL OR "weightKG" >= 0);
    END IF;
END $$;

-- التأكد من أن ديون العملاء صحيحة
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_v4_debt_non_negative') THEN
        ALTER TABLE users_v4
        ADD CONSTRAINT users_v4_debt_non_negative 
        CHECK (debt >= 0);
    END IF;
END $$;

-- =====================================================
-- الجزء 5: تنظيف الجداول القديمة (حذر!)  
-- =====================================================

-- ⚠️ تحذير: قم بعمل Backup قبل تشغيل هذا القسم!
-- ⚠️ هذا سيحذف الجداول القديمة نهائياً

-- UNCOMMENT the following lines if you want to drop old tables:
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS orders CASCADE;
-- DROP TABLE IF EXISTS transactions CASCADE;
-- DROP TABLE IF EXISTS expenses CASCADE;
-- DROP TABLE IF EXISTS system_settings CASCADE;

-- =====================================================
-- الجزء 6: التحقق من الأعمدة الموجودة
-- =====================================================

-- عرض الأعمدة الحرجة للتأكد من وجودها
DO $$
BEGIN
    RAISE NOTICE '=== Treasury Transactions ===';
    RAISE NOTICE 'Created columns: %', 
        (SELECT string_agg(column_name, ', ') 
         FROM information_schema.columns 
         WHERE table_name = 'treasury_transactions_v4' 
         AND column_name LIKE '%creat%');
         
    RAISE NOTICE '=== Wallet Transactions ===';
    RAISE NOTICE 'Created columns: %', 
        (SELECT string_agg(column_name, ', ') 
         FROM information_schema.columns 
         WHERE table_name = 'wallet_transactions_v4' 
         AND column_name LIKE '%creat%');
         
    RAISE NOTICE '=== Shein Transactions ===';
    RAISE NOTICE 'Created columns: %', 
        (SELECT string_agg(column_name, ', ') 
         FROM information_schema.columns 
         WHERE table_name = 'shein_transactions_v4' 
         AND column_name LIKE '%creat%');
         
    RAISE NOTICE '=== Schema Fixes Applied Successfully! ===';
END $$;
