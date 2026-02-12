
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runTest() {
    console.log('STARTING TEST: Create and Delete Purchase Invoice');

    // 1. Get a supplier and an item
    const { data: supplier } = await supabase.from('accounts').select('id').eq('account_code', '2100').single(); // Assuming 2100 is a supplier or similar
    // Fallback if 2100 not found, get any liability or just create dummy if needed. 
    // Actually let's just pick ANY account for test.
    const { data: accounts } = await supabase.from('accounts').select('id').limit(1);
    const supplierId = accounts?.[0]?.id;

    // Get an item
    const { data: items } = await supabase.from('inventory_items').select('id').limit(1);
    const itemId = items?.[0]?.id;

    if (!supplierId || !itemId) {
        console.error('No supplier or item found to test with.');
        return;
    }

    console.log(`Using Supplier: ${supplierId}, Item: ${itemId}`);

    // 2. Create Dummy Invoice Manually (simulating the action logic)
    // I can't import the action directly easily in this script without complex setup, 
    // so I will REPLICATE the logic to verify if the QUERY works.

    // ... Actually, I should better try to Find an existing invoice and see its transactions.
    // This is safer than creating dummy data that might mess up DB if not cleaned.

    const { data: invoices } = await supabase.from('purchase_invoices').select('*').order('created_at', { ascending: false }).limit(1);

    if (!invoices || invoices.length === 0) {
        console.log('No invoices found.');
        return;
    }

    const invoice = invoices[0];
    console.log(`Checking Invoice: ${invoice.invoice_number} (ID: ${invoice.id})`);

    // 3. Check Transactions using the SAME query as deletePurchaseInvoice
    const { data: transactions, error } = await supabase
        .from('inventory_transactions')
        .select('id, notes, layer_id')
        .ilike('notes', `%${invoice.invoice_number}%`);

    if (error) {
        console.error('Error fetching transactions:', error);
        return;
    }

    console.log(`Found ${transactions?.length} transactions linked to this invoice.`);

    if (transactions && transactions.length > 0) {
        transactions.forEach(t => {
            console.log(` - Tx ID: ${t.id}, Note: "${t.notes}", Layer ID: ${t.layer_id}`);
        });

        // Check if layers exist
        const layerIds = transactions.map(t => t.layer_id).filter(id => id);
        if (layerIds.length > 0) {
            const { data: layers } = await supabase.from('inventory_layers').select('id, remaining_quantity').in('id', layerIds);
            console.log(`Found ${layers?.length} layers linked to these transactions.`);
            layers?.forEach(l => console.log(`   > Layer ${l.id}: Qty ${l.remaining_quantity}`));
        }
    } else {
        console.log('WARNING: No transactions found matching the note pattern!');
        // Check if there are ANY transactions for this item around that time?
        // Maybe the note format is different?
    }
}

runTest();
