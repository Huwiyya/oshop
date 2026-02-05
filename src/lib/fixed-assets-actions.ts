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
    // Calculate initial Net Book Value (Cost)
    const net_book_value = data.cost;

    const { data: newAsset, error } = await supabaseAdmin
        .from('fixed_assets')
        .insert({
            ...data,
            net_book_value: net_book_value,
            accumulated_depreciation: 0
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return newAsset;
}

// --- الإهلاك ---
export async function runDepreciation(date: string, note?: string) {
    // 1. Get all active assets
    const { data: assets } = await supabaseAdmin
        .from('fixed_assets')
        .select(`
            *,
            category:asset_categories(
                accumulated_depreciation_account_id,
                depreciation_account_id
            )
        `)
        .eq('is_active', true)
        .gt('net_book_value', 0); // Only depreciate if value remains

    if (!assets || assets.length === 0) return { count: 0, journalId: null };

    // 2. Calculate Depreciation (Straight Line / Monthly)
    // Assumption: Run monthly.
    // Dep = (Cost - Salvage) / (LifeYears * 12)

    const lines: JournalEntryLine[] = [];
    const updates: any[] = []; // To update asset record

    for (const asset of assets) {
        if (!asset.category?.accumulated_depreciation_account_id || !asset.category?.depreciation_account_id) {
            continue; // Skip if accounts not linked
        }

        const cost = asset.cost;
        const salvage = asset.salvage_value || 0;
        const lifeMonths = (asset.useful_life_years || 5) * 12; // Default 5 years

        let monthlyDep = (cost - salvage) / lifeMonths;

        // Ensure we don't depreciate more than Net Book Value
        if (monthlyDep > asset.net_book_value) {
            monthlyDep = asset.net_book_value;
        }

        if (monthlyDep <= 0) continue;

        // Add to Lines
        // Dr. Dep Expense
        lines.push({
            accountId: asset.category.depreciation_account_id,
            description: `إهلاك - ${asset.name_ar}`,
            debit: monthlyDep,
            credit: 0
        });

        // Cr. Accumulated Dep
        lines.push({
            accountId: asset.category.accumulated_depreciation_account_id,
            description: `مجمع إهلاك - ${asset.name_ar}`,
            debit: 0,
            credit: monthlyDep
        });

        // Prepare Update
        // Note: multiple updates in loop is slow, but acceptable for MVP
        await supabaseAdmin
            .from('fixed_assets')
            .update({
                accumulated_depreciation: asset.accumulated_depreciation + monthlyDep,
                net_book_value: asset.net_book_value - monthlyDep
            })
            .eq('id', asset.id);
    }

    if (lines.length === 0) return { count: 0, journalId: null };

    // 3. Create Journal Entry
    // We should aggregate lines by account to reduce journal size? 
    // Usually detailed is better for tracking, but aggregate is cleaner.
    // Let's keep detailed for now.

    const { id: journalId } = await createJournalEntry({
        date: date,
        description: `قيد إهلاك دوري - ${note || date}`,
        referenceType: 'depreciation',
        lines: lines
    });

    return { count: assets.length, journalId };
}
