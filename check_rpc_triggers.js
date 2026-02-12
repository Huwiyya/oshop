require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTriggersAndRPC() {
    try {
        console.log('📊 Checking for atomic RPC functions and triggers...\n');

        // Check if atomic receipt/payment RPC exists
        const rpcFunctions = [
            'create_receipt_atomic',
            'create_payment_atomic',
            'delete_receipt_atomic',
            'delete_payment_atomic'
        ];

        for (const rpc of rpcFunctions) {
            try {
                const { data, error } = await supabase.rpc(rpc, {});
                console.log(`  ${rpc}: ${error ? `❌ ${error.message}` : '✅ Exists (but failed with no params)'}`);
            } catch (e) {
                console.log(`  ${rpc}: ❌ Error - ${e.message}`);
            }
        }

        // Check receipts and payments tables
        console.log('\n📋 Checking existing receipts and payments...\n');

        const { data: receipts } = await supabase.from('receipts_v2').select('*').limit(5);
        console.log(`Receipts: ${receipts?.length || 0} found`);
        if (receipts && receipts.length > 0) {
            console.log('  Sample:', receipts[0]);
        }

        const { data: payments } = await supabase.from('payments_v2').select('*').limit(5);
        console.log(`\nPayments: ${payments?.length || 0} found`);
        if (payments && payments.length > 0) {
            console.log('  Sample:', payments[0]);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkTriggersAndRPC();
