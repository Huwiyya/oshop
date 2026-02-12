import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTreasuryBalance() {
    console.log('🔍 Checking Treasury Cards...\n');

    // 1. Get all treasury cards
    const { data: cards, error: cardsError } = await supabase
        .from('treasury_cards_v4')
        .select('*')
        .order('name');

    if (cardsError) {
        console.error('❌ Error fetching treasury cards:', cardsError);
        return;
    }

    console.log('📊 Treasury Cards:');
    console.log('═'.repeat(80));
    for (const card of cards || []) {
        console.log(`\n💳 ${card.name} (${card.type})`);
        console.log(`   ID: ${card.id}`);
        console.log(`   Balance (stored): ${card.balance} ${card.currency}`);

        // Get transactions for this card
        const { data: transactions, error: txError } = await supabase
            .from('treasury_transactions_v4')
            .select('*')
            .eq('cardId', card.id)
            .order('created_at', { ascending: false });

        if (!txError && transactions) {
            const calculatedBalance = transactions.reduce((sum, tx) => {
                return sum + (tx.type === 'deposit' ? tx.amount : -tx.amount);
            }, 0);

            console.log(`   Balance (calculated): ${calculatedBalance.toFixed(2)} ${card.currency}`);
            console.log(`   Transaction count: ${transactions.length}`);

            if (Math.abs(card.balance - calculatedBalance) > 0.01) {
                console.log(`   ⚠️  MISMATCH! Stored: ${card.balance}, Calculated: ${calculatedBalance.toFixed(2)}`);
            } else {
                console.log(`   ✅ Balance matches!`);
            }

            // Show last 5 transactions
            if (transactions.length > 0) {
                console.log(`\n   Last ${Math.min(5, transactions.length)} transactions:`);
                for (const tx of transactions.slice(0, 5)) {
                    const sign = tx.type === 'deposit' ? '+' : '-';
                    console.log(`   ${sign}${tx.amount.toFixed(2)} - ${tx.description} (${new Date(tx.created_at).toLocaleString()})`);
                }
            }
        }
    }

    console.log('\n' + '═'.repeat(80));

    // Specific check for USDT card
    console.log('\n🎯 Checking USDT Card specifically (cash_dollar type):\n');
    const { data: usdtCard } = await supabase
        .from('treasury_cards_v4')
        .select('id, name, type, balance, currency')
        .eq('type', 'cash_dollar')
        .single();

    if (usdtCard) {
        console.log('Found:', usdtCard);
    } else {
        console.log('❌ No card with type "cash_dollar" found!');
        console.log('Checking for "usdt_treasury" type...');

        const { data: usdtCard2 } = await supabase
            .from('treasury_cards_v4')
            .select('id, name, type, balance, currency')
            .eq('type', 'usdt_treasury')
            .single();

        if (usdtCard2) {
            console.log('Found:', usdtCard2);
        } else {
            console.log('❌ No card with type "usdt_treasury" found either!');
        }
    }
}

checkTreasuryBalance().then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
}).catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
