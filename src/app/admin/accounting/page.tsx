import React from 'react';
import { getAccountingTreeStats } from '@/lib/financial-actions';
import { AccountingTreeNode } from '@/components/accounting/accounting-tree-node';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { FileText, PlusCircle } from 'lucide-react';

export default async function AccountingPage() {
    const treeData = await getAccountingTreeStats();

    // Helper to find specific branches
    const assets = treeData.find(n => n.id === 'assets');
    const liabilities = treeData.find(n => n.id === 'liabilities');
    const income = treeData.find(n => n.id === 'income');
    const expenses = treeData.find(n => n.id === 'expenses');

    return (
        <div className="container mx-auto max-w-7xl space-y-6 p-4">
            {/* Header & Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-orange-500">
                        الملخص المالي (Financial Summary)
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        نظرة شاملة على المركز المالي والأرباح والخسائر
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/admin/accounting/journal">
                        <Button variant="outline" className="gap-2">
                            <FileText className="w-4 h-4" />
                            قيود اليومية
                        </Button>
                    </Link>
                    <Link href="/admin/accounting/journal/new">
                        <Button className="gap-2 bg-gradient-to-r from-primary to-orange-600">
                            <PlusCircle className="w-4 h-4" />
                            قيد جديد
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Main Grid: Manager.io Style (Left: Balance Sheet, Right: P&L) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Left Column: Balance Sheet (المركز المالي) */}
                <div className="space-y-6">
                    <Card className="glass-card shadow-md border-t-4 border-t-emerald-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl flex justify-between">
                                <span>الأصول (Assets)</span>
                                <span className="font-mono text-emerald-600">{assets ? `LYD ${assets.valueLYD.toLocaleString()}` : '0'}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {assets && assets.children?.map(child => (
                                <AccountingTreeNode key={child.id} node={child} />
                            ))}
                            {!assets && <div className="p-4 text-muted-foreground text-sm">لا توجد بيانات</div>}
                        </CardContent>
                    </Card>

                    <Card className="glass-card shadow-md border-t-4 border-t-rose-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl flex justify-between">
                                <span>الخصوم (Liabilities)</span>
                                <span className="font-mono text-rose-600">{liabilities ? `LYD ${liabilities.valueLYD.toLocaleString()}` : '0'}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {liabilities && liabilities.children?.map(child => (
                                <AccountingTreeNode key={child.id} node={child} />
                            ))}
                            {!liabilities && <div className="p-4 text-muted-foreground text-sm">لا توجد بيانات</div>}
                        </CardContent>
                    </Card>

                    {/* Net Equity Calculation (Assets - Liabilities) */}
                    <Card className="bg-slate-50 dark:bg-slate-900 border-dashed">
                        <CardContent className="p-4 flex justify-between items-center">
                            <span className="font-bold">صافي حقوق الملكية (Net Equity)</span>
                            <span className="font-mono text-xl font-bold text-primary">
                                LYD {((assets?.valueLYD || 0) - (liabilities?.valueLYD || 0)).toLocaleString()}
                            </span>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Profit & Loss (الأرباح والخسائر) */}
                <div className="space-y-6">
                    <Card className="glass-card shadow-md border-t-4 border-t-blue-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl flex justify-between">
                                <span>الإيرادات (Income)</span>
                                <span className="font-mono text-blue-600">{income ? `LYD ${income.valueLYD.toLocaleString()}` : '0'}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {income && income.children?.map(child => (
                                <AccountingTreeNode key={child.id} node={child} />
                            ))}
                            {!income && <div className="p-4 text-muted-foreground text-sm">لا توجد بيانات</div>}
                        </CardContent>
                    </Card>

                    <Card className="glass-card shadow-md border-t-4 border-t-orange-500">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl flex justify-between">
                                <span>المصروفات (Expenses)</span>
                                <span className="font-mono text-orange-600">{expenses ? `LYD ${expenses.valueLYD.toLocaleString()}` : '0'}</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {expenses && expenses.children?.map(child => (
                                <AccountingTreeNode key={child.id} node={child} />
                            ))}
                            {!expenses && <div className="p-4 text-muted-foreground text-sm">لا توجد بيانات</div>}
                        </CardContent>
                    </Card>

                    {/* Net Profit Calculation (Income - Expenses) */}
                    <Card className="bg-slate-50 dark:bg-slate-900 border-dashed">
                        <CardContent className="p-4 flex justify-between items-center">
                            <span className="font-bold">صافي الربح (Net Profit)</span>
                            <span className={
                                (income?.valueLYD || 0) - (expenses?.valueLYD || 0) >= 0
                                    ? "font-mono text-xl font-bold text-emerald-600"
                                    : "font-mono text-xl font-bold text-rose-600"
                            }>
                                LYD {((income?.valueLYD || 0) - (expenses?.valueLYD || 0)).toLocaleString()}
                            </span>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}
