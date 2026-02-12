'use server';

import { supabaseAdmin } from './supabase-admin';
import { revalidatePath } from 'next/cache';

// --- Types ---

export interface FixedAssetV2 {
    id: string;
    asset_number: string;
    name_ar: string;
    name_en: string;
    asset_category: string;
    asset_subcategory?: string;
    description?: string;
    acquisition_date: string;
    cost: number;
    useful_life_years: number;
    salvage_value: number; // DB: salvage_value
    accumulated_depreciation: number;
    book_value: number;

    // Accounts
    asset_account_id: string;
    accumulated_depreciation_account_id: string;
    depreciation_expense_account_id: string;

    // Operational
    status: string;
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
    asset_category: string; // Now open string for custom categories
    asset_subcategory?: string;
    description?: string;
    acquisition_date: string;
    cost: number; // mapped to cost
    useful_life_years: number;
    salvage_value?: number;

    // Accounts
    asset_account_id?: string; // Optioanl if we create it
    payment_account_id?: string; // For Journal Entry

    // Operational
    location?: string;
    responsible_person?: string;
    serial_number?: string;
    warranty_expiry?: string;
    status?: string;
}

// --- Category Management ---

export async function getAssetCategories() {
    // Fetch Level 2 Accounts under Fixed Assets (12)
    // Actually, traditionally Fixed Assets uses 121 (Tangible), 122 (Intangible)
    // We want to fetch all children of 121 and 122 that are "Parent" accounts or just use them as categories.
    // Let's assume user wants to add "Trucks" under 121.

    const { data, error } = await supabaseAdmin
        .from('accounts_v2')
        .select('id, name_ar, code, parent_id')
        .or('code.like.121%,code.like.122%')
        .eq('is_parent', false) // Only fetch leaf accounts that we can use as Asset Groups? 
    // actually, we usually create a GROUP for the category ("Vehicles") and then individual assets are sub-accounts.
    // BUT here, the user wants "Classification".
    // Let's return all accounts under 12 that act as "Asset Types".
    // For simplicity, let's just fetch existing categories used in the assets table + some defaults.

    // Better approach: Use accounts.
    // Fetch accounts under 121 (Tangible Assets) and 122 (Intangible)
    const { data: accounts } = await supabaseAdmin
        .from('accounts_v2')
        .select('id, name_ar, code, is_parent')
        .or('code.ilike.121%,code.ilike.122%')
        .eq('is_parent', true) // Categories should be parents to individual assets? 
        // Or maybe the category IS the account and we add sub-accounts?
        // Let's stick to the pattern: Category = GL Account (e.g. 12104 Vehicles).
        // Individual Asset = Fixed Asset Register Item (linked to 12104).
        .order('code');

    return accounts || [];
}

export async function createAssetCategory(nameAr: string, nameEn: string, parentCode: string = '121') {
    // 1. Find Parent Account (e.g. 121 Tangible Assets)
    const { data: parent } = await supabaseAdmin
        .from('accounts_v2')
        .select('id, code, level')
        .eq('code', parentCode)
        .single();

    if (!parent) throw new Error('Parent account not found');

    // 2. Generate Next Code with Conflict Check
    let nextCode;
    let seq = 1;

    // Find the highest existing code under this parent to start search
    const { data: lastChild } = await supabaseAdmin
        .from('accounts_v2')
        .select('code')
        .eq('parent_id', parent.id)
        .order('code', { ascending: false })
        .limit(1)
        .single();

    if (lastChild) {
        // Try to parse the last sequence
        const numericPart = lastChild.code.replace(parent.code, '');
        const lastSeq = parseInt(numericPart);
        if (!isNaN(lastSeq)) {
            seq = lastSeq + 1;
        }
    }

    // Loop to find a truly available code
    let isUnique = false;
    while (!isUnique) {
        nextCode = `${parent.code}${seq.toString().padStart(2, '0')}`;

        // Check if code exists globally (ignoring parent)
        const { data: existing } = await supabaseAdmin
            .from('accounts_v2')
            .select('id')
            .eq('code', nextCode)
            .maybeSingle(); // Use maybeSingle to avoid 406 error if multiple found (though code is unique)

        if (!existing) {
            isUnique = true;
        } else {
            seq++;
        }

        // Safety break
        if (seq > 999) throw new Error('Could not generate unique category code');
    }

    try {
        const { data: newAccount, error } = await supabaseAdmin
            .from('accounts_v2')
            .insert({
                code: nextCode,
                name_ar: nameAr,
                name_en: nameEn || nameAr,
                parent_id: parent.id,
                level: (parent.level || 0) + 1,
                is_parent: true,
                type_id: '5fda3c74-d0ed-4614-a829-5b5454d2deb3', // Asset Type UUID
                root_type: 'asset',
                is_active: true
            })
            .select()
            .single();

        if (error) {
            console.error('Create Category DB Error:', error);
            throw error;
        }

        revalidatePath('/accounting/fixed-assets');

        // Ensure returning a plain object
        return JSON.parse(JSON.stringify(newAccount));
    } catch (err: any) {
        console.error('Create Category Action Error:', err);
        throw new Error(err.message);
    }
}

