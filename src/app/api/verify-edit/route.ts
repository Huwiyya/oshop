
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    let report: any = { status: 'initializing', steps: [] };
    const log = (msg: string, data?: any) => report.steps.push({ msg, data: data ? JSON.stringify(data) : null });

    try {
        // 1. Setup Data
        const { data: types } = await supabaseAdmin.from('account_types').select('id, name_en');
        const liabilityType = types?.find(t => t.name_en?.toLowerCase().includes('liab'))?.id || types?.[0]?.id;
        const assetType = types?.find(t => t.name_en?.toLowerCase().includes('asset'))?.id || types?.[0]?.id;

        // Accounts
        const supCode = 'SUP-EDIT-' + Date.now().toString().slice(-4);
        const { data: sAcc } = await supabaseAdmin.from('accounts').insert({
            account_code: supCode, name_ar: 'مورد تعديل ' + supCode, account_type_id: liabilityType, level: 4
        }).select().single();

        const cusCode = 'CUS-EDIT-' + Date.now().toString().slice(-4);
        const { data: cAcc } = await supabaseAdmin.from('accounts').insert({
            account_code: cusCode, name_ar: 'عميل تعديل ' + cusCode, account_type_id: assetType, level: 4
        }).select().single();

        if (!sAcc || !cAcc) throw new Error('Failed to create test accounts');
        const supplierAccountId = sAcc.id;
        const customerAccountId = cAcc.id;

        // Item
        const itemCode = 'ITEM-EDIT-' + Date.now().toString().slice(-4);
        const { data: newItem } = await supabaseAdmin.from('inventory_items').insert({
            name_ar: 'صنف تعديل', item_code: itemCode, quantity_on_hand: 0
        }).select().single();

        if (!newItem) throw new Error('Failed to create test item');
        const itemId = newItem.id;

        log('Setup Complete', { itemCode, supCode });

        // 2. Inspect Schema
        const { data: cols, error: colErr } = await supabaseAdmin.from('journal_entry_lines').select('*').limit(1);
        // This will return an empty array if empty, but if we assume at least one row exists? 
        // Or we can try to insert a dummy row to see the error?
        // Actually, let's just log the error from the INSERT if it fails.
        // But to be sure, create a dummy journal entry line? No, complicated dependencies.

        // Better: Try to SELECT columns from a known view if possible?
        // Or just try to select 'journal_entry_id' from the table.
        const { error: checkErr } = await supabaseAdmin.from('journal_entry_lines').select('journal_entry_id').limit(1);
        if (!checkErr) {
            log('Column journal_entry_id EXISTS in journal_entry_lines');
        } else {
            log('Column journal_entry_id DOES NOT EXIST', checkErr.message);
        }

        const { error: checkErr2 } = await supabaseAdmin.from('journal_entry_lines').select('entry_id').limit(1);
        if (!checkErr2) {
            log('Column entry_id EXISTS in journal_entry_lines');
        } else {
            log('Column entry_id DOES NOT EXIST', checkErr2.message);
        }

        // 2. Create Purchase (Qty 10 @ 100)
        log('Creating Purchase (10 @ 100)');
        const { data: pur, error: purErr } = await supabaseAdmin.rpc('create_purchase_invoice_rpc', {
            invoice_data: {
                supplierId: supplierAccountId,
                date: new Date().toISOString().split('T')[0],
                currency: 'LYD', rate: 1, paidAmount: 0, notes: 'Original Purchase'
            },
            items: [{ itemId: itemId, quantity: 10, unitPrice: 100, description: 'Original Item' }]
        });
        if (purErr) throw new Error('Create Purchase Failed: ' + purErr.message);

        // Check Inventory
        let { data: itemAfterPur } = await supabaseAdmin.from('inventory_items').select('quantity_on_hand').eq('id', itemId).single();
        log('Inventory after Purchase', itemAfterPur?.quantity_on_hand); // Should be 10

        // 3. EDIT Purchase (Change Qty to 15 @ 110)
        log('Editing Purchase (Change to 15 @ 110)');
        const { data: editPur, error: editPurErr } = await supabaseAdmin.rpc('update_purchase_invoice_rpc', {
            p_invoice_id: pur?.invoice_id,
            p_new_data: {
                supplierId: supplierAccountId,
                date: new Date().toISOString().split('T')[0],
                currency: 'LYD', rate: 1, paidAmount: 0, notes: 'Edited Purchase'
            },
            p_new_items: [{ itemId: itemId, quantity: 15, unitPrice: 110, description: 'Edited Item' }]
        });
        if (editPurErr) throw new Error('Edit Purchase Failed: ' + editPurErr.message);

        // Check Inventory
        let { data: itemAfterEditPur } = await supabaseAdmin.from('inventory_items').select('quantity_on_hand').eq('id', itemId).single();
        log('Inventory after Edit Purchase', itemAfterEditPur?.quantity_on_hand); // Should be 15
        if (itemAfterEditPur?.quantity_on_hand !== 15) throw new Error('Inventory mismatch after purchase edit');

        // 4. Create Sale (Qty 5)
        log('Creating Sale (5 @ 200)');
        const { data: sale, error: saleErr } = await supabaseAdmin.rpc('create_sales_invoice_rpc', {
            invoice_data: {
                customerId: customerAccountId,
                date: new Date().toISOString().split('T')[0],
                currency: 'LYD', rate: 1, paidAmount: 0, notes: 'Original Sale'
            },
            items: [{ itemId: itemId, quantity: 5, unitPrice: 200, description: 'Original Sale Item' }]
        });
        if (saleErr) throw new Error('Create Sale Failed: ' + saleErr.message);

        // Check Inventory
        let { data: itemAfterSale } = await supabaseAdmin.from('inventory_items').select('quantity_on_hand').eq('id', itemId).single();
        log('Inventory after Sale', itemAfterSale?.quantity_on_hand); // Should be 10 (15 - 5)

        // 5. EDIT Sale (Change Qty to 3)
        log('Editing Sale (Change to 3 @ 200)');
        const { data: editSale, error: editSaleErr } = await supabaseAdmin.rpc('update_sales_invoice_rpc', {
            p_invoice_id: sale?.invoice_id,
            p_new_data: {
                customerId: customerAccountId,
                date: new Date().toISOString().split('T')[0],
                currency: 'LYD', rate: 1, paidAmount: 0, notes: 'Edited Sale'
            },
            p_new_items: [{ itemId: itemId, quantity: 3, unitPrice: 200, description: 'Edited Sale Item' }]
        });
        if (editSaleErr) throw new Error('Edit Sale Failed: ' + editSaleErr.message);

        // Check Inventory
        let { data: itemAfterEditSale } = await supabaseAdmin.from('inventory_items').select('quantity_on_hand').eq('id', itemId).single();
        log('Inventory after Edit Sale', itemAfterEditSale?.quantity_on_hand); // Should be 12 (15 - 3)
        if (itemAfterEditSale?.quantity_on_hand !== 12) throw new Error('Inventory mismatch after sale edit');

        report.final_status = 'Success';
        return NextResponse.json({ success: true, report });

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message, report }, { status: 500 });
    }
}
