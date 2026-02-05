
import { getTreasuryCards, getTreasuryCardById } from '../src/lib/actions';

async function run() {
    console.log("--- Debugging Treasury Cards ---");

    // 1. List All
    console.log("Fetching all cards...");
    const cards = await getTreasuryCards();
    console.log(`Found ${cards.length} cards.`);
    cards.forEach(c => console.log(`- ${c.name} (${c.id})`));

    // 2. Fetch Specific ID (from screenshot)
    const targetId = '2f540ba6-5c16-4bb5-bc81-ece10780e5b3';
    console.log(`\nFetching specific ID: ${targetId}`);
    const card = await getTreasuryCardById(targetId);

    if (card) {
        console.log(`SUCCESS: Found card:`, card);
    } else {
        console.error(`FAILURE: Card not found via getTreasuryCardById.`);
    }
}

run().catch(e => console.error(e));
