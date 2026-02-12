
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function recalculateBalances() {
    console.log('Recalculating V2 Balances...');

    let allAccounts: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('accounts_v2')
            .select('id, code, name_ar, type_id, account_type:type_id(normal_balance)')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching page', page, error);
            break;
        }

        if (data.length > 0) {
            allAccounts = allAccounts.concat(data);
            if (data.length < pageSize) hasMore = false;
            page++;
        } else {
            hasMore = false;
        }
    }

    const accounts = allAccounts;

    console.log(`Processing ${accounts.length} accounts...`);

    let updatedCount = 0;

    for (const acc of accounts) {
        // 2. Get lines
        const { data: lines, error: linesError } = await supabase
            .from('journal_lines_v2')
            .select('debit, credit')
            .eq('account_id', acc.id);

        if (linesError) {
            console.error(`Error fetching lines for ${acc.code}:`, linesError);
            continue;
        }

        if (!lines || lines.length === 0) {
            // Ensure balance is 0
            await supabase.from('accounts_v2').update({ current_balance: 0 }).eq('id', acc.id);
            continue;
        }

        const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
        const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);

        // Calculate Balance based on Normal Balance
        // If type is missing, assume Debit normal? Or just Net?
        // Usually:
        // Asset/Expense (Debit Normal): Dr - Cr
        // Liability/Equity/Revenue (Credit Normal): Cr - Dr
        // However, some systems store everything as Dr - Cr (Net Debit).
        // Let's check a known account.
        // Account 1110 (Cash) had -1115010.
        // If it's Asset (Dr Normal), Dr - Cr should be positive (if money present).
        // If it's negative, it means Cr > Dr (Overdrawn).

        // Let's assume standard Dr - Cr for now, and the UI handles display.
        // Wait, accounting-actions.ts says:
        // "For Assets/Expenses (Debit Normal), Balance is Positive."
        // "For Liab/Equity/Revenue (Credit Normal), Balance is Negative."
        // This suggests the DB stores "Net Debit" (Dr - Cr).

        const netDebit = totalDebit - totalCredit;

        // Update
        const { error: updateError } = await supabase
            .from('accounts_v2')
            .update({ current_balance: netDebit })
            .eq('id', acc.id);

        if (updateError) {
            console.error(`Error updating ${acc.code}:`, updateError);
        } else {
            updatedCount++;
            if (acc.code === '4101') {
                console.log(`Updated 4101: Dr ${totalDebit} - Cr ${totalCredit} = ${netDebit}`);
            }
        }
    }

    console.log(`Recalculation complete. Updated ${updatedCount} accounts.`);
}

recalculateBalances();
