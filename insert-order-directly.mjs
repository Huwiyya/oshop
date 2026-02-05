import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Using key type:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON');


async function insertOrderDirectly() {
    console.log('🔵 Connecting to Supabase...');
    console.log('URL:', supabaseUrl);

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // Step 1: Get test user
        console.log('\n🔵 Step 1: Fetching test user...');
        const { data: user, error: userError } = await supabase
            .from('users_v4')
            .select('*')
            .eq('username', 'test')
            .single();

        if (userError) {
            console.error('❌ Error fetching user:', userError);
            return;
        }

        console.log('✅ User found:', { id: user.id, username: user.username, name: user.name });

        // Step 2: Get highest sequence number for this user
        console.log('\n🔵 Step 2: Finding highest sequence number...');
        const { data: existingOrders, error: ordersError } = await supabase
            .from('orders_v4')
            .select('sequenceNumber')
            .eq('userId', user.id)
            .order('sequenceNumber', { ascending: false })
            .limit(1);

        if (ordersError && ordersError.code !== 'PGRST116') {
            console.error('❌ Error fetching orders:', ordersError);
            return;
        }

        const maxSequence = existingOrders && existingOrders.length > 0 ? existingOrders[0].sequenceNumber : 0;
        const newSequence = maxSequence + 1;
        console.log('✅ Max sequence:', maxSequence, '→ New sequence:', newSequence);

        // Step 3: Get app settings for exchange rate
        console.log('\n🔵 Step 3: Getting app settings...');
        const { data: settingsArray, error: settingsError } = await supabase
            .from('settings_v4')
            .select('*')
            .eq('id', 'main');

        const settings = settingsArray && settingsArray.length > 0 ? settingsArray[0] : null;
        const exchangeRate = settings?.exchangeRate || 5.0; // Default to 5.0 if not found
        console.log('✅ Exchange rate:', exchangeRate);

        // Step 4: Create test order
        console.log('\n🔵 Step 4: Creating test order...');
        const orderId = 'TEST_' + Date.now();
        const invoiceNumber = `${user.id}-${String(newSequence).padStart(3, '0')}`;

        const testOrder = {
            id: orderId,
            invoiceNumber: invoiceNumber,
            sequenceNumber: newSequence,
            trackingId: 'TRACK_' + Date.now(),
            userId: user.id,
            customerName: user.name || 'test',
            operationDate: new Date().toISOString(),
            purchasePriceUSD: 50,
            sellingPriceLYD: 50 * exchangeRate,
            downPaymentLYD: 0,
            status: 'pending',
            store: 'Amazon',
            exchangeRate: exchangeRate,
            productLinks: '',
            weightKG: 0,
            itemDescription: 'Test order created directly',
            managerId: null,
            representativeId: null,
            representativeName: null,
            collectedAmount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        console.log('Order data:', JSON.stringify(testOrder, null, 2));

        const { data: order, error: orderError } = await supabase
            .from('orders_v4')
            .insert(testOrder)
            .select()
            .single();

        if (orderError) {
            console.error('❌ Error creating order:', orderError);
            console.error('Error details:', JSON.stringify(orderError, null, 2));
            return;
        }

        console.log('\n✅ SUCCESS! Order created:', { id: order.id, invoiceNumber: order.invoiceNumber });

        // Step 5: Create transaction record
        console.log('\n🔵 Step 5: Creating transaction record...');
        const transactionId = 'TRANS_' + Date.now();
        const { data: transaction, error: transError } = await supabase
            .from('transactions_v4')
            .insert({
                id: transactionId,
                orderId: order.id,
                customerId: user.id,
                customerName: user.name || 'test',
                date: new Date().toISOString(),
                type: 'order',
                status: 'pending',
                amount: testOrder.sellingPriceLYD,
                description: `إنشاء طلب جديد ${invoiceNumber}`,
                createdAt: new Date().toISOString()
            })
            .select()
            .single();

        if (transError) {
            console.warn('⚠️ Warning: Failed to create transaction:', transError);
        } else {
            console.log('✅ Transaction created:', transaction.id);
        }

        console.log('\n✅ DONE! Order URL: http://localhost:3000/admin/orders');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
        console.error('Stack:', error.stack);
    }
}

insertOrderDirectly();
