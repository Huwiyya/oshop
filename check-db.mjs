import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function checkDatabase() {
    console.log('🔵 Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // Check users
        console.log('\n🔵 Checking users_v4 table...');
        const { data: allUsers, error: usersError } = await supabase
            .from('users_v4')
            .select('*');

        if (usersError) {
            console.error('❌ Error:', usersError);
        } else {
            console.log(`✅ Found ${allUsers.length} users:`);
            allUsers.forEach(u => console.log(`  - ${u.id}: ${u.username} (${u.name})`));
        }

        // Check orders
        console.log('\n🔵 Checking orders_v4 table...');
        const { data: allOrders, error: ordersError } = await supabase
            .from('orders_v4')
            .select('*')
            .limit(5);

        if (ordersError) {
            console.error('❌ Error:', ordersError);
        } else {
            console.log(`✅ Found ${allOrders.length} orders (showing first 5):`);
            allOrders.forEach(o => console.log(`  - ${o.id}: ${o.invoiceNumber} - ${o.status}`));
        }

        // Check settings
        console.log('\n🔵 Checking settings_v4 table...');
        const { data: allSettings, error: settingsError } = await supabase
            .from('settings_v4')
            .select('*');

        if (settingsError) {
            console.error('❌ Error:', settingsError);
        } else {
            console.log(`✅ Found ${allSettings.length} settings:`);
            allSettings.forEach(s => console.log(`  - ${s.id}: exchangeRate=${s.exchangeRate}`));
        }

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

checkDatabase();
