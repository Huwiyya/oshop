
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedIntangibles() {
    console.log('Seeding Intangible Asset Accounts...');

    // 1. Get Parent 122 (Intangible Assets)
    const { data: parent } = await supabase
        .from('accounts')
        .select('id, account_type_id')
        .eq('account_code', '122')
        .single();

    if (!parent) {
        console.error('Parent 122 not found. Cannot seed.');
        return;
    }

    const accountsToCreate = [
        {
            account_code: '1222',
            name_ar: 'علامات تجارية',
            name_en: 'Trademarks',
            parent_id: parent.id,
            account_type_id: parent.account_type_id,
            level: 3,
            is_parent: true, // Will have sub-accounts for each asset
            is_active: true,
            currency: 'LYD'
        },
        {
            account_code: '1223',
            name_ar: 'براءات اختراع',
            name_en: 'Patents',
            parent_id: parent.id,
            account_type_id: parent.account_type_id,
            level: 3,
            is_parent: true,
            is_active: true,
            currency: 'LYD'
        },
        {
            account_code: '1224',
            name_ar: 'حقوق نشر وتأليف',
            name_en: 'Copyrights',
            parent_id: parent.id,
            account_type_id: parent.account_type_id,
            level: 3,
            is_parent: true,
            is_active: true,
            currency: 'LYD'
        }
    ];

    for (const acc of accountsToCreate) {
        const { error } = await supabase.from('accounts').upsert(acc, { onConflict: 'account_code' });
        if (error) console.error(`Error creating ${acc.account_code}:`, error.message);
        else console.log(`Account ${acc.account_code} seeded.`);
    }
}

seedIntangibles();
