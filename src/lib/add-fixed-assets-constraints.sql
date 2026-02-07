-- ==========================================
-- إضافة CHECK Constraints لجدول fixed_assets
-- ==========================================
-- هذا السكربت يضيف جميع الـ constraints الناقصة

-- 1. إزالة أي constraints قديمة (إن وجدت)
ALTER TABLE fixed_assets 
DROP CONSTRAINT IF EXISTS fixed_assets_status_check;

ALTER TABLE fixed_assets 
DROP CONSTRAINT IF EXISTS fixed_assets_asset_category_check;

ALTER TABLE fixed_assets 
DROP CONSTRAINT IF EXISTS fixed_assets_depreciation_method_check;

-- 2. إضافة الـ CHECK constraints الجديدة

-- Status constraint
ALTER TABLE fixed_assets 
ADD CONSTRAINT fixed_assets_status_check 
CHECK (status IN ('active', 'inactive', 'disposed', 'under_maintenance'));

-- Asset category constraint
ALTER TABLE fixed_assets 
ADD CONSTRAINT fixed_assets_asset_category_check 
CHECK (asset_category IN ('tangible', 'intangible', 'wip'));

-- Depreciation method constraint
ALTER TABLE fixed_assets 
ADD CONSTRAINT fixed_assets_depreciation_method_check 
CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'none'));

-- 3. التحقق من الـ constraints (اختياري)
SELECT
    con.conname AS constraint_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'fixed_assets'
  AND con.contype = 'c'
ORDER BY con.conname;
