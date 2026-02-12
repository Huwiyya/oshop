require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testActualCreate() {
    try {
        console.log('🧪 Testing actual asset creation like the UI does...\n');

        const assetData = {
            name_ar: 'اختبار حقيقي',
            name_en: 'Real Test',
            asset_category: '121',
            acquisition_date: '2026-02-11',
            cost: 3000,
            useful_life_years: 5,
            salvage_value: 0,
            location: '',
            responsible_person: '',
            serial_number: '',
            warranty_expiry: null,
            description: '',
            payment_account_id: null
        };

        // Try to mimic the createFixedAssetV2 function

        // 1. Get payment account
        const { data: payAcc } = await supabase.from('accounts_v2').select('id').like('code', '111%').limit(1).single();
        console.log('Payment Account:', payAcc);

        // 2. Generate asset number
        const year = new Date().getFullYear();
        const { count } = await supabase.from('fixed_assets_v2').select('*', { count: 'exact', head: true });
        const seq = (count || 0) + 1;
        const assetNumber = `AST-${year}-${seq.toString().padStart(4, '0')}`;
        console.log('Asset Number:', assetNumber);

        // 3. Create asset account
        const { data: parentAcc } = await supabase.from('accounts_v2').select('id, level').eq('code', assetData.asset_category).single();
        console.log('Parent Account:', parentAcc);

        if (!parentAcc) {
            console.error('❌ PROBLEM: Parent account for category not found!');
            return;
        }

        const assetAccountCode = `${assetData.asset_category}-${Date.now().toString().slice(-6)}`;
        const { data: newAssetAccount, error: accError } = await supabase.from('accounts_v2').insert({
            code: assetAccountCode,
            name_ar: `أصل: ${assetData.name_ar}`,
            name_en: `Asset: ${assetData.name_en || assetData.name_ar}`,
            parent_id: parentAcc.id,
            level: (parentAcc.level || 0) + 1,
            is_parent: false,
            root_type: 'asset',
            is_active: true
            // type_id removed - was causing UUID error
        }).select('id').single();

        if (accError) {
            console.error('❌ Asset account creation error:', accError);
            return;
        }

        console.log('✅ Asset Account Created:', newAssetAccount);

        // 4. Get other accounts
        const { data: accumParent } = await supabase.from('accounts_v2').select('id').like('code', '123%').limit(1).single();
        const accumId = accumParent ? accumParent.id : newAssetAccount.id;

        const { data: expParent } = await supabase.from('accounts_v2').select('id').like('code', '5%').limit(1).single();
        const expId = expParent ? expParent.id : newAssetAccount.id;

        console.log('Accum ID:', accumId);
        console.log('Exp ID:', expId);

        // 5. Insert asset
        const payload = {
            asset_number: assetNumber,
            name_ar: assetData.name_ar,
            name_en: assetData.name_en || assetData.name_ar,
            asset_category: assetData.asset_category,
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

        console.log('\n📝 Payload to insert:', JSON.stringify(payload, null, 2));

        const { data: newAsset, error: insertError } = await supabase
            .from('fixed_assets_v2')
            .insert(payload)
            .select()
            .single();

        if (insertError) {
            console.error('❌❌ INSERT ERROR:', insertError);
            return;
        }

        console.log('\n✅✅ Asset created successfully:', newAsset);

        // 6. Try RPC
        const { error: rpcError } = await supabase.rpc('create_journal_entry_rpc', {
            p_date: assetData.acquisition_date,
            p_description: `Purchase Asset: ${assetData.name_ar}`,
            p_reference_type: 'asset_acquisition',
            p_reference_id: newAsset.id,
            p_lines: [
                { account_id: newAssetAccount.id, debit: assetData.cost, credit: 0, description: 'Asset Cost' },
                { account_id: payAcc.id, debit: 0, credit: assetData.cost, description: 'Payment' }
            ]
        });

        if (rpcError) {
            console.error('❌ RPC ERROR:', rpcError);
            console.log('⚠️ Asset was created but journal entry failed!');
        } else {
            console.log('✅ Journal entry created successfully');
        }

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

testActualCreate();
