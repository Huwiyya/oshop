
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyManualJournal() {
    console.log('Verifying Manual Journal Entry Creation...');

    // 1. Get Accounts
    const { data: acct1 } = await supabase.from('accounts').select('id, account_code').limit(1).single();
    if (!acct1) {
        console.error('No accounts found.');
        return;
    }
    // Get another account
    const { data: acct2 } = await supabase.from('accounts').select('id, account_code').neq('id', acct1.id).limit(1).single();

    if (!acct2) {
        console.error('Need at least 2 accounts.');
        return;
    }

    console.log(`Using Accounts: ${acct1.account_code} and ${acct2.account_code}`);

    // 2. Prepare Payload
    const entryDate = new Date().toISOString().split('T')[0];
    const lines = [
        {
            accountId: acct1.id,
            debit: 100,
            credit: 0,
            description: 'Test Manual Debit'
        },
        {
            accountId: acct2.id,
            debit: 0,
            credit: 100,
            description: 'Test Manual Credit'
        }
    ];

    // 3. Call RPC
    console.log('Calling create_complete_journal_rpc...');
    const { data: entryId, error } = await supabase.rpc('create_complete_journal_rpc', {
        p_entry_date: entryDate,
        p_description: 'Verification of Manual Journal Fix',
        p_reference_type: 'manual',
        p_reference_id: null,
        p_lines: lines
    });

    if (error) {
        console.error('RPC Error:', error.message);
        console.error('Details:', error.details, error.hint);
        return;
    }

    console.log('Journal Entry Created! ID:', entryId);

    // 4. Verify Entry Number
    const { data: entry } = await supabase.from('journal_entries').select('entry_number, total_debit').eq('id', entryId).single();
    if (entry) {
        console.log('Verified Entry:', entry);
        if (entry.entry_number && entry.entry_number.startsWith('JE-')) {
            console.log('SUCCESS: Entry Number Generated Correctly.');
        } else {
            console.error('FAILURE: Entry Number format incorrect:', entry.entry_number);
        }

        // Cleanup
        console.log('Cleaning up...');
        await supabase.from('journal_entries').delete().eq('id', entryId);
    } else {
        console.error('Could not fetch created entry.');
    }
}

verifyManualJournal();
