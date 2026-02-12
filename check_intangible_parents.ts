
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkParents() {
    console.log('Checking Intangible Asset Parents...');

    const codes = ['1', '12', '122', '1221', '1222', '1223', '1224'];

    const { data: accounts, error } = await supabase
        .from('accounts')
        .select('id, account_code, name_ar')
        .in('account_code', codes);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Found Accounts:', accounts);

    const foundCodes = accounts?.map(a => a.account_code) || [];
    const missing = codes.filter(c => !foundCodes.includes(c));

    console.log('Missing Codes:', missing);
}

checkParents();
