
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

async function fixItemsAccounts() {
    console.log('Starting Inventory Items Account Fix...');

    // 1. Get IDs for Level 3 and Level 4 Accounts
    const codes = [
        { l3: '1130', l4: '113001', col: 'inventory_account_id' },
        { l3: '5100', l4: '510001', col: 'cogs_account_id' },
        { l3: '4100', l4: '410001', col: 'sales_account_id' }
    ];

    for (const { l3, l4, col } of codes) {
        console.log(`Processing ${l3} -> ${l4} for column ${col}...`);

        const { data: acc3 } = await supabaseAdmin.from('accounts').select('id').eq('account_code', l3).single();
        const { data: acc4 } = await supabaseAdmin.from('accounts').select('id').eq('account_code', l4).single();

        if (!acc4) {
            console.error(`❌ Target Level 4 account ${l4} not found! Run ensure-accounts.ts first.`);
            continue;
        }

        // If Level 3 exists, migrate items pointing to it
        if (acc3) {
            const { data: updatedData, error: updateError } = await supabaseAdmin
                .from('inventory_items')
                .update({ [col]: acc4.id })
                .eq(col, acc3.id)
                .select('id');

            const count = updatedData?.length || 0;

            if (updateError) console.error(`❌ Error migrating ${l3} -> ${l4}:`, updateError.message);
            else console.log(`✅ Migrated ${count} items from ${l3} to ${l4}.`);
        }

        // Also fix NULLs if they should be default?
        // Let's being conservative and only fix specific problematic L3 references first.
        // Actually, if it's NULL, the RPC tries to use default.
        // If RPC default is L3 (because SQL not run), it fails.
        // If we set it to L4 here, we bypass the RPC default!
        // SO: We SHOULD update NULLs to L4 as well to be safe and "fix" it without running SQL if possible.

        const { data: nullData, error: nullError } = await supabaseAdmin
            .from('inventory_items')
            .update({ [col]: acc4.id })
            .is(col, null)
            .select('id');

        const nullCount = nullData?.length || 0;

        if (nullError) console.error(`❌ Error fixing NULLs for ${col}:`, nullError.message);
        else console.log(`✅ Fixed ${nullCount} items with NULL ${col} to ${l4}.`);
    }

    console.log('Inventory Items Fix Complete.');
}

fixItemsAccounts().catch(console.error);
