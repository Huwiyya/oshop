
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findGroupsWithBalances() {
    console.log('Finding Group accounts with non-zero balances...');

    let allAccounts: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('accounts_v2')
            .select('code, name_ar, current_balance, is_group, type_id, account_type:type_id(category)')
            .eq('is_group', true)
            // .neq('current_balance', 0) // Can't start with neq logic easily in Supabase/PostgREST on float sometimes, but let's try.
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) { console.error(error); break; }
        if (data.length > 0) {
            allAccounts = allAccounts.concat(data);
            if (data.length < pageSize) hasMore = false;
            page++;
        } else { hasMore = false; }
    }

    const groupsWithBalance = allAccounts.filter(a => Math.abs(a.current_balance) > 0.01);

    console.log(`Found ${groupsWithBalance.length} groups with balances:`);
    groupsWithBalance.forEach(g => {
        console.log(`${g.code} (${g.account_type?.category}): ${g.current_balance}`);
    });
}

findGroupsWithBalances();
