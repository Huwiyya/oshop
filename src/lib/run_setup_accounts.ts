import { supabaseAdmin } from './supabase-admin';
import * as fs from 'fs';
import * as path from 'path';

async function runSQL() {
    console.log('🚀 Running SQL setup for missing accounts...\n');

    try {
        const sqlPath = path.join(import.meta.dirname, 'setup_missing_accounts.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📝 Executing SQL...\n');

        const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('❌ SQL Error:', error);
            throw error;
        }

        console.log('✅ SQL executed successfully!');
        console.log('Result:', data);

        // Verify the accounts
        const { data: accounts } = await supabaseAdmin
            .from('accounts_v2')
            .select('code, name_ar, name_en')
            .eq('level', 1)
            .order('code');

        console.log('\n📊 Root accounts in system:');
        accounts?.forEach(acc => {
            console.log(`   ${acc.code} - ${acc.name_ar} (${acc.name_en})`);
        });

    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

runSQL()
    .then(() => {
        console.log('\n🎉 Setup complete!');
        process.exit(0);
    });
