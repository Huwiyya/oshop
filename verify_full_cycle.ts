
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Service role to bypass RLS and use Admin functions
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFullCycle() {
    console.log('Starting Full Payroll Cycle Verification...');

    // 1. Get Employee
    const { data: emp, error: empError } = await supabase.from('accounts').select('id, name_ar').eq('account_code', '2130001').single();
    if (empError || !emp) {
        console.error('Employee not found (2130001). Cannot test.');
        return;
    }
    console.log('Employee Found:', emp.name_ar);

    // 2. Create Draft Slip
    const payload = {
        employee_id: emp.id,
        employee_name: emp.name_ar,
        period_year: 2026,
        period_month: 2,
        payment_date: new Date().toISOString(),
        slip_number: 'TEST-CYCLE-' + Date.now(),
        status: 'draft',
        basic_salary: 6000,
        net_salary: 5500, // 6000 - 500
        created_by: null // Service role
    };

    console.log('Creating Draft Slip...');
    const { data: slip, error: slipError } = await supabase
        .from('payroll_slips')
        .insert(payload)
        .select()
        .single();

    if (slipError) {
        console.error('Draft Creation Failed:', slipError.message);
        return;
    }
    console.log('Draft Created:', slip.id);

    // 3. Add Lines (Earning & Deduction)
    const { data: earnAcct } = await supabase.from('accounts').select('id').like('account_code', '5%').limit(1).single();
    const { data: dedAcct } = await supabase.from('accounts').select('id').like('account_code', '2%').limit(1).single();

    const lines = [
        {
            slip_id: slip.id,
            account_id: earnAcct!.id,
            description: 'Cycle Test Salary',
            amount: 6000,
            type: 'earning'
        },
        {
            slip_id: slip.id,
            account_id: dedAcct!.id,
            description: 'Cycle Test Deduction',
            amount: 500,
            type: 'deduction'
        }
    ];

    const { error: linesError } = await supabase.from('payroll_slip_lines').insert(lines);
    if (linesError) {
        console.error('Lines Insert Failed:', linesError.message);
        return;
    }
    console.log('Lines Added.');

    // 4. Post Slip (Call RPC)
    console.log('Posting Slip via RPC...');
    const { data: rpcResult, error: rpcError } = await supabase.rpc('accept_payroll_slip_v2_rpc', {
        p_slip_id: slip.id,
        p_journal_description: 'Test Cycle Posting'
    });

    if (rpcError) {
        console.error('RPC Posting Failed:', rpcError.message);
        // Clean up draft if failed
        await supabase.from('payroll_slips').delete().eq('id', slip.id);
        return;
    }

    console.log('Posting Success:', rpcResult);

    // 5. Verify Journal Entry
    if (rpcResult && rpcResult.journal_id) {
        const { data: je, error: jeError } = await supabase.from('journal_entries').select('*').eq('id', rpcResult.journal_id).single();
        if (je) {
            console.log('Journal Entry Verified:', je.id, '| Total Debit:', je.total_debit);
        } else {
            console.error('Journal Entry Not Found!');
        }

        // Clean up Journal & Slip (Cascade should handle lines ?? No, usually explicit. But let's delete JE and Slip)
        // Deleting Slip first.
        // Wait, if posted, might be locked? No, we are admin.
        console.log('Cleaning up...');
        await supabase.from('journal_entries').delete().eq('id', rpcResult.journal_id); // Should cascade lines
        await supabase.from('payroll_slips').delete().eq('id', slip.id); // Should cascade lines
        console.log('Cleanup Complete.');
    }
}

verifyFullCycle();
