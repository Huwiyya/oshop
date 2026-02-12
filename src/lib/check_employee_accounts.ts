
import { supabaseAdmin } from './supabase-admin';

async function check() {
    console.log('--- Checking System Accounts ---');
    const { data: sa, error: saError } = await supabaseAdmin
        .from('system_accounts')
        .select('*')
        .in('key', ['EMPLOYEES_PAYABLE', 'EMPLOYEES_CONTROL']);

    if (saError) console.error(saError);
    else console.table(sa);

    if (sa && sa.length > 0) {
        const ids = sa.map((s: any) => s.account_id);

        console.log('--- Checking Legacy Accounts ---');
        const { data: acc, error: accError } = await supabaseAdmin
            .from('accounts')
            .select('id, name_ar, account_code')
            .in('id', ids);
        if (accError) console.error(accError);
        else console.table(acc);

        console.log('--- Checking V2 Accounts ---');
        const { data: accV2, error: accV2Error } = await supabaseAdmin
            .from('accounts_v2')
            .select('id, name_ar, code')
            .in('id', ids);
        if (accV2Error) console.error(accV2Error);
        else console.table(accV2);
    } else {
        console.log('No system accounts found for employees.');
    }

    console.log('--- Searching for "Employees" or "Staff" in Accounts ---');
    const { data: search, error: searchError } = await supabaseAdmin
        .from('accounts')
        .select('id, name_ar, account_code')
        .or('name_ar.ilike.%موظف%,name_en.ilike.%Employee%,name_en.ilike.%Staff%');

    if (searchError) console.error(searchError);
    else console.table(search);
}

check();
