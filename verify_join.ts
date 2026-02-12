
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyJoin() {
    console.log('Verifying Join (Simulating getPayslipV2)...');

    // Fetch any slip
    const { data: slips } = await supabase.from('payroll_slips').select('id').limit(1);
    if (!slips || slips.length === 0) {
        console.log('No slips to test join.');
        return;
    }

    const slipId = slips[0].id;
    console.log('Testing Join for Slip:', slipId);

    const { data, error } = await supabase
        .from('payroll_slips')
        .select(`*, lines:payroll_slip_lines(*)`)
        .eq('id', slipId)
        .single();

    if (error) {
        console.error('Join Error:', error.message);
        console.error('Full Error:', error);
    } else {
        console.log('Join Success. Lines:', data.lines?.length);
    }
}

verifyJoin();
