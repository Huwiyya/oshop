require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentAssets() {
    try {
        console.log('📊 Checking recent assets in database...\n');

        const { data: assets, error } = await supabase
            .from('fixed_assets_v2')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Error:', error);
            return;
        }

        console.log(`Found ${assets.length} total assets:\n`);
        assets.forEach((asset, i) => {
            console.log(`${i + 1}. ${asset.name_ar || asset.name_en}`);
            console.log(`   Number: ${asset.asset_number}`);
            console.log(`   Cost: ${asset.cost}`);
            console.log(`   Created: ${asset.created_at}`);
            console.log(`   Status: ${asset.status}`);
            console.log('');
        });

        // Check for our "Final Test Asset"
        const testAsset = assets.find(a => a.name_ar?.includes('Final') || a.name_en?.includes('Final'));
        if (testAsset) {
            console.log('✅ Test asset WAS saved to database!');
            console.log('This means the issue is with the UI refresh/query logic');
        } else {
            console.log('❌ Test asset was NOT saved to database');
            console.log('This means the server action is failing silently');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkRecentAssets();
