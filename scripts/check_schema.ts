
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkSchema() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔍 Checking Schema for orders_v4...');

    // Fetch one row and check keys
    const { data, error } = await supabase
        .from('orders_v4')
        .select('*')
        .limit(1)
        .single();

    if (data) {
        const keys = Object.keys(data);
        console.log('📋 Available Columns:');
        console.log(keys.join(', '));

        if (keys.includes('walletPaymentAmount')) {
            console.log('\n✅ "walletPaymentAmount" column EXISTS.');
        } else {
            console.log('\n❌ "walletPaymentAmount" column MISSING!');
        }
    } else {
        console.log('❌ Could not fetch data to check schema.', error);
    }
}

checkSchema();
