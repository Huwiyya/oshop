import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applySchema() {
    console.log('🔄 Applying Invoices Schema V2 via RPC...');
    const schemaPath = path.resolve(process.cwd(), 'src/lib/invoices-schema-v2.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    // Try exec_sql RPC
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('❌ RPC exec_sql failed:', error.message);
        console.log('\n⚠️  MANUAL ACTION REQUIRED ⚠️');
        console.log('Please copy the content of src/lib/invoices-schema-v2.sql and run it in your Supabase SQL Editor.');
    } else {
        console.log('✅ Schema applied successfully via RPC!');
    }
}

applySchema();
