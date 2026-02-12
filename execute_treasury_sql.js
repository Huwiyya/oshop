require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function executeSQLDirectly() {
    try {
        console.log('📝 Reading treasury_atomic_functions.sql...\n');

        const sqlContent = fs.readFileSync('./src/lib/treasury_atomic_functions.sql', 'utf8');

        console.log('🚀 Executing SQL via Supabase...\n');

        // Split by function definitions
        const functionBlocks = sqlContent.split(/(?=CREATE OR REPLACE FUNCTION)/g).filter(block => block.trim());

        console.log(`Found ${functionBlocks.length} SQL blocks to execute\n`);

        for (let i = 0; i < functionBlocks.length; i++) {
            const block = functionBlocks[i].trim();

            if (block.startsWith('CREATE OR REPLACE FUNCTION')) {
                // Extract function name
                const match = block.match(/CREATE OR REPLACE FUNCTION\s+(\w+)/);
                const funcName = match ? match[1] : `Function ${i + 1}`;

                console.log(`${i + 1}. Executing ${funcName}...`);

                try {
                    // Use raw SQL execution via Supabase
                    // Note: This requires a database function that can execute arbitrary SQL
                    // Since we may not have that, we'll use a different approach

                    // Alternative: Use connection string with pg library
                    const { Client } = require('pg');

                    // Construct connection string from Supabase URL
                    const dbUrl = supabaseUrl.replace('https://', '');
                    const projectRef = dbUrl.split('.')[0];

                    // For this to work, we need DATABASE_URL or construct it
                    // Let me check if DATABASE_URL exists
                    const databaseUrl = process.env.DATABASE_URL;

                    if (!databaseUrl) {
                        console.log('   ⚠️  DATABASE_URL not found in .env.local');
                        console.log('   💡 Add DATABASE_URL to .env.local with your Postgres connection string');
                        console.log('   Example: DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres');
                        return;
                    }

                    const client = new Client({
                        connectionString: databaseUrl,
                        ssl: { rejectUnauthorized: false }
                    });

                    await client.connect();
                    await client.query(block);
                    await client.end();

                    console.log(`   ✅ ${funcName} created successfully`);

                } catch (err) {
                    console.error(`   ❌ Error: ${err.message}`);
                }
            } else if (block.startsWith('GRANT')) {
                console.log(`${i + 1}. Executing GRANT statements...`);

                try {
                    const { Client } = require('pg');
                    const client = new Client({
                        connectionString: process.env.DATABASE_URL,
                        ssl: { rejectUnauthorized: false }
                    });

                    await client.connect();
                    await client.query(block);
                    await client.end();

                    console.log(`   ✅ Permissions granted`);
                } catch (err) {
                    console.error(`   ❌ Error: ${err.message}`);
                }
            }
        }

        console.log('\n✅ SQL execution completed!');
        console.log('\n🧪 Now testing if functions exist...\n');

        // Test functions
        const testFunctions = [
            'create_receipt_atomic',
            'create_payment_atomic',
            'delete_receipt_atomic',
            'delete_payment_atomic'
        ];

        for (const func of testFunctions) {
            try {
                await supabase.rpc(func, {});
            } catch (e) {
                const exists = !e.message?.includes('Could not find the function');
                console.log(`   ${func}: ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
            }
        }

        console.log('\n🎉 Done! You can now test creating receipts and payments.\n');

    } catch (error) {
        console.error('Error:', error.message);

        if (error.code === 'MODULE_NOT_FOUND' && error.message.includes('pg')) {
            console.log('\n💡 Installing pg library...');
            console.log('Run: npm install pg\n');
        }
    }
}

executeSQLDirectly();
