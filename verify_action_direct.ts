
require('dotenv').config({ path: '.env.local' });
const { getFixedAssetsV2 } = require('./src/lib/fixed-assets-actions-v2');

async function test() {
    try {
        console.log("Testing getFixedAssetsV2...");
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error("❌ SUPABASE_SERVICE_ROLE_KEY is missing in env");
            // Hardcode for this test if missing, just to verify logic vs env
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://pipupdimlbjiivftgbop.supabase.co';
            process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcHVwZGltbGJqaWl2ZnRnYm9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDczMzMzMCwiZXhwIjoyMDg2MzA5MzMwfQ.3YWHGgmV5old4xJpnrUdqruz5C6wYPDDf5PlLywfmsQ';
        }

        const assets = await getFixedAssetsV2();
        console.log("Result:", assets);
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
