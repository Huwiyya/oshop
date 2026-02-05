import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileBarChart, Scale, BookOpen, Users, Building2, TrendingUp, Calendar } from 'lucide-react';
import Link from 'next/link';

const reports = [
    {
        title: 'قائمة المركز المالي (Balance Sheet)',
        description: 'توضح الأصول، الخصوم، وحقوق الملكية في لحظة زمنية معينة.',
        icon: Scale,
        href: '/admin/accounting/reports/balance-sheet',
        color: 'text-emerald-600',
        BgColor: 'bg-emerald-100 dark:bg-emerald-900/20'
    },
    {
        title: 'قائمة الأرباح والخسائر (Profit & Loss)',
        description: 'ملخص للإيرادات، المصروفات، وصافي الربح/الخسارة لفترة محددة.',
        icon: TrendingUp,
        href: '/admin/accounting/reports/profit-loss',
        color: 'text-blue-600',
        BgColor: 'bg-blue-100 dark:bg-blue-900/20'
    },
    {
        title: 'ملخص دفتر الأستاذ (General Ledger)',
        description: 'تفاصيل الحركات المالية لجميع الحسابات.',
        icon: BookOpen,
        href: '/admin/accounting/reports/general-ledger',
        color: 'text-purple-600',
        BgColor: 'bg-purple-100 dark:bg-purple-900/20'
    },
    {
        title: 'كشف حساب عميل (Customer Statement)',
        description: 'سجل المعاملات والديون الخاصة بعميل معين.',
        icon: Users,
        href: '/admin/accounting/reports/customer-statement',
        color: 'text-orange-600',
        BgColor: 'bg-orange-100 dark:bg-orange-900/20'
    },
    {
        title: 'كشف حساب مورد/دائن (Supplier Statement)',
        description: 'سجل المعاملات والمدفوعات للموردين والدائنين.',
        icon: Building2,
        href: '/admin/accounting/reports/supplier-statement',
        color: 'text-rose-600',
        BgColor: 'bg-rose-100 dark:bg-rose-900/20'
    },
    {
        title: 'تقرير المقبوضات والمدفوعات',
        description: 'ملخص للتدفقات النقدية الواردة والصادرة.',
        icon: FileBarChart,
        href: '/admin/accounting/reports/cash-flow',
        color: 'text-cyan-600',
        BgColor: 'bg-cyan-100 dark:bg-cyan-900/20'
    }
];

export default function ReportsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">التقارير المالية (Reports)</h1>
                <p className="text-muted-foreground">مجموعة التقارير القياسية للتحليل المالي</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reports.map((report) => (
                    <Link key={report.href} href={report.href}>
                        <Card className="hover:border-primary/50 transition-all cursor-pointer h-full group">
                            <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                                <div className={`p-3 rounded-lg ${report.BgColor}`}>
                                    <report.icon className={`w-6 h-6 ${report.color}`} />
                                </div>
                                <div className="space-y-1">
                                    <CardTitle className="text-base group-hover:text-primary transition-colors">
                                        {report.title}
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-sm leading-relaxed">
                                    {report.description}
                                </CardDescription>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
