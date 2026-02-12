require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'pipupdimlbjiivftgbop';
const ACCESS_TOKEN = 'sbp_b5e152fa2365f295ef12dddb54dcf2a742998648'; // Service role key

async function run() {
    try {
        console.log("🚀 Creating create_journal_entry_rpc function...");

        const sqlPath = path.join(process.cwd(), 'src', 'lib', 'create_journal_entry_rpc_v2.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'apikey': ACCESS_TOKEN
            },
            body: JSON.stringify({ query: sql })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${err}`);
        }

        const result = await response.json();
        console.log("✅ Success:", JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("❌ Failed:", error);
        process.exit(1);
    }
}

run();
