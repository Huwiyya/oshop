const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pipupdimlbjiivftgbop.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcHVwZGltbGJqaWl2ZnRnYm9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDczMzMzMCwiZXhwIjoyMDg2MzA5MzMwfQ.3YWHGgmV5old4xJpnrUdqruz5C6wYPDDf5PlLywfmsQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAccounts() {
    try {
        console.log('Checking fixed asset accounts...');

        // Check accounts starting with 121 (Fixed Assets)
        const { data: accounts, error } = await supabase
            .from('accounts_v2')
            .select('id, code, name_ar, level, current_balance, is_active')
            .like('code', '121%')
            .order('code');

        if (error) { console.error(error); return; }

        console.log('\\nFixed Asset Accounts (121xxx):');
        console.log('==============================');
        for (const acc of accounts) {
            console.log(`${acc.code} | ${acc.name_ar}`);
            console.log(`  Level: ${acc.level}, Balance: ${acc.current_balance}, Active: ${acc.is_active}`);
        }

        // Now check if there are journal lines for these accounts
        console.log('\\n\\nChecking journal entries for asset accounts...');
        const assetAccountIds = accounts.map(a => a.id);

        const { data: lines, error: lineError } = await supabase
            .from('journal_lines_v2')
            .select('account_id, debit, credit')
            .in('account_id', assetAccountIds);

        if (lineError) console.error(lineError);
        else {
            console.log(`Found ${lines?.length || 0} journal lines`);
            if (lines) {
                const balances = lines.reduce((acc, line) => {
                    if (!acc[line.account_id]) acc[line.account_id] = 0;
                    acc[line.account_id] += (Number(line.debit) || 0) - (Number(line.credit) || 0);
                    return acc;
                }, {});

                console.log('\\nCalculated Balances from Journal Lines:');
                Object.entries(balances).forEach(([id, bal]) => {
                    const account = accounts.find(a => a.id === id);
                    console.log(`${account?.code}: ${bal}`);
                });
            }
        }

    } catch (e) {
        console.error(e);
    }
}

checkAccounts();
