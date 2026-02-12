const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testDatabase() {
    console.log('🔵 Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
        // Test 1: Check if test user exists
        console.log('\n🔵 TEST 1: Fetching test user...');
        const { data: user, error: userError } = await supabase
            .from('users_v4')
            .select('*')
            .eq('username', 'test')
            .single();

        if (userError) {
            console.error('❌ Error fetching user:', userError);
            return;
        }

        console.log('✅ User found:', { id: user.id, username: user.username, phone: user.phone });

        // Test 2: Try to create a simple order
        console.log('\n🔵 TEST 2: Creating test order...');
        const testOrder = {
            id: 'test_' + Date.now(),
            invoiceNumber: 'TEST-01',
            trackingId: 'TRACK123',
            userId: user.id,
            customerName: user.name || 'test',
            operationDate: new Date().toISOString(),
            purchasePriceUSD: 50,
            sellingPriceLYD: 0,
            downPaymentLYD: 0,
            status: 'pending',
            store: 'Amazon',
            exchangeRate: 1,
            productLinks: '',
            weightKG: 0,
            itemDescription: 'Test item'
        };

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

        console.log('✅ Order created successfully!', { id: order.id, invoiceNumber: order.invoiceNumber });

        // Test 3: Delete the test order
        console.log('\n🔵 TEST 3: Cleaning up test order...');
        const { error: deleteError } = await supabase
            .from('orders_v4')
            .delete()
            .eq('id', order.id);

        if (deleteError) {
            console.error('❌ Error deleting test order:', deleteError);
        } else {
            console.log('✅ Test order deleted');
        }

    } catch (error) {
        console.error('❌ Unexpected error:', error);
        console.error('Stack:', error.stack);
    }
}

testDatabase();
