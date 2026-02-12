'use server';

import { supabaseAdmin } from './supabase-admin';
import { getAccountIdByName, createAccountV2 } from './accounting-v2-actions';

export async function setupVerificationData() {
    try {
        // 1. Ensure Accounts Exist
        let inventoryId = await getAccountIdByName('Inventory') || await getAccountIdByName('Asset');
        if (!inventoryId) {
            // Create if missing (simplified)
            const { data: type } = await supabaseAdmin.from('account_types_v2').select('id').eq('category', 'asset').limit(1).single();
            if (type) {
                const { data: newAcc } = await supabaseAdmin.from('accounts_v2').insert({
                    code: '1000-TEST-' + Date.now(),
                    name_ar: 'مخزون تجريبي',
                    name_en: 'Test Inventory',
                    type_id: type.id,
                    level: 1,
                    is_group: false,
                    parent_id: null,
                    current_balance: 0,
                    currency: 'LYD'
                }).select().single();
                inventoryId = newAcc?.id;
            }
        }

        let salesId = await getAccountIdByName('Sales') || await getAccountIdByName('Revenue');
        if (!salesId) {
            const { data: revType } = await supabaseAdmin.from('account_types_v2').select('id').eq('category', 'revenue').limit(1).single();
            if (revType) {
                const { data: newAcc } = await supabaseAdmin.from('accounts_v2').insert({
                    code: '4000-TEST-' + Date.now(),
                    name_ar: 'مبيعات تجريبية',
                    name_en: 'Test Sales',
                    type_id: revType.id,
                    level: 1,
                    is_group: false,
                    parent_id: null,
                    current_balance: 0,
                    currency: 'LYD'
                }).select().single();
                salesId = newAcc?.id;
            }
        }

        const { data: supplier } = await supabaseAdmin
            .from('accounts_v2')
            .insert({
                code: '2000-' + Date.now(),
                name_ar: 'مورد تجريبي',
                name_en: 'Test Supplier ' + Date.now(),
                type_id: (await getAccTypeId('liability')),
                level: 1,
                is_group: false
            })
            .select()
            .single();

        const { data: customer } = await supabaseAdmin
            .from('accounts_v2')
            .insert({
                code: '1100-' + Date.now(),
                name_ar: 'عميل تجريبي',
                name_en: 'Test Customer ' + Date.now(),
                type_id: (await getAccTypeId('asset')),
                level: 1,
                is_group: false
            })
            .select()
            .single();

        // 2. Create Product
        const { data: product } = await supabaseAdmin
            .from('products_v2')
            .insert({
                sku: 'TEST-' + Date.now(),
                name_ar: 'منتج اختبار',
                name_en: 'Test Product',
                inventory_account_id: inventoryId,
                sales_account_id: salesId,
                cogs_account_id: salesId, // Simplified
                current_quantity: 0
            })
            .select()
            .single();

        return {
            success: true,
            data: {
                productId: product.id,
                supplierId: supplier?.id,
                customerId: customer?.id
            }
        };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function verifyStock(productId: string) {
    const { data } = await supabaseAdmin
        .from('products_v2')
        .select('current_quantity')
        .eq('id', productId)
        .single();
    return data?.current_quantity;
}

async function getAccTypeId(category: string) {
    const { data } = await supabaseAdmin.from('account_types_v2').select('id').eq('category', category).limit(1).single();
    return data?.id;
}

export async function checkDebugInfo(invoiceId: string, productId: string) {
    // 1. Check Invoice Header
    const { data: invoice } = await supabaseAdmin
        .from('purchase_invoices_v2')
        .select('*')
        .eq('id', invoiceId)
        .single();

    // 2. Check Invoice Lines
    const { data: lines } = await supabaseAdmin
        .from('purchase_invoice_lines_v2')
        .select('*')
        .eq('invoice_id', invoiceId);

    // 3. Check Inventory Transactions
    const { data: transactions } = await supabaseAdmin
        .from('inventory_transactions_v2')
        .select('*')
        .eq('source_id', invoiceId);

    // 4. Check Product Stock
    const { data: product } = await supabaseAdmin
        .from('products_v2')
        .select('current_quantity')
        .eq('id', productId)
        .single();

    // 5. Check Layers
    const { data: layers } = await supabaseAdmin
        .from('inventory_layers_v2')
        .select('*')
        .eq('source_id', invoiceId);

    return {
        invoice,
        lines,
        transactions,
        product,
        layers
    };
}
