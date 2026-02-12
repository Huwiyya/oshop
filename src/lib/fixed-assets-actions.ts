'use server';

import { supabaseAdmin } from './supabase-admin';
import { createJournalEntry, type JournalEntryLine } from './journal-actions';

// --- إدارة التصنيفات ---
export async function getAssetCategories() {
    const { data, error } = await supabaseAdmin
        .from('asset_categories')
        .select(`
            *,
            asset_account:accounts!asset_account_id(name_ar, account_code),
            accumulated_account:accounts!accumulated_depreciation_account_id(name_ar, account_code),
            expense_account:accounts!depreciation_account_id(name_ar, account_code)
        `)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
    return data;
}

export async function createAssetCategory(data: {
    name_ar: string;
    useful_life_years: number;
    asset_account_id?: string;
    accumulated_depreciation_account_id?: string;
    depreciation_account_id?: string;
}) {
    const { data: newCat, error } = await supabaseAdmin
        .from('asset_categories')
        .insert(data)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return newCat;
}

// --- إدارة الأصول ---
export async function getFixedAssets(categoryId?: string) {
    let query = supabaseAdmin
        .from('fixed_assets')
        .select(`
            *,
            category:asset_categories(name_ar)
        `)
        .order('created_at', { ascending: false });

    if (categoryId) {
        query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching assets:', error);
        return [];
    }
    return data;
}

// --- دوال مساعدة لإنشاء الحسابات ---
async function getAccountCode(id: string) {
    const { data } = await supabaseAdmin.from('accounts').select('account_code, account_type_id').eq('id', id).single();
    return data;
}

async function generateNextCode(parentId: string, parentCode: string) {
    const { data: lastChild } = await supabaseAdmin
        .from('accounts')
        .select('account_code')
        .eq('parent_id', parentId)
        .order('account_code', { ascending: false })
        .limit(1)
        .single();

    if (lastChild && lastChild.account_code) {
        // Try to increment numeric part
        // If code is "12001", next is "12002"
        const num = parseInt(lastChild.account_code);
        if (!isNaN(num)) {
            return (num + 1).toString();
        }
    }
    return parentCode + '001';
}

