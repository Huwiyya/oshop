
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJournalBalance() {
    console.log('Checking Total Debit vs Credit in journal_lines_v2...');

    // We can't sum all lines easily without a function or massive fetch.
    // RPC is best, but let's try paginated fetch stats.

    let totalDebit = 0;
    let totalCredit = 0;

    let page = 0;
    const pageSize = 5000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('journal_lines_v2')
            .select('debit, credit')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error(error);
            break;
        }

        if (data.length > 0) {
            data.forEach(line => {
                totalDebit += Number(line.debit || 0);
                totalCredit += Number(line.credit || 0);
            });
            if (data.length < pageSize) hasMore = false;
            page++;
        } else {
            hasMore = false;
        }
    }

    console.log(`Total Debit: ${totalDebit}`);
    console.log(`Total Credit: ${totalCredit}`);
    console.log(`Net Difference: ${totalDebit - totalCredit}`);
}

checkJournalBalance();
