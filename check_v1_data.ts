
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Checking V1 Data...');

    // 1. Check Journal Entries
    const { count: entryCount, error: entryError } = await supabase
        .from('journal_entries')
        .select('*', { count: 'exact', head: true });

    if (entryError) console.error('Error checking journal_entries:', entryError);
    else console.log(`Found ${entryCount} journal entries.`);

    // 2. Check Journal Lines
    const { count: lineCount, error: lineError } = await supabase
        .from('journal_entry_lines')
        .select('*', { count: 'exact', head: true });

    if (lineError) console.error('Error checking journal_entry_lines:', lineError);
    else console.log(`Found ${lineCount} journal entry lines.`);

    // 3. Check Accounts with non-zero balance
    const { data: accounts, error: accError } = await supabase
        .from('accounts')
        .select('account_code, name_ar, current_balance')
        .neq('current_balance', 0)
        .limit(10);

    if (accError) console.error('Error checking accounts:', accError);
    else {
        console.log(`Found ${accounts?.length} accounts with non-zero balance:`);
        accounts?.forEach(acc => {
            console.log(` - ${acc.account_code} ${acc.name_ar}: ${acc.current_balance}`);
        });
    }

    // 4. Check Level 3 Accounts (Summary Level)
    const { data: level3, error: l3Error } = await supabase
        .from('accounts')
        .select('account_code, name_ar, current_balance, level')
        .eq('level', 3)
        .neq('current_balance', 0)
        .limit(5);

    if (l3Error) console.error('Error checking Level 3 accounts:', l3Error);
    else {
        console.log(`Found ${level3?.length} Level 3 accounts with balance (Dashboard Targets):`);
        level3?.forEach(acc => {
            console.log(` - ${acc.account_code} ${acc.name_ar}: ${acc.current_balance}`);
        });
    }
}

checkData();
