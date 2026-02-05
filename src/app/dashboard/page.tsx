
'use client';

import { Bell, Search, Mail, Settings, DollarSign, Package, CreditCard, ClipboardList, Users, Sun, Moon, Loader2, ArrowUpRight, ArrowDownLeft, ScanLine, Wallet } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import logo from '@/app/assets/logo.png';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Notification } from '@/lib/types';
import { getOrders, getUsers, getNotificationsForUser, markNotificationsAsReadForUser } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { MobileBottomNav, BottomNavItem } from '@/components/ui/MobileBottomNav';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const navItems: BottomNavItem[] = [
  { label: 'الرئيسية', icon: ArrowUpRight, href: '/dashboard', exact: true },
  { label: 'تتبع', icon: Search, href: '/dashboard/track-shipment' },
  { label: 'طلباتي', icon: ClipboardList, href: '/dashboard/my-orders' },
  { label: 'الدعم', icon: Users, href: '/dashboard/support-chat' },
  { label: 'إعدادات', icon: Settings, href: '/dashboard/my-data' },
];

const DashboardPage = () => {
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [orderCount, setOrderCount] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [trackId, setTrackId] = useState('');
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) {
      setGreeting('صباح الخير ☀️');
    } else {
      setGreeting('مساء الخير 🌙');
    }
  }, []);

  const router = useRouter();

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') || 'light';
    setTheme(storedTheme);
    document.documentElement.classList.toggle('dark', storedTheme === 'dark');

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const loggedInUserStr = localStorage.getItem('loggedInUser');
        if (!loggedInUserStr) {
          router.push('/login');
          return;
        }
        const loggedInUser = JSON.parse(loggedInUserStr);

        const allUsers = await getUsers();
        const currentUser = allUsers.find(u => u.id === loggedInUser.id);


        if (currentUser) {
          setUser(currentUser);

          const allOrders = await getOrders();
          const userOrders = allOrders.filter(o => o.userId === currentUser.id && o.status !== 'cancelled');

          // Stats
          const ordersTotal = userOrders.reduce((sum, o) => sum + o.sellingPriceLYD, 0);
          const debtTotal = userOrders.reduce((sum, o) => sum + o.remainingAmount, 0);
          setTotalValue(ordersTotal);
          setTotalDebt(debtTotal);
          setOrderCount(userOrders.length);

          // Recent Orders (Last 5)
          const sortedOrders = [...userOrders].sort((a, b) => new Date(b.operationDate).getTime() - new Date(a.operationDate).getTime());
          setRecentOrders(sortedOrders.slice(0, 5));

          // Fetch notifications
          const userNotifications = await getNotificationsForUser(currentUser.id);
          setNotifications(userNotifications);

        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();

  }, [router]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleOpenNotifications = async () => {
    if (user && unreadNotificationsCount > 0) {
      const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      await markNotificationsAsReadForUser(unreadIds);
    }
  };

  const handleTrackSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackId) {
      router.push(`/dashboard/track-shipment?id=${trackId}`);
    }
  };

  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24 font-sans text-foreground" dir="rtl">
      {/* Background Gradients */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <div className="fixed top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/5 to-transparent -z-10" />

      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 overflow-hidden rounded-full border border-primary/20 bg-white dark:bg-black/10 p-1">
            <Image
              src={logo}
              alt="User Avatar"
              layout="fill"
              objectFit="contain"
              className="p-1"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{greeting}</p>
            <h1 className="text-sm font-bold">{user?.name || 'زائر'}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </Button>
          <DropdownMenu onOpenChange={(open) => { if (open) handleOpenNotifications(); }}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative rounded-full">
                <Bell className="w-6 h-6" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-1 right-1 bg-red-500 w-2.5 h-2.5 rounded-full border-2 border-background animate-pulse" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 glass-card">
              <DropdownMenuLabel>الإشعارات</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length > 0 ? notifications.map(notification => (
                <DropdownMenuItem key={notification.id} className="flex flex-col items-start gap-1 whitespace-normal">
                  <p className="text-sm font-medium">{notification.message}</p>
                  <p className="text-xs text-muted-foreground">{new Date(notification.timestamp).toLocaleString('ar-LY')}</p>
                </DropdownMenuItem>
              )) : (
                <DropdownMenuItem disabled>لا توجد إشعارات جديدة</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-grow px-5 pt-6 space-y-8">

        {/* Tracking Section */}
        <section>
          <h2 className="text-2xl font-bold mb-4">
            تتبع <span className="text-primary">شحناتك</span> <br />
            بكل سهولة
          </h2>
          <form onSubmit={handleTrackSearch} className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input
              placeholder="أدخل رقم الشحنة..."
              className="pl-12 pr-10 py-6 text-base rounded-2xl border-primary/20 focus-visible:ring-primary bg-background/50 backdrop-blur-sm shadow-sm"
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
            />
            <Button size="icon" type="button" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors">
              <ScanLine className="w-5 h-5" />
            </Button>
          </form>
        </section>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="bg-primary text-primary-foreground p-5 rounded-[2rem] relative overflow-hidden shadow-lg shadow-primary/20 h-full flex flex-col justify-between min-h-[160px]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl" />
              <div>
                <div className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center mb-3 text-white">
                  <Package className="w-5 h-5" />
                </div>
                <p className="text-primary-foreground/80 text-sm font-medium">تم إرسالها</p>
              </div>
              <div>
                <h3 className="text-3xl font-bold">{orderCount}</h3>
                <p className="text-xs text-primary-foreground/60 mt-1">شحنة ناجحة</p>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="bg-card border border-border p-5 rounded-[2rem] relative overflow-hidden shadow-sm h-full flex flex-col justify-between min-h-[160px]">
              <div>
                <div className="bg-orange-100 dark:bg-orange-900/20 w-10 h-10 rounded-full flex items-center justify-center mb-3 text-orange-600 dark:text-orange-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <p className="text-muted-foreground text-sm font-medium">القيمة الاجمالية</p>
              </div>
              <div>
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : (
                  <>
                    <h3 className="text-2xl font-bold text-foreground">{totalValue.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">د.ل</span></h3>
                    {totalDebt > 0 && <p className="text-xs text-red-500 mt-1 font-medium">عليك: {totalDebt.toLocaleString()} د.ل</p>}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </section>

        {/* Stay Connected Actions */}
        <section>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            روابط <span className="text-primary">سريعة</span>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/dashboard/calculate-shipment" className="group">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-border hover:border-primary/50 transition-all shadow-sm flex items-center gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-xl text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">حاسبة</p>
                  <p className="text-xs text-muted-foreground">حساب التكلفة</p>
                </div>
              </div>
            </Link>
            <Link href="/dashboard/financial-operations" className="group">
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-border hover:border-primary/50 transition-all shadow-sm flex items-center gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 p-2.5 rounded-xl text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">المالية</p>
                  <p className="text-xs text-muted-foreground">كشف حساب</p>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Shipment History */}
        <section className="pb-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">آخر الشحنات</h3>
            <Link href="/dashboard/my-orders">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary rounded-full px-4 border border-border">
                عرض الكل
              </Button>
            </Link>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : recentOrders.length > 0 ? (
              recentOrders.map((order, i) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i }}
                >
                  <Link href={`/dashboard/my-orders/${order.id}`}>
                    <GlassCard className="p-0 overflow-hidden group hover:border-primary/50 transition-all duration-300 relative">
                      <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-primary/50 to-orange-600/50 opacity-0 group-hover:opacity-100 transition-opacity" />

                      <div className="p-5 flex flex-col gap-4">
                        {/* Header: Tracking & Status */}
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 w-10 h-10 rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                              <Package className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-base leading-none">{order.trackingNumber}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(order.operationDate).toLocaleDateString('ar-LY')}
                              </p>
                            </div>
                          </div>
                          <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'} className={cn(
                            "px-3 py-1 text-xs font-semibold rounded-lg shadow-sm",
                            order.status === 'delivered' && "bg-green-100 text-green-700 hover:bg-green-200 border-green-200",
                            order.status === 'pending' && "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-200",
                            order.status === 'shipped' && "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200",
                            order.status === 'cancelled' && "bg-red-100 text-red-700 hover:bg-red-200 border-red-200"
                          )}>
                            {translateStatus(order.status)}
                          </Badge>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-border/50 w-full" />

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-xs flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              المستلم
                            </p>
                            <p className="font-semibold truncate">{order.receiverName || order.customerName}</p>
                          </div>
                          <div className="space-y-1 text-left">
                            <p className="text-muted-foreground text-xs flex items-center justify-end gap-1">
                              <DollarSign className="w-3 h-3" />
                              المالية
                            </p>
                            <p className="font-bold text-primary">{order.sellingPriceLYD.toFixed(2)} د.ل</p>
                          </div>
                        </div>

                        {/* Extra Details: Address & Item */}
                        {(order.customerAddress || order.itemDescription) && (
                          <div className="bg-secondary/30 rounded-xl p-3 space-y-2 text-xs">
                            {order.itemDescription && (
                              <div className="flex items-start gap-2">
                                <ClipboardList className="w-3 h-3 text-muted-foreground mt-0.5" />
                                <span className="text-foreground/80 line-clamp-1">{order.itemDescription}</span>
                              </div>
                            )}
                            {order.customerAddress && (
                              <div className="flex items-start gap-2">
                                <ScanLine className="w-3 h-3 text-muted-foreground mt-0.5" /> {/* Using MapPin icon concept but ScanLine is available locally or check imports */}
                                <span className="text-muted-foreground line-clamp-1">{order.customerAddress}</span>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    </GlassCard>
                  </Link>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm bg-accent/20 rounded-2xl border border-dashed border-border">
                لا توجد شحنات حديثة
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav items={navItems} />
    </div>
  );
};

function translateStatus(status: string) {
  const map: Record<string, string> = {
    'pending': 'قيد التجهيز',
    'processed': 'تم التنفيذ',
    'ready': 'تم التجهيز',
    'shipped': 'تم الشحن',
    'arrived_dubai': 'وصلت إلى دبي',
    'arrived_benghazi': 'وصلت إلى بنغازي',
    'arrived_tobruk': 'وصلت إلى طبرق',
    'out_for_delivery': 'مع المندوب',
    'delivered': 'تم التسليم',
    'cancelled': 'ملغي',
    'paid': 'مدفوع',
    'returned': 'راجع',
  };
  return map[status] || status;
}

export default DashboardPage;
