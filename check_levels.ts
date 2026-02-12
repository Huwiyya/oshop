
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLevels() {
    const { data: accounts } = await supabase
        .from('accounts_v2')
        .select('code, level, name_ar, parent_id')
        .in('code', ['121003', '123', '121']);

    console.log(accounts);
}

checkLevels();
