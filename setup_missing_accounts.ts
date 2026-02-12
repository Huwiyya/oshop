import { supabaseAdmin } from './src/lib/supabase-admin';

async function setupMissingAccounts() {
    console.log('🚀 Setting up missing account categories...\n');

    try {
        // 1. Get account type IDs
        const { data: types, error: typesError } = await supabaseAdmin
            .from('account_types_v2')
            .select('*');

        if (typesError) throw typesError;

        console.log('📊 Found account types:', types);

        const equityType = types?.find(t => t.category === 'equity');
        const revenueType = types?.find(t => t.category === 'revenue');
        const expenseType = types?.find(t => t.category === 'expense');

        if (!equityType || !revenueType || !expenseType) {
            throw new Error('Missing required account types in account_types_v2');
        }

        // 2. Check existing root accounts
        const { data: existingAccounts } = await supabaseAdmin
            .from('accounts_v2')
            .select('code, name_ar, name_en')
            .in('code', ['3', '4', '5'])
            .order('code');

        console.log('\n📋 Existing root accounts:', existingAccounts);

        const accountsToCreate = [];

        // 3. Create Equity (3) if missing
        if (!existingAccounts?.find(a => a.code === '3')) {
            accountsToCreate.push({
                code: '3',
                name_ar: 'حقوق الملكية',
                name_en: 'Equity',
                type_id: equityType.id,
                parent_id: null,
                level: 1,
                is_group: true,
                is_active: true,
                is_system: true,
                current_balance: 0,
                currency: 'LYD',
                description: 'Root equity accounts'
            });
        }

        // 4. Create Revenue (4) if missing
        if (!existingAccounts?.find(a => a.code === '4')) {
            accountsToCreate.push({
                code: '4',
                name_ar: 'الإيرادات',
                name_en: 'Revenue',
                type_id: revenueType.id,
                parent_id: null,
                level: 1,
                is_group: true,
                is_active: true,
                is_system: true,
                current_balance: 0,
                currency: 'LYD',
                description: 'Root revenue accounts'
            });
        }

        // 5. Create Expenses (5) if missing
        if (!existingAccounts?.find(a => a.code === '5')) {
            accountsToCreate.push({
                code: '5',
                name_ar: 'المصروفات',
                name_en: 'Expenses',
                type_id: expenseType.id,
                parent_id: null,
                level: 1,
                is_group: true,
                is_active: true,
                is_system: true,
                current_balance: 0,
                currency: 'LYD',
                description: 'Root expense accounts'
            });
        }

        if (accountsToCreate.length === 0) {
            console.log('\n✅ All root accounts already exist!');
            return;
        }

        console.log(`\n📝 Creating ${accountsToCreate.length} missing root accounts...`);

        const { data: created, error: createError } = await supabaseAdmin
            .from('accounts_v2')
            .insert(accountsToCreate)
            .select();

        if (createError) {
            console.error('❌ Error creating accounts:', createError);
            throw createError;
        }

        console.log('\n✅ Successfully created accounts:');
        created?.forEach(acc => {
            console.log(`   ${acc.code} - ${acc.name_ar} (${acc.name_en})`);
        });

        // 6. Verify final state
        const { data: finalAccounts } = await supabaseAdmin
            .from('accounts_v2')
            .select('code, name_ar, name_en, type_id')
            .eq('level', 1)
            .order('code');

        console.log('\n📊 Final root accounts:');
        finalAccounts?.forEach(acc => {
            console.log(`   ${acc.code} - ${acc.name_ar} (${acc.name_en})`);
        });

    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

setupMissingAccounts()
    .then(() => {
        console.log('\n🎉 Setup complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
