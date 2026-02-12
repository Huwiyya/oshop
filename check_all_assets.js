const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pipupdimlbjiivftgbop.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcHVwZGltbGJqaWl2ZnRnYm9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDczMzMzMCwiZXhwIjoyMDg2MzA5MzMwfQ.3YWHGgmV5old4xJpnrUdqruz5C6wYPDDf5PlLywfmsQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllAssets() {
    try {
        console.log('Checking ALL assets in fixed_assets_v2...');

        const { data, error } = await supabase
            .from('fixed_assets_v2')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) { console.error(error); return; }

        console.log(`\nFound ${data?.length || 0} assets:`);
        data?.forEach(asset => {
            console.log(`\n${asset.asset_number} | ${asset.name_ar || asset.name_en}`);
            console.log(`  Cost: ${asset.cost}, Status: ${asset.status}`);
            console.log(`  Category: ${asset.asset_category}`);
            console.log(`  Created: ${asset.created_at}`);
        });

    } catch (e) {
        console.error(e);
    }
}

checkAllAssets();