// --- CRUD Operations ---

export async function getFixedAssetsV2(category?: string, includeDisposed = false): Promise<FixedAssetV2[]> {
    let query = supabaseAdmin
        .from('fixed_assets_v2')
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
        return [];
    }

    // Explicit casting to match interface
    return (data || []).map((row: any) => ({
        ...row,
        cost: Number(row.cost),
        salvage_value: Number(row.salvage_value),
        accumulated_depreciation: Number(row.accumulated_depreciation),
        book_value: Number(row.cost) - Number(row.accumulated_depreciation) // Calculated
    }));
}

export async function createFixedAssetV2(assetData: CreateAssetDataV2) {
    try {
        console.log('Creating Asset:', assetData);

        // 1. Validate Payment Account
        let paymentAccountId = assetData.payment_account_id;
        if (!paymentAccountId) {
            const { data: payAcc } = await supabaseAdmin.from('accounts_v2').select('id').like('code', '111%').limit(1).single();
            if (payAcc) paymentAccountId = payAcc.id;
            else throw new Error('No payment account found');
        }

        // 2. Generate Asset Number (AST-YYYY-XXXX)
        const year = new Date().getFullYear();
        const { count } = await supabaseAdmin.from('fixed_assets_v2').select('*', { count: 'exact', head: true });
        const seq = (count || 0) + 1;
        const assetNumber = `AST-${year}-${seq.toString().padStart(4, '0')}`;

        // 3. Resolve or Create Accounts
        // asset_category is a TEXT field containing the account CODE (e.g. "121") not a UUID

        // Find Category Account (Parent) by CODE
        const { data: parentAcc } = await supabaseAdmin
            .from('accounts_v2')
            .select('id, code, level')
            .eq('code', assetData.asset_category)
            .single();

        if (!parentAcc) throw new Error(`Category account with code ${assetData.asset_category} not found`);

        // Get Asset Account Type UUID (required for type_id field)
        const { data: assetType } = await supabaseAdmin
            .from('account_types_v2')
            .select('id')
            .eq('name_ar', 'أصول')
            .single();

        if (!assetType) throw new Error('Asset account type not found');

        // Create specific account for this asset
        const assetAccountCode = `${parentAcc.code}-${Date.now().toString().slice(-6)}`;

        const { data: newAssetAccount, error: accError } = await supabaseAdmin.from('accounts_v2').insert({
            code: assetAccountCode,
            name_ar: `أصل: ${assetData.name_ar}`,
            name_en: `Asset: ${assetData.name_en || assetData.name_ar}`,
            parent_id: parentAcc.id,
            level: (parentAcc.level || 0) + 1,
            is_parent: false,
            type_id: assetType.id,
            root_type: 'asset',
            is_active: true
        }).select('id').single();

        if (accError) throw new Error('Failed to create asset account: ' + accError.message);


        // B. Accumulated Depreciation Account (Contra Asset)
        // Usually 123... or under the same parent?
        // Let's find "Accumulated Depreciation" parent. Often 129 or similar.
        // Simplified: Use a system default 'Accumulated Depreciation' account for all, or specific.
        // Let's Find specific system key or use a known code '123'
        const { data: accumParent } = await supabaseAdmin.from('accounts_v2').select('id').like('code', '123%').limit(1).single();
        const accumId = accumParent ? accumParent.id : newAssetAccount.id; // Fallback (dangerous)

        // C. Depreciation Expense Account
        // Usually 5... Expense
        const { data: expParent } = await supabaseAdmin.from('accounts_v2').select('id').like('code', '5%').limit(1).single();
        const expId = expParent ? expParent.id : newAssetAccount.id;


        // 4. Insert into fixed_assets_v2
        const payload = {
            asset_number: assetNumber,
            name_ar: assetData.name_ar,
            name_en: assetData.name_en || assetData.name_ar,
            asset_category: assetData.asset_category, // Keeping the parent ID or Name? Let's keep Name/Desc for display if needed, but we rely on accounts.
            // Actually 'asset_category' column in DB is text. Let's store the Name of the parent account.
            asset_subcategory: assetData.asset_subcategory,
            acquisition_date: assetData.acquisition_date,
            cost: assetData.cost,
            useful_life_years: assetData.useful_life_years,
            salvage_value: assetData.salvage_value || 0,

            asset_account_id: newAssetAccount.id,
            accumulated_depreciation_account_id: accumId,
            depreciation_expense_account_id: expId,

            status: 'active',
            location: assetData.location,
            responsible_person: assetData.responsible_person,
            serial_number: assetData.serial_number,
            warranty_expiry: assetData.warranty_expiry,
            description: assetData.description
        };

        const { data: newAsset, error: insertError } = await supabaseAdmin
            .from('fixed_assets_v2')
            .insert(payload)
            .select()
            .single();

        if (insertError) throw new Error('Failed to insert asset: ' + insertError.message);

        // 5. Create Acquisition Journal Entry
        // Debit Asset Account, Credit Payment Account
        const { error: rpcError } = await supabaseAdmin.rpc('create_journal_entry_rpc', {
            p_date: assetData.acquisition_date,
            p_description: `Purchase Asset: ${assetData.name_ar}`,
            p_reference_type: 'asset_acquisition',
            p_reference_id: newAsset.id,
            p_lines: [
                { account_id: newAssetAccount.id, debit: assetData.cost, credit: 0, description: 'Asset Cost' },
                { account_id: paymentAccountId, debit: 0, credit: assetData.cost, description: 'Payment' }
            ]
        });

        if (rpcError) throw new Error('Journal Error: ' + rpcError.message);

        revalidatePath('/accounting/fixed-assets');
        return { success: true, assetId: newAsset.id };

    } catch (error: any) {
        console.error('Create Asset Error:', error);
        return { success: false, error: error.message };
    }
}

