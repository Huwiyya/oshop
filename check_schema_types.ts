
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchemaTypes() {
    console.log('Checking Schema Types...');

    const { data: columns, error } = await supabase
        .from('information_schema.columns')
        .select('table_name, column_name, data_type, udt_name')
        .in('table_name', ['payroll_slips', 'payroll_slip_lines'])
        .order('table_name, column_name');

    if (error) {
        console.error('Error fetching schema:', error.message);
        return;
    }

    console.table(columns);
}

checkSchemaTypes();
