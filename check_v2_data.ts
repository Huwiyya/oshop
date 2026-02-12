
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkV2Data() {
    console.log('Checking V2 Data...');

    // 1. Check Journal Entries V2
    const { data: entries, error: entryError } = await supabase
        .from('journal_entries_v2')
        .select('*');

    if (entryError) console.error('Error checking journal_entries_v2:', entryError);
    else {
        console.log(`Found ${entries?.length} journal entries.`);
        entries?.forEach(e => {
            console.log(` - ${e.entry_number} (${e.date}): Status=${e.status}, Total Dr=${e.total_debit}, Total Cr=${e.total_credit}`);
        });
    }

    // 2. Check Accounts V2 with non-zero balance
    const { data: accounts, error: accError } = await supabase
        .from('accounts_v2')
        .select('code, name_ar, current_balance')
        .neq('current_balance', 0)
        .limit(10);

    if (accError) console.error('Error checking accounts_v2:', accError);
    else {
        console.log(`Found ${accounts?.length} accounts with non-zero balance:`);
        accounts?.forEach(acc => {
            console.log(` - ${acc.code} ${acc.name_ar}: ${acc.current_balance}`);
        });
    }

    // 3. Check specific Revenue/Expense accounts
    const { data: revenue, error: revError } = await supabase
        .from('accounts_v2')
        .select('code, name_ar, current_balance, type_id')
        .like('code', '4%'); // Usually Revenue starts with 4

    if (revError) console.error('Error checking revenue accounts:', revError);
    else {
        console.log(`Checking Revenue Accounts (Starts with 4):`);
        revenue?.forEach(acc => {
            console.log(` - ${acc.code} ${acc.name_ar}: ${acc.current_balance}`);
        });
    }
}

checkV2Data();