export async function calculateMonthlyDepreciationV2(date: string) {
    try {
        console.log('Running Depreciation for date:', date);

        // 1. Fetch active assets
        const { data: assets, error } = await supabaseAdmin
            .from('fixed_assets_v2')
            .select('*')
            .eq('status', 'active');

        if (error) throw error;
        if (!assets || assets.length === 0) return { count: 0, success: true };

        let count = 0;

        for (const asset of assets) {
            // Simple Straight Line: (Cost - Salvage) / LifeYears / 12
            const cost = Number(asset.cost);
            const salvage = Number(asset.salvage_value);
            const lifeYears = Number(asset.useful_life_years);

            if (lifeYears <= 0) continue;

            // Monthly Depreciation
            const monthlyDepreciation = (cost - salvage) / (lifeYears * 12);

            if (monthlyDepreciation <= 0) continue;

            // Check if fully depreciated
            const currentAccumulated = Number(asset.accumulated_depreciation);
            if (currentAccumulated >= (cost - salvage)) continue;

            // Cap depreciation at remaining book value
            let amount = monthlyDepreciation;
            if (currentAccumulated + amount > (cost - salvage)) {
                amount = (cost - salvage) - currentAccumulated;
            }

            // Ensure strictly 2 decimals
            amount = Math.round(amount * 100) / 100;

            if (amount <= 0) continue;

            // Create Journal Entry
            // Debit Expense, Credit Accumulated Depreciation
            const { error: rpcError } = await supabaseAdmin.rpc('create_journal_entry_rpc', {
                p_date: date,
                p_description: `Depreciation: ${asset.name_ar} - ${date}`,
                p_reference_type: 'depreciation',
                p_reference_id: asset.id,
                p_lines: [
                    { account_id: asset.depreciation_expense_account_id, debit: amount, credit: 0, description: 'Depreciation Expense' },
                    { account_id: asset.accumulated_depreciation_account_id, debit: 0, credit: amount, description: 'Accumulated Depreciation' }
                ]
            });

            if (!rpcError) {
                // Update Asset Record
                await supabaseAdmin
                    .from('fixed_assets_v2')
                    .update({ accumulated_depreciation: currentAccumulated + amount })
                    .eq('id', asset.id);
                count++;
            } else {
                console.error('Depreciation Journal Error:', rpcError);
            }
        }

        revalidatePath('/accounting/fixed-assets');
        return { count, success: true };

    } catch (error: any) {
        console.error('Depreciation Error:', error);
        return { success: false, error: error.message };
    }
}

