-- =====================================================
-- Atomic Stored Procedures for Oshop Financial System
-- =====================================================
-- هذا الملف يحتوي على stored procedures لضمان المعاملات الذرية
-- يجب تطبيقه على قاعدة البيانات باستخدام: psql < atomic_procedures.sql

-- تفعيل UUID extension إذا لم يكن موجوداً
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. دالة إنشاء طلب بشكل ذري
-- =====================================================
CREATE OR REPLACE FUNCTION create_order_atomic(
    p_order_data JSONB,
    p_user_id TEXT,
    p_down_payment NUMERIC DEFAULT 0,
    p_payment_method TEXT DEFAULT 'cash',
    p_manager_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_order_id TEXT;
    v_remaining_amount NUMERIC;
    v_selling_price NUMERIC;
    v_transaction_id TEXT;
    v_customer_name TEXT;
    v_treasury_card_id TEXT;
    v_result JSONB;
BEGIN
    -- 1. إنشاء Order ID
    v_order_id := uuid_generate_v4()::TEXT;
    
    -- 2. استخراج البيانات من JSON
    v_selling_price := (p_order_data->>'sellingPriceLYD')::NUMERIC;
    v_customer_name := p_order_data->>'customerName';
    v_remaining_amount := v_selling_price - COALESCE(p_down_payment, 0);
    
    -- 3. إدراج الطلب
    INSERT INTO orders_v4 (
        id,
        "invoiceNumber",
        "trackingId",
        "userId",
        "customerName",
        "operationDate",
        "sellingPriceLYD",
        "remainingAmount",
        status,
        "productLinks",
        "exchangeRate",
        "purchasePriceUSD",
        "downPaymentLYD",
        "itemDescription",
        "paymentMethod",
        "managerId",
        created_at
    ) VALUES (
        v_order_id,
        COALESCE(p_order_data->>'invoiceNumber', 'INV-' || v_order_id),
        COALESCE(p_order_data->>'trackingId', ''),
        p_user_id,
        v_customer_name,
        COALESCE(p_order_data->>'operationDate', NOW()::TEXT),
        v_selling_price,
        v_remaining_amount,
        COALESCE(p_order_data->>'status', 'pending'),
        COALESCE(p_order_data->>'productLinks', ''),
        COALESCE((p_order_data->>'exchangeRate')::NUMERIC, 4.8),
        COALESCE((p_order_data->>'purchasePriceUSD')::NUMERIC, 0),
        p_down_payment,
        COALESCE(p_order_data->>'itemDescription', ''),
        p_payment_method,
        p_manager_id,
        NOW()
    );
    
    -- 4. إذا كان هناك دفعة مقدمة، تحديث الخزينة
    IF p_down_payment > 0 THEN
        -- اختيار الخزينة المناسبة بناءً على طريقة الدفع
        SELECT id INTO v_treasury_card_id
        FROM treasury_cards_v4
        WHERE type = CASE 
            WHEN p_payment_method = 'cash' THEN 'cash_libyan'
            WHEN p_payment_method = 'cash_dollar' THEN 'cash_dollar'
            WHEN p_payment_method = 'card' THEN 'bank'
            ELSE 'cash_libyan'
        END
        LIMIT 1;
        
        -- تحديث رصيد الخزينة (atomic increment)
        UPDATE treasury_cards_v4
        SET balance = balance + p_down_payment,
            "updatedAt" = NOW()::TEXT
        WHERE id = v_treasury_card_id;
        
        -- إضافة معاملة خزينة
        INSERT INTO treasury_transactions_v4 (
            id,
            amount,
            type,
            channel,
            "cardId",
            description,
            "relatedOrderId",
            "createdAt"
        ) VALUES (
            uuid_generate_v4()::TEXT,
            p_down_payment,
            'deposit',
            CASE p_payment_method WHEN 'card' THEN 'bank' ELSE 'cash' END,
            v_treasury_card_id,
            'دفعة مقدمة - طلب ' || (p_order_data->>'invoiceNumber'),
            v_order_id,
            NOW()
        );
    END IF;
    
    -- 5. تحديث دين العميل (atomic increment)
    UPDATE users_v4
    SET debt = debt + v_remaining_amount,
        "orderCount" = "orderCount" + 1
    WHERE id = p_user_id;
    
    -- 6. إضافة معاملة مالية
    v_transaction_id := uuid_generate_v4()::TEXT;
    INSERT INTO transactions_v4 (
        id,
        "orderId",
        "customerId",
        "customerName",
        date,
        type,
        status,
        amount,
        description,
        "managerId",
        created_at
    ) VALUES (
        v_transaction_id,
        v_order_id,
        p_user_id,
        v_customer_name,
        NOW()::TEXT,
        'order',
        'pending',
        v_remaining_amount,
        'طلب جديد - ' || (p_order_data->>'invoiceNumber'),
        p_manager_id,
        NOW()
    );
    
    -- 7. إرجاع النتيجة
    v_result := jsonb_build_object(
        'success', true,
        'orderId', v_order_id,
        'remainingAmount', v_remaining_amount,
        'transactionId', v_transaction_id
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- في حالة أي خطأ، سيتم التراجع عن كل التغييرات تلقائياً
        RAISE EXCEPTION 'فشل إنشاء الطلب: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. دالة حذف طلب بشكل ذري (Soft Delete)
-- =====================================================
CREATE OR REPLACE FUNCTION delete_order_atomic(
    p_order_id TEXT,
    p_manager_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_result JSONB;
    v_treasury_card_id TEXT;
BEGIN
    -- 1. جلب بيانات الطلب
    SELECT * INTO v_order
    FROM orders_v4
    WHERE id = p_order_id AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'الطلب غير موجود أو محذوف مسبقاً';
    END IF;
    
    -- 2. تحديث حالة الطلب إلى cancelled وإضافة deleted_at للـ soft delete
    UPDATE orders_v4
    SET status = 'cancelled',
        deleted_at = NOW()
    WHERE id = p_order_id;
    
    -- 3. إرجاع الدفعة المقدمة من الخزينة (إذا وجدت)
    IF v_order."downPaymentLYD" > 0 THEN
        -- اختيار الخزينة المناسبة
        SELECT id INTO v_treasury_card_id
        FROM treasury_cards_v4
        WHERE type = CASE 
            WHEN v_order."paymentMethod" = 'cash' THEN 'cash_libyan'
            WHEN v_order."paymentMethod" = 'cash_dollar' THEN 'cash_dollar'
            WHEN v_order."paymentMethod" = 'card' THEN 'bank'
            ELSE 'cash_libyan'
        END
        LIMIT 1;
        
        -- خصم من الخزينة (atomic)
        UPDATE treasury_cards_v4
        SET balance = balance - v_order."downPaymentLYD",
            "updatedAt" = NOW()::TEXT
        WHERE id = v_treasury_card_id;
        
        -- تسجيل معاملة السحب
        INSERT INTO treasury_transactions_v4 (
            id, amount, type, channel, "cardId", description, "relatedOrderId", "createdAt"
        ) VALUES (
            uuid_generate_v4()::TEXT,
            v_order."downPaymentLYD",
            'withdrawal',
            CASE v_order."paymentMethod" WHEN 'card' THEN 'bank' ELSE 'cash' END,
            v_treasury_card_id,
            'استرجاع دفعة مقدمة - حذف طلب ' || v_order."invoiceNumber",
            p_order_id,
            NOW()
        );
    END IF;
    
    -- 4. تقليل دين العميل (atomic)
    UPDATE users_v4
    SET debt = debt - v_order."remainingAmount",
        "orderCount" = GREATEST("orderCount" - 1, 0)
    WHERE id = v_order."userId";
    
    -- 5. تحديث حالة المعاملة المالية
    UPDATE transactions_v4
    SET status = 'cancelled'
    WHERE "orderId" = p_order_id;
    
    -- 6. تسجيل في Audit Log
    INSERT INTO audit_log (
        id, user_id, action, table_name, record_id, old_values, created_at
    ) VALUES (
        uuid_generate_v4()::TEXT,
        p_manager_id,
        'delete',
        'orders_v4',
        p_order_id,
        to_jsonb(v_order),
        NOW()
    );
    
    -- 7. إرجاع النتيجة
    v_result := jsonb_build_object(
        'success', true,
        'orderId', p_order_id,
        'refundedAmount', v_order."downPaymentLYD",
        'debtReduced', v_order."remainingAmount"
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'فشل حذف الطلب: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. دالة تحديث وزن الطلب بشكل ذري
-- =====================================================
CREATE OR REPLACE FUNCTION update_order_weight_atomic(
    p_order_id TEXT,
    p_weight_kg NUMERIC,
    p_cost_price NUMERIC,
    p_selling_price NUMERIC,
    p_cost_currency TEXT DEFAULT 'LYD',
    p_selling_currency TEXT DEFAULT 'LYD',
    p_manager_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_old_customer_cost NUMERIC;
    v_cost_difference NUMERIC;
    v_result JSONB;
BEGIN
    -- التحقق من صحة البيانات
    IF p_weight_kg < 0 THEN
        RAISE EXCEPTION 'الوزن لا يمكن أن يكون سالباً';
    END IF;
    
    IF p_cost_price < 0 OR p_selling_price < 0 THEN
        RAISE EXCEPTION 'الأسعار لا يمكن أن تكون سالبة';
    END IF;
    
    -- 1. جلب بيانات الطلب الحالية
    SELECT * INTO v_order
    FROM orders_v4
    WHERE id = p_order_id AND deleted_at IS NULL;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'الطلب غير موجود';
    END IF;
    
    -- 2. حساب الفرق في التكلفة
    v_old_customer_cost := COALESCE(v_order."customerWeightCost", 0);
    v_cost_difference := p_selling_price - v_old_customer_cost;
    
    -- 3. تحديث بيانات الطلب
    UPDATE orders_v4
    SET "weightKG" = p_weight_kg,
        "companyWeightCost" = p_cost_price,
        "customerWeightCost" = p_selling_price,
        "companyWeightCostCurrency" = p_cost_currency,
        "customerWeightCostCurrency" = p_selling_currency,
        "totalAmountLYD" = COALESCE("sellingPriceLYD", 0) + v_cost_difference,
        "remainingAmount" = "remainingAmount" + v_cost_difference
    WHERE id = p_order_id;
    
    -- 4. تحديث دين العميل (atomic)
    UPDATE users_v4
    SET debt = debt + v_cost_difference
    WHERE id = v_order."userId";
    
    -- 5. إضافة معاملة مالية إذا كان هناك فرق
    IF v_cost_difference != 0 THEN
        INSERT INTO transactions_v4 (
            id, "orderId", "customerId", "customerName", date, type, status, amount, description, "managerId", created_at
        ) VALUES (
            uuid_generate_v4()::TEXT,
            p_order_id,
            v_order."userId",
            v_order."customerName",
            NOW()::TEXT,
            'order',
            v_order.status,
            v_cost_difference,
            'تحديث وزن الطلب - ' || v_order."invoiceNumber",
            p_manager_id,
            NOW()
        );
    END IF;
    
    -- 6. تسجيل في Audit Log
    INSERT INTO audit_log (
        id, user_id, action, table_name, record_id, old_values, new_values, created_at
    ) VALUES (
        uuid_generate_v4()::TEXT,
        p_manager_id,
        'update',
        'orders_v4',
        p_order_id,
        jsonb_build_object('weightKG', v_order."weightKG", 'customerWeightCost', v_old_customer_cost),
        jsonb_build_object('weightKG', p_weight_kg, 'customerWeightCost', p_selling_price),
        NOW()
    );
    
    -- 7. إرجاع النتيجة
    v_result := jsonb_build_object(
        'success', true,
        'orderId', p_order_id,
        'costDifference', v_cost_difference,
        'newDebt', (SELECT debt FROM users_v4 WHERE id = v_order."userId")
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'فشل تحديث الوزن: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. دالة إعادة حساب إحصائيات المستخدم
-- =====================================================
CREATE OR REPLACE FUNCTION recalculate_user_stats_atomic(
    p_user_id TEXT
) RETURNS JSONB AS $$
DECLARE
    v_total_debt NUMERIC := 0;
    v_order_count INTEGER := 0;
    v_result JSONB;
BEGIN
    -- حساب الدين من الطلبات النشطة
    SELECT 
        COALESCE(SUM("remainingAmount"), 0),
        COUNT(*)
    INTO v_total_debt, v_order_count
    FROM orders_v4
    WHERE "userId" = p_user_id
      AND status NOT IN ('cancelled', 'paid')
      AND deleted_at IS NULL;
    
    -- تحديث بيانات المستخدم
    UPDATE users_v4
    SET debt = v_total_debt,
        "orderCount" = v_order_count
    WHERE id = p_user_id;
    
    v_result := jsonb_build_object(
        'success', true,
        'userId', p_user_id,
        'totalDebt', v_total_debt,
        'orderCount', v_order_count
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'فشل إعادة حساب الإحصائيات: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. دالة إضافة رصيد للمحفظة بشكل ذري
-- =====================================================
CREATE OR REPLACE FUNCTION add_wallet_balance_atomic(
    p_user_id TEXT,
    p_amount NUMERIC,
    p_payment_method TEXT DEFAULT 'cash',
    p_description TEXT DEFAULT '',
    p_manager_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_transaction_id TEXT;
    v_result JSONB;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'المبلغ يجب أن يكون أكبر من صفر';
    END IF;
    
    -- 1. تحديث رصيد المحفظة (atomic)
    UPDATE users_v4
    SET "walletBalance" = COALESCE("walletBalance", 0) + p_amount
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'المستخدم غير موجود';
    END IF;
    
    -- 2. تسجيل المعاملة
    v_transaction_id := uuid_generate_v4()::TEXT;
    INSERT INTO wallet_transactions_v4 (
        id, "userId", amount, type, "paymentMethod", description, "managerId", created_at
    ) VALUES (
        v_transaction_id,
        p_user_id,
        p_amount,
        'deposit',
        p_payment_method,
        COALESCE(p_description, 'إيداع في المحفظة'),
        p_manager_id,
        NOW()
    );
    
    v_result := jsonb_build_object(
        'success', true,
        'userId', p_user_id,
        'amount', p_amount,
        'transactionId', v_transaction_id,
        'newBalance', (SELECT "walletBalance" FROM users_v4 WHERE id = p_user_id)
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'فشل إضافة الرصيد: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- تم إنشاء جميع الـ Stored Procedures بنجاح!
-- =====================================================
