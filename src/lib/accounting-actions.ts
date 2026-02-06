'use server';

import { supabaseAdmin } from './supabase-admin';

// أنواع البيانات
export type AccountSummary = {
    id: string;
    account_code: string;
    name_ar: string;
    name_en: string;
    current_balance: number;
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
    // Also include any leaf accounts that are Level 1 or 2 (unlikely but possible).
    // essentially: If an account is Level 3, show it. If it's Level < 3 and has no children, show it.
    // Level 4+ are details (Customers, Specific Items) -> Hidden in summary.

    // We will flattening the list again but filtering.
    const summaryAccounts = accounts.filter((acc: any) => {
        // Show Level 3 accounts (e.g. 1120 Receivables)
        if (acc.level === 3) return true;

        // Show Level 2 accounts ONLY if they define a main revenue/expense category directly (like Sales 4100)
        // and aren't just containers for Level 3.
        // Actually, Revenue (4000) -> Sales (4100). 4100 is Level 2.
        if (acc.level === 2 && acc.account_type.category === 'revenue') return true;
        if (acc.level === 2 && acc.account_type.category === 'expense') return true;

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
export async function getDashboardMetrics(fromDate?: string, toDate?: string): Promise<DashboardSummary> {
    const summary = await getAccountsSummary();

    // دالة مساعدة لجمع الأرصدة
    const sumBalance = (accounts: AccountSummary[]) =>
        accounts.reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0);

    const totalAssets = sumBalance(summary.assets);
    const totalLiabilities = sumBalance(summary.liabilities);
    const totalEquity = sumBalance(summary.equity);
    const totalRevenue = sumBalance(summary.revenue);
    const totalExpenses = sumBalance(summary.expenses);

    return {
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalRevenue,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses
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
    phone?: string; // Optional: stored in description or separate table if needed
}) {
    const parentCode = data.type === 'customer' ? '1120' : '2110';

    // 1. Get Parent
    const { data: parent } = await supabaseAdmin
        .from('accounts')
        .select('id, account_code')
        .eq('account_code', parentCode)
        .single();

    if (!parent) throw new Error('Parent account not found');

    // 2. Generate new Code (simple increment logic)
    // In production, this should be more robust (e.g., atomic increment)
    const { data: lastChild } = await supabaseAdmin
        .from('accounts')
        .select('account_code')
        .eq('parent_id', parent.id)
        .order('account_code', { ascending: false })
        .limit(1)
        .single();

    let newCode;
    if (lastChild) {
        newCode = (parseInt(lastChild.account_code) + 1).toString();
    } else {
        newCode = parent.account_code + '001';
    }

    // 3. Create Account
    const { data: newAccount, error } = await supabaseAdmin
        .from('accounts')
        .insert({
            name_ar: data.name_ar,
            name_en: data.name_en || data.name_ar,
            account_code: newCode,
            parent_id: parent.id,
            account_type_id: data.type === 'customer' ? 'type_asset' : 'type_liability', // Assuming predefined IDs
            level: 3,
            is_parent: false,
            currency: data.currency,
            current_balance: 0
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
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
    // Parent 1112
    const { data: parent } = await supabaseAdmin.from('accounts').select('id, account_code').eq('account_code', '1112').single();
    if (!parent) throw new Error('Parent account "Banks" (1112) not found');

    // Generate Code
    const { data: lastChild } = await supabaseAdmin
        .from('accounts')
        .select('account_code')
        .eq('parent_id', parent.id)
        .order('account_code', { ascending: false })
        .limit(1)
        .single();

    let newCode = parent.account_code + '001';
    if (lastChild) newCode = (parseInt(lastChild.account_code) + 1).toString();

    // Insert
    const { data: newAccount, error } = await supabaseAdmin.from('accounts').insert({
        name_ar: data.name,
        name_en: data.name, // Use same for now
        account_code: newCode,
        parent_id: parent.id,
        account_type_id: 'type_asset',
        level: 3,
        is_parent: false,
        currency: data.currency,
        current_balance: 0,
        description: `Bank: ${data.bankName || ''} - Account: ${data.accountNumber || ''}`
    }).select().single();

    if (error) return { success: false, error: error.message };
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
    // Parent 1111
    const { data: parent } = await supabaseAdmin.from('accounts').select('id, account_code').eq('account_code', '1111').single();
    if (!parent) throw new Error('Parent account "Cash" (1111) not found');

    // Generate Code
    const { data: lastChild } = await supabaseAdmin
        .from('accounts')
        .select('account_code')
        .eq('parent_id', parent.id)
        .order('account_code', { ascending: false })
        .limit(1)
        .single();

    let newCode = parent.account_code + '001';
    if (lastChild) newCode = (parseInt(lastChild.account_code) + 1).toString();

    // Insert
    const { data: newAccount, error } = await supabaseAdmin.from('accounts').insert({
        name_ar: data.name,
        name_en: data.name,
        account_code: newCode,
        parent_id: parent.id,
        account_type_id: 'type_asset',
        level: 3,
        is_parent: false,
        currency: data.currency,
        current_balance: 0,
        description: data.description
    }).select().single();

    if (error) throw new Error(error.message);
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

export async function getAllAccounts() {
    const { data, error } = await supabaseAdmin
        .from('accounts')
        .select(`
            *,
            account_type:account_types(name_ar)
        `)
        .order('account_code', { ascending: true });

    if (error) {
        console.error('Error fetching accounts:', error);
        return [];
    }
    return data;
}

export async function updateAccount(id: string, data: { name_ar: string; name_en?: string; description?: string }) {
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

export async function createAccount(data: {
    name_ar: string;
    name_en?: string;
    parent_id: string;
    description?: string;
    is_active?: boolean;
}) {
    // 1. Get Parent to inherit type/currency and generate code
    const { data: parent } = await supabaseAdmin.from('accounts').select('*').eq('id', data.parent_id).single();
    if (!parent) return { success: false, error: 'الحساب الرئيسي غير موجود' };

    // 2. Generate Code
    const { data: lastChild } = await supabaseAdmin
        .from('accounts')
        .select('account_code')
        .eq('parent_id', data.parent_id)
        .order('account_code', { ascending: false })
        .limit(1)
        .single();

    let newCode;
    if (lastChild) {
        // Simple increment logic. 
        // Note: JS numbers lose precision for very large codes, but accounting codes usually < 15 digits.
        // Using BigInt just in case or string manipulation.
        // Assuming code is numeric string.
        newCode = (Number(lastChild.account_code) + 1).toString();
    } else {
        newCode = parent.account_code + '01';
    }

    // 3. Insert
    const { error } = await supabaseAdmin.from('accounts').insert({
        name_ar: data.name_ar,
        name_en: data.name_en,
        account_code: newCode,
        parent_id: data.parent_id,
        account_type_id: parent.account_type_id,
        level: parent.level + 1,
        is_parent: false,
        is_active: data.is_active ?? true,
        current_balance: 0, // Default 0
        currency: parent.currency || 'LYD',
        description: data.description
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
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
