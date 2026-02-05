
import { NextResponse } from 'next/server';
import { getTreasuryCards } from '@/lib/actions';

export async function GET() {
    try {
        console.log("API: Fetching Treasury Cards...");
        const cards = await getTreasuryCards();
        return NextResponse.json({
            count: cards.length,
            cards: cards.map(c => ({
                id: c.id,
                name: c.name,
                type: c.type,
                balance: c.balance
            }))
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
