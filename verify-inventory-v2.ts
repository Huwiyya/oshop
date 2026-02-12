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

async function verifyInventoryCycle() {
    console.log('🧪 Starting Inventory V2 Cycle Verification...');

    // 1. Setup Accounts
    // Inventory (Asset), COGS (Expense), Sales (Revenue), Supplier, Customer
    let invAccId, cogsAccId, salesAccId, suppAccId, custAccId;

    // Helper to get or create account
    const getAccount = async (code: string, name: string, typeName: string) => {
        const { data: acc } = await supabase.from('accounts_v2').select('id').eq('code', code).single();
        if (acc) return acc.id;
        const { data: type } = await supabase.from('account_types_v2').select('id').eq('name_en', typeName).single();
        const { data: newAcc } = await supabase.from('accounts_v2').insert({
            code, name_ar: name, name_en: name, type_id: type.id, level: 3
        }).select().single();
        return newAcc.id;
    };

    invAccId = await getAccount('1109', 'Inventory Main', 'Assets');
    cogsAccId = await getAccount('5101', 'Cost of Goods Sold', 'Expenses');
    salesAccId = await getAccount('4101', 'Product Sales', 'Revenue');
    suppAccId = await getAccount('2101', 'Main Supplier', 'Liabilities');
    custAccId = await getAccount('1201', 'Main Customer', 'Assets');

    console.log('✅ Accounts ready.');

    // 2. Create Product
    console.log('📦 Creating Product...');
    const sku = `PROD-${Date.now()}`;
    const { data: product, error: prodError } = await supabase.from('products_v2').insert({
        sku,
        name_ar: 'منتج تجريبي',
        name_en: 'Test Product',
        type: 'product',
        inventory_account_id: invAccId,
        cogs_account_id: cogsAccId,
        sales_account_id: salesAccId,
        current_quantity: 0
    }).select().single();

    if (prodError) { console.error('❌ Failed product:', prodError); return; }
    console.log('✅ Product created:', product.sku);

    // 3. PURCHASE (Stock In)
    console.log('🚚 Buying Stock (Purchase Invoice)...');
    // Buy 10 units @ 100 each
    const qtyIn = 10;
    const costPrice = 100;
    const totalCost = qtyIn * costPrice;

    // Insert Purchase Invoice Header
    const { data: purInv, error: purErr } = await supabase.from('purchase_invoices_v2').insert({
        invoice_number: `PB-${Date.now()}`,
        status: 'posted', // trigger fires on posted
        date: new Date().toISOString(),
        supplier_account_id: suppAccId,
        expense_account_id: invAccId, // Debit Inventory directly
        amount: totalCost
    }).select().single();
    if (purErr) { console.error('❌ Purchase Header failed', purErr); return; }

    // Insert Purchase Lines (Triggers Inventory logic)
    // Note: My trigger logic relies on UPDATE of invoice status or Insert of lines? 
    // Wait, trigger `trg_process_purchase_inventory_v2` is `AFTER UPDATE ON public.purchase_invoices_v2`.
    // It loops lines. So lines must exist BEFORE status becomes POSTED or Trigger runs again.
    // If I inserted header with POSTED, the trigger runs immediately. But lines don't exist yet!
    // Issue: The trigger reads lines. Lines must be inserted first.
    // But currently I inserted header first. 
    // If I insert lines later, the header trigger won't run again unless I update header.
    // OR I should insert Header DRAFT -> Insert Lines -> Update Header POSTED.

    // Let's retry with DRAFT flow which is safer.

    console.log('   (Retrying with Draft -> Posted flow for correct trigger order)');
    const { data: purInvDraft } = await supabase.from('purchase_invoices_v2').insert({
        invoice_number: `PB2-${Date.now()}`,
        status: 'draft',
        date: new Date().toISOString(),
        supplier_account_id: suppAccId,
        expense_account_id: invAccId,
        amount: totalCost
    }).select().single();

    await supabase.from('purchase_invoice_lines_v2').insert({
        invoice_id: purInvDraft.id,
        product_id: product.id,
        quantity: qtyIn,
        unit_price: costPrice,
        description: 'Stock In'
    });

    // Validating state before post
    const { data: prodBefore } = await supabase.from('products_v2').select('current_quantity').eq('id', product.id).single();
    console.log('   Qty Before Post:', prodBefore.current_quantity); // Should be 0

    // Post
    await supabase.from('purchase_invoices_v2').update({ status: 'posted' }).eq('id', purInvDraft.id);

    // Verify Stock Increase
    const { data: prodAfter } = await supabase.from('products_v2').select('current_quantity').eq('id', product.id).single();
    if (prodAfter.current_quantity === qtyIn) {
        console.log('✅ Stock Increased to:', prodAfter.current_quantity);
    } else {
        console.error('❌ Stock failed to increase! Got:', prodAfter.current_quantity);
    }

    // 4. SALE (Stock Out)
    console.log('💰 Selling Stock (Sales Invoice)...');
    // Sell 3 units @ 200 each
    const qtyOut = 3;
    const sellPrice = 200;

    const { data: saleInvDraft } = await supabase.from('sales_invoices_v2').insert({
        invoice_number: `SI-${Date.now()}`,
        status: 'draft',
        date: new Date().toISOString(),
        customer_account_id: custAccId,
        revenue_account_id: salesAccId,
        amount: qtyOut * sellPrice
    }).select().single();

    await supabase.from('sales_invoice_lines_v2').insert({
        invoice_id: saleInvDraft.id,
        product_id: product.id, // Linked
        quantity: qtyOut,
        unit_price: sellPrice,
        product_name: 'Test Product'
    });

    // Post
    const { error: postError } = await supabase.from('sales_invoices_v2').update({ status: 'posted' }).eq('id', saleInvDraft.id);
    if (postError) {
        console.error('❌ Posted failed:', postError);
        return;
    }

    // Verify Stock Decrease
    const { data: prodFinal } = await supabase.from('products_v2').select('current_quantity').eq('id', product.id).single();
    if (prodFinal.current_quantity === (qtyIn - qtyOut)) {
        console.log('✅ Stock Decreased to:', prodFinal.current_quantity);
    } else {
        console.error('❌ Stock decrease failed! Got:', prodFinal.current_quantity);
    }

    // Verify Journal Limit (COGS)
    // The sales invoice should have 2 extra lines for COGS (Debit COGS 300, Credit Inv 300)
    // Only if trigger logic worked.
    const { data: updatedSale } = await supabase.from('sales_invoices_v2').select('journal_entry_id').eq('id', saleInvDraft.id).single();
    if (updatedSale.journal_entry_id) {
        const { data: journal } = await supabase.from('journal_entries_v2').select('*, lines:journal_lines_v2(*)').eq('id', updatedSale.journal_entry_id).single();
        console.log('   Journal created with lines:', journal.lines.length);
        // Expect 4 lines: DB Customer, CR Revenue, DB COGS, CR Inventory
        // COGS = 3 * 100 = 300.
        const cogsLine = journal.lines.find((l: any) => l.account_id === cogsAccId);
        if (cogsLine && cogsLine.debit === 300) {
            console.log('🎉 SUCCESS: COGS Calculated and Posted correctly!');
        } else {
            console.error('⚠️ COGS Line missing or incorrect.', journal.lines);
        }
    }
}

verifyInventoryCycle();
