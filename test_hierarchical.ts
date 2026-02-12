
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testHierarchical() {
    console.log('Testing create_hierarchical_account_rpc for Parent 1222...');

    // Get 1222 ID
    const { data: parent } = await supabase.from('accounts').select('id').eq('account_code', '1222').single();
    if (!parent) {
        console.error('Parent 1222 not found!');
        return;
    }
    console.log('Parent 1222 ID:', parent.id);

    const params = {
        p_name_ar: 'تجربة فرعية',
        p_name_en: 'Sub Test',
        p_parent_id: parent.id,
        p_description: 'Debug Hierarchical',
        p_currency: 'LYD'
    };

    const { data, error } = await supabase.rpc('create_hierarchical_account_rpc', params);

    if (error) {
        console.error('RPC Error:', error);
    } else {
        console.log('RPC Result (New Account ID):', data);
    }
}

testHierarchical();
