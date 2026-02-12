
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAccounts() {
    console.log('Debugging Accounts...');

    const { data: accounts, error } = await supabase
        .from('accounts')
        .select('id, name_ar, account_code, level')
        .order('account_code');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Total Accounts Found: ${accounts.length}`);

    // Check Cash/Bank (111...)
    const cashBanks = accounts.filter(a => a.account_code.startsWith('111'));
    console.log('\n--- Cash & Bank Accounts (111...) ---');
    cashBanks.forEach(a => {
        console.log(`${a.account_code} - ${a.name_ar} [Level: ${a.level}]`);
    });

    // Check Customers (112...)
    const customers = accounts.filter(a => a.account_code.startsWith('112'));
    console.log('\n--- Customers (112...) ---');
    customers.slice(0, 10).forEach(a => { // Limit output
        console.log(`${a.account_code} - ${a.name_ar} [Level: ${a.level}]`);
    });

    // Check Revenue (4...)
    const revenue = accounts.filter(a => a.account_code.startsWith('4'));
    console.log('\n--- Revenue (4...) ---');
    revenue.slice(0, 10).forEach(a => {
        console.log(`${a.account_code} - ${a.name_ar} [Level: ${a.level}]`);
    });
}

debugAccounts();
