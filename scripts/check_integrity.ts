
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

async function checkIntegrity() {
    console.log('Checking Inventory Integrity...');

    // 1. Get all items
    const { data: items } = await supabase.from('inventory_items').select('id, name_ar');
    if (!items) return;

    for (const item of items) {
        // Get Layers
        const { data: layers } = await supabase.from('inventory_layers').select('id, quantity, created_at, unit_cost').eq('item_id', item.id);
        // Get Purchase Transactions
        const { data: transactions } = await supabase.from('inventory_transactions')
            .select('id, layer_id, quantity')
            .eq('item_id', item.id)
            .eq('transaction_type', 'purchase');

        const layerIds = new Set(layers?.map(l => l.id));
        const trxLayerIds = new Set(transactions?.map(t => t.layer_id));

        // Find orphan layers
        const orphans = layers?.filter(l => !trxLayerIds.has(l.id));

        if (orphans && orphans.length > 0) {
            console.log(`Item: ${item.name_ar} (${item.id})`);
            console.log(`- Total Layers: ${layers?.length}`);
            console.log(`- Total Purchase Transactions: ${transactions?.length}`);
            console.log(`- Orphan Layers (No Transaction):`);
            orphans.forEach(o => console.log(`  > Layer ID: ${o.id}, Qty: ${o.quantity}, Created: ${o.created_at}, Cost: ${o.unit_cost}`));
        }
    }
}

checkIntegrity();
