
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkChildren() {
    console.log('Checking children of 1110...');

    const { data: parent } = await supabase.from('accounts_v2').select('id').eq('code', '1110').single();

    const { data: children } = await supabase
        .from('accounts_v2')
        .select('code, name_ar, current_balance')
        .eq('parent_id', parent.id);

    console.log('Children:', children);
}

checkChildren();
