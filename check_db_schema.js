
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log('🔍 Fetching Schema Information...\n');

    const tablesToCheck = [
        'journal_entries_v2',
        'receipts_v2',
        'payments_v2',
        'receipt_lines_v2',
        'payment_lines_v2',
        'journal_entry_lines_v2'
    ];

    for (const table of tablesToCheck) {
        console.log(`\n📋 Table: ${table}`);
        console.log('-'.repeat(50));

        // We can't query information_schema directly via supabase-js client standard query builder easily
        // but we can try to select * limit 1 to see keys, which gives us columns but not types.
        // However, to get types we really need SQL access.

        // Let's try to use the rpc 'get_columns' if it exists, or just inspect the structure by grabbing a row
        // If we can't get types, we at least Validated column names.

        const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1);

        if (error) {
            console.log(`❌ Error fetching ${table}:`, error.message);
        } else if (data && data.length > 0) {
            const keys = Object.keys(data[0]);
            console.log('✅ Columns found:', keys.join(', '));

            // Check specific critical columns
            if (table === 'journal_entries_v2') {
                console.log('   Checking specific columns:');
                console.log(`   - reference_id: ${keys.includes('reference_id') ? '✅ Exists' : '❌ MISSING'}`);
                console.log(`   - reference_type: ${keys.includes('reference_type') ? '✅ Exists' : '❌ MISSING'}`);
                console.log(`   - entry_number: ${keys.includes('entry_number') ? '✅ Exists' : '❌ MISSING'}`);
            }
        } else {
            console.log('⚠️  Table seems empty or accessible but no rows returned to infer schema.');
            // If empty, we can't infer columns via select. 
        }
    }
}

checkSchema();
