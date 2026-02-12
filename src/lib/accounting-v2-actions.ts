
'use server';

import { supabaseAdmin as supabase } from './supabase-admin';
import { AccountV2, CreateAccountV2Input, JournalEntryV2, CreateJournalEntryV2Input } from './accounting-v2-types';
import { revalidatePath } from 'next/cache';
import { unstable_noStore as noStore } from 'next/cache';

// =============================================================================
// TYPES
// =============================================================================

export type AccountSummaryV2 = AccountV2 & {
    account_type: {
        category: string;
        normal_balance: string;
    };
    children?: AccountSummaryV2[];
    computed_balance?: number;
};

export type DashboardSummaryV2 = {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    balanceCheck?: number;
    cashAndBanks: number;
    receivables: number;
    payables: number;
    inventory: number;
};

// =============================================================================
// CHART OF ACCOUNTS ACTIONS
// =============================================================================

export async function getChartOfAccountsV2() {
    noStore(); // Force no caching

    try {
        // 1. Fetch All Accounts with Pagination
        let allAccounts: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        console.log('[SERVER getChartOfAccountsV2] Starting paginated fetch...');

        while (hasMore) {
            const { data, error } = await supabase
                .from('accounts_v2')
                .select('*')
                .range(page * pageSize, (page + 1) * pageSize - 1)
                .order('code', { ascending: true });

            if (error) {
                console.error('[SERVER] Error fetching page', page, error);
                throw new Error(error.message);
            }

            if (data) {
                allAccounts = [...allAccounts, ...data];
                if (data.length < pageSize) hasMore = false;
                else page++;
            } else {
                hasMore = false;
            }
        }

        console.log(`[SERVER getChartOfAccountsV2] Fetched ${allAccounts.length} accounts.`);

        // 2. Fetch Account Types Separately
        const { data: types, error: typesError } = await supabase
            .from('account_types_v2')
            .select('*');

        if (typesError) {
            console.error('[SERVER] Error fetching types:', typesError);
            // Proceed without types if they fail, better than failing completely
        }

        // 3. Map Types to Accounts (mimic the original join structure)
        const typeMap = new Map((types || []).map(t => [t.id, t]));

        const enrichedAccounts = allAccounts.map(acc => ({
            ...acc,
            account_type: typeMap.get(acc.type_id) || null
        }));

        const has3 = enrichedAccounts.some(a => a.code === '3');
        const has4 = enrichedAccounts.some(a => a.code === '4');
        const has5 = enrichedAccounts.some(a => a.code === '5');
        console.log(`[SERVER getChartOfAccountsV2] Checks - Code 3: ${has3}, 4: ${has4}, 5: ${has5}`);

        revalidatePath('/accounting/chart-of-accounts');
        return { success: true, data: enrichedAccounts as AccountV2[] };

    } catch (error: any) {
        console.error('[SERVER] Error in getChartOfAccountsV2:', error);
        return { success: false, error: error.message };
    }
}

