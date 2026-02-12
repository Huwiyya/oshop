require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testReceiptPaymentIntegration() {
    try {
        console.log('🧪 Testing Receipt and Payment Journal Integration\n');
        console.log('='.repeat(60));

        // 1. Check if RPC functions exist
        console.log('\n1️⃣ Checking RPC Functions...\n');

        const rpcTests = [
            'create_receipt_atomic',
            'create_payment_atomic',
            'delete_receipt_atomic',
            'delete_payment_atomic'
        ];

        for (const rpc of rpcTests) {
            try {
                // Try calling with empty params to see if function exists
                await supabase.rpc(rpc, {});
            } catch (e) {
                const exists = !e.message?.includes('Could not find the function');
                console.log(`   ${rpc}: ${exists ? '✅ Exists' : '❌ Missing'}`);
            }
        }

        // 2. Get current counts
        console.log('\n2️⃣ Current Database State...\n');

        const { data: receipts } = await supabase.from('receipts_v2').select('*');
        const { data: payments } = await supabase.from('payments_v2').select('*');
        const { data: journals } = await supabase.from('journal_entries_v2').select('*');

        console.log(`   Receipts: ${receipts?.length || 0}`);
        console.log(`   Payments: ${payments?.length || 0}`);
        console.log(`   Journal Entries: ${journals?.length || 0}`);

        // 3. Check journal entries by source type
        console.log('\n3️⃣ Journal Entries by Source Type...\n');

        const byType = {};
        (journals || []).forEach(j => {
            const type = j.source_type || 'manual';
            byType[type] = (byType[type] || 0) + 1;
        });

        Object.keys(byType).forEach(type => {
            console.log(`   ${type}: ${byType[type]}`);
        });

        // 4. Check if receipts/payments have journal_entry_id
        console.log('\n4️⃣ Checking Journal Entry Linkage...\n');

        const receiptWithJournal = receipts?.filter(r => r.journal_entry_id)?.length || 0;
        const paymentWithJournal = payments?.filter(p => p.journal_entry_id)?.length || 0;

        console.log(`   Receipts with journal_entry_id: ${receiptWithJournal}/${receipts?.length || 0}`);
        console.log(`   Payments with journal_entry_id: ${paymentWithJournal}/${payments?.length || 0}`);

        // 5. Status Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 Integration Status:\n');

        const receiptJournals = journals?.filter(j => j.source_type === 'receipt')?.length || 0;
        const paymentJournals = journals?.filter(j => j.source_type === 'payment')?.length || 0;

        console.log(`   ✅ Receipt Journal Entries: ${receiptJournals}`);
        console.log(`   ✅ Payment Journal Entries: ${paymentJournals}`);
        console.log(`   ✅ Purchase Invoice Entries: ${byType['purchase_invoice'] || 0}`);
        console.log(`   ✅ Sales Invoice Entries: ${byType['sales_invoice'] || 0}`);

        if (receiptJournals > 0 && paymentJournals > 0) {
            console.log('\n🎉 SUCCESS! All transaction types are creating journal entries!\n');
        } else {
            console.log('\n⚠️  Need to create test transactions to verify integration.\n');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testReceiptPaymentIntegration();
