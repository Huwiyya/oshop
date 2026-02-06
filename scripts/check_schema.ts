
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkSchema() {
    // We can't query information_schema easily via client sometimes due to permissions, 
    // but we can try selecting * limit 0 and checking keys?
    // Or just try to select 'reference_id' and see if it errors.

    console.log("Checking if reference_id exists...");
    const { data, error } = await supabase.from('inventory_transactions').select('reference_id').limit(1);

    if (error) {
        console.log("Error selecting reference_id:", error.message);
        // likely "Column does not exist"
    } else {
        console.log("Column reference_id EXISTS.");
    }
}

checkSchema();
