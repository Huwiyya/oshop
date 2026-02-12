
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJournalSchema() {
    console.log('Checking Journal Entries Schema...');

    // Check journal_entry_lines columns
    console.log('Checking journal_entry_lines columns...');
    const { data: cols } = await supabase.from('journal_entry_lines').select('*').limit(1);
    if (cols && cols.length > 0) {
        console.log('Sample Line Keys:', Object.keys(cols[0]));
    } else {
        // Try selective select
        const { error: err1 } = await supabase.from('journal_entry_lines').select('entry_id').limit(1);
        if (!err1) console.log('Column "entry_id" EXISTS.');
        else console.log('Column "entry_id" MISSING:', err1.message);

        const { error: err2 } = await supabase.from('journal_entry_lines').select('journal_entry_id').limit(1);
        if (!err2) console.log('Column "journal_entry_id" EXISTS.');
        else console.log('Column "journal_entry_id" MISSING:', err2.message);
    }
}

checkJournalSchema();
