import React from 'react';
import { getAccountingTreeStats } from '@/lib/financial-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AccountingTreeNode } from '@/components/accounting/accounting-tree-node';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { format } from 'date-fns';

export default async function BalanceSheetPage() {
    const treeData = await getAccountingTreeStats();

    // Filter top-level nodes
    const assets = treeData.find(n => n.id === 'assets');
    const liabilities = treeData.find(n => n.id === 'liabilities');
    const equity = treeData.find(n => n.id === 'equity') || {
        id: 'equity',
        label: 'حقوق الملكية (Equity)',
        valueLYD: (assets?.valueLYD || 0) - (liabilities?.valueLYD || 0),
        valueUSD: 0,
        type: 'equity',
        children: []
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between print:hidden">
                <div>
                    <h1 className="text-2xl font-bold">قائمة المركز المالي (Balance Sheet)</h1>
                    <p className="text-muted-foreground">كما في {format(new Date(), 'yyyy-MM-dd')}</p>
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
                    <h3 className="text-xl text-muted-foreground">قائمة المركز المالي</h3>
                    <p className="text-sm text-gray-500 mt-2">بتاريخ {new Date().toLocaleDateString('en-GB')}</p>
                </div>

                {/* Assets Section */}
                <section>
                    <h4 className="text-lg font-bold bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded text-emerald-700 dark:text-emerald-400 mb-4 flex justify-between">
                        <span>الأصول (Assets)</span>
                        <span>{assets?.valueLYD.toLocaleString()} د.ل</span>
                    </h4>
                    <div className="pl-4 border-l-2 border-emerald-100 dark:border-emerald-800">
                        {assets && assets.children?.map(child => (
                            <AccountingTreeNode key={child.id} node={child} />
                        ))}
                    </div>
                </section>

                {/* Liabilities & Equity Section */}
                <section>
                    <h4 className="text-lg font-bold bg-rose-100 dark:bg-rose-900/30 p-2 rounded text-rose-700 dark:text-rose-400 mb-4 flex justify-between">
                        <span>الخصوم وحقوق الملكية (Liabilities & Equity)</span>
                        <span>{((liabilities?.valueLYD || 0) + (equity.valueLYD || 0)).toLocaleString()} د.ل</span>
                    </h4>

                    <div className="pl-4 border-l-2 border-rose-100 dark:border-rose-800 space-y-6">
                        {/* Liabilities */}
                        <div>
                            <h5 className="font-semibold text-rose-600 mb-2 px-2 flex justify-between">
                                <span>الخصوم (Liabilities)</span>
                                <span>{liabilities?.valueLYD.toLocaleString()} د.ل</span>
                            </h5>
                            <div className="pl-2">
                                {liabilities && liabilities.children?.map(child => (
                                    <AccountingTreeNode key={child.id} node={child} />
                                ))}
                            </div>
                        </div>

                        {/* Equity */}
                        <div>
                            <h5 className="font-semibold text-rose-600 mb-2 px-2 flex justify-between">
                                <span>حقوق الملكية (Equity)</span>
                                <span>{equity.valueLYD.toLocaleString()} د.ل</span>
                            </h5>
                            <div className="pl-2">
                                {/* Calculated Equity Node */}
                                <div className="flex justify-between py-2 px-2 border-b border-dashed dark:border-white/10">
                                    <span>رأس المال والأرباح المبقاة</span>
                                    <span className="font-mono">{equity.valueLYD.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
