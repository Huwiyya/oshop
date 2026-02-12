
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEntryNumbers() {
    console.log('Checking Entry Numbers...');

    // Get today's date prefix
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const search = `JE-${dateStr}-%`;

    console.log('Searching for:', search);

    const { data, error } = await supabase
        .from('journal_entries')
        .select('entry_number, created_at')
        .like('entry_number', search)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Found Entries:', data);
    }
}

checkEntryNumbers();
