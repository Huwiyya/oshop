
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createLegacyCash() {
    console.log('Creating Legacy Cash Account 111001...');

    // 1. Get Parent 111 (Cash)
    const { data: parent } = await supabase
        .from('accounts')
        .select('id, account_type_id')
        .ilike('account_code', '111')
        .single();

    if (!parent) {
        console.error('Parent 111 not found.');
        return;
    }

    const { error } = await supabase.from('accounts').insert({
        account_code: '111001',
        name_ar: 'النقدية (قديم)',
        name_en: 'System Cash (Legacy)',
        parent_id: parent.id,
        account_type_id: parent.account_type_id,
        level: 4,
        is_parent: false,
        is_active: true,
        currency: 'LYD'
    });

    if (error) {
        if (error.code === '23505') { // Unique violation
            console.log('Account 111001 already exists.');
        } else {
            console.error('Error creating 111001:', error);
        }
    } else {
        console.log('Account 111001 created successfully.');
    }
}

createLegacyCash();
