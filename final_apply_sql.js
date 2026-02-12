require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

async function executeViaSupabaseRPC() {
    try {
        console.log('🔧 Applying Treasury Functions via Supabase\n');
        console.log('='.repeat(60));

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        const supabase = createClient(supabaseUrl, serviceKey);

        // Read the SQL file
        const sqlContent = fs.readFileSync('./src/lib/treasury_atomic_functions.sql', 'utf8');

        console.log('\n1️⃣ Preparing to execute SQL functions...\n');

        // Split into separate function blocks
        const blocks = sqlContent.split(/(?=CREATE OR REPLACE FUNCTION|GRANT EXECUTE)/g).filter(b => b.trim());

        console.log(`Found ${blocks.length} SQL blocks\n`);

        // Try to execute each block
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i].trim();
            if (!block) continue;

            let name = 'Unknown';
            if (block.startsWith('CREATE OR REPLACE FUNCTION')) {
                const match = block.match(/FUNCTION\s+(\w+)/);
                name = match ? match[1] : `Function ${i + 1}`;
            } else if (block.startsWith('GRANT')) {
                name = 'Grant Permissions';
            }

            console.log(`${i + 1}. ${name}...`);

            try {
                // Use Supabase's direct SQL execution via edge function or management API
                // Since we don't have direct SQL execution, we need to use psql or manual method

                console.log('   ⚠️  Cannot execute via API - manual method required');
                errorCount++;

            } catch (err) {
                console.error(`   ❌ Error: ${err.message}`);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('\n💡 RECOMMENDED METHOD:\n');
        console.log('Since automatic execution isn\'t possible, please:');
        console.log('\n1. Open Supabase Dashboard');
        console.log('2. Go to SQL Editor');
        console.log('3. Copy the ENTIRE content of treasury_atomic_functions.sql');
        console.log('4. Paste into SQL Editor');
        console.log('5. Click "Run" button\n');
        console.log('File location: src/lib/treasury_atomic_functions.sql\n');

        // Show a preview of what needs to be executed
        console.log('📄 Preview of SQL (first 500 chars):');
        console.log('-'.repeat(60));
        console.log(sqlContent.substring(0, 500) + '...\n');

    } catch (error) {
        console.error('Error:', error.message);
    }
}

executeViaSupabaseRPC();
