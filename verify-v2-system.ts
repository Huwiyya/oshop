import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Use service role key if available for bypassing RLS, otherwise fallback to anon (which might fail if RLS is strict)
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Key in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runTest() {
    console.log('🚀 Starting Accounting V2 Verification...');

    // 1. Fetch random Asset account (Cash)
    const { data: cashAccount, error: cashError } = await supabase
        .from('accounts_v2')
        .select('*')
        .eq('name_en', 'Main Treasury')
        .single();

    if (cashError || !cashAccount) {
        console.error('❌ Failed to find Main Treasury account:', cashError);
        return;
    }
    console.log(`✅ Found Cash Account: ${cashAccount.name_ar} (Balance: ${cashAccount.current_balance})`);

    // 2. Fetch random Equity account (Capital) or Revenue
    const { data: revenueAccount, error: revError } = await supabase
        .from('accounts_v2')
        .select('*')
        .eq('code', '4201') // Inventory Sales
        .single();

    if (revError || !revenueAccount) {
        console.error('❌ Failed to find Revenue account:', revError);
        return;
    }
    console.log(`✅ Found Revenue Account: ${revenueAccount.name_ar} (Balance: ${revenueAccount.current_balance})`);

    const initialCashBalance = cashAccount.current_balance;
    const initialRevenueBalance = revenueAccount.current_balance;
    const transactionAmount = 500.00;

    // 3. Create Journal Entry (Debit Cash, Credit Revenue)
    console.log(`📝 Creating Journal Entry: Debit Cash ${transactionAmount}, Credit Revenue ${transactionAmount}`);

    const entryNumber = `TEST-${Date.now()}`;

    // Header
    const { data: header, error: headerError } = await supabase
        .from('journal_entries_v2')
        .insert({
            entry_number: entryNumber,
            date: new Date().toISOString(),
            description: 'Test Transaction V2 System',
            total_debit: transactionAmount,
            total_credit: transactionAmount,
            status: 'draft'
        })
        .select()
        .single();

    if (headerError) {
        console.error('❌ Failed to create header:', headerError);
        return;
    }
    console.log(`✅ Created Draft Entry: ${header.entry_number}`);

    // Lines
    const { error: linesError } = await supabase
        .from('journal_lines_v2')
        .insert([
            {
                journal_id: header.id,
                account_id: cashAccount.id,
                debit: transactionAmount,
                credit: 0,
                description: 'Test Debit'
            },
            {
                journal_id: header.id,
                account_id: revenueAccount.id,
                debit: 0,
                credit: transactionAmount,
                description: 'Test Credit'
            }
        ]);

    if (linesError) {
        console.error('❌ Failed to create lines:', linesError);
        return;
    }
    console.log('✅ Created Journal Lines');

    // 4. Post Entry
    console.log('🔄 Posting Entry...');
    const { error: postError } = await supabase
        .from('journal_entries_v2')
        .update({ status: 'posted' })
        .eq('id', header.id);

    if (postError) {
        console.error('❌ Failed to post entry:', postError);
        return;
    }
    console.log('✅ Entry Posted Automatically');

    // 5. Verify Balances
    const { data: updatedCash } = await supabase.from('accounts_v2').select('*').eq('id', cashAccount.id).single();
    const { data: updatedRevenue } = await supabase.from('accounts_v2').select('*').eq('id', revenueAccount.id).single();

    console.log('--- Verification Results ---');
    console.log(`Cash Previous: ${initialCashBalance} -> New: ${updatedCash.current_balance} (Diff: ${updatedCash.current_balance - initialCashBalance})`);
    console.log(`Revenue Previous: ${initialRevenueBalance} -> New: ${updatedRevenue.current_balance} (Diff: ${updatedRevenue.current_balance - initialRevenueBalance})`);

    // In SQL:
    // Cash (Asset, normal debit): Debit increases it.
    // Revenue (Revenue, normal credit): Credit increases it.
    // Wait, normal balance logic in trigger:
    // If account is Asset (Debit): Balance = Sum(Debit - Credit)
    // If account is Revenue (Credit): Balance = Sum(Credit - Debit)

    // New transaction: 
    // Cash Debit 500 -> Should increase balance by 500.
    // Revenue Credit 500 -> Should increase balance by 500.

    const cashDiff = updatedCash.current_balance - initialCashBalance;
    const revDiff = updatedRevenue.current_balance - initialRevenueBalance;

    if (Math.abs(cashDiff - 500) < 0.001 && Math.abs(revDiff - 500) < 0.001) {
        console.log('🎉 SUCCESS: Balances updated correctly according to accounting rules!');
    } else {
        console.error('⚠️ FAILURE: Balances did not update as expected.');
    }
}

runTest();
