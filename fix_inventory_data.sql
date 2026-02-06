-- ============================================
-- إصلاح بيانات المخزون المتضاربة
-- Fix Inventory Data Inconsistency
-- ============================================
-- يحل مشكلة: transactions موجودة لكن layers ناقصة
-- ============================================

-- 1. حذف جميع بيانات المخزون الحالية (للبدء من جديد)
-- ============================================
-- ⚠️ تحذير: سيحذف جميع البيانات الحالية!
-- استخدم فقط إذا كنت متأكداً

-- حذف transactions
DELETE FROM inventory_transactions;

-- حذف layers
DELETE FROM inventory_layers;

-- إعادة تصفير الكميات
UPDATE inventory_items 
SET 
    quantity_on_hand = 0,
    average_cost = 0
WHERE id IS NOT NULL;

SELECT '✅ تم تنظيف جميع بيانات المخزون - يمكنك الآن البدء من جديد' as status;


-- ============================================
-- الحل البديل: إصلاح الـ layers المفقودة فقط
-- ============================================
-- إذا كنت تريد الحفاظ على البيانات وإصلاحها فقط:
-- (قم بتنفيذ هذا بدلاً من الحذف الكامل أعلاه)

/*
-- إنشاء layers المفقودة من transactions
INSERT INTO inventory_layers (item_id, purchase_date, quantity, remaining_quantity, unit_cost, card_number)
SELECT DISTINCT
    t.item_id,
    t.transaction_date as purchase_date,
    t.quantity,
    t.quantity as remaining_quantity, -- افتراض عدم وجود مبيعات
    t.unit_cost,
    NULL as card_number -- سيحتاج إلى إدخال يدوي إذا لزم الأمر
FROM inventory_transactions t
LEFT JOIN inventory_layers l ON t.layer_id = l.id
WHERE t.transaction_type = 'purchase'
  AND t.layer_id IS NULL; -- transactions بدون layers

SELECT '✅ تم إنشاء الـ layers المفقودة' as status;
*/
