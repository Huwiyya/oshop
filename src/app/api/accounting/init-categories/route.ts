import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST() {
    try {
        // 1. إنشاء حسابات الأصول الثابتة إذا لم تكن موجودة
        const accounts = [
            {
                id: 'acc_fixed_assets',
                account_code: '1140',
                name_ar: 'الأصول الثابتة',
                name_en: 'Fixed Assets',
                account_type_id: 'type_asset',
                parent_id: 'acc_current_assets',
                level: 3,
                is_parent: true,
                is_active: true
            },
            {
                id: 'acc_accumulated_dep',
                account_code: '1141',
                name_ar: 'مجمع الإهلاك',
                name_en: 'Accumulated Depreciation',
                account_type_id: 'type_asset',
                parent_id: 'acc_fixed_assets',
                level: 4,
                is_parent: false,
                is_active: true,
                current_balance: 0
            },
            {
                id: 'acc_dep_expense',
                account_code: '5400',
                name_ar: 'مصروف الإهلاك',
                name_en: 'Depreciation Expense',
                account_type_id: 'type_expense',
                parent_id: 'acc_expenses',
                level: 2,
                is_parent: false,
                is_active: true
            }
        ];

        for (const account of accounts) {
            await supabaseAdmin
                .from('accounts')
                .upsert(account, { onConflict: 'account_code' });
        }

        // 2. إنشاء التصنيفات الافتراضية
        const categories = [
            {
                id: 'cat_vehicles',
                name_ar: 'مركبات ووسائل نقل',
                name_en: 'Vehicles',
                depreciation_method: 'straight_line',
                useful_life_years: 5,
                salvage_value_percent: 10,
                asset_account_id: 'acc_fixed_assets',
                depreciation_account_id: 'acc_dep_expense',
                accumulated_depreciation_account_id: 'acc_accumulated_dep'
            },
            {
                id: 'cat_furniture',
                name_ar: 'أثاث ومفروشات',
                name_en: 'Furniture & Fixtures',
                depreciation_method: 'straight_line',
                useful_life_years: 7,
                salvage_value_percent: 5,
                asset_account_id: 'acc_fixed_assets',
                depreciation_account_id: 'acc_dep_expense',
                accumulated_depreciation_account_id: 'acc_accumulated_dep'
            },
            {
                id: 'cat_equipment',
                name_ar: 'أجهزة ومعدات',
                name_en: 'Equipment',
                depreciation_method: 'straight_line',
                useful_life_years: 5,
                salvage_value_percent: 10,
                asset_account_id: 'acc_fixed_assets',
                depreciation_account_id: 'acc_dep_expense',
                accumulated_depreciation_account_id: 'acc_accumulated_dep'
            },
            {
                id: 'cat_computers',
                name_ar: 'أجهزة كمبيوتر',
                name_en: 'Computers',
                depreciation_method: 'straight_line',
                useful_life_years: 3,
                salvage_value_percent: 0,
                asset_account_id: 'acc_fixed_assets',
                depreciation_account_id: 'acc_dep_expense',
                accumulated_depreciation_account_id: 'acc_accumulated_dep'
            },
            {
                id: 'cat_buildings',
                name_ar: 'مباني',
                name_en: 'Buildings',
                depreciation_method: 'straight_line',
                useful_life_years: 20,
                salvage_value_percent: 5,
                asset_account_id: 'acc_fixed_assets',
                depreciation_account_id: 'acc_dep_expense',
                accumulated_depreciation_account_id: 'acc_accumulated_dep'
            }
        ];

        const { data, error } = await supabaseAdmin
            .from('asset_categories')
            .upsert(categories, { onConflict: 'id' })
            .select();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            message: 'تم إنشاء التصنيفات الافتراضية بنجاح',
            count: data?.length || 0
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
