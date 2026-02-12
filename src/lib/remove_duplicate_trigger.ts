
import fs from 'fs';
import path from 'path';

const PROJECT_REF = 'pipupdimlbjiivftgbop';
const ACCESS_TOKEN = 'sbp_b5e152fa2365f295ef12dddb54dcf2a742998648';

async function run() {
    try {
        console.log("🚀 Removing Duplicate Trigger via Supabase Management API...");

        const sql = `
            DROP TRIGGER IF EXISTS a_trg_process_sales_inventory_v2 ON public.sales_invoices_v2;
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

        console.log("✅ Duplicate Trigger Removed Successfully!");

    } catch (error) {
        console.error("❌ Failed to remove trigger:", error);
    }
}

run();
