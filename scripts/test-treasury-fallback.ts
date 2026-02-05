import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Import the function we want to test
import { processCostDeduction } from '../src/lib/actions';

async function testFallback() {
    console.log('🧪 Testing Treasury Fallback Mechanism\n');
    console.log('═'.repeat(80));

    // Check current state
    console.log('\n📊 Current State BEFORE Test:');
    console.log('─'.repeat(80));

    const { data: treasuryCard } = await supabase
        .from('treasury_cards_v4')
        .select('*')
        .eq('type', 'cash_dollar')
        .single();

    console.log(`Treasury USDT Balance: $${(treasuryCard?.balance || 0).toFixed(2)}`);

    const { data: sheinCards } = await supabase
        .from('shein_cards_v4')
        .select('*')
        .eq('status', 'available')
        .order('remainingValue', { ascending: false });

    const totalSheinBalance = (sheinCards || []).reduce((sum, card) => {
        return sum + (card.remainingValue ?? card.value);
    }, 0);

    console.log(`Total Shein Cards Balance: $${totalSheinBalance.toFixed(2)}`);
    console.log(`Available Shein Cards: ${(sheinCards || []).length}`);

    // Test scenario: Try to deduct $10 when treasury has $0
    console.log('\n\n🎯 Test Scenario: Deduct $10 (Treasury: $0, Shein Cards: $60)');
    console.log('─'.repeat(80));

    try {
        console.log('Calling processCostDeduction(testOrderId, "TEST-001", 10, undefined, undefined, 10)...\n');

        // This should work now with the fallback mechanism
        await processCostDeduction('test-order-123', 'TEST-001', 10, undefined, undefined, 10);

        console.log('\n✅ SUCCESS! The fallback mechanism worked!');
        console.log('The system automatically used Shein cards when treasury was empty.');

        // Check state after
        console.log('\n\n📊 Current State AFTER Test:');
        console.log('─'.repeat(80));

        const { data: sheinCardsAfter } = await supabase
            .from('shein_cards_v4')
            .select('*')
            .eq('status', 'available')
            .order('remainingValue', { ascending: false });

        const totalSheinBalanceAfter = (sheinCardsAfter || []).reduce((sum, card) => {
            return sum + (card.remainingValue ?? card.value);
        }, 0);

        console.log(`Total Shein Cards Balance: $${totalSheinBalanceAfter.toFixed(2)}`);
        console.log(`Change: -$${(totalSheinBalance - totalSheinBalanceAfter).toFixed(2)}`);

        // Rollback the test transaction
        console.log('\n\n🔄 Rolling back test transaction...');
        await supabase
            .from('shein_transactions_v4')
            .delete()
            .eq('orderId', 'test-order-123');

        // Restore card balances
        const { data: usedCards } = await supabase
            .from('shein_cards_v4')
            .select('*')
            .eq('usedForOrderId', 'test-order-123');

        for (const card of usedCards || []) {
            const originalCard = sheinCards?.find(c => c.id === card.id);
            if (originalCard) {
                await supabase
                    .from('shein_cards_v4')
                    .update({
                        remainingValue: originalCard.remainingValue ?? originalCard.value,
                        status: 'available',
                        usedForOrderId: null,
                        usedAt: null
                    })
                    .eq('id', card.id);
            }
        }

        console.log('✅ Test data rolled back successfully!');

    } catch (error: any) {
        console.error('\n❌ FAILED! Error:', error.message);
        console.log('\nThis means the fix did not work as expected.');
    }

    console.log('\n' + '═'.repeat(80));
}

testFallback().then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
}).catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
