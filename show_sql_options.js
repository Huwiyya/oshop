require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const https = require('https');

async function executeSQLViaAPI() {
    try {
        console.log('🔧 Applying Treasury Functions via Supabase API\n');
        console.log('='.repeat(60));

        const sqlContent = fs.readFileSync('./src/lib/treasury_atomic_functions.sql', 'utf8');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
            throw new Error('Missing Supabase credentials');
        }

        // Extract project ref
        const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

        console.log(`\n📍 Project: ${projectRef}`);
        console.log(`\n1️⃣ Executing SQL via Supabase REST API...\n`);

        // Use Supabase's PostgREST /rpc endpoint to execute arbitrary SQL
        // We'll need to create a helper function first, or use direct PostgreSQL REST API

        // Alternative: Use fetch to POST SQL
        const fetch = (await import('node-fetch')).default;

        // Split into individual function CREATE statements
        const statements = sqlContent.split(/(?=CREATE OR REPLACE FUNCTION|GRANT EXECUTE)/g).filter(s => s.trim());

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();
            if (!statement) continue;

            let name = 'Unknown';
            if (statement.startsWith('CREATE OR REPLACE FUNCTION')) {
                const match = statement.match(/FUNCTION\s+(\w+)/);
                name = match ? match[1] : `Function ${i + 1}`;
            } else if (statement.startsWith('GRANT')) {
                name = 'Grant Permissions';
            }

            console.log(`   ${i + 1}. ${name}...`);

            try {
                // Use PostgREST query endpoint
                // Note: This requires the supabase REST API to support raw SQL execution
                // which typically requires a custom RPC function

                // For now, let's create a simpler approach using supabase-js with a workaround
                const { createClient } = require('@supabase/supabase-js');
                const supabase = createClient(supabaseUrl, serviceKey);

                // Try to execute via a magic SQL execution endpoint if available
                // This won't work directly, so we need a different approach

                console.log('      ⚠️  Direct SQL execution not available via API');
                console.log('      💡 Need DATABASE_URL or manual SQL execution');
                failCount++;

            } catch (err) {
                console.error(`      ❌ Error: ${err.message}`);
                failCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('\n❌ Automatic SQL execution requires DATABASE_URL\n');
        console.log('📋 Please use ONE of these methods:\n');
        console.log('METHOD 1: Add DATABASE_URL to .env.local');
        console.log(`  DATABASE_URL=postgresql://postgres:[PASSWORD]@db.${projectRef}.supabase.co:5432/postgres\n`);
        console.log('  Then run: node apply_treasury_functions.js\n');
        console.log('METHOD 2: Manual execution (RECOMMENDED)');
        console.log('  1. Open Supabase Dashboard > SQL Editor');
        console.log(`  2. Copy all content from: treasury_atomic_functions.sql`);
        console.log('  3. Paste and click "Run"\n');
        console.log('METHOD 3: Use psql command line');
        console.log(`  psql "postgresql://postgres:[PASSWORD]@db.${projectRef}.supabase.co:5432/postgres" < src/lib/treasury_atomic_functions.sql\n`);

    } catch (error) {
        console.error('Error:', error.message);
    }
}

executeSQLViaAPI();
