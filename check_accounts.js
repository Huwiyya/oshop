
const { createClient } = require('@supabase/supabase-js');

// Hardcoding for this script since we just read them - normally we'd use dotenv but this is faster for a one-off
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'REPLACE_ME_WITH_REAL_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'REPLACE_ME_WITH_REAL_KEY';

if (supabaseUrl.includes('REPLACE')) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Checking accounts...');
    const { data, error } = await supabase
        .from('accounts_v2')
        .select('id, code, name_ar, is_parent')
        .or('code.eq.121,code.eq.122,code.eq.12');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Found Accounts:', data);
    }
}

check();