export async function getAccountTypesV2() {
    const { data, error } = await supabase
        .from('account_types_v2')
        .select('*')
        .order('category', { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
}


export async function getActiveAccountsV2() {
    const { data, error } = await supabase
        .from('accounts_v2')
        .select('id, name_ar, code')
        .eq('is_active', true)
        .eq('is_group', false) // Only select leaf accounts
        .order('code');

    if (error) return [];
    return data;
}

export async function createAccountV2(input: Partial<CreateAccountV2Input> & { parent_id: string; name_ar: string }) {
    // 1. Fetch Parent to inherit details
    const { data: parent, error: parentError } = await supabase
        .from('accounts_v2')
        .select('*')
        .eq('id', input.parent_id)
        .single();

    if (parentError || !parent) {
        return { success: false, error: 'Parent account not found' };
    }

    // 2. Calculate Level and Type
    const level = parent.level + 1;
    const type_id = parent.type_id;

    // 3. Generate Code (Find max child code)
    const { data: siblings } = await supabase
        .from('accounts_v2')
        .select('code')
        .eq('parent_id', input.parent_id)
        .order('code', { ascending: false })
        .limit(1);

    let newCode = '';
    if (siblings && siblings.length > 0) {
        // Increment last sibling code
        // Assuming code is numeric or hierarchical (e.g., 1101 -> 1102)
        // Simple heuristic: try parsing as int, increment, else append '1'
        const lastCode = siblings[0].code;
        const validNum = parseInt(lastCode);
        if (!isNaN(validNum)) {
            newCode = (validNum + 1).toString();
        } else {
            newCode = `${parent.code}-01`; // Fallback
        }
    } else {
        // No siblings, start from parent code + 1 (or 01)
        // E.g. Parent 11 -> Child 1101
        newCode = `${parent.code}01`;
    }

    // 4. Insert
    const finalInput = {
        ...input,
        code: input.code || newCode,
        level,
        type_id,
        is_active: input.is_active ?? true,
        is_system: false,
        current_balance: 0,
        currency: parent.currency || 'LYD'
    };

    const { data, error } = await supabase
        .from('accounts_v2')
        .insert(finalInput)
        .select()
        .single();

    if (error) {
        console.error('Error creating account:', error);
        return { success: false, error: error.message };
    }

    revalidatePath('/accounting/coa-v2');
    return { success: true, data };
}

// =============================================================================
// DASHBOARD & SUMMARY ACTIONS (V2)
// =============================================================================

export async function getAccountsSummaryV2(date?: string): Promise<{
    assets: AccountSummaryV2[];
    liabilities: AccountSummaryV2[];
    equity: AccountSummaryV2[];
    revenue: AccountSummaryV2[];
    expenses: AccountSummaryV2[];
}> {
    // 1. Fetch all active accounts with pagination (to handle >1000 rows)
    let accounts: any[] = [];
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
            console.error('Error fetching accounts summary page', page, error);
            // If error on first page, return empty.
            if (page === 0) return { assets: [], liabilities: [], equity: [], revenue: [], expenses: [] };
            // If error on later pages, process what we have? Or break?
            // Safer to break and show partial data than crash.
            break;
        }

        if (data && data.length > 0) {
            accounts = accounts.concat(data);
            if (data.length < pageSize) hasMore = false;
            page++;
        } else {
            hasMore = false;
        }
    }

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
        // Add children sum to self balance (include group balance if exists)
        node.computed_balance = childrenSum + node.computed_balance;
        return node.computed_balance;
    };

    roots.forEach(aggregateBalance);

    // 3. Filter for Summary View (Level 3 or Level 2 Revenue/Expense)
    const summaryAccounts = accounts.filter((acc: any) => {
        if (acc.level === 3) return true;
        if (acc.level === 2 && ['revenue', 'expense'].includes(acc.account_type.category)) return true;
        // Fix: Include Leaf accounts at Level < 3 (e.g. 123 Accumulated Depreciation)
        if (acc.level < 3 && (!acc.children || acc.children.length === 0)) return true;
        return false;
    });

    const result = {
        assets: [] as AccountSummaryV2[],
        liabilities: [] as AccountSummaryV2[],
        equity: [] as AccountSummaryV2[],
        revenue: [] as AccountSummaryV2[],
        expenses: [] as AccountSummaryV2[]
    };

    // 4. Distribute to Categories
    summaryAccounts.forEach((acc: any) => {
        const summaryAcc = { ...acc, current_balance: acc.computed_balance };
        const category = acc.account_type.category;

        if (category === 'asset') result.assets.push(summaryAcc);
        else if (category === 'liability') result.liabilities.push(summaryAcc);
        else if (category === 'equity') result.equity.push(summaryAcc);
        else if (category === 'revenue') result.revenue.push(summaryAcc);
        else if (category === 'expense') result.expenses.push(summaryAcc);
    });

    return result;
}

