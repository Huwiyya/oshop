'use server';

import { supabaseAdmin as supabase } from './supabase-admin';
import { AccountV2 } from './accounting-v2-types';
import { revalidatePath } from 'next/cache';

// =============================================================================
// REPORT TYPES
// =============================================================================

export interface ReportItem {
    account_id: string;
    account_code: string;
    account_name: string;
    level: number;
    amount: number;
    children?: ReportItem[];
}

export interface BalanceSheetV2 {
    assets: ReportItem[];
    liabilities: ReportItem[];
    equity: ReportItem[];
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    is_balanced: boolean;
}

export interface IncomeStatementV2 {
    revenue: ReportItem[];
    expenses: ReportItem[];
    total_revenue: number;
    total_expenses: number;
    net_income: number;
}

// =============================================================================
// ACTIONS
// =============================================================================

export async function getBalanceSheetV2(): Promise<{ success: boolean; data?: BalanceSheetV2; error?: string }> {
    // 1. Fetch relevant accounts (Assets, Liabilities, Equity)
    const { data: accounts, error } = await supabase
        .from('accounts_v2')
        .select(`
            *,
            account_type:type_id (category, normal_balance)
        `)
        .in('account_type.category', ['asset', 'liability', 'equity']) // This filter needs to be correct. 
        // Supabase join filter syntax: .filter('account_type.category', 'in', '("asset","liability","equity")')
        // OR fetch all and filter in JS if small dataset. COA is usually small (< 1000).
        .order('code', { ascending: true });

    if (error) return { success: false, error: error.message };
    if (!accounts) return { success: false, error: 'No accounts found' };

    // 2. Filter in JS to be safe with join syntax
    const assetAccounts = accounts.filter(a => a.account_type.category === 'asset');
    const liabilityAccounts = accounts.filter(a => a.account_type.category === 'liability');
    const equityAccounts = accounts.filter(a => a.account_type.category === 'equity');

    // 3. Build Trees (Recursively or Iteratively)
    // Helper to build hierarchy
    const buildTree = (subset: any[], parentId: string | null = null): ReportItem[] => {
        return subset
            .filter(a => a.parent_id === parentId)
            .map(a => {
                const children = buildTree(subset, a.id);
                // Calculate total including children?
                // In V2 design, parent accounts don't have transactions, so their "balance" is sum of children?
                // The DB logic `update_account_balances_v2` updates the specific account in the line.
                // If I post to a child, the parent doesn't auto-update in the DB schema I wrote (I only updated the specific account).
                // WAIT! My trigger `update_account_balances_v2` only updates `a.id`.
                // If `is_group` is true, it shouldn't have transactions.
                // So current_balance on a group account might be 0.
                // WE NEED TO AGGREGATE IN SOFTWARE for the report.

                // Recursive sum
                const selfBalance = a.current_balance || 0;
                const childrenBalance = children.reduce((sum, child) => sum + child.amount, 0);

                // For Assets/Expenses (Debit normal): Positive
                // For Liab/Equity/Rev (Credit normal): Positive
                // The DB stores strictly: Debit +, Credit - ? No, `update_account_balances_v2` does: 
                // Debit Normal: Balance += (Dr - Cr). 
                // Credit Normal: Balance += (Cr - Dr).
                // So `current_balance` is always positive magnitude if normal.

                const total = selfBalance + childrenBalance;

                return {
                    account_id: a.id,
                    account_code: a.code,
                    account_name: a.name_ar, // or name_en based on locale
                    level: a.level,
                    amount: total,
                    children: children.length > 0 ? children : undefined
                };
            });
    };

    // Need to find Root IDs for each category to start the tree
    // Actually, just find items with level=1 or parent_id=null within the subset?
    // The subset might not contain the absolute root if I filtered by category? 
    // Yes, account_types dictate category.

    // The issue: A parent might be level 1.
    const assetTree = buildTree(assetAccounts, null); // Assumes roots have parent_id = null
    // If roots are not in `assetAccounts` (e.g. if I missed them), this fails.
    // In seeding, roots were created.

    // Wait, `assetTree` will be empty if I pass `null` but the root accounts have `parent_id`? 
    // In schema: `parent_id UUID REFERENCES ...`. Roots have NULL.
    // However, if I filter by category, do roots have the category? Yes.

    // BUT! Some implementations have a single "Assets" root. 
    // Let's check the seed.
    // Root "Assets" (code 1) has `parent_id` NULL.
    // So `buildTree(assetAccounts, null)` should work.

    // Actually, `buildTree` needs to handle the case where "Assets" (level 1) is the root.
    // It will find it.

    const assets = assetTree;
    const liabilities = buildTree(liabilityAccounts, null);
    const equity = buildTree(equityAccounts, null);

    // 4. Calculate Totals
    const sumTree = (items: ReportItem[]) => items.reduce((sum, item) => sum + item.amount, 0);

    const totalAssets = sumTree(assets);
    const totalLiabilities = sumTree(liabilities);
    const totalEquity = sumTree(equity);

    // Net Income calc (Revenue - Expense) to add to Equity?
    // Standard Balance Sheet needs Current Year Earnings.
    // I should calculate Net Income and append it to Equity section dynamically.
    const incomeParams = await getIncomeStatementV2();
    const netIncome = incomeParams.success ? (incomeParams.data?.net_income || 0) : 0;

    // Add "Net Income" as a virtual item in Equity
    equity.push({
        account_id: 'virtual-net-income',
        account_code: 'NI',
        account_name: 'صافي ربح الفترة',
        level: 2,
        amount: netIncome
    });

    // Recalculate Equity Total
    const finalTotalEquity = totalEquity + netIncome;

    return {
        success: true,
        data: {
            assets,
            liabilities,
            equity,
            total_assets: totalAssets,
            total_liabilities: totalLiabilities,
            total_equity: finalTotalEquity,
            is_balanced: Math.abs(totalAssets - (totalLiabilities + finalTotalEquity)) < 0.1
        }
    };
}

