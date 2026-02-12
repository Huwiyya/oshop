const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAccount() {
    const { data, error } = await supabase
        .from('accounts_v2')
        .select('id, name_ar, code, is_group, level, current_balance, parent_id')
        .or('code.eq.1111,code.eq.111101,code.eq.111102');

    if (error) console.error(error);
    else console.table(data);
}

checkAccount();
