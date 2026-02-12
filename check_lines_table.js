
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLinesTable() {
    console.log('🔍 Checking for journal_lines_v2...');

    const { data, error } = await supabase
        .from('journal_lines_v2')
        .select('*')
        .limit(1);

    if (error) {
        console.log(`❌ Error: ${error.message}`);
        // Try 'journal_entry_lines_v2' just in case
        console.log('Trying journal_entry_lines_v2...');
        const { data: data2, error: error2 } = await supabase
            .from('journal_entry_lines_v2')
            .select('*')
            .limit(1);

        if (error2) console.log(`❌ Error: ${error2.message}`);
        else console.log('✅ Found journal_entry_lines_v2');
    } else {
        console.log('✅ Found journal_lines_v2');
        if (data && data.length > 0) {
            console.log('Columns:', Object.keys(data[0]).join(', '));
        }
    }
}

checkLinesTable();
