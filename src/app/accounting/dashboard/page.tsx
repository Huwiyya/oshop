
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    DollarSign,
    Wallet,
    CreditCard,
    TrendingUp,
    Calendar,
    Filter,
    BookOpen
} from 'lucide-react';
// SWITCH TO V1 ACTIONS
import { getDashboardMetricsV2, getAccountsSummaryV2, type DashboardSummaryV2, type AccountSummaryV2 } from '@/lib/accounting-v2-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function AccountingDashboard() {
    const router = useRouter(); // Initialize router
    const [isLoading, setIsLoading] = useState(true);
    const [metrics, setMetrics] = useState<DashboardSummaryV2 | null>(null);
    const [details, setDetails] = useState<{
        assets: AccountSummaryV2[];
        liabilities: AccountSummaryV2[];
        equity: AccountSummaryV2[];
        revenue: AccountSummaryV2[];
        expenses: AccountSummaryV2[];
    } | null>(null);
    const [dateFilter, setDateFilter] = useState('all'); // all, today, month, year

    useEffect(() => {
        async function loadData() {
            try {
                setIsLoading(true);
                const [metricsData, detailsData] = await Promise.all([
                    getDashboardMetricsV2(),
                    getAccountsSummaryV2()
                ]);
                setMetrics(metricsData);
                setDetails(detailsData);
            } catch (error) {
                console.error('Failed to load dashboard data:', error);
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [dateFilter]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-32 rounded-xl" />
                    <Skeleton className="h-32 rounded-xl" />
                    <Skeleton className="h-32 rounded-xl" />
                </div>
                <Skeleton className="h-96 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">الملخص المالي</h1>
                    <p className="text-slate-500">نظرة عامة على الوضع المالي للمؤسسة</p>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
                    <Button
                        variant={dateFilter === 'month' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setDateFilter('month')}
                        className="text-xs"
                    >
                        هذا الشهر
                    </Button>
                    <Button
                        variant={dateFilter === 'year' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setDateFilter('year')}
                        className="text-xs"
                    >
                        هذه السنة
                    </Button>
                    <Button
                        variant={dateFilter === 'all' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setDateFilter('all')}
                        className="text-xs"
                    >
                        الكل
                    </Button>
                </div>
            </div>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="صافي الدخل"
                    value={metrics?.netIncome || 0}
                    icon={Activity}
                    trend={metrics?.netIncome && metrics.netIncome >= 0 ? 'positive' : 'negative'}
                    description="الفرق بين الإيرادات والمصروفات"
                    color="emerald"
                    href="/accounting/financial-reports"
                />
                <MetricCard
                    title="إجمالي الأصول"
                    value={metrics?.totalAssets || 0}
                    icon={Wallet}
                    description="مجموع النقدية، المخزون، والذمم"
                    color="blue"
                    href="/accounting/financial-reports"
                />
                <MetricCard
                    title="إجمالي الالتزامات"
                    value={metrics?.totalLiabilities || 0}
                    icon={CreditCard}
                    description="الديون والمستحقات"
                    color="amber"
                    href="/accounting/financial-reports"
                />
                <MetricCard
                    title="حقوق الملكية"
                    value={metrics?.totalEquity || 0}
                    icon={DollarSign}
                    description="رأس المال + الأرباح المحتجزة + صافي الدخل"
                    color="purple"
                    href="/accounting/financial-reports"
                />
            </div>

            {/* Summary Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                    title="النقدية والبنوك"
                    value={metrics?.cashAndBanks || 0}
                    icon={Wallet}
                    color="blue"
                    href="/accounting/cash-banks"
                />
                <SummaryCard
                    title="مستحقات العملاء"
                    value={metrics?.receivables || 0}
                    icon={ArrowUpRight}
                    color="emerald"
                    href="/accounting/entities?type=customer"
                />
                <SummaryCard
                    title="مستحقات الموردين"
                    value={metrics?.payables || 0}
                    icon={ArrowDownRight}
                    color="red"
                    href="/accounting/entities?type=supplier"
                />
                <SummaryCard
                    title="قيمة المخزون"
                    value={metrics?.inventory || 0}
                    icon={BookOpen}
                    color="orange"
                    href="/accounting/inventory-reports"
                />
            </div>

            {/* Balance Check Indicator */}
            {metrics?.balanceCheck !== undefined && Math.abs(metrics.balanceCheck) > 0.01 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-red-800">⚠️ تنبيه: المعادلة المحاسبية غير متوازنة</h3>
                        <p className="text-sm text-red-600">
                            الفرق: {formatCurrency(Math.abs(metrics.balanceCheck))} - يرجى مراجعة القيود المحاسبية
                        </p>
                    </div>
                </div>
            )}
            {metrics?.balanceCheck !== undefined && Math.abs(metrics.balanceCheck) <= 0.01 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-sm text-emerald-700 font-medium">
                        ✓ المعادلة المحاسبية متوازنة (الأصول = الالتزامات + حقوق الملكية)
                    </p>
                </div>
            )}

            {/* Financial Statements Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Income Statement Section */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50 border-b pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-emerald-600" />
                                قائمة الدخل (الأرباح والخسائر)
                            </CardTitle>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${(metrics?.netIncome || 0) >= 0
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                                }`}>
                                الصافي: {formatCurrency(metrics?.netIncome || 0)}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {/* Revenue */}
                            <div className="p-4 bg-emerald-50/30">
                                <h3 className="font-semibold text-emerald-800 mb-3">الإيرادات</h3>
                                <div className="space-y-2">
                                    {details?.revenue.map(acc => (
                                        <AccountRow key={acc.id} account={acc} router={router} />
                                    ))}
                                    <div className="flex justify-between font-bold pt-2 border-t border-emerald-100 mt-2">
                                        <span>إجمالي الإيرادات</span>
                                        <span>{formatCurrency(metrics?.totalRevenue || 0)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Expenses */}
                            <div className="p-4 bg-red-50/30">
                                <h3 className="font-semibold text-red-800 mb-3">المصروفات</h3>
                                <div className="space-y-2">
                                    {details?.expenses.map(acc => (
                                        <AccountRow key={acc.id} account={acc} router={router} type="expense" />
                                    ))}
                                    <div className="flex justify-between font-bold pt-2 border-t border-red-100 mt-2">
                                        <span>إجمالي المصروفات</span>
                                        <span>{formatCurrency(metrics?.totalExpenses || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Balance Sheet Section */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50 border-b pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Wallet className="w-5 h-5 text-blue-600" />
                                المركز المالي
                            </CardTitle>
                            <span className="text-sm text-slate-500">كما في {new Date().toLocaleDateString('ar-LY')}</span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y">
                            {/* Assets */}
                            <div className="p-4">
                                <Link href="/accounting/financial-reports?tab=balance-sheet">
                                    <h3 className="font-semibold text-blue-800 mb-3 hover:underline cursor-pointer">الأصول</h3>
                                </Link>
                                <div className="space-y-2">
                                    {details?.assets.map(acc => (
                                        <AccountRow key={acc.id} account={acc} router={router} />
                                    ))}
                                    <Link href="/accounting/financial-reports?tab=balance-sheet">
                                        <div className="flex justify-between font-bold pt-2 border-t mt-2 hover:bg-slate-50 cursor-pointer rounded px-1 transition-colors">
                                            <span>إجمالي الأصول</span>
                                            <span>{formatCurrency(metrics?.totalAssets || 0)}</span>
                                        </div>
                                    </Link>
                                </div>
                            </div>

                            {/* Liabilities */}
                            <div className="p-4 bg-slate-50/50">
                                <Link href="/accounting/financial-reports?tab=balance-sheet">
                                    <h3 className="font-semibold text-amber-800 mb-3 hover:underline cursor-pointer">الالتزامات</h3>
                                </Link>
                                <div className="space-y-2">
                                    {details?.liabilities.map(acc => (
                                        <AccountRow key={acc.id} account={acc} router={router} />
                                    ))}
                                    <Link href="/accounting/financial-reports?tab=balance-sheet">
                                        <div className="flex justify-between font-bold pt-2 border-t mt-2 hover:bg-slate-100 cursor-pointer rounded px-1 transition-colors">
                                            <span>إجمالي الالتزامات</span>
                                            <span>{formatCurrency(metrics?.totalLiabilities || 0)}</span>
                                        </div>
                                    </Link>
                                </div>
                            </div>

                            {/* Equity */}
                            <div className="p-4 bg-slate-50/50">
                                <Link href="/accounting/financial-reports?tab=balance-sheet">
                                    <h3 className="font-semibold text-purple-800 mb-3 hover:underline cursor-pointer">حقوق الملكية</h3>
                                </Link>
                                <div className="space-y-2">
                                    {details?.equity.map(acc => (
                                        <AccountRow key={acc.id} account={acc} router={router} />
                                    ))}
                                    <Link href="/accounting/financial-reports?tab=balance-sheet">
                                        <div className="flex justify-between font-bold pt-2 border-t mt-2 hover:bg-slate-100 cursor-pointer rounded px-1 transition-colors">
                                            <span>إجمالي حقوق الملكية</span>
                                            <span>{formatCurrency(metrics?.totalEquity || 0)}</span>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div >
        </div >
    );
}

import Link from 'next/link';
function MetricCard({ title, value, icon: Icon, trend, description, color, href }: any) {
    const colorClasses = {
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        blue: "bg-blue-50 text-blue-600 border-blue-100",
        amber: "bg-amber-50 text-amber-600 border-amber-100",
        purple: "bg-purple-50 text-purple-600 border-purple-100",
        red: "bg-red-50 text-red-600 border-red-100",
    };

    const Content = (
        <Card className={`border shadow-sm hover:shadow-md transition-shadow ${href ? 'cursor-pointer' : ''}`}>
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-xl ${colorClasses[color as keyof typeof colorClasses]}`}>
                        <Icon className="w-6 h-6" />
                    </div>
                </div>
                <div>
                    <h3 className="text-sm font-medium text-slate-500 mb-1">{title}</h3>
                    <div className="text-2xl font-bold text-slate-900">{formatCurrency(value)}</div>
                    <p className="text-xs text-slate-400 mt-1">{description}</p>
                </div>
            </CardContent>
        </Card>
    );

    if (href) return <Link href={href}>{Content}</Link>;
    return Content;
}