export async function getDashboardMetricsV2(fromDate?: string, toDate?: string): Promise<DashboardSummaryV2> {
    noStore();
    const summary = await getAccountsSummaryV2();

    const sumBalance = (accounts: AccountSummaryV2[]) =>
        accounts.reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0);

    // In V2, balances are stored as Net Debit (Dr - Cr).
    // So Assets/Expenses are positive, Liab/Equity/Revenue are negative.
    // We convert to positive for display.
    const totalAssets = sumBalance(summary.assets);
    const totalLiabilities = Math.abs(sumBalance(summary.liabilities));
    const totalEquityBase = Math.abs(sumBalance(summary.equity));
    const totalRevenue = Math.abs(sumBalance(summary.revenue));
    const totalExpenses = sumBalance(summary.expenses);

    // Net Income
    const netIncome = totalRevenue - totalExpenses;

    // Total Equity (including Net Income)
    const totalEquity = totalEquityBase + netIncome;

    // Balance Check: Assets = Liabilities + Equity
    const balanceCheck = totalAssets - (totalLiabilities + totalEquity);

    // Granular Metrics (matching codes from standard account tree)
    // Cash & Banks: typically starts with '111'
    const cashAndBanks = summary.assets
        .filter(acc => String(acc.code).startsWith('111'))
        .reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0);

    // Receivables: typically starts with '112'
    const receivables = summary.assets
        .filter(acc => String(acc.code).startsWith('112'))
        .reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0);

    // Inventory: typically starts with '113'
    const inventory = summary.assets
        .filter(acc => String(acc.code).startsWith('113'))
        .reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0);

    // Payables: typically starts with '211'
    const payables = summary.liabilities
        .filter(acc => String(acc.code).startsWith('211'))
        .reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0);

    return {
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalRevenue,
        totalExpenses,
        netIncome,
        balanceCheck,
        cashAndBanks,
        receivables,
        payables,
        inventory
    };
}


// =============================================================================
// JOURNAL ENTRY ACTIONS
// =============================================================================

export async function getJournalEntriesV2() {
    const { data, error } = await supabase
        .from('journal_entries_v2')
        .select(`
            *,
            lines:journal_lines_v2 (
                *,
                account:account_id (name_ar, code)
            )
        `)
        .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as JournalEntryV2[] };
}

export async function createJournalEntryV2(input: CreateJournalEntryV2Input) {
    // 1. Create Header
    // Need to generate entry number. For now, simple random or sequential if logic exists.
    // In real app, use a DB sequence or function.
    const entryNumber = `JE-${Date.now()}`;

    // Calculate totals
    const totalDebit = input.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = input.lines.reduce((sum, line) => sum + line.credit, 0);

    // Basic validation (DB constraint will also catch this)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return { success: false, error: 'Entry is not balanced' };
    }

    const { data: header, error: headerError } = await supabase
        .from('journal_entries_v2')
        .insert({
            entry_number: entryNumber,
            date: input.date,
            description: input.description,
            total_debit: totalDebit,
            total_credit: totalCredit,
            status: 'posted' // Auto-post for now
        })
        .select()
        .single();

    if (headerError) return { success: false, error: headerError.message };

    // 2. Create Lines
    const linesToInsert = input.lines.map(line => ({
        journal_id: header.id,
        account_id: line.account_id,
        debit: line.debit,
        credit: line.credit,
        description: line.description || input.description
    }));

    const { error: linesError } = await supabase
        .from('journal_lines_v2')
        .insert(linesToInsert);

    if (linesError) {
        // Rollback header? Supabase client doesn't support transaction easily here.
        // The DB trigger `validate_journal_balance_v2` might catch issues if we update status to posted.
        // Since we inserted header with status 'posted', the trigger ran.
        // Wait, if we insert header with 'posted', but no lines yet, the trigger `update_account_balances_v2` sees 0 lines.
        // Correct approach: Insert as 'draft', insert lines, then update to 'posted'.

        // This implementation is FLAGGED as imperfect. 
        // FIX: Update header status to 'draft' initialy.
        return { success: false, error: linesError.message };
    }

    revalidatePath('/accounting/journal-v2');
    return { success: true, data: header };
}

