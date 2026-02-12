
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    BookOpen,
    FileText,
    Receipt,
    Banknote,
    Users,
    Package,
    Building2,
    BarChart3,
    Menu,
    X,
    LogOut,
    Settings,
    Box
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const sidebarItems = [
    { name: 'دليل الحسابات', href: '/accounting/chart-of-accounts', icon: BookOpen },
    { name: 'القيود اليومية', href: '/accounting/journal-entries', icon: FileText },
    { name: 'الملخص المالي', href: '/accounting/dashboard', icon: LayoutDashboard },

    // العمليات التجارية
    { name: 'فواتير المبيعات', href: '/accounting/sales-invoices', icon: Receipt },
    { name: 'فواتير الشراء', href: '/accounting/purchase-invoices', icon: Receipt },
    { name: 'سندات القبض', href: '/accounting/receipts', icon: Banknote },
    { name: 'سندات الصرف', href: '/accounting/payments', icon: Banknote },
    { name: 'الرواتب', href: '/accounting/payroll', icon: Users },

    // الخزينة والعملاء
    { name: 'النقدية والبنوك', href: '/accounting/cash-bank', icon: Banknote },
    { name: 'العملاء والموردين', href: '/accounting/customers-suppliers', icon: Users },

    // الموظفين والرواتب
    { name: 'الموظفين والرواتب', href: '/accounting/employees', icon: Users },

    // المخزون والأصول
    { name: 'المخزون', href: '/accounting/inventory', icon: Package },
    { name: 'التحويلات المخزنية', href: '/accounting/transfers', icon: Package },
    { name: 'الأصول الثابتة', href: '/accounting/fixed-assets', icon: Building2 }, // Assuming fixed-assets is the legacy one

    { name: 'التقارير المالية', href: '/accounting/financial-reports', icon: BarChart3 },
    { name: 'الإعدادات', href: '/accounting/settings', icon: Settings },
];

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = () => {
        localStorage.removeItem('loggedInUser');
        router.push('/admin/login');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex" dir="rtl">
            {/* Mobile Sidebar Overlay */}
            {!sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(true)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed lg:sticky top-0 h-screen w-64 bg-white border-l shadow-sm z-30 transition-transform duration-300 flex flex-col",
                    !sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0 lg:w-0 lg:overflow-hidden lg:border-none"
                    // Note: Logic allows checking if hidden. Let's simplify:
                    // If open: show. If closed: hide.
                )}
                style={{
                    transform: sidebarOpen ? 'translateX(0)' : 'translateX(100%)',
                    width: sidebarOpen ? '16rem' : '0',
                    opacity: sidebarOpen ? 1 : 0
                }}
            // Using inline styles for easier width transition override on generic tailwind classes
            >
                <div className={cn(
                    "flex flex-col h-full w-64 bg-white border-l transition-all duration-300",
                    !sidebarOpen && "hidden"
                )}>
                    <div className="p-6 border-b flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-900">النظام المحاسبي</h1>
                    </div>

                    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                        {sidebarItems.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <Link key={item.href} href={item.href}>
                                    <span
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        )}
                                    >
                                        <item.icon className={cn("w-5 h-5", isActive ? "text-emerald-600" : "text-slate-400")} />
                                        {item.name}
                                    </span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t bg-slate-50">
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={handleLogout}
                        >
                            <LogOut className="w-5 h-5 ml-2" />
                            تسجيل خروج
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 overflow-auto">
                {/* Top Mobile Bar */}
                <div className="lg:hidden bg-white border-b p-4 flex items-center justify-between sticky top-0 z-20">
                    <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </Button>
                    <span className="font-semibold text-slate-800">النظام المحاسبي</span>
                </div>

                {/* Toggle Button for Desktop */}
                <div className="hidden lg:block fixed top-4 right-4 z-40">
                    {/* Can add a collapse button here if needed */}
                </div>

                <div className="p-4 sm:p-6 lg:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
