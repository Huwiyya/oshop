
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

async function fixIntegrity() {
    console.log('Fixing Inventory Integrity...');

    // 1. Get all items
    const { data: items } = await supabase.from('inventory_items').select('id, name_ar');
    if (!items) return;

    for (const item of items) {
        // Get Layers
        const { data: layers } = await supabase.from('inventory_layers').select('*').eq('item_id', item.id);
        // Get Purchase Transactions
        const { data: transactions } = await supabase.from('inventory_transactions')
            .select('id, layer_id')
            .eq('item_id', item.id)
            .eq('transaction_type', 'purchase');

        const trxLayerIds = new Set(transactions?.map(t => t.layer_id));
        const orphans = layers?.filter(l => !trxLayerIds.has(l.id));

        if (orphans && orphans.length > 0) {
            console.log(`Fixing Orphans for ${item.name_ar}...`);

            for (const layer of orphans) {
                console.log(`  > Creating transaction for Layer ${layer.id}`);

                await supabase.from('inventory_transactions').insert({
                    item_id: item.id,
                    transaction_type: 'purchase',
                    transaction_date: layer.purchase_date,
                    quantity: layer.quantity, // Use original quantity
                    unit_cost: layer.unit_cost,
                    total_cost: layer.quantity * layer.unit_cost,
                    layer_id: layer.id,
                    notes: 'إصلاح تلقائي: إضافة رصيد مفقود'
                });
            }
            console.log('  Done.');
        }
    }
}

fixIntegrity();
