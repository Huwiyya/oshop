
import { createAccountV2, getAccountIdByName } from './accounting-v2-actions';
import { createPurchaseInvoice } from './purchase-actions';
import { createSalesInvoice } from './sales-actions';
import { supabaseAdmin } from './supabase-admin';

async function verifyFlow() {
    console.log("🚀 Starting Verification Flow...");

    try {
        // 1. Setup Accounts (if not exist)
        let inventoryId = await getAccountIdByName('Inventory');
        if (!inventoryId) {
            console.log("Creating Inventory Account...");
            const assetType = await supabaseAdmin.from('account_types_v2').select('id').eq('name_en', 'Assets').single();
            const { data: newAcc } = await supabaseAdmin.from('accounts_v2').insert({
                code: '1000-TEST',
                name_ar: 'مخزون تجريبي',
                name_en: 'Inventory Test',
                type_id: assetType.data!.id,
                level: 1,
                is_group: false,
                parent_id: null,
                current_balance: 0,
                currency: 'LYD'
            }).select().single();
            inventoryId = newAcc!.id;
        }

        let salesId = await getAccountIdByName('Sales');
        if (!salesId) {
            console.log("Creating Sales Account...");
            const revType = await supabaseAdmin.from('account_types_v2').select('id').eq('name_en', 'Revenue').single();
            const { data: newAcc } = await supabaseAdmin.from('accounts_v2').insert({
                code: '4000-TEST',
                name_ar: 'مبيعات تجريبية',
                name_en: 'Sales Test',
                type_id: revType.data!.id,
                level: 1,
                is_group: false,
                parent_id: null,
                current_balance: 0,
                currency: 'LYD'
            }).select().single();
            salesId = newAcc!.id;
        }

        let supplierId = await getAccountIdByName('Supplier'); // Dummy or Real
        if (!supplierId) {
            console.log("Creating Supplier Account...");
            const liabType = await supabaseAdmin.from('account_types_v2').select('id').eq('name_en', 'Liabilities').single();
            const { data: newAcc } = await supabaseAdmin.from('accounts_v2').insert({
                code: '2000-TEST',
                name_ar: 'مورد تجريبي',
                name_en: 'Supplier Test',
                type_id: liabType.data!.id,
                level: 1,
                is_group: false,
                parent_id: null,
                current_balance: 0,
                currency: 'LYD'
            }).select().single();
            supplierId = newAcc!.id;
        }

        let customerId = await getAccountIdByName('Customer'); // Dummy or Real
        if (!customerId) {
            console.log("Creating Customer Account...");
            const type = await supabaseAdmin.from('account_types_v2').select('id').eq('name_en', 'Assets').single(); // AR is Asset
            const { data: newAcc } = await supabaseAdmin.from('accounts_v2').insert({
                code: '1100-TEST',
                name_ar: 'عميل تجريبي',
                name_en: 'Customer Test',
                type_id: type.data!.id,
                level: 1,
                is_group: false,
                parent_id: null,
                current_balance: 0,
                currency: 'LYD'
            }).select().single();
            customerId = newAcc!.id;
        }


        // 2. Create Product
        const sku = `PROD-${Date.now()}`;
        const { data: product, error: prodError } = await supabaseAdmin
            .from('products_v2')
            .insert({
                sku: sku,
                name_ar: 'منتج تجريبي',
                name_en: 'Test Product',
                inventory_account_id: inventoryId,
                sales_account_id: salesId,
                cogs_account_id: salesId, // Using Sales for COGS just for test (or create Expense)
                current_quantity: 0
            })
            .select()
            .single();

        if (prodError) throw prodError;
        console.log(`✅ Product Created: ${product.name_en} (ID: ${product.id})`);


        // 3. Purchase (Stock In)
        console.log("📦 Creating Purchase Invoice...");
        const purchaseRes = await createPurchaseInvoice({
            supplierId: supplierId!,
            invoiceDate: new Date().toISOString().split('T')[0],
            items: [{
                itemId: product.id,
                quantity: 10,
                unitPrice: 50, // Cost
                total: 500,
                description: 'Test Restock'
            }],
            currency: 'LYD',
            exchangeRate: 1,
            paidAmount: 0 // Credit
        });
        console.log(`✅ Purchase Result:`, purchaseRes);


        // 4. Verify Stock Increase
        const { data: prodAfterBuy } = await supabaseAdmin.from('products_v2').select('current_quantity').eq('id', product.id).single();
        console.log(`📊 Stock after Purchase: ${prodAfterBuy?.current_quantity} (Expected: 10)`);
        if (prodAfterBuy?.current_quantity !== 10) throw new Error("Stock update failed!");


        // 5. Sale (Stock Out)
        console.log("💰 Creating Sales Invoice...");
        const saleRes = await createSalesInvoice({
            customerId: customerId!,
            invoiceDate: new Date().toISOString().split('T')[0],
            items: [{
                itemId: product.id,
                quantity: 3,
                unitPrice: 100, // Price
                total: 300,
                description: 'Test Sale'
            }],
            currency: 'LYD',
            exchangeRate: 1,
            paidAmount: 0
        });
        console.log(`✅ Sale Result:`, saleRes);


        // 6. Verify Stock Decrease
        const { data: prodAfterSell } = await supabaseAdmin.from('products_v2').select('current_quantity').eq('id', product.id).single();
        console.log(`📊 Stock after Sale: ${prodAfterSell?.current_quantity} (Expected: 7)`);
        if (prodAfterSell?.current_quantity !== 7) throw new Error("Stock deduction failed!");


        console.log("🎉 VERIFICATION SUCCESSFUL! Flow Complete.");

    } catch (e) {
        console.error("❌ Verification Failed:", e);
    }
}

// Check if running directly
// We can't really detect execution mode easily in this env without wrapper, but importing it is fine.
// I will run this via a separate command calling this function.

verifyFlow();
