require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function testAssetCreation() {
    try {
        console.log('Testing create_journal_entry_rpc...');

        // Test with simple data
        const { data, error } = await supabase.rpc('create_journal_entry_rpc', {
            p_date: '2026-02-11',
            p_description: 'Test Journal Entry',
            p_reference_type: 'test',
            p_reference_id: 'test-id-123',
            p_lines: [
                { account_id: '75eb7a2b-5f70-4394-97c4-edc8bd856c13', debit: 100, credit: 0, description: 'Test Debit' },
                { account_id: '33cc0e1e-d84b-416b-8062-2f6d494effb3', debit: 0, credit: 100, description: 'Test Credit' }
            ]
        });

        if (error) {
            console.error('RPC Error:', error);
        } else {
            console.log('✅ RPC Success! Journal ID:', data);

            // Check if lines were created
            const { data: lines } = await supabase
                .from('journal_lines_v2')
                .select('*')
                .eq('entry_id', data);

            console.log('Created lines:', lines?.length);
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

testAssetCreation();
