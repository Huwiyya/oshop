import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findMoney() {
    console.log('💰 Searching for $60...\n');
    console.log('═'.repeat(80));

    // 1. Check ALL Treasury Cards
    console.log('\n📊 TREASURY CARDS:');
    console.log('─'.repeat(80));

    const { data: treasuryCards } = await supabase
        .from('treasury_cards_v4')
        .select('*')
        .order('balance', { ascending: false });

    let totalTreasuryBalance = 0;
    for (const card of treasuryCards || []) {
        console.log(`\n💳 ${card.name} (${card.type})`);
        console.log(`   Balance: ${card.balance.toFixed(2)} ${card.currency}`);

        if (card.currency === 'USD') {
            totalTreasuryBalance += card.balance;
        }

        // Get transactions for this card
        const { data: txs } = await supabase
            .from('treasury_transactions_v4')
            .select('*')
            .eq('cardId', card.id);

        const calculatedBalance = (txs || []).reduce((sum, tx) => {
            return sum + (tx.type === 'deposit' ? tx.amount : -tx.amount);
        }, 0);

        console.log(`   Calculated from transactions: ${calculatedBalance.toFixed(2)}`);
        console.log(`   Transaction count: ${(txs || []).length}`);

        if (Math.abs(card.balance - calculatedBalance) > 0.01) {
            console.log(`   ⚠️  MISMATCH DETECTED!`);
        }
    }

    console.log(`\n💵 Total Treasury USD: $${totalTreasuryBalance.toFixed(2)}`);

    // 2. Check ALL Shein Cards
    console.log('\n\n🎴 SHEIN CARDS:');
    console.log('─'.repeat(80));

    const { data: sheinCards } = await supabase
        .from('shein_cards_v4')
        .select('*')
        .order('remainingValue', { ascending: false });

    let totalSheinBalance = 0;
    for (const card of sheinCards || []) {
        const remaining = card.remainingValue ?? card.value;
        totalSheinBalance += remaining;

        if (remaining > 0) {
            console.log(`\n🎴 ${card.code}`);
            console.log(`   Status: ${card.status}`);
            console.log(`   Original Value: $${card.value.toFixed(2)}`);
            console.log(`   Remaining: $${remaining.toFixed(2)}`);

            if (remaining >= 59 && remaining <= 61) {
                console.log(`   🎯 THIS COULD BE THE $60!`);
            }
        }
    }

    console.log(`\n💵 Total Shein Cards Balance: $${totalSheinBalance.toFixed(2)}`);

    // 3. Summary
    console.log('\n\n📌 SUMMARY:');
    console.log('═'.repeat(80));
    console.log(`Total USD in Treasury Cards: $${totalTreasuryBalance.toFixed(2)}`);
    console.log(`Total USD in Shein Cards: $${totalSheinBalance.toFixed(2)}`);
    console.log(`Grand Total: $${(totalTreasuryBalance + totalSheinBalance).toFixed(2)}`);

    if (totalTreasuryBalance >= 59 && totalTreasuryBalance <= 61) {
        console.log(`\n✅ Found $60 in Treasury Cards!`);
    } else if (totalSheinBalance >= 59 && totalSheinBalance <= 61) {
        console.log(`\n✅ Found $60 in Shein Cards!`);
    } else {
        console.log(`\n❓ $60 not found in expected range. Actual total: $${(totalTreasuryBalance + totalSheinBalance).toFixed(2)}`);
    }
}

findMoney().then(() => {
    console.log('\n✅ Search complete!');
    process.exit(0);
}).catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
