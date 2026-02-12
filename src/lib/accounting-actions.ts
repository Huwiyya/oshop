'use server';

import { supabaseAdmin } from './supabase-admin';
import { unstable_noStore as noStore } from 'next/cache';

// أنواع البيانات
export type AccountSummary = {
    id: string;
    account_code: string;
    name_ar: string;
    name_en: string;
    current_balance: number;
    cash_flow_type?: 'operating' | 'investing' | 'financing';
    account_type: {
        category: string;
        normal_balance: string;
    };
};

export type DashboardSummary = {
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

// جلب ملخص الحسابات حسب النوع (للمركز المالي وقائمة الدخل)
// جلب ملخص الحسابات حسب النوع (للمركز المالي وقائمة الدخل)
export async function getAccountsSummary(date?: string): Promise<{
    assets: AccountSummary[];
    liabilities: AccountSummary[];
    equity: AccountSummary[];
    revenue: AccountSummary[];
    expenses: AccountSummary[];
}> {
    // 1. Fetch all active accounts (Parents and Children)
    const { data: accounts, error } = await supabaseAdmin
        .from('accounts')
        .select(`
            id,
            account_code,
            name_ar,
            name_en,
            current_balance,
            level,
            parent_id,
            is_parent,
            cash_flow_type,
            account_type:account_types!inner (
                category,
                normal_balance
            )
        `)
        .eq('is_active', true)
        .order('account_code');

    if (error) {
        console.error('Error fetching accounts summary:', error);
        return { assets: [], liabilities: [], equity: [], revenue: [], expenses: [] };
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
        // If parent has its own balance (should be 0 usually), add it. 
        // We overwrite computed_balance with the sum for display.
        node.computed_balance = childrenSum + (node.is_parent ? 0 : node.computed_balance);
        return node.computed_balance;
    };

    roots.forEach(aggregateBalance);

    // 3. Filter for Summary View
    // We want to show Level 3 accounts (e.g., Cash, Receivables, Inventory) as summaries.
    const summaryAccounts = accounts.filter((acc: any) => {
        // Show Level 3 accounts (e.g. 1120 Receivables)
        if (acc.level == 3) return true;

        // Show Level 2 accounts ONLY if they define a main revenue/expense category directly (like Sales 4100)
        // and aren't just containers for Level 3.
        // Actually, Revenue (4000) -> Sales (4100). 4100 is Level 2.
        if (acc.level == 2 && acc.account_type.category === 'revenue') return true;
        if (acc.level == 2 && acc.account_type.category === 'expense') return true;

        return false;
    });

    const result = {
        assets: [] as AccountSummary[],
        liabilities: [] as AccountSummary[],
        equity: [] as AccountSummary[],
        revenue: [] as AccountSummary[],
        expenses: [] as AccountSummary[]
    };

    // 4. Distribute to Categories
    summaryAccounts.forEach((acc: any) => {
        // Use computed_balance instead of current_balance
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

// حساب الأجماليات للوحة التحكم
export async function getDashboardMetricsFresh(fromDate?: string, toDate?: string): Promise<DashboardSummary> {
    noStore();
    const summary = await getAccountsSummary();

    // دالة مساعدة لجمع الأرصدة (Signed Sum)
    const sumBalance = (accounts: AccountSummary[]) =>
        accounts.reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0);

    // For Assets/Expenses (Debit Normal), Balance is Positive.
    // For Liab/Equity/Revenue (Credit Normal), Balance is Negative.

    // Convert to Absolute for Display/Traditional View
    const totalAssets = sumBalance(summary.assets);
    const totalLiabilities = Math.abs(sumBalance(summary.liabilities));
    const totalEquityBase = Math.abs(sumBalance(summary.equity));
    const totalRevenue = Math.abs(sumBalance(summary.revenue));
    const totalExpenses = sumBalance(summary.expenses);

    // حساب صافي الدخل
    const netIncome = totalRevenue - totalExpenses;

    // حقوق الملكية = رأس المال + الأرباح المحتجزة + صافي الدخل
    const totalEquity = totalEquityBase + netIncome;

    // التحقق من توازن المعادلة المحاسبية: الأصول = الالتزامات + حقوق الملكية
    const balanceCheck = totalAssets - (totalLiabilities + totalEquity);

    // Granular Summaries Logic
    // Cash & Banks: Starts with 111 (Cash 1111, Banks 1112)
    const cashAndBanks = summary.assets
        .filter(acc => String(acc.account_code).trim().startsWith('111'))
        .reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0);

    // Receivables: Starts with 112
    const receivables = summary.assets
        .filter(acc => String(acc.account_code).trim().startsWith('112'))
        .reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0);

    // Inventory: Starts with 113
    const inventory = summary.assets
        .filter(acc => String(acc.account_code).trim().startsWith('113'))
        .reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0);

    // Payables: Starts with 211
    const payables = Math.abs(summary.liabilities
        .filter(acc => String(acc.account_code).trim().startsWith('211'))
        .reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0));

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

