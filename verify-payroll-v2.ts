import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyPayrollFlow() {
    console.log('🧪 Starting Payroll V2 Verification...');

    // 1. Setup Accounts (Expense: Salaries, Payment: Bank)
    let expenseId, paymentId;

    // Get Expense Account
    const { data: expData } = await supabase.from('accounts_v2').select('*').eq('name_en', 'Salaries Expense').single();
    if (expData) expenseId = expData.id;
    else {
        // Create
        const { data: type } = await supabase.from('account_types_v2').select('id').eq('name_en', 'Expenses').single();
        const { data: newExp } = await supabase.from('accounts_v2').insert({
            code: '5105', name_ar: 'رواتب وأجور', name_en: 'Salaries Expense', type_id: type.id, level: 3
        }).select().single();
        expenseId = newExp.id;
    }

    // Get Payment Account (Bank)
    const { data: payData } = await supabase.from('accounts_v2').select('*').eq('name_en', 'Main Bank').single();
    if (payData) paymentId = payData.id;
    else {
        // Create
        const { data: type } = await supabase.from('account_types_v2').select('id').eq('name_en', 'Assets').single();
        const { data: newPay } = await supabase.from('accounts_v2').insert({
            code: '1202', name_ar: 'البنك الرئيسي', name_en: 'Main Bank', type_id: type.id, level: 3
        }).select().single();
        paymentId = newPay.id;
    }

    console.log('✅ Accounts ready:', { expenseId, paymentId });

    // 2. Create Payroll Run
    console.log('📝 Creating Payroll Run...');
    const totalGross = 5000;
    const { data: run, error: runError } = await supabase.from('payroll_runs_v2').insert({
        run_number: `TEST-RUN-${Date.now()}`,
        month: '2024-02',
        date: new Date().toISOString(),
        payment_account_id: paymentId,
        expense_account_id: expenseId,
        total_gross: totalGross,
        total_deductions: 0,
        status: 'posted' // auto-trigger
    }).select().single();

    if (runError) {
        console.error('❌ Failed to create payroll run:', runError);
        return;
    }

    console.log('✅ Payroll Run created:', run.run_number);

    // 3. Verify Journal Entry
    console.log('🔍 Check Journal Entry...');
    const { data: updatedRun } = await supabase.from('payroll_runs_v2').select('journal_entry_id').eq('id', run.id).single();

    if (!updatedRun.journal_entry_id) {
        console.error('❌ Journal Entry ID not found on payroll run! Trigger failed?');
        return;
    }

    const { data: journal } = await supabase.from('journal_entries_v2').select('*, lines:journal_lines_v2(*)').eq('id', updatedRun.journal_entry_id).single();

    if (!journal) {
        console.error('❌ Journal Entry record missing!');
        return;
    }

    console.log('✅ Journal Entry created:', journal.entry_number);

    const debitLine = journal.lines.find((l: any) => l.debit > 0);
    const creditLine = journal.lines.find((l: any) => l.credit > 0);

    if (debitLine.account_id === expenseId && creditLine.account_id === paymentId && debitLine.debit === totalGross) {
        console.log('🎉 SUCCESS: Payroll -> Journal Flow verified!');
    } else {
        console.error('⚠️ FAILURE: Journal lines do not match expectation.');
    }
}

verifyPayrollFlow();
