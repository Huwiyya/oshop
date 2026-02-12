require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'pipupdimlbjiivftgbop';
const ACCESS_TOKEN = 'sbp_b5e152fa2365f295ef12dddb54dcf2a742998648';

async function run() {
    try {
        console.log("🔍 Verifying Fixed Assets Schema...\n");

        const sqlPath = path.join(process.cwd(), 'src', 'lib', 'verify_fixed_assets_schema.sql');
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
            throw new Error(`API Error: ${response.status} - ${err}`);
        }

        const result = await response.json();
        console.log("✅ Schema verification complete!\n");

        // Pretty print results
        if (Array.isArray(result) && result.length > 0) {
            result.forEach((section, idx) => {
                console.log(`\n📊 Section ${idx + 1}:`);
                if (Array.isArray(section)) {
                    section.forEach(row => console.log(row));
                } else {
                    console.log(section);
                }
            });
        }

    } catch (error) {
        console.error("❌ Failed:", error.message);
        process.exit(1);
    }
}

run();
