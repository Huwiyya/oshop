-- ========================================
-- التحقق من CHECK Constraints على جدول fixed_assets
-- ========================================

-- 1. عرض جميع الـ CHECK constraints على جدول fixed_assets
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'fixed_assets'
  AND con.contype = 'c'  -- c = CHECK constraint
ORDER BY con.conname;

-- 2. إذا لم تظهر النتائج المطلوبة، قم بإنشاء/تحديث الـ constraints:

-- إلغاء الـ constraints القديمة إذا كانت موجودة
ALTER TABLE fixed_assets DROP CONSTRAINT IF EXISTS fixed_assets_status_check;
ALTER TABLE fixed_assets DROP CONSTRAINT IF EXISTS fixed_assets_asset_category_check;
ALTER TABLE fixed_assets DROP CONSTRAINT IF EXISTS fixed_assets_depreciation_method_check;

-- إنشاء الـ constraints الجديدة
ALTER TABLE fixed_assets 
ADD CONSTRAINT fixed_assets_status_check 
CHECK (status IN ('active', 'inactive', 'disposed', 'under_maintenance'));

ALTER TABLE fixed_assets 
ADD CONSTRAINT fixed_assets_asset_category_check 
CHECK (asset_category IN ('tangible', 'intangible', 'wip'));

ALTER TABLE fixed_assets 
ADD CONSTRAINT fixed_assets_depreciation_method_check 
CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'none'));

-- 3. التحقق مرة أخرى بعد الإنشاء
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'fixed_assets'
  AND con.contype = 'c'
ORDER BY con.conname;
