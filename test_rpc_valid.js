require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function testFullCycle() {
    try {
        console.log('Testing RPC with valid UUID...');

        const testAssetId = '89a4adf5-878f-41e9-9da4-77b82959a92f'; // Existing asset

        const { data, error } = await supabase.rpc('create_journal_entry_rpc', {
            p_date: '2026-02-11',
            p_description: 'Test Fixed Asset Purchase',
            p_reference_type: 'asset_acquisition',
            p_reference_id: testAssetId,
            p_lines: [
                { account_id: '75eb7a2b-5f70-4394-97c4-edc8bd856c13', debit: 10000, credit: 0, description: 'Asset Cost' },
                { account_id: '33cc0e1e-d84b-416b-8062-2f6d494effb3', debit: 0, credit: 10000, description: 'Payment' }
            ]
        });

        if (error) {
            console.error('❌ RPC Error:', error);
        } else {
            console.log('✅ RPC Success! Journal ID:', data);

            // Check account balances
            const { data: accounts } = await supabase
                .from('accounts_v2')
                .select('code, name_ar, current_balance')
                .in('id', ['75eb7a2b-5f70-4394-97c4-edc8bd856c13', '33cc0e1e-d84b-416b-8062-2f6d494effb3']);

            console.log('\\n✅ Updated Account Balances:');
            accounts?.forEach(a => console.log(`  ${a.code}: ${a.current_balance} - ${a.name_ar}`));
        }

    } catch (e) {
        console.error('❌ Error:', e);
    }
}

testFullCycle();
