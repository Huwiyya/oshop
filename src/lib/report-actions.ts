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
        return { revenues: [], cogs: [], expenses: [], totalRevenue: 0, totalCOGS: 0, totalExpense: 0, grossProfit: 0, netIncome: 0 };
    }

    const revenues: ReportLine[] = [];
    const cogs: ReportLine[] = [];
    const expenses: ReportLine[] = [];

    const revenueMap = new Map<string, ReportLine>();
    const cogsMap = new Map<string, ReportLine>();
    const expenseMap = new Map<string, ReportLine>();

    for (const line of lines) {
        const acc: any = Array.isArray(line.account) ? line.account[0] : line.account;
        if (!acc || !acc.account_code) continue;

        let category: 'revenue' | 'cogs' | 'expense' | null = null;
        let map: Map<string, ReportLine> | null = null;

        if (acc.account_code.startsWith('4')) {
            category = 'revenue';
            map = revenueMap;
        } else if (acc.account_code.startsWith('51')) {
            category = 'cogs';
            map = cogsMap;
        } else if (acc.account_code.startsWith('5')) { // All other expenses (52, 53, etc.)
            category = 'expense';
            map = expenseMap;
        }

        if (!category || !map) continue;

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

    // Finalize Revenues
    let totalRevenue = 0;
    for (const rec of Array.from(revenueMap.values())) {
        rec.balance = rec.credit - rec.debit;
        revenues.push(rec);
        totalRevenue += rec.balance;
    }

    // Finalize COGS
    let totalCOGS = 0;
    for (const rec of Array.from(cogsMap.values())) {
        rec.balance = rec.debit - rec.credit; // Expense nature
        cogs.push(rec);
        totalCOGS += rec.balance;
    }

    // Finalize Operating Expenses
    let totalExpense = 0;
    for (const rec of Array.from(expenseMap.values())) {
        rec.balance = rec.debit - rec.credit; // Expense nature
        expenses.push(rec);
        totalExpense += rec.balance;
    }

    const grossProfit = totalRevenue - totalCOGS;
    const netIncome = grossProfit - totalExpense;

    return {
        revenues: revenues.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
        cogs: cogs.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
        expenses: expenses.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
        totalRevenue,
        totalCOGS,
        grossProfit,
        totalExpense,
        netIncome
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

// --- كشف حساب عميل (Customer Statement) ---
export type StatementTransaction = {
    date: string;
    description: string;
    type: string;
    reference: string;
    debit: number;
    credit: number;
    balance: number;
};

export type CustomerStatement = {
    customerName: string;
    openingBalance: number;
    closingBalance: number;
    totalDebit: number;
    totalCredit: number;
    transactions: StatementTransaction[];
};

export async function getCustomerStatement(customerId: string, startDate?: string, endDate?: string): Promise<CustomerStatement> {
    // 1. Get Customer Details
    const { data: customer } = await supabaseAdmin.from('accounts').select('name_ar, current_balance').eq('id', customerId).single();
    if (!customer) throw new Error('Customer not found');

    // 2. Get Transactions
    let query = supabaseAdmin
        .from('journal_entry_lines')
        .select(`
            debit,
            credit,
            description,
            journal_entries!inner (
                entry_date,
                entry_number,
                reference_type,
                reference_id,
                status,
                description
            )
        `)
        .eq('account_id', customerId)
        .eq('journal_entries.status', 'posted')
        .order('journal_entries(entry_date)', { ascending: true });

    if (startDate) query = query.gte('journal_entries.entry_date', startDate);
    if (endDate) query = query.lte('journal_entries.entry_date', endDate);

    const { data: lines, error } = await query;
    if (error) throw new Error(error.message);

    // 3. Process
    let runningBalance = 0; // Should ideally account for opening balance before startDate
    const transactions: StatementTransaction[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines || []) {
        const je = Array.isArray(line.journal_entries) ? line.journal_entries[0] : line.journal_entries;
        const debit = Number(line.debit);
        const credit = Number(line.credit);

        runningBalance += (debit - credit); // Normal balance for Asset (Receivable) is Debit. So +Dr -Cr.

        totalDebit += debit;
        totalCredit += credit;

        transactions.push({
            date: je.entry_date,
            description: line.description || je.description || '-',
            type: je.reference_type || 'manual',
            reference: je.reference_id || je.entry_number,
            debit,
            credit,
            balance: runningBalance
        });
    }

    return {
        customerName: customer.name_ar,
        openingBalance: 0, // Simplified
        closingBalance: runningBalance,
        totalDebit,
        totalCredit,
        transactions
    };
}

// --- قائمة التدفقات النقدية (Cash Flow Statement) ---
export type CashFlowData = {
    netIncome: number;
    operatingActivities: number;
    operatingDetails: { name: string; amount: number }[];
    investingActivities: number;
    investingDetails: { name: string; amount: number }[];
    financingActivities: number;
    financingDetails: { name: string; amount: number }[];
    netCashFlow: number;
};

export async function getCashFlowStatement(startDate: string, endDate: string): Promise<CashFlowData | null> {
    // 1. Calculate Net Income first
    const incomeStmt = await getIncomeStatement(startDate, endDate);
    const netIncome = incomeStmt.netIncome;

    // 2. Fetch movements for *Balance Sheet* accounts only (Assets 1, Liab 2, Equity 3)
    const { data: movements, error } = await supabaseAdmin
        .from('journal_entry_lines')
        .select(`
            debit,
            credit,
            account:accounts!inner (
                account_code,
                name_ar,
                account_type_id
            ),
            journal_entries!inner (
                entry_date,
                status
            )
        `)
        .eq('journal_entries.status', 'posted')
        .gte('journal_entries.entry_date', startDate)
        .lte('journal_entries.entry_date', endDate)
        .or('account_code.like.1%,account_code.like.2%,account_code.like.3%');

    if (error) {
        console.error('Error fetching cash flow data:', error);
        return null;
    }

    let operatingActivities = 0;
    let investingActivities = 0;
    let financingActivities = 0;

    const operatingDetails: { name: string; amount: number }[] = [];
    const investingDetails: { name: string; amount: number }[] = [];
    const financingDetails: { name: string; amount: number }[] = [];

    const addDetail = (type: 'operating' | 'investing' | 'financing', name: string, amount: number) => {
        if (Math.abs(amount) < 0.01) return;
        const target = type === 'operating' ? operatingDetails : type === 'investing' ? investingDetails : financingDetails;
        target.push({ name, amount });
        if (type === 'operating') operatingActivities += amount;
        else if (type === 'investing') investingActivities += amount;
        else financingActivities += amount;
    };

    // 3. Find Depreciation (Non-cash expense) Add-back
    // Typical Depreciation Expense accounts start with 5 or are named clearly
    let depreciation = 0;
    for (const exp of incomeStmt.expenses) {
        if (exp.accountName.includes('إهلاك') || exp.accountName.toLowerCase().includes('depreciation')) {
            depreciation += exp.balance;
        }
    }
    addDetail('operating', 'الإهلاك (مصروف غير نقدي)', depreciation);

    // 4. Analyze Balance Sheet Changes
    // Change = Dr - Cr
    // Asset Increase (+Change) -> Cash Outflow (-) => Effect = -Change
    // Liab/Eq Increase (-Change i.e. Cr>Dr) -> Cash Inflow (+) => Effect = -Change
    // So for ALL BS accounts: Cash Effect = -(Dr - Cr) = (Cr - Dr)

    // Grouping
    let changeReceivables = 0;
    let changeInventory = 0;
    let changePayables = 0;

    // Aggregate by account code first
    const accountChanges = new Map<string, { change: number, name: string }>();

    movements?.forEach(line => {
        const acc: any = Array.isArray(line.account) ? line.account[0] : line.account;
        const code = acc.account_code;

        // EXCLUDE Cash/Bank accounts (Cash Flow is ABOUT them, not BY them)
        // Adjust these codes based on your exact Chart of Accounts
        // Usually 1101, 101, etc.
        if (code.startsWith('1101') || acc.name_ar.includes('صندوق') || acc.name_ar.includes('بنك') || acc.name_ar.includes('خزينة')) {
            return;
        }

        const netLineChange = Number(line.debit) - Number(line.credit);
        const current = accountChanges.get(code) || { change: 0, name: acc.name_ar };

        accountChanges.set(code, {
            change: current.change + netLineChange,
            name: current.name
        });
    });

    // Fix iteration error by converting to array
    for (const [code, { change, name }] of Array.from(accountChanges.entries())) {
        const cashEffect = -change; // (Cr - Dr)

        // A. Investing Activities (Fixed Assets 12xx)
        if (code.startsWith('12')) {
            addDetail('investing', `صافي التغير في ${name}`, cashEffect);
        }
        // B. Financing Activities (Long Term Liab 22xx, Equity 3xxx)
        else if (code.startsWith('22') || code.startsWith('3')) {
            addDetail('financing', `صافي التغير في ${name}`, cashEffect);
        }
        // C. Operating (Working Capital) - Current Assets / Current Liabilities
        else {
            // Group common operating items
            if (name.includes('مخزون') || code.startsWith('1103')) {
                changeInventory += cashEffect;
            } else if (name.includes('عملاء') || name.includes('ذمم مدينة') || code.startsWith('1102')) {
                changeReceivables += cashEffect;
            } else if (name.includes('موردين') || name.includes('ذمم دائنة') || code.startsWith('2101')) {
                changePayables += cashEffect;
            } else {
                addDetail('operating', `التغير في ${name}`, cashEffect);
            }
        }
    }

    addDetail('operating', 'التغير في العملاء والذمم المدينة', changeReceivables);
    addDetail('operating', 'التغير في المخزون', changeInventory);
    addDetail('operating', 'التغير في الموردين والذمم الدائنة', changePayables);

    return {
        netIncome,
        operatingActivities,
        operatingDetails,
        investingActivities,
        investingDetails,
        financingActivities,
        financingDetails,
        netCashFlow: netIncome + operatingActivities + investingActivities + financingActivities
    };
}
