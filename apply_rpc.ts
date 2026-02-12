
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyRpc() {
    const sqlPath = path.join(process.cwd(), 'src/lib/atomic_journal_rpc.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        // Fallback: splitting by ; might not work for functions.
        // If exec_sql RPC is not available, we might need another way.
        // Or if the error is just that exec_sql doesn't exist.
        console.error('Error executing SQL via RPC:', error);

        // Try direct SQL execution if possible (not possible with supabase-js client usually unless using specific admin API or valid RPC)
        // Assume user has an `exec_sql` or similar helper, or we just rely on pasting it in dashboard?
        // Wait, I can try to use the `pg` library if connection string is available, or just hope `exec_sql` exists.
        // Actually, many supabase projects don't have `exec_sql` enabled for security.

        console.log('Attempts to use Supabase Query Editor or pg driver usually required.');
    } else {
        console.log('RPC created successfully!');
    }
}

applyRpc();
