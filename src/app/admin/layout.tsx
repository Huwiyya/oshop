'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Home,
  Users,
  Briefcase,
  Bike,
  ShoppingCart,
  Users2,
  BarChart,
  MessageSquare,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  Loader2,
  DollarSign,
  TrendingDown,
  HandCoins,
  Printer,
  Download,
  BookUser,
  Zap,
  Package,
  Globe,
  CreditCard,
  FolderTree,
} from 'lucide-react';
import Image from 'next/image';
import logo from '@/app/assets/logo.png';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Manager } from '@/lib/types';
import { getManagerById } from '@/lib/actions';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
  { href: '/admin/dashboard', icon: Home, label: 'لوحة التحكم', permissionId: 'dashboard' },
  { href: '/admin/users', icon: Users, label: 'إدارة المستخدمين', permissionId: 'users' },
  { href: '/admin/employees', icon: Briefcase, label: 'إدارة المدراء', permissionId: 'employees' },
  { href: '/admin/representatives', icon: Bike, label: 'إدارة المندوبين', permissionId: 'representatives' },
  { href: '/admin/orders', icon: ShoppingCart, label: 'إدارة الطلبات', permissionId: 'orders' },
  { href: '/admin/sites', icon: Globe, label: 'إدارة المواقع العالمية', permissionId: 'orders' },
  // Inventory removed as per request
  { href: '/admin/shein-cards', icon: CreditCard, label: 'البطاقات والخزينة', permissionId: 'inventory' },
  { href: '/admin/shipping-label', icon: Printer, label: 'إنشاء بوليصة شحن', permissionId: 'shipping_label' },
  { href: '/admin/temporary-users', icon: Users2, label: 'المستخدمين المؤقتين', permissionId: 'temporary_users' },
  { href: '/admin/financial-reports', icon: BarChart, label: 'التقارير المالية', permissionId: 'financial_reports' },
  { href: '/admin/instant-sales', icon: Zap, label: 'مبيعات فورية', permissionId: 'instant_sales' },
  { href: '/admin/instant-sales', icon: Zap, label: 'مبيعات فورية', permissionId: 'instant_sales' },
  { href: '/admin/deposits', icon: HandCoins, label: 'سجل العربون', permissionId: 'deposits' },
  { href: '/admin/expenses', icon: TrendingDown, label: 'إدارة المصروفات', permissionId: 'expenses' },
  { href: '/admin/creditors', icon: BookUser, label: 'إدارة الذمم', permissionId: 'creditors' },
  { href: '/admin/support-center', icon: MessageSquare, label: 'مركز الدعم', permissionId: 'support' },
  { href: '/admin/notifications', icon: Bell, label: 'إدارة الإشعارات', permissionId: 'notifications' },
  { href: '/admin/data-export', icon: Download, label: 'تصدير البيانات', permissionId: 'data_export' },
  { href: '/admin/exchange-rate', icon: DollarSign, label: 'اسعار الصرف والشحن', permissionId: 'exchange_rate' },
];