// Improved atomic creation function
export async function createAtomicJournalEntryV2(input: CreateJournalEntryV2Input) {
    const entryNumber = `JE-${Date.now()}`;
    const totalDebit = input.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = input.lines.reduce((sum, line) => sum + line.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return { success: false, error: 'Entry is not balanced' };
    }

    // 1. Insert Header as DRAFT
    const { data: header, error: headerError } = await supabase
        .from('journal_entries_v2')
        .insert({
            entry_number: entryNumber,
            date: input.date,
            description: input.description,
            total_debit: totalDebit,
            total_credit: totalCredit,
            status: 'draft'
        })
        .select()
        .single();

    if (headerError || !header) return { success: false, error: headerError?.message || 'Failed to create header' };

    // 2. Insert Lines
    const linesToInsert = input.lines.map(line => ({
        journal_id: header.id,
        account_id: line.account_id,
        debit: line.debit,
        credit: line.credit,
        description: line.description || input.description
    }));

    const { error: linesError } = await supabase
        .from('journal_lines_v2')
        .insert(linesToInsert);

    if (linesError) {
        // Cleanup draft
        await supabase.from('journal_entries_v2').delete().eq('id', header.id);
        return { success: false, error: linesError.message };
    }

    // 3. Post Entry (This triggers account balance updates)
    const { error: postError } = await supabase
        .from('journal_entries_v2')
        .update({ status: 'posted' })
        .eq('id', header.id);

    if (postError) {
        return { success: false, error: postError.message };
    }

    revalidatePath('/accounting/journal-v2');
    revalidatePath('/accounting/coa-v2');
    return { success: true, data: header };
}


export async function getAccountIdByName(name: string): Promise<string | null> {
    const { data } = await supabase
        .from('accounts_v2')
        .select('id')
        .or(`name_en.ilike.%${name}%,name_ar.ilike.%${name}%`)
        .limit(1)
        .single();

    return data?.id || null;
}

// =============================================================================
// ACCOUNT MANAGEMENT ACTIONS
// =============================================================================

