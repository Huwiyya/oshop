require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function testCreateAsset() {
    try {
        console.log('Testing asset creation...');

        // Get a category ID
        const { data: category } = await supabase
            .from('accounts_v2')
            .select('id, code, name_ar')
            .eq('code', '121')
            .single();

        console.log('Category:', category);

        if (!category) {
            console.error('Category 121 not found!');
            return;
        }

        // Prepare test data similar to UI
        const testAsset = {
            name_ar: 'سيارة اختبار',
            name_en: 'Test Car',
            asset_category: category.id, // THIS IS THE KEY!
            acquisition_date: '2026-02-11',
            cost: 50000,
            useful_life_years: 5,
            salvage_value: 5000
        };

        console.log('\nInserting asset with data:', testAsset);

        // Try direct insertion first
        const { data, error } = await supabase
            .from('fixed_assets_v2')
            .insert({
                asset_number: 'TEST-001',
                name_ar: testAsset.name_ar,
                name_en: testAsset.name_en,
                asset_category: testAsset.asset_category,
                acquisition_date: testAsset.acquisition_date,
                cost: testAsset.cost,
                useful_life_years: testAsset.useful_life_years,
                salvage_value: testAsset.salvage_value,
                status: 'active',
                asset_account_id: category.id, // temporary
                accumulated_depreciation_account_id: category.id, // temporary
                depreciation_expense_account_id: category.id // temporary
            })
            .select();

        if (error) {
            console.error('❌ Insert Error:', error);
        } else {
            console.log('✅ Insert Success:', data);
        }

    } catch (e) {
        console.error('❌ Error:', e);
    }
}

testCreateAsset();
