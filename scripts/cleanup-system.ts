import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupSystem() {
    console.log('🧹 STARTING SYSTEM CLEANUP');
    console.log('═'.repeat(80));

    // 1. Remove duplicate cash_dollar card
    console.log('\n📌 Step 1: Removing duplicate treasury card...');

    const { data: cashDollarCard } = await supabase
        .from('treasury_cards_v4')
        .select('*')
        .eq('type', 'cash_dollar')
        .single();

    if (cashDollarCard) {
        console.log(`   Found card: ${cashDollarCard.name} (${cashDollarCard.type})`);
        console.log(`   Balance: ${cashDollarCard.balance} ${cashDollarCard.currency}`);

        if (cashDollarCard.balance === 0) {
            // Check if there are any transactions
            const { data: transactions } = await supabase
                .from('treasury_transactions_v4')
                .select('*')
                .eq('cardId', cashDollarCard.id);

            if (!transactions || transactions.length === 0) {
                console.log('   ✅ Safe to delete (no balance, no transactions)');

                const { error } = await supabase
                    .from('treasury_cards_v4')
                    .delete()
                    .eq('id', cashDollarCard.id);

                if (error) {
                    console.error('   ❌ Failed to delete:', error);
                } else {
                    console.log('   ✅ Successfully deleted duplicate card!');
                }
            } else {
                console.log(`   ⚠️  Card has ${transactions.length} transactions - keeping it for history`);
            }
        } else {
            console.log(`   ⚠️  Card has balance (${cashDollarCard.balance}) - not deleting`);
        }
    } else {
        console.log('   ℹ️  No cash_dollar card found (might already be deleted)');
    }

    // 2. Check orphaned transaction
    console.log('\n📌 Step 2: Checking orphaned transactions...');

    const { data: allTreasuryTx } = await supabase
        .from('treasury_transactions_v4')
        .select('*')
        .not('relatedOrderId', 'is', null);

    if (allTreasuryTx) {
        let orphaned = [];

        for (const tx of allTreasuryTx) {
            const { data: order } = await supabase
                .from('orders_v4')
                .select('id')
                .eq('id', tx.relatedOrderId)
                .single();

            if (!order) {
                orphaned.push(tx);
            }
        }

        console.log(`   Found ${orphaned.length} orphaned transaction(s)`);

        if (orphaned.length > 0) {
            console.log('\n   Orphaned Transactions:');
            for (const tx of orphaned) {
                console.log(`   - ID: ${tx.id}`);
                console.log(`     Amount: ${tx.amount}`);
                console.log(`     Type: ${tx.type}`);
                console.log(`     Description: ${tx.description}`);
                console.log(`     Related Order ID: ${tx.relatedOrderId} (deleted)`);
                console.log(`     Created: ${tx.created_at}`);

                // Add a note to clarify this is from a deleted order
                const updatedDescription = tx.description + ' [Deleted Order]';

                const { error } = await supabase
                    .from('treasury_transactions_v4')
                    .update({
                        description: updatedDescription,
                        relatedOrderId: null  // Clear the orphaned reference
                    })
                    .eq('id', tx.id);

                if (error) {
                    console.log(`     ❌ Failed to update: ${error.message}`);
                } else {
                    console.log(`     ✅ Updated with note`);
                }
            }
        }
    }

    // 3. Verify final state
    console.log('\n📌 Step 3: Verifying final state...');

    const { data: treasuryCards } = await supabase
        .from('treasury_cards_v4')
        .select('*');

    console.log('\n   Final Treasury Cards:');
    for (const card of treasuryCards || []) {
        console.log(`   ✅ ${card.name} (${card.type}) - ${card.balance.toFixed(2)} ${card.currency}`);
    }

    console.log('\n═'.repeat(80));
    console.log('✅ CLEANUP COMPLETE!');
}

cleanupSystem().then(() => {
    console.log('\n✨ All done!');
    process.exit(0);
}).catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
