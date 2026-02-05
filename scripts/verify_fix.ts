
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function verifyFix() {
    console.log('✅ VERIFYING FIX...');

    // Setup
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get user 'test' (from previous context) or any user
    const { data: users } = await supabase.from('users_v4').select('*').limit(1);
    const user = users?.[0];

    if (!user) { console.log('No user found'); return; }

    console.log(`👤 User: ${user.name}, Balance: ${user.walletBalance}`);

    // 2. Try to set balance to -10 (Direct update test)
    console.log('🔄 Attempting to set negative balance (-10)...');

    const { error } = await supabase
        .from('users_v4')
        .update({ walletBalance: -10 })
        .eq('id', user.id);

    if (error) {
        console.error('❌ FAILED! Constraint still active:', error.message);
    } else {
        console.log('🎉 SUCCESS! Negative balance accepted.');

        // Restore positive balance
        await supabase.from('users_v4').update({ walletBalance: 50 }).eq('id', user.id);
        console.log('🔄 Restored balance to 50 for testing.');
    }
}

verifyFix();
