
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAsset() {
    console.log('Checking Account 1110...');

    // 1. Account Details
    const { data: acc } = await supabase
        .from('accounts_v2')
        .select('*, account_type:type_id(*)')
        .eq('code', '1110')
        .single();

    console.log('Account:', acc);

    // 2. Journal Lines
    const { data: lines } = await supabase
        .from('journal_lines_v2')
        .select('debit, credit, description')
        .eq('account_id', acc.id)
        .limit(10);

    console.log('First 10 Lines:', lines);

    // 3. Sum all lines
    const { data: allLines } = await supabase
        .from('journal_lines_v2')
        .select('debit, credit')
        .eq('account_id', acc.id);

    const totalDr = allLines?.reduce((sum, line) => sum + Number(line.debit), 0) || 0;
    const totalCr = allLines?.reduce((sum, line) => sum + Number(line.credit), 0) || 0;
    console.log(`Total Dr: ${totalDr}, Total Cr: ${totalCr}, Net: ${totalDr - totalCr}`);
}

checkAsset();
