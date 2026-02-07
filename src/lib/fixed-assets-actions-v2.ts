'use server';

import { supabaseAdmin } from './supabase-admin';

// --- Types ---
export type AssetCategory = 'tangible' | 'intangible' | 'wip';
export type AssetStatus = 'active' | 'inactive' | 'disposed' | 'under_maintenance';
export type DepreciationMethod = 'straight_line' | 'declining_balance' | 'none';

export interface FixedAssetV2 {
    id: string;
    account_id: string;
    asset_code: string;
    name_ar: string;
    name_en?: string;
    asset_category: AssetCategory;
    asset_subcategory?: string;
    description?: string;
    acquisition_date: string;
    acquisition_cost: number;
    useful_life_years?: number;
    residual_value: number;
    depreciation_method: DepreciationMethod;
    accumulated_depreciation: number;
    status: AssetStatus;
    disposal_date?: string;
    disposal_amount?: number;
    disposal_notes?: string;
    location?: string;
    responsible_person?: string;
    serial_number?: string;
    warranty_expiry?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateAssetDataV2 {
    name_ar: string;
    name_en?: string;
    asset_category: AssetCategory;
    asset_subcategory?: string;
    description?: string;
    acquisition_date: string;
    acquisition_cost: number;
    useful_life_years?: number;
    residual_value?: number;
    depreciation_method?: DepreciationMethod;
    location?: string;
    responsible_person?: string;
    serial_number?: string;
    warranty_expiry?: string;
}

// --- CRUD Operations ---

export async function getFixedAssetsV2(category?: AssetCategory, includeDisposed = false): Promise<FixedAssetV2[]> {
    let query = supabaseAdmin
        .from('fixed_assets')
        .select('*')
        .order('created_at', { ascending: false });

    if (category) {
        query = query.eq('asset_category', category);
    }

    if (!includeDisposed) {
        query = query.neq('status', 'disposed');
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching fixed assets:', error);
        throw new Error(error.message);
    }

    return data || [];
}

export async function getFixedAssetV2ById(id: string): Promise<FixedAssetV2 | null> {
    const { data, error } = await supabaseAdmin
        .from('fixed_assets')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching fixed asset:', error);
        return null;
    }

    return data;
}

export async function createFixedAssetV2(assetData: CreateAssetDataV2) {
    try {
        const { data, error } = await supabaseAdmin.rpc('create_fixed_asset_rpc', {
            p_name_ar: assetData.name_ar,
            p_name_en: assetData.name_en || null,
            p_asset_category: assetData.asset_category,
            p_asset_subcategory: assetData.asset_subcategory || null,
            p_description: assetData.description || null,
            p_acquisition_date: assetData.acquisition_date,
            p_acquisition_cost: assetData.acquisition_cost,
            p_useful_life_years: assetData.useful_life_years || null,
            p_residual_value: assetData.residual_value || 0,
            p_depreciation_method: assetData.depreciation_method || 'straight_line',
            p_location: assetData.location || null,
            p_responsible_person: assetData.responsible_person || null,
            p_serial_number: assetData.serial_number || null,
            p_warranty_expiry: assetData.warranty_expiry || null
        });

        if (error) throw error;

        return { success: true, assetId: data };
    } catch (error: any) {
        console.error('Error creating fixed asset:', error);
        return { success: false, error: error.message };
    }
}

export async function updateFixedAssetV2(id: string, updates: Partial<CreateAssetDataV2>) {
    try {
        const { error } = await supabaseAdmin
            .from('fixed_assets')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        return { success: true };
    } catch (error: any) {
        console.error('Error updating fixed asset:', error);
        return { success: false, error: error.message };
    }
}

export async function disposeFixedAssetV2(
    assetId: string,
    disposalDate: string,
    disposalAmount: number,
    disposalNotes?: string
) {
    try {
        const { data, error } = await supabaseAdmin.rpc('dispose_fixed_asset_rpc', {
            p_asset_id: assetId,
            p_disposal_date: disposalDate,
            p_disposal_amount: disposalAmount,
            p_disposal_notes: disposalNotes || null
        });

        if (error) throw error;

        return { success: true, journalId: data };
    } catch (error: any) {
        console.error('Error disposing fixed asset:', error);
        return { success: false, error: error.message };
    }
}

// --- Depreciation ---

export async function calculateMonthlyDepreciationV2(periodDate?: string) {
    try {
        const { data, error } = await supabaseAdmin.rpc('calculate_monthly_depreciation', {
            p_period_date: periodDate || new Date().toISOString().split('T')[0]
        });

        if (error) throw error;

        return { success: true, count: data };
    } catch (error: any) {
        console.error('Error calculating depreciation:', error);
        return { success: false, error: error.message };
    }
}

export async function getAssetDepreciationLogV2(assetId: string) {
    const { data, error } = await supabaseAdmin
        .from('asset_depreciation_log')
        .select('*')
        .eq('asset_id', assetId)
        .order('period_date', { ascending: false });

    if (error) {
        console.error('Error fetching depreciation log:', error);
        return [];
    }

    return data || [];
}

// --- Statistics ---

export async function getAssetsSummaryV2() {
    const { data, error } = await supabaseAdmin
        .from('fixed_assets')
        .select('asset_category, acquisition_cost, accumulated_depreciation, status');

    if (error) {
        console.error('Error fetching assets summary:', error);
        return {
            totalCost: 0,
            totalDepreciation: 0,
            bookValue: 0,
            byCategory: {}
        };
    }

    const summary = {
        totalCost: 0,
        totalDepreciation: 0,
        bookValue: 0,
        byCategory: {} as Record<string, { count: number; cost: number; depreciation: number; bookValue: number }>
    };

    data?.forEach(asset => {
        if (asset.status !== 'disposed') {
            summary.totalCost += Number(asset.acquisition_cost);
            summary.totalDepreciation += Number(asset.accumulated_depreciation);

            if (!summary.byCategory[asset.asset_category]) {
                summary.byCategory[asset.asset_category] = { count: 0, cost: 0, depreciation: 0, bookValue: 0 };
            }

            summary.byCategory[asset.asset_category].count++;
            summary.byCategory[asset.asset_category].cost += Number(asset.acquisition_cost);
            summary.byCategory[asset.asset_category].depreciation += Number(asset.accumulated_depreciation);
        }
    });

    summary.bookValue = summary.totalCost - summary.totalDepreciation;

    Object.keys(summary.byCategory).forEach(cat => {
        summary.byCategory[cat].bookValue = summary.byCategory[cat].cost - summary.byCategory[cat].depreciation;
    });

    return summary;
}
