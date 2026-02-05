import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function checkSchema() {
    console.log('🔵 Getting orders_v4 schema...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // Get one order to see its structure
        const { data: orders, error } = await supabase
            .from('orders_v4')
            .select('*')
            .limit(1);

        if (error) {
            console.error('❌ Error:', error);
            return;
        }

        if (orders && orders.length > 0) {
            console.log('\n✅ Sample order columns:');
            console.log(Object.keys(orders[0]).sort().join('\n'));
            console.log('\n📋 Full sample order:');
            console.log(JSON.stringify(orders[0], null, 2));
        } else {
            console.log('⚠️ No orders found in database');
        }

    } catch (err) {
        console.error('❌ Error:', err);
    }
}

checkSchema();
