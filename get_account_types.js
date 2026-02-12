require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getAccountTypes() {
    try {
        console.log('📊 Fetching account_types_v2 table...\n');

        const { data: types, error } = await supabase
            .from('account_types_v2')
            .select('*');

        if (error) {
            console.error('Error:', error);
            return;
        }

        console.log('Available Account Types:');
        types.forEach(type => {
            console.log(`  - ID: ${type.id}`);
            console.log(`    Code: ${type.code}`);
            console.log(`    Name AR: ${type.name_ar}`);
            console.log(`    Name EN: ${type.name_en || 'N/A'}`);
            console.log(`    Root Type: ${type.root_type}`);
            console.log('');
        });

        // Find asset type
        const assetType = types.find(t => t.root_type === 'asset' || t.code === '1' || t.name_ar.includes('أصول'));
        if (assetType) {
            console.log('✅ Asset Type Found:');
            console.log(`   UUID to use: ${assetType.id}`);
            console.log(`   Code: ${assetType.code}`);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

getAccountTypes();
