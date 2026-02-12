const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testCreateCategory() {
    console.log("Testing Create Asset Category...");

    // 1. Check Parents
    const { data: parents, error: pErr } = await supabase
        .from('accounts_v2')
        .select('*')
        .in('code', ['121', '122']);

    console.log("Parents found:", parents ? parents.length : 0);
    if (parents) parents.forEach(p => console.log(`- ${p.code}: ${p.name_ar} (ID: ${p.id})`));

    if (pErr) console.error("Error fetching parents:", pErr);

    if (!parents || parents.length < 2) {
        console.warn("WARNING: Missing one of the parent accounts (121 or 122).");
    }

    // 2. Simulate Creation Logic for '121'
    const parentCode = '121';
    const parent = parents.find(p => p.code === parentCode);

    if (parent) {
        const { data: lastChild } = await supabase
            .from('accounts_v2')
            .select('code')
            .eq('parent_id', parent.id)
            .order('code', { ascending: false })
            .limit(1)
            .single();

        console.log("Last Child Code:", lastChild ? lastChild.code : "None");

        let nextCode;
        if (lastChild) {
            nextCode = (parseInt(lastChild.code) + 1).toString();
        } else {
            nextCode = `${parent.code}01`;
        }
        console.log("Proposed Next Code:", nextCode);

        // Try inserting a query check to see if this code exists
        const { data: conflict } = await supabase.from('accounts_v2').select('id').eq('code', nextCode).single();
        if (conflict) {
            console.error("CONFLICT DETECTED: Code " + nextCode + " already exists!");
        } else {
            console.log("Code " + nextCode + " is available.");
        }
    }
}

testCreateCategory();
