import React from 'react';
import { getAccountingTreeStats } from '@/lib/financial-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AccountingTreeNode } from '@/components/accounting/accounting-tree-node';
import { Button } from '@/components/ui/button';
import { Printer, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

export default async function ProfitLossPage() {
    const treeData = await getAccountingTreeStats();

    // Filter P&L nodes
    const income = treeData.find(n => n.id === 'income');
    const expenses = treeData.find(n => n.id === 'expenses');

    // Calculate Net Profit
    const totalIncome = income?.valueLYD || 0;
    const totalExpenses = expenses?.valueLYD || 0;
    const netProfit = totalIncome - totalExpenses;

    const isProfit = netProfit >= 0;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between print:hidden">
                <div>
                    <h1 className="text-2xl font-bold">قائمة الأرباح والخسائر (Profit & Loss)</h1>
                    <p className="text-muted-foreground">عن الفترة {format(new Date(), 'yyyy')}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="gap-2">
                        <Printer className="w-4 h-4" />
                        طباعة
                    </Button>
                    <Button variant="outline" className="gap-2">
                        <Download className="w-4 h-4" />
                        تصدير PDF
                    </Button>
                </div>
            </div>

            <div className="print:p-8 bg-white dark:bg-black/20 p-6 rounded-xl border shadow-sm space-y-8">
                <div className="text-center border-b pb-6 mb-6">
                    <h2 className="text-2xl font-bold">Oshop - فرع مصراته</h2>
                    <h3 className="text-xl text-muted-foreground">قائمة الأرباح والخسائر</h3>
                    <p className="text-sm text-gray-500 mt-2">عن السنة المالية المنتهية في {new Date().getFullYear()}</p>
                </div>

                {/* Income Section */}
                <section>
                    <h4 className="text-lg font-bold bg-blue-100 dark:bg-blue-900/30 p-2 rounded text-blue-700 dark:text-blue-400 mb-4 flex justify-between">
                        <span>الإيرادات (Income)</span>
                        <span>{totalIncome.toLocaleString()} د.ل</span>
                    </h4>
                    <div className="pl-4 border-l-2 border-blue-100 dark:border-blue-800">
                        {income && income.children?.map(child => (
                            <AccountingTreeNode key={child.id} node={child} />
                        ))}
                    </div>
                </section>

                {/* Expenses Section */}
                <section>
                    <h4 className="text-lg font-bold bg-orange-100 dark:bg-orange-900/30 p-2 rounded text-orange-700 dark:text-orange-400 mb-4 flex justify-between">
                        <span>المصروفات (Expenses)</span>
                        <span>{totalExpenses.toLocaleString()} د.ل</span>
                    </h4>
                    <div className="pl-4 border-l-2 border-orange-100 dark:border-orange-800">
                        {expenses && expenses.children?.map(child => (
                            <AccountingTreeNode key={child.id} node={child} />
                        ))}
                    </div>
                </section>

                {/* Net Profit Section */}
                <section className="mt-8 border-t-2 border-dashed pt-6">
                    <div className={`flex items-center justify-between p-4 rounded-xl ${isProfit ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300'}`}>
                        <div className="flex items-center gap-3">
                            {isProfit ? <TrendingUp className="w-8 h-8" /> : <TrendingDown className="w-8 h-8" />}
                            <span className="text-2xl font-bold">صافي الربح / الخسارة</span>
                        </div>
                        <span className="text-3xl font-mono font-bold">{netProfit.toLocaleString()} د.ل</span>
                    </div>
                </section>
            </div>
        </div>
    );
}
