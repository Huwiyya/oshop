
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateDashboard() {
    console.log('Simulating Dashboard Logic...');

    // 1. Fetch all active accounts
    // Pagination Logic
    let allAccounts: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('accounts_v2')
            .select(`
                *,
                account_type:type_id!inner (
                    category,
                    normal_balance
                )
            `)
            .eq('is_active', true)
            .order('code')
            .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) {
            console.error('Error fetching page', page, error);
            break;
        }

        if (data.length > 0) {
            allAccounts = allAccounts.concat(data);
            if (data.length < pageSize) hasMore = false;
            page++;
        } else {
            hasMore = false;
        }
    }

    const accounts = allAccounts;

    console.log(`Fetched ${accounts.length} accounts.`);

    // 2. Build Hierarchy & Calculate Balances (Roll-up)
    const accountMap = new Map<string, any>();
    accounts.forEach((acc: any) => {
        acc.children = [];
        acc.computed_balance = Number(acc.current_balance) || 0;
        accountMap.set(acc.id, acc);
    });

    const roots: any[] = [];
    accounts.forEach((acc: any) => {
        if (acc.parent_id) {
            const parent = accountMap.get(acc.parent_id);
            if (parent) parent.children.push(acc);
        } else {
            roots.push(acc);
        }
    });

    // Recursive function to sum balances up the tree
    const aggregateBalance = (node: any): number => {
        if (!node.children || node.children.length === 0) {
            return node.computed_balance;
        }
        const childrenSum = node.children.reduce((sum: number, child: any) => sum + aggregateBalance(child), 0);
        // Add children sum to self balance (usually 0 for parents)
        // BUG POTENTIAL: is_group check in original code:
        // node.computed_balance = childrenSum + (node.is_group ? 0 : node.computed_balance);
        node.computed_balance = childrenSum + (node.is_group ? 0 : node.computed_balance);
        return node.computed_balance;
    };

    roots.forEach(aggregateBalance);

    // 3. Filter for Summary View
    const summaryAccounts = accounts.filter((acc: any) => {
        if (acc.level === 3) return true;
        if (acc.level === 2 && ['revenue', 'expense'].includes(acc.account_type.category)) return true;
        return false;
    });

    console.log(`Filtered to ${summaryAccounts.length} summary accounts.`);

    // Check if 4101 is in summaryAccounts
    const acc4101 = summaryAccounts.find((a: any) => a.code === '4101');
    if (acc4101) {
        console.log(`Account 4101 FOUND in summary. Computed Balance: ${acc4101.computed_balance}`);
    } else {
        console.log(`Account 4101 NOT FOUND in summary.`);
    }

    const result = {
        revenue: [] as any[],
        expenses: [] as any[]
    };

    summaryAccounts.forEach((acc: any) => {
        const summaryAcc = { ...acc, current_balance: acc.computed_balance };
        const category = acc.account_type.category;
        if (category === 'revenue') result.revenue.push(summaryAcc);
        else if (category === 'expense') result.expenses.push(summaryAcc);
    });

    const sumBalance = (accs: any[]) =>
        accs.reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0);

    const totalRevenue = sumBalance(result.revenue);
    const totalExpenses = sumBalance(result.expenses);
    const netIncome = totalRevenue - totalExpenses;

    console.log('--- Simulation Results ---');
    console.log(`Total Revenue: ${totalRevenue}`);
    console.log(`Total Expenses: ${totalExpenses}`);
    console.log(`Net Income: ${netIncome}`);
}

simulateDashboard();
