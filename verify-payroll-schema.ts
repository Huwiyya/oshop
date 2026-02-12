import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyPayrollSchema() {
    console.log('🔍 Verifying Payroll Schema V2...');

    const { error } = await supabase.from('payroll_runs_v2').select('id').limit(1);

    if (error) {
        if (error.message.includes('does not exist')) {
            console.error('❌ Payroll tables do not exist yet.');
            console.log('⚠️  Please run the SQL from src/lib/payroll-schema-v2.sql in your Supabase SQL Editor.');
            process.exit(1);
        } else {
            console.error('❌ Unexpected error verifying schema:', error);
        }
    } else {
        console.log('✅ Payroll Schema V2 verified! Tables exist.');
    }
}

verifyPayrollSchema();