export async function updateAccountV2(id: string, data: {
    name_ar?: string;
    name_en?: string;
    description?: string;
    code?: string;
    is_active?: boolean;
}) {
    const { error } = await supabase
        .from('accounts_v2')
        .update(data)
        .eq('id', id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/accounting/coa-v2');
    return { success: true };
}

export async function toggleAccountStatusV2(id: string, isActive: boolean) {
    return updateAccountV2(id, { is_active: isActive });
}

export async function deleteAccountV2(id: string) {
    // 1. Check for children
    const { count: childrenCount, error: childError } = await supabase
        .from('accounts_v2')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', id);

    if (childError) return { success: false, error: childError.message };
    if (childrenCount && childrenCount > 0) {
        return { success: false, error: 'لا يمكن حذف حساب رئيسي يحتوي على حسابات فرعية' };
    }

    // 2. Check for transactions (journal entry lines)
    const { count: txCount, error: txError } = await supabase
        .from('journal_lines_v2')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', id);

    if (txError) return { success: false, error: txError.message };
    if (txCount && txCount > 0) {
        return { success: false, error: 'لا يمكن حذف حساب يحتوي على حركات مالية' };
    }

    // 3. Delete
    // Note: If RESTRICT constraint exists on parent_id of other tables, DB will stop it too.
    const { error } = await supabase.from('accounts_v2').delete().eq('id', id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/accounting/coa-v2');
    return { success: true };
}

export async function deleteJournalEntryV2(id: string) {
    // Check status
    const { data: entry } = await supabase.from('journal_entries_v2').select('status').eq('id', id).single();
    if (!entry) return { success: false, error: 'Entry not found' };

    if (entry.status === 'posted') {
        return { success: false, error: 'Cannot delete posted entry. Please reverse it instead.' };
    }

    const { error } = await supabase.from('journal_entries_v2').delete().eq('id', id);

    if (error) return { success: false, error: error.message };

    revalidatePath('/accounting/journal-v2');
    revalidatePath('/accounting/journal-entries');
    return { success: true };
}

// =============================================================================
// ENTITY MANAGEMENT (CUSTOMERS & SUPPLIERS) V2
// =============================================================================

export async function getEntitiesV2(type: 'customer' | 'supplier') {
    // 1. Get System Account Key
    const systemKey = type === 'customer' ? 'CUSTOMERS_CONTROL' : 'SUPPLIERS_CONTROL';

    // 2. Get Parent ID from System Accounts
    const { data: systemAccount } = await supabase
        .from('system_accounts')
        .select('account_id')
        .eq('key', systemKey)
        .single();

    if (!systemAccount) return { success: false, error: `System account ${systemKey} not mapped. Run system-accounts-schema.sql` };

    // 3. Fetch Children
    const { data, error } = await supabase
        .from('accounts_v2')
        .select('*')
        .eq('parent_id', systemAccount.account_id)
        .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as AccountV2[] };
}

export async function createEntityV2(data: {
    name_ar: string;
    name_en?: string;
    type: 'customer' | 'supplier';
    currency?: string;
    phone?: string;
}) {
    // 1. Get System Account Key
    const systemKey = data.type === 'customer' ? 'CUSTOMERS_CONTROL' : 'SUPPLIERS_CONTROL';

    // 2. Get Parent ID from System Accounts
    const { data: systemAccount } = await supabase
        .from('system_accounts')
        .select('account_id')
        .eq('key', systemKey)
        .single();

    if (!systemAccount) {
        return { success: false, error: `System account ${systemKey} not found. Please contact admin.` };
    }

    // 3. Create Account using existing logic (handles code generation)
    return await createAccountV2({
        name_ar: data.name_ar,
        name_en: data.name_en || data.name_ar,
        parent_id: systemAccount.account_id,
        description: data.phone ? `Phone: ${data.phone}` : undefined,
        currency: data.currency || 'LYD'
    });
}

export async function updateEntityV2(id: string, data: {
    name_ar?: string;
    name_en?: string;
    phone?: string;
    currency?: string;
}) {
    return await updateAccountV2(id, {
        name_ar: data.name_ar,
        name_en: data.name_en,
        description: data.phone ? `Phone: ${data.phone}` : undefined,
        // currency is usually immutable after creation if transactions exist, but allowing for now/or ignoring if not in updateAccountV2
    });
}

export async function deleteEntityV2(id: string, type: 'customer' | 'supplier') {
    // 1. Check for basic constraints (Journal Lines, Children) - handled by deleteAccountV2
    // But we should also check Invoices V2
    const invoiceTable = type === 'customer' ? 'sales_invoices_v2' : 'purchase_invoices_v2';
    const fkColumn = type === 'customer' ? 'customer_account_id' : 'supplier_account_id';

    const { count } = await supabase
        .from(invoiceTable)
        .select('*', { count: 'exact', head: true })
        .eq(fkColumn, id);

    if (count && count > 0) {
        return { success: false, error: `Cannot delete ${type} with existing invoices.` };
    }

    // 2. Call deleteAccountV2
    return await deleteAccountV2(id);
}



export async function getJournalEntryV2(id: string) {
    const { data, error } = await supabase
        .from('journal_entries_v2')
        .select(`
            *,
            lines:journal_lines_v2 (
                *,
                account:account_id (name_ar, code)
            )
        `)
        .eq('id', id)
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as JournalEntryV2 };
}

