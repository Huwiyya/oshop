
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check4101Status() {
    const { data, error } = await supabase
        .from('accounts_v2')
        .select('code, is_active, is_group, current_balance')
        .eq('code', '4101')
        .single();

    if (error) {
        console.error(error);
    } else {
        console.log('Account 4101 Status:');
        console.log(`- Code: ${data.code}`);
        console.log(`- Is Active: ${data.is_active}`);
        console.log(`- Is Group: ${data.is_group}`);
        console.log(`- Current Balance: ${data.current_balance}`);

        if (!data.is_active) console.log('WARNING: Account is INACTIVE. Dashboard filters this out.');
        if (data.is_group) console.log('WARNING: Account is GROUP. Aggregation ignores its balance.');
    }
}
check4101Status();
