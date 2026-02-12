
const { createClient } = require('@supabase/supabase-js');

// Hardcoding for this script
const supabaseUrl = 'https://pipupdimlbjiivftgbop.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcHVwZGltbGJqaWl2ZnRnYm9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDczMzMzMCwiZXhwIjoyMDg2MzA5MzMwfQ.3YWHGgmV5old4xJpnrUdqruz5C6wYPDDf5PlLywfmsQ';

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        console.log('--- Testing Create Fixed Asset V2 Logic ---');

        const assetData = {
            name_ar: "Test Asset Script",
            asset_category: "121", // Assuming this is valid based on previous work
            cost: 10000,
            useful_life_years: 5,
            acquisition_date: new Date().toISOString().split('T')[0]
        };

        // 1. Validate Payment Account
        let paymentAccountId;
        const { data: payAcc } = await supabaseAdmin.from('accounts_v2').select('id').like('code', '111%').limit(1).single();
        if (payAcc) paymentAccountId = payAcc.id;
        else throw new Error('No payment account found');
        console.log('Payment Account:', paymentAccountId);

        // 2. Generate Asset Number
        const year = new Date().getFullYear();
        const { count } = await supabaseAdmin.from('fixed_assets_v2').select('*', { count: 'exact', head: true });
        const seq = (count || 0) + 1;
        const assetNumber = `AST-${year}-${seq.toString().padStart(4, '0')}`;
        console.log('Asset Number:', assetNumber);

        // 3. Resolve Asset Account
        // Find Category Account (Parent)
        // If asset_category is "121", find account with code "121"
        let assetParentAccountCode = assetData.asset_category;
        const { data: parentAcc } = await supabaseAdmin.from('accounts_v2').select('id, code, level').eq('code', assetParentAccountCode).single();

        if (!parentAcc) {
            // Maybe it's an ID
            const { data: parentAccById } = await supabaseAdmin.from('accounts_v2').select('id, code, level').eq('id', assetData.asset_category).single();
            if (!parentAccById) throw new Error('Invalid Asset Category Account: ' + assetData.asset_category);
            // Use found account
        }

        // For this test, let's assume we found parentAcc or throw
        if (!parentAcc) throw new Error("Parent Account 121 not found in DB");

        console.log('Parent Account:', parentAcc);

        // Create specific account for this asset
        const { data: lastChild } = await supabaseAdmin.from('accounts_v2').select('code').eq('parent_id', parentAcc.id).order('code', { ascending: false }).limit(1).single();
        const nextCode = lastChild ? (parseInt(lastChild.code) + 1).toString() : `${parentAcc.code}001`;

        const { data: newAssetAccount, error: accError } = await supabaseAdmin.from('accounts_v2').insert({
            code: nextCode,
            name_ar: `أصل: ${assetData.name_ar}`,
            name_en: `Asset: ${assetData.name_ar}`, // Fallback en
            parent_id: parentAcc.id,
            level: (parentAcc.level || 0) + 1,
            is_parent: false,
            type_id: 'd2c8d8f8-d4e5-4f6a-9b7c-8d9e0f1a2b3c', // WARNING: Hardcoded Type ID might be wrong. Let's fetch it.
            // actually we should fetch type_id from parent or account_types table
            root_type: 'asset',
            is_active: true
        }).select('id').single();

        // Wait, type_id constraint might fail if I don't provide a valid UUID.
        // Let's fetch correct type_id for 'Assets'
        const { data: assetType } = await supabaseAdmin.from('account_types_v2').select('id').eq('name_en', 'Assets').single();
        if (!assetType) throw new Error("Asset Type not found");

        // Retry insert with correct type_id
        const { data: newAssetAccountRetry, error: accErrorRetry } = await supabaseAdmin.from('accounts_v2').insert({
            code: nextCode,
            name_ar: `أصل: ${assetData.name_ar}`,
            name_en: `Asset: ${assetData.name_ar}`,
            parent_id: parentAcc.id,
            level: (parentAcc.level || 0) + 1,
            is_parent: false,
            type_id: assetType.id,
            root_type: 'asset',
            is_active: true
        }).select('id').single();

        if (accErrorRetry) throw new Error('Failed to create asset account: ' + accErrorRetry.message);
        console.log('New Asset Account:', newAssetAccountRetry.id);

        // 4. Insert into fixed_assets_v2
        // Get accum/expense accounts (simplified lookup)
        const { data: accumParent } = await supabaseAdmin.from('accounts_v2').select('id').like('code', '123%').limit(1).single();
        const accumId = accumParent ? accumParent.id : newAssetAccountRetry.id;

        const { data: expParent } = await supabaseAdmin.from('accounts_v2').select('id').like('code', '55%').limit(1).single(); // 55 is Depr Expense
        const expId = expParent ? expParent.id : newAssetAccountRetry.id;

        const payload = {
            asset_number: assetNumber,
            name_ar: assetData.name_ar,
            name_en: assetData.name_ar,
            asset_category: assetData.asset_category,
            acquisition_date: assetData.acquisition_date,
            cost: assetData.cost,
            useful_life_years: assetData.useful_life_years,
            salvage_value: 0,
            asset_account_id: newAssetAccountRetry.id,
            accumulated_depreciation_account_id: accumId,
            depreciation_expense_account_id: expId,
            status: 'active'
        };

        const { data: newAsset, error: insertError } = await supabaseAdmin
            .from('fixed_assets_v2')
            .insert(payload)
            .select()
            .single();

        if (insertError) throw new Error('Failed to insert asset: ' + insertError.message);
        console.log('Asset Created:', newAsset);

    } catch (error) {
        console.error("❌ Failed:", error);
    }
}

run();
