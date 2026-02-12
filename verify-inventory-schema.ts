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

async function verifyInventorySchema() {
    console.log('🔍 Verifying Inventory Schema V2...');

    const { error: prodError } = await supabase.from('products_v2').select('id').limit(1);
    const { error: layerError } = await supabase.from('inventory_layers_v2').select('id').limit(1);

    if (prodError || layerError) {
        if (prodError?.message.includes('does not exist') || layerError?.message.includes('does not exist')) {
            console.error('❌ Inventory tables do not exist yet.');
            console.log('⚠️  Please run the SQL from src/lib/inventory-schema-v2.sql in your Supabase SQL Editor.');
            process.exit(1);
        } else {
            console.error('❌ Unexpected error verifying schema:', prodError || layerError);
        }
    } else {
        console.log('✅ Inventory Schema V2 verified! Tables exist.');
    }
}

verifyInventorySchema();
