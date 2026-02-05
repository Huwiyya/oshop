'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    LayoutDashboard,
    FileText,
    Wallet,
    Landmark,
    ArrowDownLeft,
    ArrowUpRight,
    FileBarChart,
    Settings,
    Briefcase
} from 'lucide-react';

const accountingNavItems = [
    { href: '/admin/accounting', icon: LayoutDashboard, label: 'الملخص (Summary)', exact: true },
    { href: '/admin/accounting/journal', icon: FileText, label: 'قيود اليومية (Journal Entries)' },
    { href: '/admin/accounting/cash-accounts', icon: Wallet, label: 'الخزائن النقدية (Cash Accounts)' },
    { href: '/admin/accounting/bank-accounts', icon: Landmark, label: 'الحسابات البنكية (Bank Accounts)' },
    { href: '/admin/accounting/receipts', icon: ArrowDownLeft, label: 'المقبوضات (Receipts)' },
    { href: '/admin/accounting/payments', icon: ArrowUpRight, label: 'المدفوعات (Payments)' },
    { href: '/admin/accounting/reports', icon: FileBarChart, label: 'التقارير (Reports)' },
    { href: '/admin/accounting/settings', icon: Settings, label: 'الإعدادات (Settings)' },
];

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
            {/* Business Header (Manager.io style top bar for the business) */}
            <div className="bg-white dark:bg-[#1c1c1e] p-4 rounded-xl border border-gray-200 dark:border-white/5 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                    <Briefcase className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="font-bold text-lg leading-none">Oshop - ( فرع مصراته )</h2>
                    <p className="text-xs text-muted-foreground mt-1">نظام المحاسبة المتكامل</p>
                </div>
            </div>

            <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Accounting Sidebar */}
                <aside className="w-64 flex-shrink-0 flex flex-col gap-2 overflow-y-auto pb-4">
                    {accountingNavItems.map((item) => {
                        const isActive = item.exact
                            ? pathname === item.href
                            : pathname.startsWith(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-white dark:bg-white/10 text-primary font-bold shadow-sm border border-gray-100 dark:border-white/5"
                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200"
                                )}
                            >
                                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-gray-500")} />
                                {item.label}
                            </Link>
                        );
                    })}
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto pr-2">
                    {children}
                </main>
            </div>
        </div>
    );
}
