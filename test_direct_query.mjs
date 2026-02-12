// Quick test file to directly call getChartOfAccountsV2
import { supabaseAdmin } from './src/lib/supabase-admin';

async function testQuery() {
    console.log('🧪 Testing Supabase query directly...\n');

    try {
        const { data, error } = await supabaseAdmin
            .from('accounts_v2')
            .select(`
                *,
                account_type:account_types_v2!type_id (*)
            `)
            .order('code', { ascending: true });

        if (error) {
            console.error('❌ Error:', error);
            return;
        }

        console.log(`✅ Total accounts: ${data?.length}`);
        console.log('\n📋 Account codes:', data?.map(a => a.code).sort().join(', '));

        const has3 = data?.some(a => a.code === '3');
        const has4 = data?.some(a => a.code === '4');
        const has5 = data?.some(a => a.code === '5');

        console.log('\n🎯 Codes 3, 4, 5 present?');
        console.log(`   3: ${has3 ? '✅' : '❌'}`);
        console.log(`   4: ${has4 ? '✅' : '❌'}`);
        console.log(`   5: ${has5 ? '✅' : '❌'}`);

        if (!has3 || !has4 || !has5) {
            console.log('\n⚠️  Missing accounts! Checking raw data...');
            const missing = await supabaseAdmin
                .from('accounts_v2')
                .select('code, name_ar, is_active, type_id')
                .in('code', ['3', '4', '5']);

            console.log('Missing accounts in DB:', missing.data);
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testQuery().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
