
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { addOrder, addWalletTransaction, getUserWalletBalance } from '../src/lib/actions';

dotenv.config({ path: '.env.local' });

// Mock supabaseAdmin for the script context if needed, but since we import actions, 
// we depend on how actions.ts initializes supabase. 
// Note: actions.ts likely uses process.env vars directly.

async function debugAutoDeduction() {
    console.log('🐞 STARTING AUTO-DEDUCTION DEBUGGING');
    console.log('═'.repeat(60));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Create a Test User
    const testEmail = `debug_${Date.now()}@test.com`;
    const { data: user, error: userError } = await supabase
        .from('users_v4')
        .insert({
            name: 'Debug User',
            username: `debug_user_${Date.now()}`,
            phone: '0000000000',
            email: testEmail,
            role: 'client',
            walletBalance: 0,
            orderCounter: 0
        })
        .select()
        .single();

    if (userError || !user) {
        console.error('❌ Failed to create test user:', userError);
        return;
    }
    console.log(`✅ Test User Created: ${user.name} (ID: ${user.id})`);

    // 2. Add 50 LYD to Wallet
    await addWalletTransaction(user.id, 50, 'deposit', 'Initial Deposit', 'system', 'cash');
    const balanceAfterDeposit = await getUserWalletBalance(user.id);
    console.log(`💰 Balance after deposit: ${balanceAfterDeposit} LYD (Expected: 50)`);

    // 3. Create an Order for 100 LYD
    // We expect: Wallet to go to -50, and order remaining amount to be 50.
    console.log('\n📝 Creating Order (Cost: 100 LYD)...');

    // Construct minimal valid order data
    const orderData = {
        userId: user.id,
        customerName: user.name,
        customerPhone: user.phone,
        items: [],
        sellingPriceLYD: 100, // Total Cost
        productLinks: 'http://test.com',
        remainingAmount: 100, // Usually calculated, but passed here
        status: 'pending',
        managerId: 'system',
        purchasePriceUSD: 0,
        exchangeRate: 5,
        customerAddress: 'Tripoli',
        paymentMethod: 'cash', // Even if cash, wallet should deduct first
    };

    try {
        const newOrder = await addOrder(orderData as any);

        if (newOrder) {
            console.log(`\n✅ Order Created: #${newOrder.invoiceNumber}`);

            // 4. Check Final State
            const finalBalance = await getUserWalletBalance(user.id);
            console.log(`\n📊 Final Results:`);
            console.log(`   Wallet Balance: ${finalBalance} LYD (Expected: -50 if working, 0 if Option 2, 50 if failed)`);
            console.log(`   Order Wallet Payment: ${newOrder.walletPaymentAmount} LYD (Expected: 50)`);
            console.log(`   Order Remaining: ${newOrder.remainingAmount} LYD (Expected: 50)`);

            // Fetch actual order from DB to be sure
            const { data: dbOrder } = await supabase
                .from('orders_v4')
                .select('*')
                .eq('id', newOrder.id)
                .single();

            console.log(`   DB Order Remaining: ${dbOrder.remainingAmount}`);

        } else {
            console.error('❌ Failed to create order (returned null)');
        }

    } catch (e) {
        console.error('❌ Exception during addOrder:', e);
    }

    // Cleanup (Optional)
    // await supabase.from('users_v4').delete().eq('id', user.id);
}

debugAutoDeduction();
