
import fs from 'fs';
import path from 'path';

// Fix script to update Verify Logic
const PROJECT_REF = 'pipupdimlbjiivftgbop';
const ACCESS_TOKEN = 'sbp_b5e152fa2365f295ef12dddb54dcf2a742998648';

async function run() {
    try {
        console.log("🚀 Applying SQL Fix via Supabase Management API...");

        // Read the SQL file content
        const sqlPath = path.join(process.cwd(), 'src', 'lib', 'fix_inventory_triggers.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

        // Construct the API URL
        const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

        // Execute the fetch request
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: sqlContent })
        });

        // Check for response success
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${err}`);
        }

        console.log("✅ SQL Fix Applied Successfully!");
    } catch (error) {
        console.error("❌ Failed to apply SQL fix:", error);
        process.exit(1);
    }
}

run();
