
import { getTreasuryCards } from '../src/lib/actions';

async function run() {
    console.log("Fetching Treasury Cards...");
    const cards = await getTreasuryCards();
    console.log(`Total Cards: ${cards.length}`);
    cards.forEach(c => {
        console.log(`[${c.type}] ${c.name} (${c.id}) - Balance: ${c.balance}`);
    });
}

run().catch(console.error);
