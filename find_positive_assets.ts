
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findPositiveAssets() {
    console.log('Finding Asset accounts with balance != 0...');

    // Get Asset Type ID (from previous script: 5fda3c74...) or just join
    const { data: accounts } = await supabase
        .from('accounts_v2')
        .select(`
            code, name_ar, current_balance, is_group,
            account_type:type_id!inner ( category )
        `)
        .eq('account_type.category', 'asset')
        .neq('current_balance', 0)
        .order('current_balance', { ascending: false });

    console.log('Assets with balance:', accounts);

    // Calculate total
    const total = accounts?.reduce((sum, acc) => sum + acc.current_balance, 0);
    console.log('Total Assets (raw sum):', total);
}

findPositiveAssets();
