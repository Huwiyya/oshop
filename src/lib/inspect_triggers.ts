
import fs from 'fs';
import path from 'path';

const PROJECT_REF = 'pipupdimlbjiivftgbop';
const ACCESS_TOKEN = 'sbp_b5e152fa2365f295ef12dddb54dcf2a742998648';

async function run() {
    try {
        console.log("🚀 Inspecting Triggers via Supabase Management API...");

        // Query to list triggers on sales_invoices_v2
        const sql = `
            SELECT trigger_name, event_manipulation, action_statement
            FROM information_schema.triggers
            WHERE event_object_table = 'sales_invoices_v2';
        `;

        const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: sql })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${err}`);
        }

        const data = await response.json();
        console.table(data);

    } catch (error) {
        console.error("❌ Failed to inspect triggers:", error);
    }
}

run();