// --- إدارة العملاء والموردين ---

export async function getEntities(type: 'customer' | 'supplier') {
    // الكود 1120 للعملاء (الذمم المدينة)
    // الكود 2110 للموردين (الذمم الدائنة)
    const parentCode = type === 'customer' ? '1120' : '2110';

    // 1. Get Parent ID
    const { data: parent } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('account_code', parentCode)
        .single();

    if (!parent) return [];

    // 2. Get Children (The actual customers/suppliers)
    const { data, error } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .eq('parent_id', parent.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(`Error fetching ${type}s:`, error);
        return [];
    }
    return data;
}

export async function createEntity(data: {
    name_ar: string;
    name_en?: string;
    type: 'customer' | 'supplier';
    currency: 'LYD' | 'USD';
    phone?: string;
}) {
    // 1. Get Parent ID from system_accounts (Dynamic Mapping)
    const systemKey = data.type === 'customer' ? 'CUSTOMERS_CONTROL' : 'SUPPLIERS_CONTROL';

    const { data: systemAccount } = await supabaseAdmin
        .from('system_accounts')
        .select('account_id')
        .eq('key', systemKey)
        .single();

    if (!systemAccount) {
        throw new Error(`System account ${systemKey} not found. Please run system-accounts-schema.sql`);
    }

    const { data: parent } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('id', systemAccount.account_id)
        .single();

    if (!parent) throw new Error('Parent account for entities not found');

    // 2. Create via RPC
    const { data: newAccountId, error } = await invokeCreateAccountRPC({
        p_name_ar: data.name_ar,
        p_name_en: data.name_en || data.name_ar,
        p_parent_id: parent.id,
        p_description: data.phone ? `Phone: ${data.phone}` : undefined,
        p_currency: data.currency
    });

    if (error) throw new Error(error.message);

    // 3. Fetch and return
    const { data: newAccount } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .eq('id', newAccountId)
        .single();

    return newAccount;
}

/**
 * Update Customer or Supplier
 */
