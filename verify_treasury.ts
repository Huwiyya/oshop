import { addTreasuryTransaction, getTreasuryTransactions, getTreasuryCards } from './src/lib/actions';

async function verifyTreasury() {
    console.log("🔵 Starting Treasury Verification...");

    // 1. Fetch Cards
    console.log("1️⃣ Fetching Treasury Cards...");
    const cards = await getTreasuryCards();
    console.log(`   Found ${cards.length} cards.`);

    const usdtCard = cards.find(c => c.type === 'usdt_treasury');
    if (!usdtCard) {
        console.error("❌ CRTICAL: USDT Treasury card not found! Schema update might be missing.");
        return;
    }
    console.log("   ✅ USDT Treasury Card Found:", usdtCard);
    const initialBalance = usdtCard.balance;

    // 2. Deposit
    console.log("\n2️⃣ Testing Deposit (100)...");
    const depositAmount = 100;
    await addTreasuryTransaction({
        amount: depositAmount,
        type: 'deposit',
        description: 'Verification Deposit',
        cardId: usdtCard.id
    });
    console.log("   ✅ Deposit transaction added.");

    // 3. Verify Balance Update
    console.log("\n3️⃣ Verifying Balance Update...");
    const cardsAfter = await getTreasuryCards();
    const usdtCardAfter = cardsAfter.find(c => c.id === usdtCard.id);
    const expectedBalance = initialBalance + depositAmount;

    if (Math.abs(usdtCardAfter!.balance - expectedBalance) < 0.01) {
        console.log(`   ✅ Balance updated correctly: ${initialBalance} -> ${usdtCardAfter!.balance}`);
    } else {
        console.error(`   ❌ Balance Mismatch! Expected ${expectedBalance}, got ${usdtCardAfter!.balance}`);
    }

    // 4. Verify History
    console.log("\n4️⃣ Verifying Transaction History...");
    const history = await getTreasuryTransactions(usdtCard.id);
    const lastTx = history[0];
    if (lastTx && lastTx.amount === depositAmount && lastTx.description === 'Verification Deposit') {
        console.log("   ✅ Transaction found in history:");
        console.log(lastTx);
    } else {
        console.error("   ❌ Transaction NOT found in history or incorrect!");
        console.log(history.slice(0, 3));
    }

    console.log("\n5️⃣ Reverting (Withdraw 100)...");
    await addTreasuryTransaction({
        amount: depositAmount,
        type: 'withdrawal',
        description: 'Verification Revert',
        cardId: usdtCard.id
    });
    console.log("   ✅ Revert complete.");
}

verifyTreasury().catch(console.error);
