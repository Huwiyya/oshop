
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDeduction() {
    console.log('Verifying Deduction Insert (Simulating Action)...');

    // 1. Get Employee
    const { data: emp } = await supabase.from('accounts').select('id, name_ar').eq('account_code', '2130001').single();
    if (!emp) {
        console.error('Employee not found (2130001). Cannot test.');
        return;
    }

    // 2. Prepare Payload (Mimic upsertPayslipV2)
    const lines = [
        { type: 'earning', amount: 5000, description: 'Basic Salary' },
        { type: 'deduction', amount: 500, description: 'Test Deduction' } // The problematic part?
    ];

    const totalEarnings = 5000;
    const totalDeductions = 500;
    const netSalary = 4500;

    const payload = {
        employee_id: emp.id,
        employee_name: emp.name_ar,
        period_year: 2026,
        period_month: 2,
        payment_date: new Date().toISOString(),
        slip_number: 'TEST-DED-001',
        status: 'draft',
        basic_salary: 5000, // Ensure this is present
        net_salary: netSalary,
        created_by: null
    };

    console.log('Inserting Header...');
    const { data: header, error: headerError } = await supabase.from('payroll_slips').insert(payload).select().single();

    if (headerError) {
        console.error('Header Insert Failed:', headerError.message);
        return;
    }
    console.log('Header Insert Success:', header.id);

    // 3. Insert Lines
    console.log('Inserting Lines...');
    // We need standard accounts for lines.
    // Fetch a generic account for deduction (e.g. 2140 or just 2 something)
    const { data: dedAcct } = await supabase.from('accounts').select('id').like('account_code', '2%').limit(1).single();
    const { data: earnAcct } = await supabase.from('accounts').select('id').like('account_code', '5%').limit(1).single();

    if (!dedAcct || !earnAcct) {
        console.error('Cannot find accounts for lines.');
        return;
    }

    const dbLines = [
        {
            slip_id: header.id,
            account_id: earnAcct.id, // Expense
            description: 'Basic Salary',
            amount: 5000,
            type: 'earning'
        },
        {
            slip_id: header.id,
            account_id: dedAcct.id, // Liability
            description: 'Test Deduction',
            amount: 500,
            type: 'deduction'
        }
    ];

    const { error: linesError } = await supabase.from('payroll_slip_lines').insert(dbLines);
    if (linesError) {
        console.error('Lines Insert Failed:', linesError.message);
    } else {
        console.log('Lines Insert Success. Deduction Verification Complete.');

        // Cleanup
        await supabase.from('payroll_slips').delete().eq('id', header.id);
        console.log('Cleanup Done.');
    }
}

verifyDeduction();
