// Simple debug script to test addOrder directly
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '.env.local') });

async function testAddOrder() {
    try {
        console.log('🔵 Starting debug test...');

        // Import addOrder
        const { addOrder } = await import('./src/lib/actions.ts');

        const testOrderData = {
            userId: 'OS1', // ID of test user
            customerName: 'test',
            operationDate: new Date().toISOString(),
            purchasePriceUSD: 50,
            sellingPriceLYD: 0,
            downPaymentLYD: 0,
            status: 'pending',
            store: 'Amazon',
            trackingId: 'TEST123',
            exchangeRate: 1,
            productLinks: '',
            weightKG: 0,
            itemDescription: 'Test item',
            managerId: null,
            representativeId: null,
            representativeName: null,
            collectedAmount: 0
        };

        console.log('🔵 Calling addOrder with:', JSON.stringify(testOrderData, null, 2));
        const result = await addOrder(testOrderData);

        if (result) {
            console.log('✅ SUCCESS! Order created:', result.id, result.invoiceNumber);
        } else {
            console.error('❌ FAILED! addOrder returned null');
        }
    } catch (error) {
        console.error('❌ ERROR:', error);
        console.error('Stack:', error.stack);
    }
}

testAddOrder();
