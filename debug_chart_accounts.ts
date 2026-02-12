import { supabaseAdmin } from './src/lib/supabase-admin';

async function debugAccounts() {
    console.log('🔍 Debugging Chart of Accounts...\n');

    try {
        // 1. Check raw accounts data
        const { data: allAccounts, error } = await supabaseAdmin
            .from('accounts_v2')
            .select('id, code, name_ar, name_en, level, parent_id, is_active, type_id')
            .order('code');

        if (error) {
            console.error('❌ Error fetching accounts:', error);
            return;
        }

        console.log('📊 Total accounts in DB:', allAccounts?.length);
        console.log('\n🔢 Level 1 accounts (Root):');
        allAccounts?.filter(a => a.level === 1).forEach(acc => {
            console.log(`   ${acc.code.padEnd(4)} | ${acc.name_ar.padEnd(20)} | ${acc.name_en.padEnd(20)} | parent_id: ${acc.parent_id} | active: ${acc.is_active}`);
        });

        // 2. Check account types
        const { data: types } = await supabaseAdmin
            .from('account_types_v2')
            .select('*');

        console.log('\n📋 Account Types:');
        types?.forEach(t => {
            const count = allAccounts?.filter(a => a.type_id === t.id).length || 0;
            console.log(`   ${t.category.padEnd(10)} | ${t.name_en.padEnd(20)} | Accounts: ${count}`);
        });

        // 3. Check specific codes
        console.log('\n🎯 Checking codes 3, 4, 5:');
        ['3', '4', '5'].forEach(code => {
            const acc = allAccounts?.find(a => a.code === code);
            if (acc) {
                console.log(`   ✅ ${code}: ${acc.name_ar} (ID: ${acc.id})`);
            } else {
                console.log(`   ❌ ${code}: NOT FOUND`);
            }
        });

        // 4. Check what getChartOfAccountsV2 would return
        const { data: withTypes } = await supabaseAdmin
            .from('accounts_v2')
            .select(`
                *,
                account_type:type_id (*)
            `)
            .order('code', { ascending: true });

        console.log('\n🔎 Accounts with type info (like getChartOfAccountsV2):');
        console.log('   Total returned:', withTypes?.length);
        console.log('   Codes:', withTypes?.map(a => a.code).join(', '));

    } catch (error) {
        console.error('❌ Debug failed:', error);
    }
}

debugAccounts().then(() => process.exit(0));
