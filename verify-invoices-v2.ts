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

async function verifyInvoicesFlow() {
    console.log('🧪 Starting Invoices V2 Verification...');

    // 1. Setup Accounts
    // We need: Customer (Asset), Revenue (Revenue), Supplier (Liability), Expense (Expense)
    // reusing existing accounts or fetching them

    // Get a Customer Account
    const { data: customerData } = await supabase.from('accounts_v2').select('*').eq('name_en', 'Main Customer').single();
    let customerId = customerData?.id;

    if (!customerId) {
        // Create if not exists (simplified)
        const { data: type } = await supabase.from('account_types_v2').select('id').eq('name_en', 'Assets').single();
        const { data: newCust } = await supabase.from('accounts_v2').insert({
            code: '1205', name_ar: 'عميل رئيسي', name_en: 'Main Customer', type_id: type.id, level: 3
        }).select().single();
        customerId = newCust.id;
    }

    // Get Revenue Account
    const { data: revenueData } = await supabase.from('accounts_v2').select('*').eq('name_en', 'Sales Revenue').single();
    let revenueId = revenueData?.id;
    if (!revenueId) {
        const { data: type } = await supabase.from('account_types_v2').select('id').eq('name_en', 'Revenue').single();
        const { data: newRev } = await supabase.from('accounts_v2').insert({
            code: '4105', name_ar: 'إيرادات المبيعات', name_en: 'Sales Revenue', type_id: type.id, level: 3
        }).select().single();
        revenueId = newRev.id;
    }

    console.log('✅ Accounts ready:', { customerId, revenueId });

    // 2. Create Sales Invoice
    console.log('📝 Creating Sales Invoice...');
    const invoiceAmount = 1500;
    const { data: invoice, error: invError } = await supabase.from('sales_invoices_v2').insert({
        invoice_number: `TEST-INV-${Date.now()}`,
        date: new Date().toISOString(),
        customer_account_id: customerId,
        revenue_account_id: revenueId,
        amount: invoiceAmount,
        status: 'posted' // auto-trigger
    }).select().single();

    if (invError) {
        console.error('❌ Failed to create invoice:', invError);
        return;
    }

    console.log('✅ Sales Invoice created:', invoice.invoice_number);

    // 3. Verify Journal Entry Creation
    console.log('🔍 Check Journal Entry...');
    // Give trigger a moment (though it's usually immediate in same tx, supabase-js might be async)
    const { data: updatedInvoice } = await supabase.from('sales_invoices_v2').select('journal_entry_id').eq('id', invoice.id).single();

    if (!updatedInvoice.journal_entry_id) {
        console.error('❌ Journal Entry ID not found on invoice! Trigger failed?');
        return;
    }

    const { data: journal } = await supabase.from('journal_entries_v2').select('*, lines:journal_lines_v2(*)').eq('id', updatedInvoice.journal_entry_id).single();

    if (!journal) {
        console.error('❌ Journal Entry record missing!');
        return;
    }

    console.log('✅ Journal Entry created:', journal.entry_number);
    console.log('   Lines:', journal.lines.length);

    const debitLine = journal.lines.find((l: any) => l.debit > 0);
    const creditLine = journal.lines.find((l: any) => l.credit > 0);

    if (debitLine.account_id === customerId && creditLine.account_id === revenueId && debitLine.debit === invoiceAmount) {
        console.log('🎉 SUCCESS: Invoice -> Journal Flow verified!');
    } else {
        console.error('⚠️ FAILURE: Journal lines do not match expectation.');
        console.log('Expected Debit Customer:', customerId, 'Got:', debitLine.account_id);
        console.log('Expected Credit Revenue:', revenueId, 'Got:', creditLine.account_id);
    }
}

verifyInvoicesFlow();
