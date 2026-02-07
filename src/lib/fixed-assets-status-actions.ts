'use server';

import { supabaseAdmin } from './supabase-admin';

/**
 * Update asset status (active, inactive, disposed, under_maintenance)
 */
export async function updateAssetStatus(assetId: string, newStatus: 'active' | 'inactive' | 'disposed' | 'under_maintenance') {
    try {
        const { error } = await supabaseAdmin
            .from('fixed_assets')
            .update({
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', assetId);

        if (error) throw error;

        return { success: true };
    } catch (error: any) {
        console.error('Error updating asset status:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mark asset as inactive (end of productive life)
 */
export async function markAssetInactive(assetId: string) {
    return updateAssetStatus(assetId, 'inactive');
}

/**
 * Reactivate an inactive asset
 */
export async function reactivateAsset(assetId: string) {
    return updateAssetStatus(assetId, 'active');
}