export async function updateFixedAsset(id: string, data: Partial<CreateAssetDataV2>) {
    try {
        const payload: any = {
            updated_at: new Date().toISOString()
        };
        if (data.name_ar) payload.name_ar = data.name_ar;
        if (data.name_en) payload.name_en = data.name_en;
        if (data.cost !== undefined) payload.cost = data.cost;
        if (data.useful_life_years !== undefined) payload.useful_life_years = data.useful_life_years;
        if (data.location) payload.location = data.location;
        if (data.serial_number) payload.serial_number = data.serial_number;
        if (data.responsible_person) payload.responsible_person = data.responsible_person;
        if (data.status) payload.status = data.status;

        const { error } = await supabaseAdmin
            .from('fixed_assets_v2')
            .update(payload)
            .eq('id', id);

        if (error) throw error;
        revalidatePath('/accounting/fixed-assets');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteFixedAsset(assetId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabaseAdmin
            .from('fixed_assets_v2')
            .update({ status: 'disposed' })
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// ============================================================================
// ENHANCED FUNCTIONS FOR REDESIGNED PAGE
// ============================================================================

/**
 * Asset Disposal with Gain/Loss Calculation
 */
export interface AssetDisposalData {
    assetId: string;
    disposalDate: string;
    disposalAmount: number;
    disposalMethod: 'sale' | 'scrap' | 'donation' | 'other';
    notes?: string;
    cashAccountId?: string;
}

export async function disposeAsset(data: AssetDisposalData) {
    try {
        // 1. Get asset details
        const { data: asset, error: assetError } = await supabaseAdmin
            .from('fixed_assets_v2')
            .select('*')
            .eq('id', data.assetId)
            .single();

        if (assetError || !asset) throw new Error('Asset not found');

        // 2. Calculate gain/loss
        const bookValue = Number(asset.cost) - Number(asset.accumulated_depreciation);
        const gainLoss = data.disposalAmount - bookValue;

        // 3. Find default cash account if not provided
        let cashAccountId = data.cashAccountId;
        if (!cashAccountId) {
            const { data: cashAcc } = await supabaseAdmin
                .from('accounts_v2')
                .select('id')
                .eq('code', '1110')
                .single();
            cashAccountId = cashAcc?.id;
        }

        // 4. Find Gain/Loss account
        let gainLossAccountId: string;
        const { data: glAcc } = await supabaseAdmin
            .from('accounts_v2')
            .select('id')
            .like('code', '53%')
            .limit(1)
            .single();

        if (glAcc) {
            gainLossAccountId = glAcc.id;
        } else {
            const { data: newGlAcc } = await supabaseAdmin
                .from('accounts_v2')
                .insert({
                    code: '5399',
                    name_ar: 'مكاسب/خسائر التخلص من الأصول',
                    name_en: 'Gain/Loss on Asset Disposal',
                    is_active: true,
                    level: 2
                })
                .select('id')
                .single();
            gainLossAccountId = newGlAcc!.id;
        }

        // 5. Create disposal journal entry
        const journalLines = [
            // Debit: Accumulated Depreciation
            {
                account_id: asset.accumulated_depreciation_account_id,
                debit: asset.accumulated_depreciation,
                credit: 0,
                description: 'Accumulated Depreciation Removal'
            },
        ];

        // Add cash if applicable
        if (cashAccountId && data.disposalAmount > 0) {
            journalLines.push({
                account_id: cashAccountId,
                debit: data.disposalAmount,
                credit: 0,
                description: `Proceeds from ${data.disposalMethod}`
            });
        }

        // Gain or Loss
        if (gainLoss > 0) {
            journalLines.push({
                account_id: gainLossAccountId,
                debit: 0,
                credit: gainLoss,
                description: 'Gain on Disposal'
            });
        } else if (gainLoss < 0) {
            journalLines.push({
                account_id: gainLossAccountId,
                debit: Math.abs(gainLoss),
                credit: 0,
                description: 'Loss on Disposal'
            });
        }

        // Credit: Asset Account
        journalLines.push({
            account_id: asset.asset_account_id,
            debit: 0,
            credit: asset.cost,
            description: 'Asset Cost Removal'
        });

        const { error: rpcError } = await supabaseAdmin.rpc('create_journal_entry_rpc', {
            p_date: data.disposalDate,
            p_description: `Asset Disposal: ${asset.name_ar}`,
            p_reference_type: 'asset_disposal',
            p_reference_id: data.assetId,
            p_lines: journalLines
        });

        if (rpcError) throw new Error('Journal Error: ' + rpcError.message);

        // 6. Update asset status
        await supabaseAdmin
            .from('fixed_assets_v2')
            .update({ status: 'disposed' })
            .eq('id', data.assetId);

        revalidatePath('/accounting/fixed-assets');
        return { success: true, gainLoss, bookValue };

    } catch (error: any) {
        console.error('Dispose Asset Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get Asset History
 */
export async function getAssetHistory(assetId: string) {
    try {
        const { data, error } = await supabaseAdmin
            .from('journal_entries_v2')
            .select(`
                id,
                entry_number,
                date,
                description,
                total_debit,
                total_credit,
                created_at
            `)
            .eq('source_id', assetId)
            .order('date', { ascending: false });

        if (error) throw error;
        return data || [];

    } catch (error: any) {
        console.error('Get Asset History Error:', error);
        return [];
    }
}

/**
 * Get Depreciation Schedule
 */
export interface DepreciationScheduleEntry {
    period: number;
    date: string;
    depreciationAmount: number;
    accumulatedDepreciation: number;
    bookValue: number;
}

export async function getDepreciationSchedule(assetId: string): Promise<DepreciationScheduleEntry[]> {
    try {
        const { data: asset, error } = await supabaseAdmin
            .from('fixed_assets_v2')
            .select('*')
            .eq('id', assetId)
            .single();

        if (error || !asset) return [];

        const cost = Number(asset.cost);
        const salvage = Number(asset.salvage_value || 0);
        const lifeYears = Number(asset.useful_life_years);
        const acquisitionDate = new Date(asset.acquisition_date);
        const depreciableAmount = cost - salvage;
        const monthlyDepreciation = depreciableAmount / (lifeYears * 12);

        const schedule: DepreciationScheduleEntry[] = [];
        let accumulated = 0;

        for (let month = 1; month <= lifeYears * 12; month++) {
            accumulated += monthlyDepreciation;
            const periodDate = new Date(acquisitionDate);
            periodDate.setMonth(periodDate.getMonth() + month);

            schedule.push({
                period: month,
                date: periodDate.toISOString().split('T')[0],
                depreciationAmount: monthlyDepreciation,
                accumulatedDepreciation: accumulated,
                bookValue: cost - accumulated
            });
        }

        return schedule;

    } catch (error: any) {
        console.error('Get Depreciation Schedule Error:', error);
        return [];
    }
}

/**
 * Get asset by ID
 */
export async function getAssetById(id: string): Promise<FixedAssetV2 | null> {
    try {
        const { data, error } = await supabaseAdmin
            .from('fixed_assets_v2')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) return null;

        return {
            ...data,
            cost: Number(data.cost),
            salvage_value: Number(data.salvage_value),
            accumulated_depreciation: Number(data.accumulated_depreciation),
            book_value: Number(data.cost) - Number(data.accumulated_depreciation)
        };

    } catch (error: any) {
        console.error('Get Asset By ID Error:', error);
        return null;
    }
}
