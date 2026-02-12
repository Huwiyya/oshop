require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getFixedAssetsSchema() {
    try {
        console.log('📊 Fetching fixed_assets_v2 schema from Supabase...\n');

        // Get table columns
        const { data: columns, error: colError } = await supabase
            .from('fixed_assets_v2')
            .select('*')
            .limit(0);

        if (colError) {
            console.error('Error fetching schema:', colError);
            return;
        }

        // Get one sample record to see structure
        const { data: sample, error: sampleError } = await supabase
            .from('fixed_assets_v2')
            .select('*')
            .limit(1);

        console.log('✅ Schema structure:');
        if (sample && sample.length > 0) {
            const record = sample[0];
            Object.keys(record).forEach(key => {
                const value = record[key];
                const type = typeof value;
                console.log(`  - ${key}: ${type} = ${value}`);
            });
        }

        // Test creating a new asset
        console.log('\n🧪 Testing asset creation...');
        const testAsset = {
            asset_number: 'TEST-SCHEMA-001',
            name_ar: 'اختبار السكيما',
            name_en: 'Schema Test',
            asset_category: '121',
            acquisition_date: '2026-02-11',
            cost: 1000,
            useful_life_years: 5,
            salvage_value: 100,
            status: 'active'
        };

        const { data: created, error: createError } = await supabase
            .from('fixed_assets_v2')
            .insert(testAsset)
            .select();

        if (createError) {
            console.error('❌ Insert Error:', createError);
            console.log('\nMissing required fields or schema mismatch detected!');
        } else {
            console.log('✅ Test insert successful:', created);

            // Clean up
            await supabase
                .from('fixed_assets_v2')
                .delete()
                .eq('asset_number', 'TEST-SCHEMA-001');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

getFixedAssetsSchema();
