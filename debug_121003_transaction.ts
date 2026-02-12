
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTransaction() {
    console.log('Debugging Transaction for 121003...');

    // 1. Get Account ID
    const { data: acc } = await supabase.from('accounts_v2').select('id').eq('code', '121003').single();
    if (!acc) { console.error('Account not found'); return; }

    // 2. Get Journal Lines
    const { data: lines } = await supabase
        .from('journal_lines_v2')
        .select('journal_id, debit, credit')
        .eq('account_id', acc.id);

    console.log('Lines for 121003:', lines);

    if (lines && lines.length > 0) {
        const journalId = lines[0].journal_id;

        // 3. Get Full Journal Entry
        console.log(`Checking Journal: ${journalId}`);
        const { data: fullEntry } = await supabase
            .from('journal_lines_v2')
            .select('*, account:account_id(code, name_ar, is_active)')
            .eq('journal_id', journalId);

        console.log('Full Entry Lines:', fullEntry);

        // Check if any account is null (deleted) or inactive
        fullEntry?.forEach((line: any) => {
            if (!line.account) {
                console.log(`WARNING: Line ${line.id} has NO Account (Deleted?)`);
            } else if (!line.account.is_active) {
                console.log(`WARNING: Line ${line.id} Account ${line.account.code} is INACTIVE`);
            }
        });
    }
}

debugTransaction();
