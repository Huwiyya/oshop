import {
    addOrder,
    deleteOrder,
    saveOrderWeight,
    getUserById,
    getTreasuryCards
} from './src/lib/actions';
import { supabaseAdmin } from './src/lib/supabase-admin';

async function verifyFlow() {
    console.log("🚀 Starting Financial Flow Verification");

    // 1. Setup: Get a user and Treasury Card
    const users = await supabaseAdmin.from('users_v4').select('id, name, debt').limit(1);
    if (!users.data || users.data.length === 0) { console.error("No users found"); return; }
    const user = users.data[0];
    const initialDebt = user.debt || 0;

    console.log(`👤 User: ${user.name} | Initial Debt: ${initialDebt}`);

    const cards = await getTreasuryCards();
    const cashCard = cards.find(c => c.type === 'cash_libyan');
    if (!cashCard) { console.error("No Cash Libyan card found"); return; }
    const initialCash = cashCard.balance;
    console.log(`💰 Treasury (Cash): ${initialCash}`);

    // 2. Create Order (100 LYD, 20 Down Payment)
    console.log("\n1️⃣ Creating Order...");
    const orderData = {
        userId: user.id,
        customerName: user.name,
        sellingPriceLYD: 100,
        downPaymentLYD: 20,
        paymentMethod: 'cash',
        status: 'pending' as any,
        productLinks: 'Test Product',
        itemDescription: 'Test Item'
    };

    // We mock cookies or context if needed, but addOrder relies on simple args mostly
    const newOrder = await addOrder(orderData as any);
    if (!newOrder) { console.error("❌ Failed to create order"); return; }
    console.log(`   ✅ Order Created: ${newOrder.invoiceNumber} | ID: ${newOrder.id}`);

    // Verify User Debt (Should calculate stats)
    // Debt = (100 - 20) = 80. + Initial Debt.
    const userAfterOrder = await getUserById(user.id);
    console.log(`   👉 User Debt: ${userAfterOrder?.debt} (Expected: ${initialDebt + 80})`);

    // Verify Treasury (Should increase by 20)
    const cardsAfterOrder = await getTreasuryCards();
    const cashAfterOrder = cardsAfterOrder.find(c => c.type === 'cash_libyan')?.balance;
    console.log(`   👉 Treasury: ${cashAfterOrder} (Expected: ${initialCash + 20})`);


    // 3. Add Weight (Add 5kg, Cost 50, Sell 60 LYD)
    // Old cost 0. New cost 60. Diff +60.
    // Total should be 100 + 60 = 160.
    // Remaining should be 80 + 60 = 140.
    console.log("\n2️⃣ Adding Weight...");
    const weightRes = await saveOrderWeight(
        newOrder.id,
        5, // kg
        50, // cost
        60, // sell
        'LYD', // cost curr
        'LYD' // sell curr
    );

    if (weightRes.success) {
        console.log("   ✅ Weight Saved");
    } else {
        console.error("   ❌ Weight Save Failed:", weightRes.message);
    }

    // Verify User Debt
    // Expected: Initial + 80 + 60 = Initial + 140
    const userAfterWeight = await getUserById(user.id);
    console.log(`   👉 User Debt: ${userAfterWeight?.debt} (Expected: ${initialDebt + 140})`);


    // 4. Delete Order
    console.log("\n3️⃣ Deleting Order...");
    const deleteRes = await deleteOrder(newOrder.id);
    if (deleteRes) {
        console.log("   ✅ Order Deleted");
    } else {
        console.error("   ❌ Delete Failed");
    }

    // Verify User Debt (Should return to Initial)
    const userFinal = await getUserById(user.id);
    console.log(`   👉 User Debt: ${userFinal?.debt} (Expected: ${initialDebt})`);

    // Verify Treasury (Should return to Initial - refunding the 20 DP)
    const cardsFinal = await getTreasuryCards();
    const cashFinal = cardsFinal.find(c => c.type === 'cash_libyan')?.balance;
    console.log(`   👉 Treasury: ${cashFinal} (Expected: ${initialCash})`);

}

verifyFlow().catch(console.error);
