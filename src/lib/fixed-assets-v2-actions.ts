'use server';

import { supabaseAdmin as supabase } from './supabase-admin';
import { revalidatePath } from 'next/cache';

export interface FixedAssetV2 {
    id: string;
    asset_number: string;
    name_ar: string;
    name_en: string;
    acquisition_date: string;
    cost: number;
    salvage_value: number;
    useful_life_years: number;
    accumulated_depreciation: number;
    book_value: number;
    status: 'active' | 'disposed' | 'fully_depreciated';
    created_at: string;

    // Relations
    asset_account?: { name_ar: string; name_en: string };
    accumulated_depreciation_account?: { name_ar: string; name_en: string };
    depreciation_expense_account?: { name_ar: string; name_en: string };
}

// =============================================================================
// FIXED ASSETS ACTIONS
// =============================================================================

export async function getFixedAssetsV2() {
    const { data, error } = await supabase
        .from('fixed_assets_v2')
        .select(`
            *,
            asset_account:asset_account_id (name_ar, name_en),
            accumulated_depreciation_account:accumulated_depreciation_account_id (name_ar, name_en),
            depreciation_expense_account:depreciation_expense_account_id (name_ar, name_en)
        `)
        .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as FixedAssetV2[] };
}

export async function createFixedAssetV2(input: {
    name_ar: string;
    name_en: string;
    acquisition_date: string;
    cost: number;
    salvage_value: number;
    useful_life_years: number;
    asset_account_id: string;
    accumulated_depreciation_account_id: string;
    depreciation_expense_account_id: string;
}) {
    const assetNumber = `AST-${Date.now().toString().slice(-6)}`;

    const { data, error } = await supabase
        .from('fixed_assets_v2')
        .insert({
            asset_number: assetNumber,
            name_ar: input.name_ar,
            name_en: input.name_en,
            acquisition_date: input.acquisition_date,
            cost: input.cost,
            salvage_value: input.salvage_value,
            useful_life_years: input.useful_life_years,
            asset_account_id: input.asset_account_id,
            accumulated_depreciation_account_id: input.accumulated_depreciation_account_id,
            depreciation_expense_account_id: input.depreciation_expense_account_id,
            status: 'active'
        })
        .select()
        .single();

    if (error) return { success: false, error: error.message };

    revalidatePath('/accounting/assets-v2');
    return { success: true, data };
}

export async function runDepreciationV2(assetId: string, amount: number, date: string) {
    // Manually trigger a depreciation entry
    const { data, error } = await supabase
        .from('depreciation_entries_v2')
        .insert({
            asset_id: assetId,
            date: date,
            amount: amount,
            description: `Manual Depreciation Run`,
            status: 'posted' // Auto-trigger journal
        })
        .select()
        .single();

    if (error) return { success: false, error: error.message };

    revalidatePath('/accounting/assets-v2');
    revalidatePath('/accounting/journal-v2');
    return { success: true, data };
}
