require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function applySQL() {
    try {
        console.log('📝 Reading SQL file...\n');

        const sql = fs.readFileSync('./src/lib/treasury_atomic_functions.sql', 'utf8');

        console.log('🚀 Applying SQL functions to database...\n');
        console.log('Please copy the SQL from treasury_atomic_functions.sql');
        console.log('and run it in your Supabase SQL Editor.\n');
        console.log('Or use psql/pgAdmin to execute it directly.\n');

        console.log('File location: /Users/zaki/Downloads/Oshop-main/src/lib/treasury_atomic_functions.sql');

        console.log('\n✅ After applying SQL, test by creating a receipt or payment!');

    } catch (error) {
        console.error('Error:', error);
    }
}

applySQL();