export async function updateJournalEntryV2(id: string, input: {
    date: string;
    description: string;
    lines: {
        account_id: string;
        debit: number;
        credit: number;
        description?: string;
    }[];
}) {
    console.log('updateJournalEntryV2 called', { id, input });
    // 1. Calculate totals
    const totalDebit = input.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = input.lines.reduce((sum, line) => sum + line.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        console.error('updateJournalEntryV2 unbalanced', totalDebit, totalCredit);
        return { success: false, error: 'Entry is not balanced' };
    }

    // 2. Update Header
    const { data: updated, error: headerError } = await supabase
        .from('journal_entries_v2')
        .update({
            date: input.date,
            description: input.description,
            total_debit: totalDebit,
            total_credit: totalCredit,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

    if (headerError) {
        console.error('updateJournalEntryV2 headerError', headerError);
        return { success: false, error: headerError.message };
    }

    // Check if entry exists/updated
    if (!updated || updated.length === 0) {
        console.error('updateJournalEntryV2 No entry found with id', id);
        return { success: false, error: 'Entry not found or not updated' };
    }

    // 3. Replace Lines
    console.log('Deleting lines for', id);
    const { error: deleteError } = await supabase
        .from('journal_lines_v2')
        .delete()
        .eq('journal_id', id);

    if (deleteError) return { success: false, error: deleteError.message };

    const linesToInsert = input.lines.map(line => ({
        journal_id: id,
        account_id: line.account_id,
        debit: line.debit,
        credit: line.credit,
        description: line.description || input.description
    }));

    const { error: insertError } = await supabase
        .from('journal_lines_v2')
        .insert(linesToInsert);

    if (insertError) return { success: false, error: insertError.message };

    revalidatePath('/accounting/journal-v2');
    return { success: true };
}

// =============================================================================
// BANK & CASH MANAGEMENT V2
// =============================================================================

export async function getBankAccountsV2() {
    // 1. Get Parent ID for Banks (Code 1112)
    const { data: parent } = await supabase
        .from('accounts_v2')
        .select('id')
        .eq('code', '1112')
        .single();

    if (!parent) return { success: false, error: 'Parent account "Banks" (1112) not found' };

    // 2. Fetch Children
    const { data, error } = await supabase
        .from('accounts_v2')
        .select('*')
        .eq('parent_id', parent.id)
        .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as AccountV2[] };
}

export async function createBankAccountV2(data: {
    name: string;
    currency: 'LYD' | 'USD';
    accountNumber?: string;
    bankName?: string
}) {
    // 1. Get Parent ID for Banks (Code 1112)
    const { data: parent } = await supabase
        .from('accounts_v2')
        .select('*')
        .eq('code', '1112')
        .single();

    if (!parent) return { success: false, error: 'Parent account "Banks" (1112) not found' };

    // 2. Create Account using existing generic logic (handles code generation)
    return await createAccountV2({
        name_ar: data.name,
        name_en: data.bankName || data.name,
        parent_id: parent.id,
        description: `Bank: ${data.bankName || ''} - Account: ${data.accountNumber || ''}`,
        currency: data.currency
    });
}

export async function getCashAccountsV2() {
    // 1. Get Parent ID for Cash (Code 1111)
    const { data: parent } = await supabase
        .from('accounts_v2')
        .select('id')
        .eq('code', '1111')
        .single();

    if (!parent) return { success: false, error: 'Parent account "Cash" (1111) not found' };

    // 2. Fetch Children
    const { data, error } = await supabase
        .from('accounts_v2')
        .select('*')
        .eq('parent_id', parent.id)
        .order('created_at', { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as AccountV2[] };
}

export async function createCashAccountV2(data: {
    name: string;
    currency: 'LYD' | 'USD';
    description?: string
}) {
    // 1. Get Parent ID for Cash (Code 1111)
    const { data: parent } = await supabase
        .from('accounts_v2')
        .select('*')
        .eq('code', '1111')
        .single();

    if (!parent) return { success: false, error: 'Parent account "Cash" (1111) not found' };

    // 2. Create Account
    return await createAccountV2({
        name_ar: data.name,
        name_en: data.name,
        parent_id: parent.id,
        description: data.description,
        currency: data.currency
    });
}



export async function updateBankAccountV2(id: string, data: {
    name: string;
    currency?: 'LYD' | 'USD';
    accountNumber?: string;
    bankName?: string
}) {
    // Construct description
    const description = `Bank: ${data.bankName || ''} - Account: ${data.accountNumber || ''}`;

    const { data: account, error } = await supabase
        .from('accounts_v2')
        .update({
            name_ar: data.name,
            name_en: data.name, // Keeping en/ar same for now as per legacy
            currency: data.currency,
            description: description
        })
        .eq('id', id)
        .select()
        .single();

    if (error) return { success: false, error: error.message };
    revalidatePath('/accounting/cash-bank');
    return { success: true, data: account };
}

export async function updateCashAccountV2(id: string, data: {
    name: string;
    currency?: 'LYD' | 'USD';
    description?: string
}) {
    const { data: account, error } = await supabase
        .from('accounts_v2')
        .update({
            name_ar: data.name,
            name_en: data.name,
            currency: data.currency,
            description: data.description
        })
        .eq('id', id)
        .select()
        .single();

    if (error) return { success: false, error: error.message };
    revalidatePath('/accounting/cash-bank');
    return { success: true, data: account };
}

export async function deleteBankAccountV2(id: string) {
    // 1. Check for Receipts (Treasury)
    const { count: receiptCount, error: receiptError } = await supabase
        .from('receipts_v2')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', id); // account_id in receipts is the treasury/bank account

    if (receiptError) return { success: false, error: receiptError.message };
    if (receiptCount && receiptCount > 0) {
        return { success: false, error: 'لا يمكن حذف حساب مرتبط بسندات قبض' };
    }

    // 2. Check for Payments (Treasury)
    const { count: paymentCount, error: paymentError } = await supabase
        .from('payments_v2')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', id);

    if (paymentError) return { success: false, error: paymentError.message };
    if (paymentCount && paymentCount > 0) {
        return { success: false, error: 'لا يمكن حذف حساب مرتبط بسندات صرف' };
    }

    // 3. General Account Deletion (Check Journal Lines & Children)
    return await deleteAccountV2(id);
}

export async function getProductsV2() {
    noStore();
    try {
        const { data, error } = await supabase
            .from('products_v2')
            .select('id, name_ar, name_en, sku, current_quantity')
            .order('name_ar');

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        console.error('Error fetching products:', error);
        return { success: false, error: error.message };
    }
}
// =============================================================================
// ACCOUNT DETAILS & LEDGER V2
// =============================================================================

export async function getAccountDetailsV2(id: string) {
    const { data: account, error } = await supabase
        .from('accounts_v2')
        .select(`
            *,
            account_type:type_id (name_ar, name_en, category)
        `)
        .eq('id', id)
        .single();

    if (error || !account) {
        console.error('Error fetching account details:', error);
        return null;
    }

    // Consolidated Balance Calculation
    // Fetch all accounts in the hierarchy (starting with this account's code)
    // This includes the account itself + all children
    const { data: family } = await supabase
        .from('accounts_v2')
        .select('current_balance')
        .ilike('code', `${account.code}%`);

    if (family && family.length > 0) {
        const total = family.reduce((sum, member) => sum + (Number(member.current_balance) || 0), 0);
        account.current_balance = total;
    }

    return account;
}

export async function getAccountLedgerV2(accountId: string) {
    // 1. Get Account Code to find children (Hierarchy)
    const { data: account } = await supabase
        .from('accounts_v2')
        .select('code')
        .eq('id', accountId)
        .single();

    if (!account) return [];

    // 2. Find all account IDs associated with this code (Self + Children)
    // Using simple prefix match. E.g. '121' matches '121', '12101', '121-01'
    const { data: accounts } = await supabase
        .from('accounts_v2')
        .select('id')
        .ilike('code', `${account.code}%`);

    const accountIds = accounts?.map(a => a.id) || [accountId];

    // 3. Fetch Ledger
    const { data, error } = await supabase
        .from('journal_lines_v2')
        .select(`
            *,
            account:account_id (name_ar, code),
            journal_entries:journal_id (
                id,
                entry_number,
                entry_date:date,
                description,
                source_type,
                source_id,
                created_at
            )
        `)
        .in('account_id', accountIds)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching ledger:', error);
        return [];
    }
    // Transform to flat structure if needed, or return as is.
    // The existing page expects `journal_entries` object nested.
    return data || [];
}
