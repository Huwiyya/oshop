import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function insertOrderDirectly() {
    console.log('🔵 Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // Step 1: Get ALL users and pick first
        console.log('\n🔵 Step 1: Fetching users...');
        const { data: allUsers, error: usersError } = await supabase
            .from('users_v4')
            .select('*')
            .limit(5);

        if (usersError || !allUsers || allUsers.length === 0) {
            console.error('❌ Error fetching users:', usersError);
            return;
        }

        console.log(`✅ Found ${allUsers.length} users, using first one:`);
        allUsers.forEach(u => console.log(`  - ${u.id}: ${u.username || 'N/A'} (${u.name || 'N/A'})`));

        const user = allUsers[0];
        console.log(`\n✅ Selected user: ${user.id} - ${user.name}`);

        // Step 2: Get highest sequence
        console.log('\n🔵 Step 2: Finding highest sequence...');
        const { data: orders } = await supabase
            .from('orders_v4')
            .select('sequenceNumber')
            .eq('userId', user.id)
            .order('sequenceNumber', { ascending: false })
            .limit(1);

        const maxSeq = orders && orders.length > 0 ? orders[0].sequenceNumber : 0;
        const newSeq = maxSeq + 1;
        console.log(`✅ Max sequence: ${maxSeq} → New: ${newSeq}`);

        // Step 3: Get settings
        console.log('\n🔵 Step 3: Getting settings...');
        const { data: settings } = await supabase
            .from('settings_v4')
            .select('*')
            .limit(1);

        const rate = settings && settings.length > 0 ? settings[0].exchangeRate : 5.0;
        console.log(`✅ Exchange rate: ${rate}`);

        // Step 4: Create order
        console.log('\n🔵 Step 4: Creating test order...');
        const orderId = 'DIRECT_' + Date.now();
        const invoiceNum = `${user.id}-${String(newSeq).padStart(3, '0')}`;

        const orderData = {
            id: orderId,
            invoiceNumber: invoiceNum,
            sequenceNumber: newSeq,
            trackingId: 'TRACK_' + Date.now(),
            userId: user.id,
            customerName: user.name || 'Test User',
            operationDate: new Date().toISOString(),
            purchasePriceUSD: 50,
            sellingPriceLYD: 50 * rate,
            downPaymentLYD: 0,
            status: 'pending',
            store: 'Amazon',
            exchangeRate: rate,
            productLinks: '',
            weightKG: 0,
            itemDescription: 'Test order - created directly via script'
        };

        console.log('📦 Order:', JSON.stringify(orderData, null, 2));

        const { data: newOrder, error: insertError } = await supabase
            .from('orders_v4')
            .insert(orderData)
            .select();

        if (insertError) {
            console.error('❌ INSERT ERROR:', JSON.stringify(insertError, null, 2));
            return;
        }

        console.log('\n✅✅✅ SUCCESS! Order created:');
        console.log('  ID:', newOrder[0].id);
        console.log('  Invoice:', newOrder[0].invoiceNumber);
        console.log('  Status:', newOrder[0].status);
        console.log('\n🌐 View at: http://localhost:3000/admin/orders');

    } catch (err) {
        console.error('❌ Fatal error:', err.message);
        console.error('Stack:', err.stack);
    }
}

insertOrderDirectly();
