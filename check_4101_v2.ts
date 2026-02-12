
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check4101() {
    const { data, error } = await supabase
        .from('accounts_v2')
        .select('*, account_type:type_id(*)')
        .eq('code', '4101')
        .single();

    if (error) {
        console.error(error);
    } else {
        console.log('Account 4101:');
        console.log(`- Code: ${data.code}`);
        console.log(`- Level: ${data.level}`);
        console.log(`- Category: ${data.account_type?.category}`);
        console.log(`- Current Balance: ${data.current_balance}`);

        // Check filtering logic
        const matchesLevel3 = data.level === 3;
        const matchesLevel2RevExp = data.level === 2 && ['revenue', 'expense'].includes(data.account_type?.category || '');

        console.log(`- Matches Filter (Level 3 or Level 2 Rev/Exp)? ${matchesLevel3 || matchesLevel2RevExp ? 'YES' : 'NO'}`);
    }
}
check4101();
