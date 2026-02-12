
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    console.log('Listing Tables and Counts...');
    const tables = [
        'accounts',
        'accounts_v2',
        'journal_entries',
        'journal_entries_v2',
        'journal_entry_lines',
        'journal_lines_v2',
        'payroll_slips',
        'products'
    ];

    for (const t of tables) {
        const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
        if (error) {
            console.log(`Table '${t}': ${error.message} (Code: ${error.code})`);
        } else {
            console.log(`Table '${t}': EXISTS (Rows: ${count})`);
        }
    }
}

listTables();
