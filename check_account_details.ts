
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDetails() {
    console.log('Checking Account 4101 Details...');
    const { data: acc, error } = await supabase
        .from('accounts_v2')
        .select('*, account_type:type_id(*)')
        .eq('code', '4101')
        .single();

    if (error) console.error(error);
    else console.log(acc);

    // Also check 5xxx accounts (Expenses)
    console.log('Checking 5xxx Accounts...');
    const { data: expenses } = await supabase
        .from('accounts_v2')
        .select('code, level, type_id, account_type:type_id(*)')
        .like('code', '5%')
        .limit(5);

    console.log(expenses);
}

checkDetails();
