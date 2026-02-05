
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkOrderDetails() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the specific order shown in the screenshot #OS1-030
    const { data: order, error } = await supabase
        .from('orders_v4')
        .select('*')
        .eq('invoiceNumber', 'test-030') // Assuming format based on screenshot
        // If not sure about exact ID, let's search by user
        .maybeSingle();

    if (!order) {
        // Fallback: search recent orders
        console.log('Searching for recent orders for user "test"...');
        const { data: orders } = await supabase
            .from('orders_v4')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);

        if (orders && orders[0]) {
            console.log('Latest Order Found:', orders[0].invoiceNumber);
            printOrder(orders[0]);
        } else {
            console.log('No orders found.');
        }
    } else {
        printOrder(order);
    }
}

function printOrder(order: any) {
    console.log('═'.repeat(50));
    console.log(`🆔 Invoice: ${order.invoiceNumber}`);
    console.log(`💵 Selling Price (Total): ${order.sellingPriceLYD}`);
    console.log(`🧧 Wallet Payment Amount: ${order.walletPaymentAmount}`);
    console.log(`📉 Remaining Amount (Debt): ${order.remainingAmount}`);
    console.log(`💰 Collected Amount: ${order.collectedAmount}`);
    console.log('═'.repeat(50));

    // Check math
    const expectedRemaining = order.sellingPriceLYD - (order.walletPaymentAmount || 0) - (order.collectedAmount || 0);
    console.log(`🧮 Calculated Remaining Should Be: ${expectedRemaining}`);

    if (order.remainingAmount !== expectedRemaining) {
        console.log('❌ MISMATCH DETECTED!');
    } else {
        console.log('✅ Math is correct in DB.');
    }
}

checkOrderDetails();
