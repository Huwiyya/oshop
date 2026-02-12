
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugAccounts() {
    console.log('--- Debugging Accounts Structure ---');

    // 1. Check Parent 2130
    const { data: parent2130 } = await supabase.from('accounts').select('*').eq('account_code', '2130').single();
    console.log('Parent 2130:', parent2130);

    if (parent2130) {
        const { data: children2130 } = await supabase.from('accounts').select('id, name_ar, account_code').eq('parent_id', parent2130.id);
        console.log('Children of 2130 (Standard Employees):', children2130);
    }

    // 2. Search for accounts with "Salary" or "Employee" in description or name
    console.log('\n--- Searching for misplaced employees ---');
    const { data: potentialEmployees } = await supabase
        .from('accounts')
        .select('id, name_ar, account_code, parent_id, description')
        .or('name_ar.ilike.%موظف%,name_en.ilike.%employee%,description.ilike.%salary%')
        .limit(20);

    console.log('Potential Misplaced Employees:', potentialEmployees);

    // 3. Dump all Level 3/4 Liabilities to see structure
    console.log('\n--- Dumping Liability Structure (Code starts with 2) ---');
    const { data: liabilities } = await supabase
        .from('accounts')
        .select('id, name_ar, account_code, parent_id')
        .like('account_code', '2%')
        .order('account_code');

    // Build simple tree
    const map = new Map();
    liabilities?.forEach(a => map.set(a.id, a));
    liabilities?.forEach(a => {
        const p = map.get(a.parent_id);
        if (p) {
            if (!p.children) p.children = [];
            p.children.push(a);
        }
    });

    const roots = liabilities?.filter(a => !map.get(a.parent_id) || a.account_code.length === 1);

    function printTree(node: any, depth = 0) {
        console.log('  '.repeat(depth) + `${node.account_code} - ${node.name_ar}`);
        if (node.children) {
            node.children.forEach((c: any) => printTree(c, depth + 1));
        }
    }

    roots?.forEach(r => printTree(r));
}

debugAccounts();
