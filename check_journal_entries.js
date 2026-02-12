require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJournalEntries() {
    try {
        console.log('📊 Checking journal entries in database...\n');

        // Get all journal entries
        const { data: entries, error } = await supabase
            .from('journal_entries_v2')
            .select('*')
            .order('date', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Error:', error);
            return;
        }

        console.log(`Found ${entries.length} journal entries:\n`);

        // Group by source_type
        const byType = {};
        entries.forEach(entry => {
            const type = entry.source_type || 'manual';
            if (!byType[type]) byType[type] = [];
            byType[type].push(entry);
        });

        console.log('Entries by Type:');
        Object.keys(byType).forEach(type => {
            console.log(`\n  ${type}: ${byType[type].length} entries`);
            byType[type].slice(0, 3).forEach(e => {
                console.log(`    - ${e.entry_number}: ${e.description}`);
                console.log(`      Date: ${e.date}, Amount: ${e.total_debit}`);
            });
        });

        // Check for specific types
        const hasReceipts = entries.some(e => e.source_type === 'receipt' || e.description?.includes('قبض'));
        const hasPayments = entries.some(e => e.source_type === 'payment' || e.description?.includes('صرف'));
        const hasPurchases = entries.some(e => e.source_type === 'purchase_invoice' || e.description?.includes('مشتريات'));
        const hasSales = entries.some(e => e.source_type === 'sales_invoice' || e.description?.includes('مبيعات'));

        console.log('\n\n✅ Transaction Type Coverage:');
        console.log(`  Receipts: ${hasReceipts ? '✅ Found' : '❌ Missing'}`);
        console.log(`  Payments: ${hasPayments ? '✅ Found' : '❌ Missing'}`);
        console.log(`  Purchases: ${hasPurchases ? '✅ Found' : '❌ Missing'}`);
        console.log(`  Sales: ${hasSales ? '✅ Found' : '❌ Missing'}`);

    } catch (error) {
        console.error('Error:', error);
    }
}

checkJournalEntries();
