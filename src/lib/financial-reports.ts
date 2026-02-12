// ============================================
// Financial Reports - Balance Sheet & Income Statement
// ============================================

import { supabaseAdmin } from './supabase-admin';
import { getAccountsSummary } from './accounting-actions';

// ============================================
// Balance Sheet Report
// ============================================

export interface BalanceSheetData {
    assets: {
        current: any[];
        fixed: any[];
        other: any[];
        total: number;
    };
    liabilities: {
        current: any[];
        longTerm: any[];
        total: number;
    };
    equity: {
        capital: any[];
        retainedEarnings: any[];
        currentYearIncome: number;
        total: number;
    };
    asOfDate: Date;
    balanceCheck: number; // Should be ~0
}

export async function getBalanceSheet(asOfDate: Date = new Date()): Promise<BalanceSheetData> {
    const summary = await getAccountsSummary();

    const filterByCode = (accounts: any[], prefix: string) =>
        accounts.filter(acc => acc.account_code.startsWith(prefix));

    const sumBalance = (accounts: any[]) =>
        accounts.reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0);

    // Assets (Debit Normal Balance - Positive)
    const currentAssets = filterByCode(summary.assets, '11'); // 1100 series
    const fixedAssets = filterByCode(summary.assets, '12'); // 1200 series
    const otherAssets = summary.assets.filter(acc =>
        !acc.account_code.startsWith('11') &&
        !acc.account_code.startsWith('12')
    );
    const totalAssets = sumBalance(summary.assets);

    // Liabilities (Credit Normal Balance - Negative, convert to Absolute)
    const currentLiabilities = filterByCode(summary.liabilities, '21'); // 2100 series
    const longTermLiabilities = filterByCode(summary.liabilities, '22'); // 2200 series
    const totalLiabilities = Math.abs(sumBalance(summary.liabilities));

    // Equity (Credit Normal Balance - Negative, convert to Absolute)
    const capital = filterByCode(summary.equity, '31'); // 3100 series
    const retainedEarnings = filterByCode(summary.equity, '32'); // 3200 series

    // Net Income (Revenue - Expenses)
    const totalRevenue = Math.abs(sumBalance(summary.revenue));
    const totalExpenses = sumBalance(summary.expenses);
    const currentYearIncome = totalRevenue - totalExpenses;

    const totalEquity = Math.abs(sumBalance(summary.equity)) + currentYearIncome;

    // Balance Check: Assets = Liabilities + Equity
    const balanceCheck = totalAssets - (totalLiabilities + totalEquity);

    return {
        assets: {
            current: currentAssets,
            fixed: fixedAssets,
            other: otherAssets,
            total: totalAssets
        },
        liabilities: {
            current: currentLiabilities,
            longTerm: longTermLiabilities,
            total: totalLiabilities
        },
        equity: {
            capital,
            retainedEarnings,
            currentYearIncome,
            total: totalEquity
        },
        asOfDate,
        balanceCheck
    };
}

// ============================================
// Income Statement Report
// ============================================

export interface IncomeStatementData {
    revenue: {
        sales: any[];
        services: any[];
        other: any[];
        total: number;
    };
    expenses: {
        cogs: any[];
        operating: any[];
        depreciation: any[];
        other: any[];
        total: number;
    };
    grossProfit: number;
    operatingIncome: number;
    netIncome: number;
    period: {
        startDate: Date;
        endDate: Date;
    };
}

export async function getIncomeStatement(
    startDate?: Date,
    endDate: Date = new Date()
): Promise<IncomeStatementData> {
    const summary = await getAccountsSummary();

    const filterByCode = (accounts: any[], prefix: string) =>
        accounts.filter(acc => acc.account_code.startsWith(prefix));

    const sumBalance = (accounts: any[]) =>
        accounts.reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0);

    // Revenue (Credit Normal Balance - Negative, convert to Absolute)
    const salesRevenue = filterByCode(summary.revenue, '41'); // 4100 series
    const servicesRevenue = filterByCode(summary.revenue, '42'); // 4200 series (if exists)
    const otherRevenue = summary.revenue.filter(acc =>
        !acc.account_code.startsWith('41') &&
        !acc.account_code.startsWith('42')
    );
    const totalRevenue = Math.abs(sumBalance(summary.revenue));

    // Expenses (Debit Normal Balance - Positive)
    const cogs = filterByCode(summary.expenses, '51'); // 5100 series
    const operatingExpenses = filterByCode(summary.expenses, '52'); // 5200 series
    const depreciationExpense = filterByCode(summary.expenses, '53'); // 5300 series
    const otherExpenses = summary.expenses.filter(acc =>
        !acc.account_code.startsWith('51') &&
        !acc.account_code.startsWith('52') &&
        !acc.account_code.startsWith('53')
    );
    const totalExpenses = sumBalance(summary.expenses);

    // Calculations
    const cogsAmount = sumBalance(cogs);
    const grossProfit = totalRevenue - cogsAmount;
    const operatingExpensesAmount = sumBalance(operatingExpenses);
    const operatingIncome = grossProfit - operatingExpensesAmount;
    const netIncome = totalRevenue - totalExpenses;

    return {
        revenue: {
            sales: salesRevenue,
            services: servicesRevenue,
            other: otherRevenue,
            total: totalRevenue
        },
        expenses: {
            cogs,
            operating: operatingExpenses,
            depreciation: depreciationExpense,
            other: otherExpenses,
            total: totalExpenses
        },
        grossProfit,
        operatingIncome,
        netIncome,
        period: {
            startDate: startDate || new Date(endDate.getFullYear(), 0, 1), // Default: Start of year
            endDate
        }
    };
}

// ============================================
// Helper: Format Currency
// ============================================

export function formatCurrency(amount: number, currency: string = 'LYD'): string {
    return new Intl.NumberFormat('ar-LY', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2
    }).format(amount);
}
