
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyUpsert() {
    console.log('Verifying Upsert with payment_date...');

    const payload = {
        employee_name: 'Test Employee',
        period_year: 2026,
        period_month: 2,
        payment_date: new Date().toISOString(),
        slip_number: 'TEST-001',
        status: 'draft',
        // We need a valid employee_id. Let's fetch one.
        // Or just fail on FK constraint, but we want to see if it fails on COLUMN missing first.
    };

    // Fetch an employee first
    const { data: emp } = await supabase.from('accounts').select('id').eq('account_code', '2130001').single();
    if (emp) {
        (payload as any).employee_id = emp.id;
    } else {
        console.log('No employee found, skipping full insert, checking column metadata via RPC or error.');
        // If we try to insert, and column is missing, we get error.
        // Only if employee_id is missing we get FK error.
        // We need execution.
    }

    if ((payload as any).employee_id) {
        console.log('Attempting Insert...');
        const { data, error } = await supabase.from('payroll_slips').insert(payload).select();
        if (error) {
            console.error('Insert Error:', error.message);
        } else {
            console.log('Insert Success:', data);
            // Cleanup
            if (data && data[0]) {
                await supabase.from('payroll_slips').delete().eq('id', data[0].id);
            }
        }
    } else {
        console.log('Skipping insert due to missing employee.');
    }
}

verifyUpsert();
