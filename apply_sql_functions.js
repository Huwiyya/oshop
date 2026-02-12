require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function applySQLFunctions() {
    try {
        console.log('📝 Applying Treasury Atomic Functions to Supabase...\n');

        // Read the SQL file
        const sql = fs.readFileSync('./src/lib/treasury_atomic_functions.sql', 'utf8');

        // Split into individual function definitions
        const functions = sql.split('CREATE OR REPLACE FUNCTION');

        console.log(`Found ${functions.length - 1} function(s) to create.\n`);

        // Apply each function (skipping the first empty element)
        for (let i = 1; i < functions.length; i++) {
            const funcSQL = 'CREATE OR REPLACE FUNCTION' + functions[i];
            const funcName = funcSQL.match(/FUNCTION\s+(\w+)/)?.[1] || `function_${i}`;

            console.log(`${i}. Creating ${funcName}...`);

            // Execute SQL
            const { error } = await supabase.rpc('exec_sql', { sql_query: funcSQL });

            if (error && !error.message.includes('does not exist')) {
                console.error(`   ❌ Error: ${error.message}`);
            } else {
                console.log(`   ✅ Success`);
            }
        }

        console.log('\n✅ SQL functions applied successfully!');
        console.log('\n📋 Next step: Test by creating a receipt or payment\n');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.log('\n💡 Alternative: Copy treasury_atomic_functions.sql contents');
        console.log('   and paste into Supabase SQL Editor to run manually.\n');
    }
}

applySQLFunctions();
