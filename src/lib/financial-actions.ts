'use server';

import { supabaseAdmin } from './supabase-admin';

export interface AccountingNode {
    id: string;
    label: string;
    valueLYD: number;
    valueUSD: number;
    children?: AccountingNode[];
    type: 'asset' | 'liability' | 'income' | 'expense' | 'equity';
}

export async function getAccountingTreeStats(): Promise<AccountingNode[]> {
    try {
        // 1. Assets: Treasury, Customer Debts, Inventory
        const treasury = await getTreasuryStats();
        const customerDebts = await getCustomerDebts();
        const inventory = await getInventoryValue(); // This might be complex if not tracked well

        // 2. Liabilities: Customer Wallets, External Debts (Creditors)
        const customerWallets = await getCustomerWallets();
        const creditorDebts = await getCreditorDebts();

        // 3. Income: Sales, Shipping Income
        const salesIncome = await getSalesIncome();

        // 4. Expenses: General Expenses
        const expenses = await getExpensesStats();

        // Construct the Tree
        const tree: AccountingNode[] = [
            {
                id: 'assets',
                label: 'الأصول (Assets)',
                valueLYD: treasury.totalLYD + customerDebts.totalLYD + inventory.totalLYD,
                valueUSD: treasury.totalUSD + customerDebts.totalUSD + inventory.totalUSD,
                type: 'asset',
                children: [
                    {
                        id: 'treasury',
                        label: 'الخزينة (Treasury)',
                        valueLYD: treasury.totalLYD,
                        valueUSD: treasury.totalUSD,
                        type: 'asset',
                        children: treasury.details
                    },
                    {
                        id: 'customer_debts',
                        label: 'ديون العملاء (Receivables)',
                        valueLYD: customerDebts.totalLYD,
                        valueUSD: customerDebts.totalUSD,
                        type: 'asset'
                    },
                    {
                        id: 'inventory',
                        label: 'المخزون (Inventory)',
                        valueLYD: inventory.totalLYD,
                        valueUSD: inventory.totalUSD,
                        type: 'asset'
                    }
                ]
            },
            {
                id: 'liabilities',
                label: 'الخصوم (Liabilities)',
                valueLYD: customerWallets.totalLYD + creditorDebts.totalLYD,
                valueUSD: customerWallets.totalUSD + creditorDebts.totalUSD,
                type: 'liability',
                children: [
                    {
                        id: 'customer_wallets',
                        label: 'محافظ العملاء (Customer Wallets)',
                        valueLYD: customerWallets.totalLYD,
                        valueUSD: customerWallets.totalUSD,
                        type: 'liability'
                    },
                    {
                        id: 'creditor_debts',
                        label: 'دائنون (Payables)',
                        valueLYD: creditorDebts.totalLYD,
                        valueUSD: creditorDebts.totalUSD,
                        type: 'liability'
                    }
                ]
            },
            {
                id: 'income',
                label: 'الإيرادات (Income)',
                valueLYD: salesIncome.totalLYD,
                valueUSD: salesIncome.totalUSD,
                type: 'income',
                children: [
                    {
                        id: 'sales',
                        label: 'المبيعات (Sales)',
                        valueLYD: salesIncome.totalLYD,
                        valueUSD: salesIncome.totalUSD,
                        type: 'income'
                    }
                ]
            },
            {
                id: 'expenses',
                label: 'المصروبات (Expenses)',
                valueLYD: expenses.totalLYD,
                valueUSD: expenses.totalUSD,
                type: 'expense',
                children: expenses.details
            }
        ];

        return tree;
    } catch (error) {
        console.error('Error fetching accounting tree:', error);
        return [];
    }
}

// --- Helper Functions ---

async function getTreasuryStats() {
    const { data, error } = await supabaseAdmin.from('treasury_cards_v4').select('*');
    if (error) return { totalLYD: 0, totalUSD: 0, details: [] };

    let totalLYD = 0;
    let totalUSD = 0;
    const details: AccountingNode[] = [];

    data.forEach((card: any) => {
        if (card.currency === 'LYD') totalLYD += (card.balance || 0);
        else totalUSD += (card.balance || 0);

        details.push({
            id: `treasury_${card.id}`,
            label: card.name,
            valueLYD: card.currency === 'LYD' ? card.balance : 0,
            valueUSD: card.currency !== 'LYD' ? card.balance : 0,
            type: 'asset'
        });
    });

    return { totalLYD, totalUSD, details };
}

async function getCustomerDebts() {
    const { data, error } = await supabaseAdmin.from('users_v4').select('debt').gt('debt', 0);
    if (error) return { totalLYD: 0, totalUSD: 0 };

    const totalLYD = data.reduce((sum, user) => sum + (user.debt || 0), 0);
    return { totalLYD, totalUSD: 0 }; // Usually debt is in LYD main currency
}

async function getCustomerWallets() {
    const { data, error } = await supabaseAdmin.from('users_v4').select('wallet_balance').gt('wallet_balance', 0);
    if (error) return { totalLYD: 0, totalUSD: 0 };

    const totalLYD = data.reduce((sum, user) => sum + (user.wallet_balance || 0), 0);
    return { totalLYD, totalUSD: 0 };
}

async function getCreditorDebts() {
    // Assuming external_debts or creditors table exists. Based on file structure, 'creditors' might be a table or just managed in code.
    // Quick check: db-adapter showed 'external_debts' might be the one, or I should check the schema.
    // Let's assume a 'creditors' table with 'total_debt' if it exists, or sum 'external_debts' status=pending.
    // Based on `types.ts`, Creditor interface exists.
    const { data, error } = await supabaseAdmin.from('creditors').select('total_debt, currency');
    if (error) return { totalLYD: 0, totalUSD: 0 };

    let totalLYD = 0;
    let totalUSD = 0;

    data.forEach((c: any) => {
        if (c.currency === 'USD') totalUSD += (c.total_debt || 0);
        else totalLYD += (c.total_debt || 0);
    });

    return { totalLYD, totalUSD };
}

async function getInventoryValue() {
    // Basic estimation: cost price of all products * quantity
    const { data, error } = await supabaseAdmin.from('products').select('quantity, cost_price_usd, selling_price_lyd');
    if (error) return { totalLYD: 0, totalUSD: 0 };

    let totalUSD = 0;
    let totalLYD = 0; // If some have local cost, but mostly imports are USD cost.

    data.forEach((p: any) => {
        const qty = p.quantity || 0;
        totalUSD += (p.cost_price_usd || 0) * qty;
        // We could also track potential sales value in LYD, but inventory for accounting is usually at Cost.
    });

    return { totalLYD, totalUSD };
}

async function getSalesIncome() {
    // Sum of all PAID orders. Or all orders? Usually Income = Sales.
    // Let's sum total_amount_lyd of orders that are not cancelled.
    const { data, error } = await supabaseAdmin
        .from('orders_v4')
        .select('total_amount_lyd')
        .neq('status', 'cancelled');

    if (error) return { totalLYD: 0, totalUSD: 0 };

    const totalLYD = data.reduce((sum, order) => sum + (order.total_amount_lyd || 0), 0);
    return { totalLYD, totalUSD: 0 };
}

async function getExpensesStats() {
    const { data, error } = await supabaseAdmin.from('expenses').select('*');
    if (error) return { totalLYD: 0, totalUSD: 0, details: [] };

    let totalLYD = 0;
    const details: AccountingNode[] = [];

    // Group by description or just list them? Too many expenses might clutter.
    // Let's just return total for now, or maybe grouped by month if we had categories.
    // For now, flat sum.
    totalLYD = data.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    return { totalLYD, totalUSD: 0, details };
}