export async function getIncomeStatementV2(): Promise<{ success: boolean; data?: IncomeStatementV2; error?: string }> {
    const { data: accounts, error } = await supabase
        .from('accounts_v2')
        .select(`
            *,
            account_type:type_id (category, normal_balance)
        `)
        .in('account_type.category', ['revenue', 'expense'])
        .order('code', { ascending: true });

    if (error) return { success: false, error: error.message };
    if (!accounts) return { success: false, error: 'No accounts found' };

    const revAccounts = accounts.filter(a => a.account_type.category === 'revenue');
    const expAccounts = accounts.filter(a => a.account_type.category === 'expense');

    const buildTree = (subset: any[], parentId: string | null = null): ReportItem[] => {
        return subset
            .filter(a => a.parent_id === parentId)
            .map(a => {
                const children = buildTree(subset, a.id);
                // Report Logic: Aggregation
                const selfBalance = a.current_balance || 0;
                const childrenBalance = children.reduce((sum, child) => sum + child.amount, 0);
                const total = selfBalance + childrenBalance;

                return {
                    account_id: a.id,
                    account_code: a.code,
                    account_name: a.name_ar,
                    level: a.level,
                    amount: total,
                    children: children.length > 0 ? children : undefined
                };
            });
    };

    const revenue = buildTree(revAccounts, null);
    const expenses = buildTree(expAccounts, null);

    const sumTree = (items: ReportItem[]) => items.reduce((sum, item) => sum + item.amount, 0);

    const totalRevenue = sumTree(revenue);
    const totalExpenses = sumTree(expenses);

    return {
        success: true,
        data: {
            revenue,
            expenses,
            total_revenue: totalRevenue,
            total_expenses: totalExpenses,
            net_income: totalRevenue - totalExpenses
        }
    };
}
