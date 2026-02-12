
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyBalances() {
    console.log('Verifying Account Balances...');

    // 1. Get all accounts with their stored balance
    const { data: accounts, error: accError } = await supabase
        .from('accounts')
        .select('id, name_ar, account_code, current_balance, level')
        .order('account_code');

    if (accError) {
        console.error('Error fetching accounts:', accError);
        return;
    }

    console.log(`Checking ${accounts.length} accounts...`);

    let discrepancyCount = 0;

    for (const acc of accounts) {
        // 2. Calculate actual balance from journal lines
        const { data: lines, error: linesError } = await supabase
            .from('journal_entry_lines')
            .select('debit, credit')
            .eq('account_id', acc.id);

        if (linesError) {
            console.error(`Error fetching lines for ${acc.account_code}:`, linesError);
            continue;
        }

        let calculatedBalance = 0;
        // Simple Debit - Credit for check (ignoring normal balance type for now, just checking magnitude)
        // Actually, we should check based on account type, but let's just see if it's NON-ZERO vs ZERO.
        const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
        const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
        const netMovement = totalDebit - totalCredit;

        // stored balance
        const storedBalance = Number(acc.current_balance || 0);

        // If stored is 0 but calculated is NOT 0, that's a huge flag.
        if (Math.abs(netMovement) > 0.001) {
            // Check if stored matches
            // We don't know the sign convention of stored_balance without checking account_type/normal_balance,
            // but usually it's absolute or signed.
            // If stored is 0, it's definitely wrong.
            if (Math.abs(storedBalance) < 0.001) {
                console.log(`[DISCREPANCY] ${acc.account_code} - ${acc.name_ar}`);
                console.log(`   Stored: ${storedBalance}`);
                console.log(`   Calculated Net (Dr-Cr): ${netMovement}`);
                console.log(`   Total Dr: ${totalDebit}, Total Cr: ${totalCredit}`);
                discrepancyCount++;
            } else if (Math.abs(Math.abs(storedBalance) - Math.abs(netMovement)) > 0.001) {
                console.log(`[MISMATCH] ${acc.account_code} - ${acc.name_ar}`);
                console.log(`   Stored: ${storedBalance}`);
                console.log(`   Calculated Net (Dr-Cr): ${netMovement}`);
                discrepancyCount++;
            }
        }
    }

    if (discrepancyCount === 0) {
        console.log('No discrepancies found. Balances seem up to date.');
    } else {
        console.log(`\nFound ${discrepancyCount} accounts with balance discrepancies.`);
    }
}

verifyBalances();
