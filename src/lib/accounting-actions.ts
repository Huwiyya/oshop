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
export async function getAccountsSummary(date?: string): Promise<{
    assets: AccountSummary[];
    liabilities: AccountSummary[];
    equity: AccountSummary[];
    revenue: AccountSummary[];
    expenses: AccountSummary[];
}> {
    // في المرحلة الأولى، سنعتمد على الأرصدة الحالية في جدول accounts
    // لاحقاً سنقوم بحساب الأرصدة بناءً على التاريخ من جدول account_transactions

    const { data: accounts, error } = await supabaseAdmin
        .from('accounts')
        .select(`
            id,
            account_code,
            name_ar,
            name_en,
            current_balance,
            account_type:account_types!inner (
                category,
                normal_balance
            )
        `)
        .eq('is_active', true)
        .eq('is_parent', false); // نأخذ الحسابات الفرعية فقط للجمع

    if (error) {
        console.error('Error fetching accounts summary:', error);
        return { assets: [], liabilities: [], equity: [], revenue: [], expenses: [] };
    }

    const result = {
        assets: [] as AccountSummary[],
        liabilities: [] as AccountSummary[],
        equity: [] as AccountSummary[],
        revenue: [] as AccountSummary[],
        expenses: [] as AccountSummary[]
    };

    // تصنيف الحسابات
    accounts?.forEach((acc: any) => {
        const category = acc.account_type.category;
        if (category === 'asset') result.assets.push(acc);
        else if (category === 'liability') result.liabilities.push(acc);
        else if (category === 'equity') result.equity.push(acc);
        else if (category === 'revenue') result.revenue.push(acc);
        else if (category === 'expense') result.expenses.push(acc);
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

    if (error) return null;
    return data;
}
