
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Checking Payroll Schema Compatibility...');

    // 1. Try to fetch one row with new columns
    // We select specific V2 columns to see if they exist
    const { data, error } = await supabase.from('payroll_slips')
        .select('id, status, net_salary, journal_entry_id, payment_date')
        .limit(1);

    if (error) {
        console.error('Schema Mismatch Detected:', error.message);
        console.log('Columns likely missing. Migration required.');
        process.exit(1);
    } else {
        console.log('Schema seems compatible. Columns exist.');
        process.exit(0);
    }
}

check();
