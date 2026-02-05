import { saveOrderWeight, getOrderById } from './src/lib/actions';

async function debugWeight(orderId: string) {
    console.log(`🔵 Debugging Weight for Order: ${orderId}`);

    // 1. Fetch Order
    const order = await getOrderById(orderId);
    if (!order) {
        console.error("❌ Order not found!");
        return;
    }
    console.log("   ✅ Order Found:", {
        id: order.id,
        invoiceNumber: order.invoiceNumber,
        userId: order.userId,
        exchangeRate: order.exchangeRate,
        customerWeightCostCurrency: order.customerWeightCostCurrency,
        customerWeightCost: order.customerWeightCost
    });

    if (!order.userId) {
        console.warn("⚠️ WARNING: Order has no userId. Financial transaction might fail or be unlinked.");
    }
    if (!order.exchangeRate) {
        console.warn("⚠️ WARNING: Order has no exchangeRate. USD conversions will default to 1:1 or fail.");
    }

    // 2. Simulate Save (Adding 5kg, Cost 10 USD, Sell 50 LYD)
    console.log("\n2️⃣ Simulating saveOrderWeight...");
    const result = await saveOrderWeight(
        orderId,
        5, // weight
        10, // costPrice
        50, // sellingPrice
        'USD', // costCurrency
        'LYD' // sellingCurrency
    );

    console.log("   👉 Result:", result);

}

// Replace with a valid Order ID from your DB
const TEST_ORDER_ID = 'REPLACE_WITH_VALID_ID';

// Fetch a recent order to test if ID not known
import { supabaseAdmin } from './src/lib/supabase-admin';
async function run() {
    const { data } = await supabaseAdmin.from('orders_v4').select('id').limit(1).single();
    if (data) {
        await debugWeight(data.id);
    } else {
        console.log("No orders found to test.");
    }
}

run().catch(console.error);
