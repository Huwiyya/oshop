
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check1131() {
    const { data, error } = await supabase
        .from('accounts_v2')
        .select('*, account_type:type_id(*)')
        .eq('code', '1131')
        .single();

    if (error) console.error(error);
    else console.log(data);
}

check1131();
