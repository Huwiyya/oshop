
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function fixOrder30() {
    console.log('🔧 FIXING ORDER OS1-030 DATA');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update order OS1-030
    // We know 50 was deducted from wallet, but order says 0 used and 100 remaining.
    // We need to set walletAmountUsed = 50, remainingAmount = 50.

    const { data: order, error } = await supabase
        .from('orders_v4')
        .select('*')
        .eq('invoiceNumber', 'test-030') // Trying 'test-030' first based on username 'test'
        .maybeSingle();

    let orderId = order?.id;

    if (!orderId) {
        // Fallback: search by invoiceNumber pattern 'OS1-030' if stored that way
        const { data: order2 } = await supabase
            .from('orders_v4')
            .select('*')
            .eq('invoiceNumber', 'OS1-030')
            .maybeSingle();
        orderId = order2?.id;
    }

    if (!orderId) {
        // Fallback: search by user 'test' latest order
        const { data: user } = await supabase.from('users_v4').select('id').eq('username', 'test').single();
        if (user) {
            const { data: order3 } = await supabase
                .from('orders_v4')
                .select('*')
                .eq('userId', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            orderId = order3?.id;
            console.log(`Found latest order for user test: ${order3?.invoiceNumber}`);
        }
    }

    if (orderId) {
        console.log(`✅ Found Order ID: ${orderId}`);

        const { error: updateError } = await supabase
            .from('orders_v4')
            .update({
                walletAmountUsed: 50,
                remainingAmount: 50
            })
            .eq('id', orderId);

        if (updateError) {
            console.error('❌ Failed to update:', updateError);
        } else {
            console.log('🎉 Order corrected successfully!');
            console.log('   walletAmountUsed: 50');
            console.log('   remainingAmount: 50');
        }
    } else {
        console.error('❌ Could not find order #OS1-030');
    }
}

fixOrder30();