export async function createFixedAsset(data: {
    name_ar: string;
    asset_code: string;
    category_id: string;
    purchase_date: string;
    cost: number;
    useful_life_years: number;
    salvage_value?: number;
    notes?: string;
}) {
    // 1. Get Category Details to find Parent Account
    const { data: category } = await supabaseAdmin
        .from('asset_categories')
        .select('*')
        .eq('id', data.category_id)
        .single();

    if (!category || !category.asset_account_id) {
        throw new Error('فئة الأصل غير مرتبطة بحساب رئيسي للأصول');
    }

    const parentAccountData = await getAccountCode(category.asset_account_id);
    if (!parentAccountData) throw new Error('حساب الأصول الرئيسي للفئة غير موجود');

    // 2. Create "Asset Parent" Account (The Container) -> e.g. "Toyota Camry"
    // This account will be a PARENT account in the tree
    const assetParentCode = await generateNextCode(category.asset_account_id, parentAccountData.account_code);

    const { data: assetParent, error: err1 } = await supabaseAdmin.from('accounts').insert({
        name_ar: data.name_ar,
        name_en: data.name_ar, // auto copy
        account_code: assetParentCode,
        parent_id: category.asset_account_id,
        account_type_id: parentAccountData.account_type_id,
        is_parent: true, // It acts as a wrapper
        level: 4, // Assuming category is 3
        current_balance: 0,
        is_active: true
    }).select().single();

    if (err1) throw new Error(`فشل إنشاء حساب الأصل الرئيسي: ${err1.message}`);

    // 3. Create "Cost" Sub-Account -> e.g. "Cost - Toyota Camry"
    const costCode = assetParentCode + '01';
    const { data: costAccount, error: err2 } = await supabaseAdmin.from('accounts').insert({
        name_ar: `تكلفة - ${data.name_ar}`,
        account_code: costCode,
        parent_id: assetParent.id,
        account_type_id: parentAccountData.account_type_id,
        is_parent: false,
        level: 5,
        current_balance: 0,
        is_active: true
    }).select().single();

    if (err2) throw new Error(`فشل إنشاء حساب التكلفة: ${err2.message}`);

    // 4. Create "Accumulated Depreciation" Sub-Account -> e.g. "Accumulated Dep - Toyota Camry"
    // Note: This should technically be under "Accumulated Depreciation" category if strict classification is needed,
    // BUT user requested it to be UNDER the asset to show Net Book Value.
    // So we put it under the assetParent.

    const accDepCode = assetParentCode + '02';
    const { data: accDepAccount, error: err3 } = await supabaseAdmin.from('accounts').insert({
        name_ar: `مجمع إهلاك - ${data.name_ar}`,
        account_code: accDepCode,
        parent_id: assetParent.id,
        account_type_id: parentAccountData.account_type_id, // Same type logic, handled by Credit/Debit nature
        is_parent: false,
        level: 5,
        current_balance: 0,
        is_active: true
    }).select().single();

    if (err3) throw new Error(`فشل إنشاء حساب مجمع الإهلاك: ${err3.message}`);

    // 5. Create Asset Record with links to these accounts
    const net_book_value = data.cost;
    const { data: newAsset, error } = await supabaseAdmin
        .from('fixed_assets')
        .insert({
            ...data,
            net_book_value: net_book_value,
            accumulated_depreciation: 0,
            cost_account_id: costAccount.id,
            accumulated_account_id: accDepAccount.id
        })
        .select()
        .single();

    if (error) throw new Error(error.message);

    // 6. Optional: Create Acquisition Journal Entry
    // This assumes the user wants to record the purchase NOW.
    // We need payment account info. For now, since args are limited, we skip auto-JE
    // or we assume it's part of a separate Purchase Invoice flow.
    // To strictly follow "Audit" requirements, we should return the account IDs 
    // so the UI can prompt for "How did you pay?".

    // However, if this is "Opening Balance", we might want to debit Asset, Credit Opening Balance Equity.
    // Let's leave it as is but Return the IDs

    return { ...newAsset, accounts: { cost: costAccount, accumulated: accDepAccount } };
}

// --- الإهلاك ---
export async function runDepreciation(date: string, note?: string) {
    // 1. Get all active assets
    const { data: assets } = await supabaseAdmin
        .from('fixed_assets')
        .select(`
            *,
            category:asset_categories(
                depreciation_account_id
            )
        `)
        .eq('is_active', true)
        .gt('net_book_value', 0);

    if (!assets || assets.length === 0) return { count: 0, journalId: null };

    // Prepare items for RPC
    const items = [];

    for (const asset of assets) {
        // Use Asset Specific Accumulated Account if exists, else fallback
        const accAccountId = asset.accumulated_account_id;
        const expAccountId = asset.category?.depreciation_account_id;

        if (!accAccountId || !expAccountId) {
            console.warn(`Asset ${asset.name_ar} missing accounts linkage`);
            continue;
        }

        const cost = asset.cost;
        const salvage = asset.salvage_value || 0;
        const lifeMonths = (asset.useful_life_years || 5) * 12;

        let monthlyDep = (cost - salvage) / lifeMonths;

        if (monthlyDep > asset.net_book_value) {
            monthlyDep = asset.net_book_value;
        }

        if (monthlyDep <= 0.01) continue;

        items.push({
            asset_id: asset.id,
            asset_name: asset.name_ar,
            depreciation_amount: monthlyDep,
            acc_dep_account_id: accAccountId,
            exp_account_id: expAccountId
        });
    }

    if (items.length === 0) return { count: 0, journalId: null };

    // Call RPC
    const { data: result, error } = await supabaseAdmin.rpc('run_depreciation_rpc', {
        entry_date: date,
        description: `قيد إهلاك دوري - ${note || date}`,
        items: items
    });

    if (error) throw new Error(error.message);

    return { count: result.count, journalId: result.journal_id };
}
