import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) must be set in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const DB_PATH = path.join(process.cwd(), 'db.json');

function readDB() {
    try {
        const data = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading DB:", error);
        return {};
    }
}

async function syncCollection(collectionName: string, data: any) {
    console.log(`Syncing collection: ${collectionName}...`);

    // Ensure ID is included in the record
    const records = Object.entries(data).map(([id, record]: [string, any]) => ({
        ...record,
        id
    }));

    if (records.length === 0) {
        console.log(`No records in ${collectionName}.`);
        return;
    }

    // Supabase upsert
    const { error } = await supabase
        .from(collectionName)
        .upsert(records, { onConflict: 'id' });

    if (error) {
        console.error(`Error syncing ${collectionName}:`, error.message);
    } else {
        console.log(`Successfully synced ${records.length} records to ${collectionName}.`);
    }
}

async function main() {
    console.log("Starting full DB sync to Supabase...");
    const db = readDB();

    // Define the collections to sync and their mapping if necessary
    // Assuming table names match collection names in db.json (users, orders, settings, etc.)

    for (const [collectionName, data] of Object.entries(db)) {
        if (typeof data === 'object' && data !== null) {
            await syncCollection(collectionName, data);
        }
    }

    console.log("Sync complete.");
}

main().catch(console.error);
