
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCashAccounts() {
    console.log('Checking for accounts starting with "111" (Cash/Bank)...');

    const { data: accounts, error } = await supabase
        .from('accounts')
        .select('id, account_code, name_ar, name_en, level, is_parent')
        .ilike('account_code', '111%');

    if (error) {
        console.error('Error fetching accounts:', error.message);
        return;
    }

    if (!accounts || accounts.length === 0) {
        console.log('No accounts found starting with "111".');

        // Check root assets
        const { data: roots } = await supabase.from('accounts').select('id, account_code, name_ar').eq('level', 1);
        console.log('Root accounts:', roots);
    } else {
        console.log('Found Cash Accounts:', accounts);
    }
}

checkCashAccounts();
