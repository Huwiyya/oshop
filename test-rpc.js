const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Supabase Admin Client...');
console.log('URL:', supabaseUrl);
console.log('Key Length:', supabaseKey ? supabaseKey.length : 0);

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing environment variables!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function testRpc() {
    try {
        console.log('Attempting to call create_journal_entry_rpc...');

        // Dummy data - assuming account ID exists (will fetch first)
        const { data: accounts, error: accError } = await supabase.from('accounts').select('id').limit(1);
        if (accError) throw accError;
        if (!accounts || accounts.length === 0) throw new Error('No accounts found');

        const accountId = accounts[0].id;
        console.log('Using Account ID:', accountId);

        const { data, error } = await supabase.rpc('create_journal_entry_rpc', {
            p_entry_date: new Date().toISOString().split('T')[0],
            p_description: 'NODE_SCRIPT_TEST',
            p_reference_type: 'manual',
            p_reference_id: null,
            p_lines: [
                { accountId: accountId, description: 'Test Debit', debit: 100, credit: 0 },
                { accountId: accountId, description: 'Test Credit', debit: 0, credit: 100 }
            ]
        });

        if (error) {
            console.error('❌ RPC Failed:', error);
        } else {
            console.log('✅ RPC Success! Entry ID:', data);
        }

    } catch (err) {
        console.error('❌ detailed error:', err);
    }
}

testRpc();