const getPageTitle = (pathname: string): string => {
  const pageTitles: { [key: string]: string } = {
    '/admin/dashboard': 'لوحة التحكم الرئيسية',
    '/admin/users': 'إدارة المستخدمين',
    '/admin/employees': 'إدارة المدراء',
    '/admin/representatives': 'إدارة المندوبين',
    '/admin/orders': 'إدارة الطلبات',
    '/admin/orders/add': 'إضافة/تعديل طلب',
    '/admin/sites': 'إدارة المواقع العالمية',
    '/admin/inventory': 'إدارة المخزون',
    '/admin/shein-cards': 'إدارة بطاقات Shein',
    '/admin/shipping-label': 'إنشاء بوليصة شحن يدوية',
    '/admin/shipping-label/history': 'سجل البوليصات اليدوية',
    '/admin/temporary-users': 'إدارة المستخدمين المؤقتين',
    '/admin/temporary-users/add': 'إضافة فاتورة مجمعة',
    '/admin/financial-reports': 'التقارير المالية',
    '/admin/instant-sales': 'حاسبة المبيعات الفورية',
    '/admin/instant-sales/history': 'سجل المبيعات الفورية',
    '/admin/deposits': 'سجل العربون',
    '/admin/expenses': 'إدارة المصروفات',
    '/admin/creditors': 'إدارة الذمم (الدائنون/المدينون)',
    '/admin/support-center': 'مركز الدعم',
    '/admin/notifications': 'إدارة الإشعارات',
    '/admin/data-export': 'تصدير البيانات',
    '/admin/exchange-rate': 'اسعار الصرف والشحن',
  };

  if (pathname.startsWith('/admin/users/print')) return 'طباعة كشف حساب المستخدم';
  if (pathname.startsWith('/admin/users/')) return 'الملف الشخصي للمستخدم';
  if (pathname.startsWith('/admin/representatives/')) return 'الملف الشخصي للمندوب';
  if (pathname.startsWith('/admin/creditors/print')) return 'طباعة كشف حساب';
  if (pathname.startsWith('/admin/creditors/')) return 'ملف الذمة';
  if (pathname.startsWith('/admin/orders/')) return 'تفاصيل الطلب';
  if (pathname.startsWith('/admin/treasury/')) return 'تفاصيل الخزينة';
  if (pathname.startsWith('/admin/shein-cards/')) return 'تفاصيل بطاقة شي إن';

  return pageTitles[pathname] || 'لوحة التحكم';
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentManager, setCurrentManager] = useState<Manager | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const user = localStorage.getItem('loggedInUser');
    if (user) {
      try {
        const userData = JSON.parse(user);
        if (userData.type === 'admin') {
          const fetchManagerData = async () => {
            // In a real app we might verify token valididity here
            // For now we trust localStorage but reload permissions
            const manager = await getManagerById(userData.id);
            if (manager) {
              setCurrentManager(manager);
              setIsAuthenticated(true);
            } else {
              handleLogout();
            }
          };
          fetchManagerData();
        } else {
          setIsAuthenticated(false);
          if (pathname !== '/admin/login') {
            // Avoid redirect loop if already on login
            router.push('/admin/login');
          }
        }
      } catch (e) {
        setIsAuthenticated(false);
        if (pathname !== '/admin/login') router.push('/admin/login');
      }
    } else {
      setIsAuthenticated(false);
      if (pathname !== '/admin/login') router.push('/admin/login');
    }
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.removeItem('loggedInUser');
    setCurrentManager(null);
    setIsAuthenticated(false);
    router.push('/admin/login');
  };

  const currentPageTitle = getPageTitle(pathname);

  const visibleNavItems = navItems.filter(item => {
    if (item.permissionId === 'dashboard') return true;
    const isSuperAdmin = currentManager?.username === 'admin@tamweelsys.app';
    if (isSuperAdmin) return true;
    return currentManager?.permissions?.includes(item.permissionId);
  });

  if (!isMounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (pathname === '/admin/login' || !isAuthenticated) {
    return <>{children}</>;
  }

  // Check access:
  // 1. Dashboard is always allowed.
  // 2. Path must start with a visible nav item's href.
  // 3. SPECIAL CASE: /admin/treasury/... is allowed if user has access to /admin/shein-cards (inventory permission).
  // 4. SPECIAL CASE: /admin/shein-cards/... (details) matches standard prefix so it's covered by #2.
  const isAllowed =
    pathname === '/admin/dashboard' ||
    visibleNavItems.some(item => pathname.startsWith(item.href)) ||
    (pathname.startsWith('/admin/treasury') && visibleNavItems.some(item => item.href === '/admin/shein-cards'));

  if (!isAllowed) {
    return (
      <div className="flex h-screen items-center justify-center bg-[hsl(var(--background))] text-center p-4" dir="rtl">
        <div className="glass-card p-8 rounded-2xl border-red-500/20">
          <h1 className="text-3xl font-bold text-destructive mb-4">وصول مرفوض</h1>
          <p className="text-muted-foreground mb-6">ليس لديك الصلاحية للوصول إلى هذه الصفحة.</p>
          <Button variant="outline" onClick={() => router.push('/admin/dashboard')}>العودة إلى لوحة التحكم</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-foreground font-sans selection:bg-primary/30" dir="rtl">
      {/* Dynamic Background Effect */}
      <div className="fixed inset-0 bg-slate-50 dark:bg-[#0f172a] -z-20 transition-colors duration-500" />
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 dark:bg-primary/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[120px] animate-pulse delay-700" />
      </div>

      <TooltipProvider>
        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[55] md:hidden backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Professional Sidebar */}
        <aside
          className={cn(
            'fixed transition-transform duration-300 ease-in-out no-print flex flex-col',
            // Mobile Styles: Full Height, Right Aligned, High Z-Index
            'inset-y-0 right-0 z-[60] w-[85%] max-w-[320px] bg-[#1c1c1e]/95 backdrop-blur-2xl border-l border-white/5 shadow-2xl',
            // Desktop Styles: Floating, Rounded, Lower Z-Index
            'md:top-4 md:right-4 md:bottom-4 md:z-40 md:w-72 md:rounded-3xl md:bg-white md:dark:bg-[#1c1c1e] md:shadow-xl md:border md:border-gray-100 md:dark:border-white/5',
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
          )}
        >
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/5">
            <Link href="/admin/dashboard" className="flex items-center gap-3 group">
              <div className="relative w-12 h-12 flex items-center justify-center bg-gradient-to-br from-primary to-orange-600 rounded-2xl shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all duration-500">
                <Image src={logo} alt="Logo" width={32} height={32} className="brightness-0 invert transform group-hover:scale-110 transition-transform" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none">Oshop</h1>
                <span className="text-[10px] text-primary font-bold tracking-widest uppercase mt-1">Admin Panel</span>
              </div>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 rounded-xl"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto px-4 py-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
            <ul className="space-y-2">
              {visibleNavItems.map((item) => {
                const isActive = pathname.startsWith(item.href) && item.href !== '/admin/dashboard' || pathname === item.href;
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-4 rounded-2xl px-5 py-4 transition-all duration-300 group relative overflow-hidden',
                        isActive
                          ? 'text-white bg-gradient-to-r from-primary to-orange-600 shadow-lg shadow-primary/25' // Active state: Solid primary gradient
                          : 'text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'
                      )}
                      onClick={() => setIsSidebarOpen(false)}
                    >
                      {/* Active Indicator Bar (Removed for solid active bg style, or keep if preferred? I'll use the gradient bg as primarily requested for "Premium") */}
                      {/* Actually, previous code used text-white on active, checking intent. It used primary/20 bg. I will switch to solid gradient for better contrast in light mode too. */}

                      <item.icon className={cn(
                        "h-6 w-6 z-10 relative transition-transform duration-300",
                        isActive ? "text-white scale-110" : "group-hover:text-primary dark:group-hover:text-white group-hover:scale-110"
                      )}
                      />
                      <span className={cn(
                        "z-10 relative font-bold text-sm tracking-wide transition-all",
                        isActive ? "text-white" : "group-hover:text-primary dark:group-hover:text-white"
                      )}>{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* User Profile Footer */}
          <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-black/20">
            <div className="flex items-center gap-4 px-4 py-4 rounded-2xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/5 hover:bg-white/80 dark:hover:bg-white/10 transition-colors cursor-pointer group shadow-sm">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center text-sm font-bold text-black border-2 border-white dark:border-white/10 shadow-lg relative">
                {currentManager?.name?.[0] || 'A'}
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-[#1c1c1e]"></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-primary transition-colors">{currentManager?.name || 'Admin'}</p>
                <p className="text-xs text-muted-foreground dark:text-white/40 truncate font-mono">{currentManager?.username}</p>
              </div>
              <LogOut className="w-5 h-5 text-gray-400 dark:text-white/20 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors" onClick={handleLogout} />
            </div>
          </div>
        </aside>

        <div className="md:pr-[20rem] transition-[padding] duration-300 h-full"> {/* Increased padding for floating sidebar */}
          <header className="sticky top-0 z-30 flex h-20 items-center justify-between gap-4 px-6 md:px-8 no-print pt-4">
            {/* Glass Header */}
            <div className="w-full h-16 rounded-2xl glass flex items-center justify-between px-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden text-foreground"
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open sidebar</span>
                </Button>
                <h1 className="font-bold text-lg text-gradient bg-clip-text bg-gradient-to-r from-primary to-orange-500">{currentPageTitle}</h1>
              </div>

              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full hover:bg-primary/20 text-foreground">
                      {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>تغيير المظهر</p></TooltipContent>
                </Tooltip>
                <div className="w-px h-6 bg-border mx-1"></div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full hover:bg-destructive/20 hover:text-destructive text-muted-foreground">
                      <LogOut className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>تسجيل الخروج</p></TooltipContent>
                </Tooltip>
              </div>
            </div>
          </header>

          <main className="p-4 sm:p-6 md:p-8 pb-24 md:pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </main>
        </div>

        {/* Mobile Floating Dock Navigation */}
        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm">
          <div className="bg-[#1c1c1e]/90 backdrop-blur-xl rounded-full border border-white/5 shadow-2xl flex items-center justify-between px-6 py-4">
            {[
              { href: '/admin/dashboard', icon: Home, label: 'الرئيسية' },
              { href: '/admin/orders', icon: ShoppingCart, label: 'الطلبات' },
              { href: '/admin/users', icon: Users, label: 'المستخدمين' },
              { href: '/admin/shein-cards', icon: CreditCard, label: 'الخزينة' },
            ].map((item) => {
              const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative group"
                >
                  <div className={cn(
                    "relative p-3 rounded-full transition-all duration-300",
                    isActive ? "bg-[#f7941d] text-white shadow-[0_0_15px_rgba(247,148,29,0.5)] transform -translate-y-2" : "text-gray-400 hover:text-white"
                  )}>
                    <item.icon className={cn("w-6 h-6", isActive && "fill-current")} />
                  </div>
                  {isActive && (
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-[#f7941d] whitespace-nowrap opacity-0 animate-in fade-in slide-in-from-top-1 duration-300 fill-mode-forwards">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}

            <button
              onClick={() => setIsSidebarOpen(true)}
              className="relative p-3 rounded-full text-gray-400 hover:text-white transition-all duration-300"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
