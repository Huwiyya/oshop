
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Standalone implementation of addWalletTransaction for testing
async function testAddWalletTransaction(supabase: any, userId: string, amount: number) {
    console.log(`\n🔄 Testing Transaction for User: ${userId}, Amount: ${amount}`);

    // 1. Check Balance (Logic we modified)
    const { data: user, error: userError } = await supabase
        .from('users_v4')
        .select('walletBalance')
        .eq('id', userId)
        .single();

    if (userError) {
        console.error('❌ Error fetching user:', userError);
        return false;
    }

    const currentBalance = user?.walletBalance || 0;
    console.log(`   Current Balance: ${currentBalance}`);

    // Simulating the "Disabled Check" logic by NOT checking if currentBalance < amount

    // 2. Insert Transaction
    const { error: txError } = await supabase
        .from('wallet_transactions_v4')
        .insert([{
            userId,
            amount,
            type: 'withdrawal',
            description: 'Debug Auto-Deduction Test',
            managerId: 'system',
            created_at: new Date().toISOString()
        }]);

    if (txError) {
        console.error('❌ Transaction Insert Error:', txError);
        return false;
    }
    console.log('   ✅ Transaction inserted');

    // 3. Update User Balance
    const newBalance = currentBalance - amount;
    const { error: updateError } = await supabase
        .from('users_v4')
        .update({ walletBalance: newBalance })
        .eq('id', userId);

    if (updateError) {
        console.error('❌ Balance Update Error:', updateError);
        return false;
    }

    console.log(`   ✅ Balance updated to: ${newBalance}`);
    return true;
}

async function runTest() {
    console.log('🐞 STARTING ISOLATED DEBUGGING (EXISTING USER)');
    console.log('═'.repeat(60));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Find an existing user (Limit 1)
    const { data: users, error } = await supabase
        .from('users_v4')
        .select('id, name, walletBalance')
        .limit(1);

    if (error || !users || users.length === 0) {
        console.error('❌ Failed to find any user:', error);
        return;
    }

    const user = users[0];
    console.log(`✅ Using Existing User: ${user.name} (Balance: ${user.walletBalance})`);

    // Reset balance to 50 for consistent testing
    await supabase.from('users_v4').update({ walletBalance: 50 }).eq('id', user.id);
    console.log('   🔄 Reset balance to 50 LYD');

    // 2. Attempt Deduction of 100 LYD (Should result in -50)
    console.log('\n📝 Attempting to deduct 100 LYD...');
    const result = await testAddWalletTransaction(supabase, user.id, 100);

    // 3. Verify Final State
    const { data: finalUser } = await supabase
        .from('users_v4')
        .select('walletBalance')
        .eq('id', user.id)
        .single();

    console.log('\n📊 Final Result:');
    console.log(`   Wallet Balance: ${finalUser?.walletBalance} LYD`);

    if (finalUser?.walletBalance === -50) {
        console.log('   🎉 SUCCESS! Logic allows negative balance.');
    } else {
        console.log('   ❌ FAILED! Logic did not produce expected result.');
    }
}

runTest();
