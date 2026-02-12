
import * as dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function ensureAccounts() {
    console.log('Starting Account Verification...');

    const accounts_to_check = [
        { code: '113001', name: 'مخزون عام', name_en: 'General Inventory', parent: '1130' },
        { code: '510001', name: 'تكلفة بضاعة مباعة عامة', name_en: 'General COGS', parent: '5100' },
        { code: '410001', name: 'مبيعات عامة', name_en: 'General Sales', parent: '4100' }
    ];

    for (const acc of accounts_to_check) {
        // Check if exists
        const { data: existing } = await supabaseAdmin
            .from('accounts')
            .select('id')
            .eq('account_code', acc.code)
            .single();

        if (existing) {
            console.log(`✅ Account ${acc.code} already exists.`);
            continue;
        }

        console.log(`Creating Account ${acc.code}...`);

        // Get Parent
        const { data: parent } = await supabaseAdmin
            .from('accounts')
            .select('*')
            .eq('account_code', acc.parent)
            .single();

        if (!parent) {
            console.error(`❌ Parent account ${acc.parent} not found! Cannot create ${acc.code}.`);
            continue;
        }

        // Create
        const { error } = await supabaseAdmin.from('accounts').insert({
            account_code: acc.code,
            name_ar: acc.name,
            name_en: acc.name_en,
            parent_id: parent.id,
            level: 4,
            is_parent: false,
            is_active: true,
            account_type_id: parent.account_type_id,
            currency: 'LYD',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        if (error) {
            console.error(`❌ Error creating ${acc.code}:`, error.message);
        } else {
            console.log(`✅ Created ${acc.code} successfully.`);
        }
    }
    console.log('Account Verification Complete.');
}

ensureAccounts().catch(console.error);
