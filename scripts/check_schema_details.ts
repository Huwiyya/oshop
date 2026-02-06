
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkSchemaDetails() {
    console.log("Checking reference_type and data...");

    // Check column existence by trying to select it
    const { data: cols, error: colError } = await supabase.from('inventory_transactions').select('reference_type').limit(1);
    if (colError) {
        console.log("Column reference_type MISSING or Error:", colError.message);
    } else {
        console.log("Column reference_type EXISTS.");
    }

    // Check if data is populated
    const { count, error: countError } = await supabase
        .from('inventory_transactions')
        .select('*', { count: 'exact', head: true })
        .not('reference_id', 'is', null);

    console.log(`Transactions with populated reference_id: ${count || 0}`);
}

checkSchemaDetails();
