
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRevenueLines() {
    console.log('Checking Revenue/Expense Lines...');

    // 1. Get IDs of Revenue/Expense Accounts
    const { data: accounts } = await supabase
        .from('accounts_v2')
        .select('id, code, name_ar')
        .or('code.like.4%,code.like.5%');

    if (!accounts || accounts.length === 0) {
        console.log('No Revenue/Expense accounts found in accounts_v2.');
        return;
    }

    const accountIds = accounts.map(a => a.id);
    console.log(`Found ${accounts.length} Revenue/Expense accounts.`);

    // 2. Check Journal Lines for these accounts
    const { data: lines, error } = await supabase
        .from('journal_lines_v2')
        .select('id, debit, credit, account_id, journal_id')
        .in('account_id', accountIds);

    if (error) {
        console.error('Error fetching lines:', error);
        return;
    }

    if (!lines || lines.length === 0) {
        console.log('NO TRANSACTIONS found for Revenue/Expense accounts.');
        console.log('The Dashboard is correctly showing 0.');
    } else {
        console.log(`FOUND ${lines.length} transactions for Revenue/Expense accounts!`);
        lines.forEach(l => {
            const acc = accounts.find(a => a.id === l.account_id);
            console.log(` - Acc: ${acc?.code} (${acc?.name_ar}) | Dr: ${l.debit}, Cr: ${l.credit} | Journal: ${l.journal_id}`);
        });

        // 3. Check if stored balance matches
        console.log('\nVerifying Stored Balances:');
        for (const acc of accounts) {
            const accLines = lines.filter(l => l.account_id === acc.id);
            if (accLines.length === 0) continue;

            // Calculate expected
            // Revenue (Credit Normal): Cr - Dr
            // Expense (Debit Normal): Dr - Cr
            // But let's just see net movement
            const totalDr = accLines.reduce((sum, l) => sum + l.debit, 0);
            const totalCr = accLines.reduce((sum, l) => sum + l.credit, 0);

            // Re-fetch current stored balance
            const { data: currentAcc } = await supabase
                .from('accounts_v2')
                .select('current_balance')
                .eq('id', acc.id)
                .single();

            console.log(`Account ${acc.code}: Calculated Dr:${totalDr} Cr:${totalCr} | Stored Balance: ${currentAcc?.current_balance}`);
        }
    }
}

checkRevenueLines();
