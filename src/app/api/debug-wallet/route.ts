
import { NextResponse } from 'next/server';
import { addWalletTransaction, getTreasuryCards, getTreasuryTransactions } from '@/lib/actions';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log("API: Debugging Wallet Mirroring...");

        // 1. Get Cash Card ID & Real User
        const cards = await getTreasuryCards();
        const cashCard = cards.find(c => c.type === 'cash_libyan');
        if (!cashCard) throw new Error("Cash Card not found");

        const { data: users } = await supabaseAdmin.from('users_v4').select('id').limit(1);
        if (!users || users.length === 0) throw new Error("No users found");
        const userId = users[0].id;

        // 2. Perform Wallet Deposit
        const logId = `Debug Mirror Test ${Date.now()}`;
        console.log(`Adding Wallet Transaction: ${logId}`);
        const result = await addWalletTransaction(
            userId,
            15.00,
            'deposit',
            logId,
            'system',
            'cash'
        );

        if (!result.success) throw new Error(result.error);

        // 3. Check Treasury
        // wait short time for eventual consistency? usually unnecessary with direct DB
        console.log("Checking Treasury...");
        const txs = await getTreasuryTransactions(cashCard.id);

        return NextResponse.json({
            success: true,
            walletResult: result,
            cashCardId: cashCard.id,
            treasuryCount: txs.length,
            recentTreasuryTxs: txs.slice(0, 5),
            logId: logId,
            foundMatch: txs.some(t => t.description && t.description.includes(logId))
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
