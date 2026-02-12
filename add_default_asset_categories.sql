-- إضافة التصنيفات الافتراضية للأصول الثابتة

-- تأكد من وجود الحسابات المطلوبة أولاً
-- إذا لم تكن موجودة، قم بإنشائها

-- 1. حساب الأصول الثابتة (يجب إنشاؤه تحت الأصول)
INSERT INTO accounts (id, account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent, is_active)
VALUES 
('acc_fixed_assets', '1140', 'الأصول الثابتة', 'Fixed Assets', 'type_asset', 'acc_current_assets', 3, true, true)
ON CONFLICT (account_code) DO NOTHING;

-- 2. حساب مجمع الإهلاك (Contra Asset)
INSERT INTO accounts (id, account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent, is_active, current_balance)
VALUES 
('acc_accumulated_dep', '1141', 'مجمع الإهلاك', 'Accumulated Depreciation', 'type_asset', 'acc_fixed_assets', 4, false, true, 0)
ON CONFLICT (account_code) DO NOTHING;

-- 3. حساب مصروف الإهلاك
INSERT INTO accounts (id, account_code, name_ar, name_en, account_type_id, parent_id, level, is_parent, is_active)
VALUES 
('acc_dep_expense', '5400', 'مصروف الإهلاك', 'Depreciation Expense', 'type_expense', 'acc_expenses', 2, false, true)
ON CONFLICT (account_code) DO NOTHING;

-- 4. التصنيفات الافتراضية للأصول
INSERT INTO asset_categories (id, name_ar, name_en, depreciation_method, useful_life_years, salvage_value_percent, asset_account_id, depreciation_account_id, accumulated_depreciation_account_id)
VALUES 
('cat_vehicles', 'مركبات ووسائل نقل', 'Vehicles', 'straight_line', 5, 10, 'acc_fixed_assets', 'acc_dep_expense', 'acc_accumulated_dep'),
('cat_furniture', 'أثاث ومفروشات', 'Furniture & Fixtures', 'straight_line', 7, 5, 'acc_fixed_assets', 'acc_dep_expense', 'acc_accumulated_dep'),
('cat_equipment', 'أجهزة ومعدات', 'Equipment', 'straight_line', 5, 10, 'acc_fixed_assets', 'acc_dep_expense', 'acc_accumulated_dep'),
('cat_computers', 'أجهزة كمبيوتر', 'Computers', 'straight_line', 3, 0, 'acc_fixed_assets', 'acc_dep_expense', 'acc_accumulated_dep'),
('cat_buildings', 'مباني', 'Buildings', 'straight_line', 20, 5, 'acc_fixed_assets', 'acc_dep_expense', 'acc_accumulated_dep')
ON CONFLICT (id) DO NOTHING;

-- عرض التصنيفات المضافة
SELECT 'تم إضافة' as status, COUNT(*) as count FROM asset_categories;
