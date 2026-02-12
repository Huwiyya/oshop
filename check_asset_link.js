
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pipupdimlbjiivftgbop.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcHVwZGltbGJqaWl2ZnRnYm9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDczMzMzMCwiZXhwIjoyMDg2MzA5MzMwfQ.3YWHGgmV5old4xJpnrUdqruz5C6wYPDDf5PlLywfmsQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLinkage() {
    try {
        console.log('Checking asset <-> account linkage...');

        // Fetch asset with all account IDs
        const { data: assets, error } = await supabase
            .from('fixed_assets_v2')
            .select('id, name_ar, asset_account_id, accumulated_depreciation_account_id, depreciation_expense_account_id, cost');

        if (error) { console.error(error); return; }

        for (const asset of assets) {
            console.log(`Asset: ${asset.name_ar} (${asset.id})`);
            console.log(`  - Asset Account: ${asset.asset_account_id}`);
            console.log(`  - Accumulated Depr Account: ${asset.accumulated_depreciation_account_id}`);
            console.log(`  - Expense Account: ${asset.depreciation_expense_account_id}`);

            // Check existence
            const ids = [asset.asset_account_id, asset.accumulated_depreciation_account_id, asset.depreciation_expense_account_id].filter(Boolean);

            const { data: accounts, error: accError } = await supabase
                .from('accounts_v2')
                .select('id, code, name_ar')
                .in('id', ids);

            if (accError) console.error(accError);
            else {
                console.log(`  ✅ Found ${accounts.length} linked accounts:`);
                accounts.forEach(a => console.log(`     - ${a.code}: ${a.name_ar}`));
            }
        }

    } catch (e) {
        console.error(e);
    }
}

checkLinkage();
