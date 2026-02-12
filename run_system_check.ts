

import fs from 'fs';
import path from 'path';

// Credentials
const PROJECT_REF = 'pipupdimlbjiivftgbop';
const ACCESS_TOKEN = 'sbp_b5e152fa2365f295ef12dddb54dcf2a742998648';

async function run() {
    try {
        console.log("🚀 Running SQL Check...");

        // 4. Run SQL File
        const sqlPath = path.join(process.cwd(), 'src', 'lib', 'fix_fixed_assets_columns.sql');
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
        console.log("Result:", JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("❌ Failed:", error);
        process.exit(1);
    }
}

run();

