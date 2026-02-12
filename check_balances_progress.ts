
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBalances() {
    console.log('Checking key account balances...');
    const codes = ['1110', '1111', '1112', '1211', '2111', '4101', '5101'];

    // Fetch accounts
    const { data: accounts, error } = await supabase
        .from('accounts_v2')
        .select('code, name_ar, current_balance')
        .in('code', codes);

    if (error) {
        console.error(error);
        return;
    }

    accounts.forEach(acc => {
        console.log(`${acc.code} - ${acc.name_ar}: ${acc.current_balance}`);
    });
}

checkBalances();
