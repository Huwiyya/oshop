-- =====================================================
-- إصلاح الأخطاء المحاسبية - Schema Updates
-- =====================================================

-- 1. إضافة عمود لتتبع المبلغ المستخدم من المحفظة
ALTER TABLE orders_v4 
ADD COLUMN IF NOT EXISTS "walletAmountUsed" NUMERIC DEFAULT 0;

-- 2. إضافة index على العمود الجديد
CREATE INDEX IF NOT EXISTS idx_orders_walletAmountUsed 
ON orders_v4("walletAmountUsed") 
WHERE "walletAmountUsed" > 0;

-- 3. إضافة constraint للتأكد من أن walletBalance لا يصبح سالباً
ALTER TABLE users_v4
DROP CONSTRAINT IF EXISTS users_v4_wallet_non_negative;

ALTER TABLE users_v4
ADD CONSTRAINT users_v4_wallet_non_negative 
CHECK ("walletBalance" >= 0);

-- 4. إضافة function للخصم الذري من المحفظة (Atomic Wallet Deduction)
CREATE OR REPLACE FUNCTION atomic_wallet_deduct(
    p_user_id TEXT,
    p_amount NUMERIC
) RETURNS TABLE(success BOOLEAN, new_balance NUMERIC) AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- محاولة الخصم مع قفل السطر (row lock)
    UPDATE users_v4
    SET "walletBalance" = "walletBalance" - p_amount
    WHERE id = p_user_id 
      AND "walletBalance" >= p_amount  -- ✅ Atomic check
    RETURNING "walletBalance" INTO v_new_balance;
    
    IF FOUND THEN
        -- نجح الخصم
        RETURN QUERY SELECT TRUE, v_new_balance;
    ELSE
        -- فشل - رصيد غير كافٍ
        SELECT "walletBalance" INTO v_current_balance
        FROM users_v4 WHERE id = p_user_id;
        
        RETURN QUERY SELECT FALSE, COALESCE(v_current_balance, 0);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. إضافة function للإيداع الذري في المحفظة
CREATE OR REPLACE FUNCTION atomic_wallet_deposit(
    p_user_id TEXT,
    p_amount NUMERIC
) RETURNS TABLE(success BOOLEAN, new_balance NUMERIC) AS $$
DECLARE
    v_new_balance NUMERIC;
BEGIN
    UPDATE users_v4
    SET "walletBalance" = "walletBalance" + p_amount
    WHERE id = p_user_id
    RETURNING "walletBalance" INTO v_new_balance;
    
    IF FOUND THEN
        RETURN QUERY SELECT TRUE, v_new_balance;
    ELSE
        RETURN QUERY SELECT FALSE, 0::NUMERIC;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- تم إنشاء Schema fixes للأخطاء المحاسبية!