function SummaryCard({ title, value, icon: Icon, color, href }: { title: string; value: number; icon: any; color: string; href: string }) {
    const colorClasses = {
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
        blue: "bg-blue-50 text-blue-600 border-blue-100",
        amber: "bg-amber-50 text-amber-600 border-amber-100",
        purple: "bg-purple-50 text-purple-600 border-purple-100",
        red: "bg-red-50 text-red-600 border-red-100",
        orange: "bg-orange-50 text-orange-600 border-orange-100",
    };

    return (
        <Link href={href}>
            <Card className="border shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-blue-300">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className={`p-2 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div className="text-left flex-1 mr-3">
                            <h3 className="text-xs font-medium text-slate-500 mb-1">{title}</h3>
                            <div className="text-lg font-bold text-slate-900">{formatCurrency(value)}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}

function AccountRow({ account, router, type = 'normal' }: { account: AccountSummaryV2, router: any, type?: 'normal' | 'expense' }) {

    const handleClick = () => {
        // Universal drill-down to Ledger View for ANY account clicked
        router.push(`/accounting/ledger/${account.id}`);
    };

    return (
        <div
            onClick={handleClick}
            className="flex justify-between items-center text-sm py-1 hover:bg-slate-100 rounded px-2 transition-colors cursor-pointer group"
        >
            <div className="flex items-center gap-2">
                <span className="text-slate-400 font-mono text-xs">{account.code}</span>
                <span className="text-slate-700 font-medium group-hover:text-blue-700 transition-colors">
                    {account.name_ar}
                </span>
            </div>
            <div className={`font-mono ${type === 'expense' ? 'text-red-600' : 'text-slate-900'}`}>
                {formatCurrency(Math.abs(Number(account.current_balance)))}
            </div>
        </div>
    );
}
