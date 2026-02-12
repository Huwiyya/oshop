require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { Client } = require('pg');

async function applyTreasuryFunctions() {
    try {
        console.log('🔧 Applying Treasury Atomic Functions to Database\n');
        console.log('='.repeat(60));

        // Read SQL file
        const sqlContent = fs.readFileSync('./src/lib/treasury_atomic_functions.sql', 'utf8');

        // Get Supabase credentials
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
            throw new Error('Missing SUPABASE credentials in .env.local');
        }

        // Extract project reference from URL
        const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

        // Check for DATABASE_URL or construct it
        let connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
            console.log('\n⚠️  DATABASE_URL not found in .env.local');
            console.log('\n📋 To apply SQL automatically, add this to your .env.local:');
            console.log(`DATABASE_URL=postgresql://postgres:[YOUR_DB_PASSWORD]@db.${projectRef}.supabase.co:5432/postgres\n`);
            console.log('Or apply SQL manually by:');
            console.log('1. Open Supabase SQL Editor');
            console.log('2. Copy contents of treasury_atomic_functions.sql');
            console.log('3. Paste and run in SQL Editor\n');
            return;
        }

        console.log('\n1️⃣ Connecting to database...');
        const client = new Client({
            connectionString,
            ssl: { rejectUnauthorized: false }
        });

        await client.connect();
        console.log('   ✅ Connected!\n');

        // Split SQL into individual statements
        console.log('2️⃣ Executing SQL functions...\n');

        const statements = sqlContent
            .split(/(?=CREATE OR REPLACE FUNCTION|GRANT EXECUTE)/g)
            .filter(s => s.trim());

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();

            if (!statement) continue;

            // Extract function name or statement type
            let name = 'Unknown';
            if (statement.startsWith('CREATE OR REPLACE FUNCTION')) {
                const match = statement.match(/FUNCTION\s+(\w+)/);
                name = match ? match[1] : `Function ${i + 1}`;
            } else if (statement.startsWith('GRANT')) {
                name = 'Permissions';
            }

            console.log(`   ${i + 1}. ${name}...`);

            try {
                await client.query(statement);
                console.log(`      ✅ Success`);
                successCount++;
            } catch (err) {
                console.error(`      ❌ Error: ${err.message}`);
                errorCount++;
            }
        }

        await client.end();

        console.log('\n' + '='.repeat(60));
        console.log(`\n📊 Results: ${successCount} successful, ${errorCount} errors\n`);

        if (successCount > 0) {
            console.log('✅ Treasury atomic functions have been applied!\n');
            console.log('🧪 Next: Test by creating a receipt or payment\n');
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

applyTreasuryFunctions();
