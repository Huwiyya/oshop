'use server';

import { supabaseAdmin } from './supabase-admin';

export type ReportLine = {
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    balance: number;
    level: number;
    isParent: boolean;
};

// --- ميزان المراجعة (Trial Balance) ---
export async function getTrialBalance(startDate?: string, endDate?: string) {
    let query = supabaseAdmin
        .from('journal_entry_lines')
        .select(`
            debit,
            credit,
            account:accounts!inner (
                id, account_code, name_ar, account_type_id, parent_id
            ),
            journal_entries!inner (
                entry_date,
                status
            )
        `)
        .eq('journal_entries.status', 'posted');

    if (startDate) query = query.gte('journal_entries.entry_date', startDate);
    if (endDate) query = query.lte('journal_entries.entry_date', endDate);

    const { data: lines, error } = await query;

    if (error) {
        console.error('Error fetching trial balance:', error);
        return [];
    }

    const accountMap = new Map<string, ReportLine>();

    for (const line of lines) {
        const acc: any = Array.isArray(line.account) ? line.account[0] : line.account;

        if (!acc || !acc.account_code) continue;
        const code = acc.account_code;

        if (!accountMap.has(code)) {
            accountMap.set(code, {
                accountCode: code,
                accountName: acc.name_ar,
                debit: 0,
                credit: 0,
                balance: 0,
                level: 3,
                isParent: false
            });
        }

        const rec = accountMap.get(code)!;
        rec.debit += Number(line.debit);
        rec.credit += Number(line.credit);
    }

    // Calculate Net
    const accountArray = Array.from(accountMap.values());
    for (const rec of accountArray) {
        rec.balance = rec.debit - rec.credit; // Dr - Cr
    }

    return accountArray.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

// --- قائمة الدخل (Income Statement) ---
export async function getIncomeStatement(startDate: string, endDate: string) {
    const { data: lines, error } = await supabaseAdmin
        .from('journal_entry_lines')
        .select(`
            debit,
            credit,
            account:accounts!inner (account_code, name_ar, account_type_id),
            journal_entries!inner (entry_date, status)
        `)
        .eq('journal_entries.status', 'posted')
        .gte('journal_entries.entry_date', startDate)
        .lte('journal_entries.entry_date', endDate);

    if (error) {
        console.error(error);
        return { revenues: [], expenses: [], netIncome: 0 };
    }

    const revenues: ReportLine[] = [];
    const expenses: ReportLine[] = [];
    const revenueMap = new Map<string, ReportLine>();
    const expenseMap = new Map<string, ReportLine>();

    for (const line of lines) {
        const acc: any = Array.isArray(line.account) ? line.account[0] : line.account;
        if (!acc || !acc.account_code) continue;

        const isRevenue = acc.account_code.startsWith('4');
        const isExpense = acc.account_code.startsWith('5');

        if (!isRevenue && !isExpense) continue;

        const map = isRevenue ? revenueMap : expenseMap;
        if (!map.has(acc.account_code)) {
            map.set(acc.account_code, {
                accountCode: acc.account_code,
                accountName: acc.name_ar,
                debit: 0,
                credit: 0,
                balance: 0,
                isParent: false,
                level: 3
            });
        }

        const rec = map.get(acc.account_code)!;
        rec.debit += Number(line.debit);
        rec.credit += Number(line.credit);
    }

    // Finalize
    let totalRevenue = 0;
    let totalExpense = 0;

    const revArray = Array.from(revenueMap.values());
    for (const rec of revArray) {
        rec.balance = rec.credit - rec.debit;
        revenues.push(rec);
        totalRevenue += rec.balance;
    }

    const expArray = Array.from(expenseMap.values());
    for (const rec of expArray) {
        rec.balance = rec.debit - rec.credit;
        expenses.push(rec);
        totalExpense += rec.balance;
    }

    return {
        revenues: revenues.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
        expenses: expenses.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
        totalRevenue,
        totalExpense,
        netIncome: totalRevenue - totalExpense
    };
}

// --- المبيزانية العمومية (Balance Sheet) ---
export async function getBalanceSheet() {
    const { data: accounts, error } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .or('account_code.like.1%,account_code.like.2%,account_code.like.3%')
        .order('account_code');

    if (error) return { assets: [], liabilities: [], equity: [] };

    const assets: any[] = [];
    const liabilities: any[] = [];
    const equity: any[] = [];

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    for (const acc of accounts) {
        if (acc.current_balance === 0 && !acc.is_parent) continue;

        const item = { ...acc, balance: Number(acc.current_balance) };

        if (acc.account_code.startsWith('1')) {
            assets.push(item);
            if (!acc.is_parent) totalAssets += item.balance;
        } else if (acc.account_code.startsWith('2')) {
            liabilities.push(item);
            if (!acc.is_parent) totalLiabilities += item.balance;
        } else if (acc.account_code.startsWith('3')) {
            equity.push(item);
            if (!acc.is_parent) totalEquity += item.balance;
        }
    }

    return {
        assets,
        liabilities,
        equity,
        totalAssets,
        totalLiabilities: Math.abs(totalLiabilities),
        totalEquity: Math.abs(totalEquity)
    };
}
