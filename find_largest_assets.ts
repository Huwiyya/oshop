
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findLargest() {
    console.log('Finding Largest Asset accounts...');

    const { data: accounts } = await supabase
        .from('accounts_v2')
        .select('code, name_ar, current_balance, is_group')
        .eq('is_active', true)
        // We can't filter by account_type.category easily without join, 
        // but we know Assets usually start with '1'
        .like('code', '1%')
        .order('current_balance', { ascending: false })
        .limit(10);

    console.log('Top 10 Assets:', accounts);

    if (accounts) {
        const sum = accounts.reduce((acc, curr) => acc + curr.current_balance, 0);
        console.log('Sum of Top 10:', sum);
    }
}

findLargest();
