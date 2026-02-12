import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchema() {
    console.log('🔍 Verifying Invoices Schema V2...');

    // Attempt to select from the new tables
    const { error: salesError } = await supabase.from('sales_invoices_v2').select('id').limit(1);
    const { error: purchaseError } = await supabase.from('purchase_invoices_v2').select('id').limit(1);

    if (salesError || purchaseError) {
        if (salesError?.message.includes('does not exist') || purchaseError?.message.includes('does not exist')) {
            console.error('❌ Schema tables do not exist yet.');
            console.log('⚠️  Please run the SQL from src/lib/invoices-schema-v2.sql in your Supabase SQL Editor.');
            process.exit(1);
        } else {
            console.error('❌ Unexpected error verifying schema:', salesError || purchaseError);
            // It might be RLS or something else, but if it exists, RLS usually returns empty data or specific error, not 404
        }
    } else {
        console.log('✅ Invoices Schema V2 verified! Tables exist.');
    }
}

verifySchema();