export async function updateEntity(id: string, data: {
    name_ar: string;
    name_en?: string;
    phone?: string;
    currency?: 'LYD' | 'USD';
}) {
    try {
        const { data: account, error } = await supabaseAdmin
            .from('accounts')
            .update({
                name_ar: data.name_ar,
                name_en: data.name_en || data.name_ar,
                currency: data.currency,
                description: data.phone ? `Phone: ${data.phone}` : undefined
            })
            .eq('id', id)
            .select()
            .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data: account };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Delete Customer or Supplier
 * Validates no related invoices, receipts, or payments exist
 */
export async function deleteEntity(id: string, type: 'customer' | 'supplier') {
    try {
        // Check for journal entries
        const { data: journalLines } = await supabaseAdmin
            .from('journal_entry_lines')
            .select('id')
            .eq('account_id', id)
            .limit(1);

        if (journalLines && journalLines.length > 0) {
            return {
                success: false,
                error: `لا يمكن حذف ${type === 'customer' ? 'عميل' : 'مورد'} مرتبط بقيود محاسبية. يرجى حذف القيود أولاً.`
            };
        }

        // Check for sales/purchase invoices
        const invoiceTable = type === 'customer' ? 'sales_invoices' : 'purchase_invoices';
        const { data: invoices } = await supabaseAdmin
            .from(invoiceTable)
            .select('id')
            .eq(type === 'customer' ? 'customer_id' : 'supplier_id', id)
            .limit(1);

        if (invoices && invoices.length > 0) {
            return {
                success: false,
                error: `لا يمكن حذف ${type === 'customer' ? 'عميل' : 'مورد'} مرتبط بفواتير. يرجى حذف الفواتير أولاً.`
            };
        }

        // Check for receipts/payments
        const transactionTable = type === 'customer' ? 'receipts' : 'payments';
        const { data: transactions } = await supabaseAdmin
            .from(transactionTable)
            .select('id')
            .eq('from_account_id', id)
            .limit(1);

        if (transactions && transactions.length > 0) {
            return {
                success: false,
                error: `لا يمكن حذف ${type === 'customer' ? 'عميل' : 'مورد'} مرتبط بسندات ${type === 'customer' ? 'قبض' : 'صرف'}. يرجى حذفها أولاً.`
            };
        }

        // Delete the entity account
        const { error } = await supabaseAdmin
            .from('accounts')
            .delete()
            .eq('id', id);

        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


// جلب كشف حساب تفصيلي
export async function getAccountLedger(accountId: string) {
    const { data, error } = await supabaseAdmin
        .from('journal_entry_lines')
        .select(`
            *,
            journal_entries!inner (
                entry_date,
                entry_number,
                description,
                reference_type,
                reference_id
            )
        `)
        .eq('account_id', accountId)
        .order('created_at', { ascending: false }); // الأحدث أولاً

    if (error) {
        console.error('Error fetching ledger:', error);
        return [];
    }
    return data;
}

export async function getAccountDetails(accountId: string) {
    const { data, error } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

    if (error) {
        console.error('getAccountDetails Error:', error, 'ID:', accountId);
        return null;
    }
    return data;
}

/**
 * Delete Journal Entry with Safe Balance Update
 * ✅ Fixed Critical Issue #1: Now updates account balances
 * ✅ Fixed Critical Issue #3: Uses Soft Delete + Audit Trail
 * ✅ Fixed Critical Issue #4: Prevents deletion of posted entries
 * ✅ Fixed Critical Issue #6: Thread-safe with database locks
 */
export async function deleteManualJournalEntry(
    journalEntryId: string,
    userId?: string,
    reason?: string
) {
    try {
        // استخدام Database Function للحذف الآمن
        const { data, error } = await supabaseAdmin
            .rpc('safe_delete_journal_entry', {
                p_entry_id: journalEntryId,
                p_user_id: userId,
                p_reason: reason
            });

        if (error) {
            return { success: false, error: error.message };
        }

        // الـ RPC يرجع JSON
        if (data && typeof data === 'object' && !data.success) {
            return data; // يحتوي على error message
        }

        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}



// --- Bank Accounts & Cash Accounts Management ---

export async function getBankAccounts() {
    // Parent 1112 for Banks
    const { data: parent } = await supabaseAdmin.from('accounts').select('id').eq('account_code', '1112').single();
    if (!parent) return [];

    const { data } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .eq('parent_id', parent.id)
        .order('created_at', { ascending: false });
    return data || [];
}

export async function createBankAccount(data: { name: string; currency: 'LYD' | 'USD'; accountNumber?: string; bankName?: string }) {
    // Parent 1112 for Banks
    const { data: parent } = await supabaseAdmin.from('accounts').select('id').eq('account_code', '1112').single();
    if (!parent) throw new Error('Parent account "Banks" (1112) not found');

    // Create via RPC
    const { data: newAccountId, error } = await invokeCreateAccountRPC({
        p_name_ar: data.name,
        p_name_en: data.name,
        p_parent_id: parent.id,
        p_description: `Bank: ${data.bankName || ''} - Account: ${data.accountNumber || ''}`,
        p_currency: data.currency
    });

    if (error) return { success: false, error: error.message };

    const { data: newAccount } = await supabaseAdmin.from('accounts').select('*').eq('id', newAccountId).single();
    return { success: true, data: newAccount };
}

export async function getCashAccounts() {
    // Parent 1111 for Cash
    const { data: parent } = await supabaseAdmin.from('accounts').select('id').eq('account_code', '1111').single();
    if (!parent) return [];

    const { data } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .eq('parent_id', parent.id)
        .order('created_at', { ascending: false });
    return data || [];
}

export async function createCashAccount(data: { name: string; currency: 'LYD' | 'USD'; description?: string }) {
    // Parent 1111 for Cash
    const { data: parent } = await supabaseAdmin.from('accounts').select('id').eq('account_code', '1111').single();
    if (!parent) throw new Error('Parent account "Cash" (1111) not found');

    // Create via RPC
    const { data: newAccountId, error } = await invokeCreateAccountRPC({
        p_name_ar: data.name,
        p_name_en: data.name,
        p_parent_id: parent.id,
        p_description: data.description,
        p_currency: data.currency
    });

    if (error) throw new Error(error.message);

    const { data: newAccount } = await supabaseAdmin.from('accounts').select('*').eq('id', newAccountId).single();
    return newAccount;
}

/**
 * Update Bank Account
 */
export async function updateBankAccount(id: string, data: {
    name: string;
    currency?: 'LYD' | 'USD';
    accountNumber?: string;
    bankName?: string
}) {
    try {
        const { data: account, error } = await supabaseAdmin
            .from('accounts')
            .update({
                name_ar: data.name,
                name_en: data.name,
                currency: data.currency,
                description: `Bank: ${data.bankName || ''} - Account: ${data.accountNumber || ''}`
            })
            .eq('id', id)
            .select()
            .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data: account };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Update Cash Account
 */
export async function updateCashAccount(id: string, data: {
    name: string;
    currency?: 'LYD' | 'USD';
    description?: string
}) {
    try {
        const { data: account, error } = await supabaseAdmin
            .from('accounts')
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
        return { success: true, data: account };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Delete Bank or Cash Account
 * Validates no transactions exist
 */
export async function deleteBankAccount(id: string) {
    try {
        // Check for journal entries
        const { data: journalLines } = await supabaseAdmin
            .from('journal_entry_lines')
            .select('id')
            .eq('account_id', id)
            .limit(1);

        if (journalLines && journalLines.length > 0) {
            return {
                success: false,
                error: 'لا يمكن حذف حساب بنكي مرتبط بحركات مالية. يرجى حذف الحركات أولاً.'
            };
        }

        // Check for receipts/payments
        const { data: receipts } = await supabaseAdmin
            .from('receipts')
            .select('id')
            .or(`from_account_id.eq.${id},to_account_id.eq.${id}`)
            .limit(1);

        if (receipts && receipts.length > 0) {
            return {
                success: false,
                error: 'لا يمكن حذف حساب بنكي مرتبط بسندات قبض. يرجى حذفها أولاً.'
            };
        }

        const { data: payments } = await supabaseAdmin
            .from('payments')
            .select('id')
            .or(`from_account_id.eq.${id},to_account_id.eq.${id}`)
            .limit(1);

        if (payments && payments.length > 0) {
            return {
                success: false,
                error: 'لا يمكن حذف حساب بنكي مرتبط بسندات صرف. يرجى حذفها أولاً.'
            };
        }

        // Delete the account
        const { error } = await supabaseAdmin
            .from('accounts')
            .delete()
            .eq('id', id);

        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


// --- إدارة الحسابات (تعديل وحذف) ---

export async function getAllAccounts(maxLevel?: number) {
    let query = supabaseAdmin
        .from('accounts')
        .select(`
            *,
            account_type:account_types(name_ar)
        `)
        .order('account_code', { ascending: true });

    if (maxLevel) {
        query = query.lte('level', maxLevel);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching accounts:', error);
        return [];
    }
    return data;
}

export async function getAccountChildren(parentId: string) {
    const { data, error } = await supabaseAdmin
        .from('accounts')
        .select(`
            *,
            account_type:account_types(name_ar)
        `)
        .eq('parent_id', parentId)
        .order('account_code', { ascending: true });

    if (error) {
        console.error('Error fetching account children:', error);
        return [];
    }
    return data;
}

export async function updateAccount(id: string, data: {
    name_ar: string;
    name_en?: string;
    description?: string;
    cash_flow_type?: 'operating' | 'investing' | 'financing' | null;
}) {
    const { error } = await supabaseAdmin
        .from('accounts')
        .update(data)
        .eq('id', id);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function toggleAccountStatus(id: string, isActive: boolean) {
    const { error } = await supabaseAdmin
        .from('accounts')
        .update({ is_active: isActive })
        .eq('id', id);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

// Helper to safely call create_hierarchical_account_rpc with fallback for backward compatibility
async function invokeCreateAccountRPC(params: {
    p_name_ar: string;
    p_name_en: string;
    p_parent_id: string;
    p_description?: string;
    p_currency?: string;
    p_cash_flow_type?: string | null;
}) {
    // Try with new signature (including cash_flow_type)
    const { data, error } = await supabaseAdmin.rpc('create_hierarchical_account_rpc', {
        p_name_ar: params.p_name_ar,
        p_name_en: params.p_name_en,
        p_parent_id: params.p_parent_id,
        p_description: params.p_description,
        p_currency: params.p_currency || 'LYD',
        p_cash_flow_type: params.p_cash_flow_type || null
    });

    // If successful, return
    if (!error) return { data, error: null };

    // If error implies function signature mismatch (e.g. "function does not exist" with these args), try legacy
    // Postgres error code for undefined function is 42883, but Supabase might return text.
    if (error.message && (error.message.includes('does not exist') || error.message.includes('signature'))) {
        console.warn('RPC create_hierarchical_account_rpc failed with new signature, trying legacy...', error.message);
        return await supabaseAdmin.rpc('create_hierarchical_account_rpc', {
            p_name_ar: params.p_name_ar,
            p_name_en: params.p_name_en,
            p_parent_id: params.p_parent_id,
            p_description: params.p_description,
            p_currency: params.p_currency || 'LYD'
            // omit p_cash_flow_type
        });
    }

    return { data, error };
}

export async function createAccount(data: {
    name_ar: string;
    name_en?: string;
    parent_id: string;
    description?: string;
    is_active?: boolean;
    cash_flow_type?: 'operating' | 'investing' | 'financing';
}) {
    // Create via RPC Helper
    const { data: newAccountId, error } = await invokeCreateAccountRPC({
        p_name_ar: data.name_ar,
        p_name_en: data.name_en || data.name_ar,
        p_parent_id: data.parent_id,
        p_description: data.description,
        p_cash_flow_type: data.cash_flow_type
    });

    if (error) return { success: false, error: error.message };
    return { success: true, id: newAccountId };
}

export async function deleteAccount(id: string) {
    // 1. Check for children
    const { count: childrenCount } = await supabaseAdmin
        .from('accounts')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', id);

    if (childrenCount && childrenCount > 0) {
        return { success: false, error: 'لا يمكن حذف حساب رئيسي يحتوي على حسابات فرعية' };
    }

    // 2. Check for transactions (journal entry lines)
    const { count: txCount } = await supabaseAdmin
        .from('journal_entry_lines')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', id);

    if (txCount && txCount > 0) {
        return { success: false, error: 'لا يمكن حذف حساب يحتوي على حركات مالية' };
    }

    // 3. Delete
    const { error } = await supabaseAdmin.from('accounts').delete().eq('id', id);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

export async function createQuickAccount(name: string, type: 'supplier' | 'customer') {
    // 1. Determine Parent Code: 211 (Liabilities -> Payables) or 112 (Assets -> Receivables)
    // Adjust based on typical depth. If 211 is parent, we create 211001. 
    // If 2110 is parent, we create 211001. 
    // Let's assume 211 is the main "Suppliers" header and 112 is "Customers".
    // Or 2110 / 1120 if they exist.

    let parentCode = type === 'supplier' ? '2110' : '1120';

    // Check if 2110/1120 exists, if not fallback to 211/112
    let { data: parent } = await supabaseAdmin
        .from('accounts')
        .select('id, account_type_id')
        .eq('account_code', parentCode)
        .single();

    if (!parent) {
        // Fallback
        parentCode = type === 'supplier' ? '211' : '112';
        const { data: fallbackParent } = await supabaseAdmin
            .from('accounts')
            .select('id, account_type_id')
            .eq('account_code', parentCode)
            .single();
        parent = fallbackParent;
    }

    if (!parent) {
        return { success: false, error: `Parent account for ${type} not found (checked ${type === 'supplier' ? '2110/211' : '1120/112'})` };
    }

    // 2. Create via RPC
    const { data: newAccountId, error } = await invokeCreateAccountRPC({
        p_name_ar: name,
        p_name_en: name, // Default English name to same
        p_parent_id: parent.id,
        p_description: `Quick created ${type}`,
        p_currency: 'LYD'
    });

    if (error) {
        return { success: false, error: error.message };
    }

    // Return the new account ID so the UI can select it
    return { success: true, id: newAccountId };
}
