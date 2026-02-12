'use client';

import React, { useState, useEffect } from 'react';
import {
    Users,
    Briefcase,
    Bike,
    ShoppingCart,
    Users2,
    BarChart,
    MessageSquare,
    Bell,
    ArrowRight,
    Loader2,
    DollarSign,
    TrendingUp,
    TrendingDown,
    Zap,
    Download,
    Package,
    Calculator
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter as useNextRouter } from 'next/navigation';
import { Manager, Order } from '@/lib/types';
import { getManagerById, getTransactions, getExpenses, getOrders } from '@/lib/actions';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/GlassCard';
import { PremiumDonutChart } from '@/components/ui/PremiumDonutChart';

const allDashboardItems = [
    {
        title: "إدارة الطلبات",
        description: "عرض وتحديث حالات الطلبات الجديدة.",
        icon: ShoppingCart,
        href: "/admin/orders",
        color: "text-orange-400",
        gradient: "from-orange-500/20 to-yellow-500/20"
    },
    {
        title: "إدارة المستخدمين",
        description: "إضافة، تعديل، وحذف حسابات المستخدمين.",
        icon: Users,
        href: "/admin/users",
        color: "text-green-400",
        gradient: "from-green-500/20 to-emerald-500/20"
    },
    {
        title: "إدارة المندوبين",
        description: "متابعة المندوبين وتعيين الطلبات.",
        icon: Bike,
        href: "/admin/representatives",
        color: "text-orange-400",
        gradient: "from-orange-500/20 to-amber-500/20"
    },
    {
        title: "إدارة المدراء",
        description: "التحكم في صلاحيات المدراء والمشرفين.",
        icon: Briefcase,
        href: "/admin/employees",
        color: "text-purple-400",
        gradient: "from-purple-500/20 to-pink-500/20"
    },
    {
        title: "المستخدمين المؤقتين",
        description: "إدارة الطلبات للمستخدمين غير المسجلين.",
        icon: Users2,
        href: "/admin/temporary-users",
        color: "text-indigo-400",
        gradient: "from-indigo-500/20 to-violet-500/20"
    },
    {
        title: "التقارير المالية",
        description: "عرض الإحصائيات والتقارير المالية.",
        icon: BarChart,
        href: "/admin/financial-reports",
        color: "text-pink-400",
        gradient: "from-pink-500/20 to-rose-500/20"
    },
    {
        title: "مركز الدعم",
        description: "التواصل مع المستخدمين وحل مشاكلهم.",
        icon: MessageSquare,
        href: "/admin/support-center",
        color: "text-teal-400",
        gradient: "from-teal-500/20 to-cyan-500/20"
    },
    {
        title: "إدارة الإشعارات",
        description: "إرسال إشعارات عامة أو خاصة للمستخدمين.",
        icon: Bell,
        href: "/admin/notifications",
        color: "text-yellow-400",
        gradient: "from-yellow-500/20 to-orange-500/20"
    },
    {
        title: "اسعار الصرف والشحن",
        description: "إدارة إعدادات النظام المالية.",
        icon: DollarSign,
        href: "/admin/exchange-rate",
        color: "text-red-400",
        gradient: "from-red-500/20 to-orange-500/20"
    },
    {
        title: "مبيعات فورية",
        description: "تسجيل المبيعات المباشرة وحساب الأرباح.",
        icon: Zap,
        href: "/admin/instant-sales",
        color: "text-yellow-300",
        gradient: "from-yellow-400/20 to-amber-600/20"
    }
];

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

const itemVariant = {
    hidden: { y: 20, opacity: 0, scale: 0.95 },
    show: { y: 0, opacity: 1, scale: 1, transition: { type: "spring", stiffness: 100 } }
};

const AdminDashboardPage = () => {
    const nextRouter = useNextRouter();
    const [manager, setManager] = useState<Manager | null>(null);
    const [dailyData, setDailyData] = useState({
        revenue: 0,
        expenses: 0,
        netProfit: 0,
        totalOrders: 0,
        trends: { revenue: 0, expenses: 0, netProfit: 0, orders: 0 }
    });
    const [chartData, setChartData] = useState<any[]>([]);
    const [recentOrders, setRecentOrders] = useState<Order[]>([]);
    const [statusConfig, setStatusConfig] = useState<any>({}); // Will load dynamically if possible
    const [isDailyDataLoading, setIsDailyDataLoading] = useState(true);

    useEffect(() => {
        // Load Status Config (Mock or Import)
        // For now, using standard map
        setStatusConfig({
            'pending': { text: 'قيد الانتظار', color: 'orange' },
            'processing': { text: 'قيد المعالجة', color: 'blue' },
            'delivered': { text: 'تم التوصيل', color: 'green' },
            'cancelled': { text: 'ملغي', color: 'red' },
            'ready': { text: 'جاهز للشحن', color: 'purple' },
            'shipped': { text: 'تم الشحن', color: 'indigo' }
        });

        const fetchManagerData = async () => {
            const user = localStorage.getItem('loggedInUser');
            if (user) {
                try {
                    const userData = JSON.parse(user);
                    if (userData.type === 'admin') {
                        const fetchedManager = await getManagerById(userData.id);
                        if (fetchedManager) {
                            setManager(fetchedManager);
                            const hasReportsPermission =
                                fetchedManager.permissions?.includes('reports') ||
                                fetchedManager.permissions?.includes('financial_reports') ||
                                fetchedManager.permissions?.includes('dashboard') ||
                                fetchedManager.username === 'admin@tamweelsys.app';

                            if (hasReportsPermission) {
                                fetchDailyFinancials();
                            } else {
                                setIsDailyDataLoading(false);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse user data or fetch manager name", e);
                }
            }
        };

        const fetchDailyFinancials = async () => {
            setIsDailyDataLoading(true);
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];

            const [transactions, expenses, orders] = await Promise.all([
                getTransactions(),
                getExpenses(),
                getOrders(),
            ]);

            const regularTransactions = transactions.filter(t => !t.customerId.startsWith('TEMP-'));

            // Recent Orders Logic
            const sortedOrders = [...orders]
                .sort((a, b) => new Date(b.operationDate).getTime() - new Date(a.operationDate).getTime())
                .slice(0, 10); // Show more on the new design
            setRecentOrders(sortedOrders);

            const todayTransactions = regularTransactions.filter(t => t.date.startsWith(todayStr));

            // Today's Stats
            const todayRevenue = todayTransactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
            const todayExpenses = expenses.filter(e => e.date.startsWith(todayStr)).reduce((sum, e) => sum + e.amount, 0);

            const calculateProfit = (orderList: Order[]) => {
                return orderList.reduce((profit, order) => {
                    const purchasePriceUSD = order.purchasePriceUSD || 0;
                    const shippingCostLYD = order.shippingCostLYD || 0;
                    const purchaseCostLYD = purchasePriceUSD * (order.exchangeRate || 0);
                    return profit + (order.sellingPriceLYD - purchaseCostLYD - shippingCostLYD);
                }, 0);
            };

            const todayOrders = orders.filter(o => o.operationDate.startsWith(todayStr) && o.status !== 'cancelled' && !o.userId.startsWith('TEMP-'));
            const todayNetProfit = calculateProfit(todayOrders) - todayExpenses;

            // Yesterday's Stats
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            const yesterdayTransactions = regularTransactions.filter(t => t.date.startsWith(yesterdayStr));

            const yesterdayRevenue = yesterdayTransactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
            const yesterdayExpenses = expenses.filter(e => e.date.startsWith(yesterdayStr)).reduce((sum, e) => sum + e.amount, 0);
            const yesterdayOrders = orders.filter(o => o.operationDate.startsWith(yesterdayStr) && o.status !== 'cancelled' && !o.userId.startsWith('TEMP-'));
            const yesterdayNetProfit = calculateProfit(yesterdayOrders) - yesterdayExpenses;

            // Trend Calculation
            const calcTrend = (current: number, previous: number) => {
                if (previous === 0) return current === 0 ? 0 : 100;
                return ((current - previous) / previous) * 100;
            };

            const trends = {
                revenue: calcTrend(todayRevenue, yesterdayRevenue),
                expenses: calcTrend(todayExpenses, yesterdayExpenses),
                netProfit: calcTrend(todayNetProfit, yesterdayNetProfit),
                orders: calcTrend(orders.length, orders.length)
            };

            setDailyData({
                revenue: todayRevenue,
                expenses: todayExpenses,
                netProfit: todayNetProfit,
                totalOrders: orders.length,
                trends
            });

            // Real Chart Data - Last 7 Days
            const days = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dStr = d.toISOString().split('T')[0];
                const dayName = format(d, 'EEE', { locale: ar });

                // Calculate total sales for this day
                const dayOrders = orders.filter(o => o.operationDate.startsWith(dStr) && o.status !== 'cancelled' && !o.userId.startsWith('TEMP-'));
                const dayValue = dayOrders.reduce((sum, o) => sum + (o.sellingPriceLYD || 0), 0);

                days.push({ name: dayName, value: dayValue, fullDate: dStr });
            }
            setChartData(days);

            setIsDailyDataLoading(false);
        };

        fetchManagerData();
    }, []);

    const hasReportsAccess = manager?.permissions?.includes('financial_dashboard') ||
        manager?.permissions?.includes('reports') ||
        manager?.username === 'admin@tamweelsys.app';

    // Calculate max value for chart scaling
    const maxChartValue = Math.max(...chartData.map(d => d.value), 100); // Default to 100 to avoid division by zero

    return (
        <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-6 pb-24 md:pb-8" // Extra padding for mobile dock
        >
            {/* NEW WELCOME HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
                        مرحباً، {manager?.name || 'Admin'}
                    </h2>
                    <p className="text-muted-foreground mt-1">نظرة عامة على أداء النظام اليوم</p>
                </div>
                <div className="flex gap-2">
                    <Button className="bg-[#f7941d] hover:bg-[#d67e15] text-white rounded-xl shadow-[0_0_20px_rgba(247,148,29,0.3)]">
                        <Download className="ml-2 h-4 w-4" />
                        تصدير تقرير
                    </Button>
                </div>
            </div>

            {/* NEW STATS GRID (PREMIUM DARK CARDS) */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                    {
                        title: "إجمالي الطلبات",
                        value: dailyData.totalOrders.toString(),
                        icon: Package,
                        trend: "الكل", // Static for total count
                        color: "text-[#f7941d]",
                        bg: "bg-[#f7941d]/10"
                    },
                    {
                        title: "الإيرادات اليومية",
                        value: `${dailyData.revenue.toLocaleString()} د.ل`,
                        icon: DollarSign,
                        trend: `${dailyData.trends.revenue > 0 ? '+' : ''}${dailyData.trends.revenue.toFixed(1)}%`,
                        color: "text-green-500",
                        bg: "bg-green-500/10"
                    },
                    {
                        title: "المصاريف",
                        value: `${dailyData.expenses.toLocaleString()} د.ل`,
                        icon: TrendingDown,
                        trend: `${dailyData.trends.expenses > 0 ? '+' : ''}${dailyData.trends.expenses.toFixed(1)}%`,
                        color: "text-red-500",
                        bg: "bg-red-500/10"
                    },
                    {
                        title: "صافي الأرباح",
                        value: `${dailyData.netProfit.toLocaleString()} د.ل`,
                        icon: Zap,
                        trend: `${dailyData.trends.netProfit > 0 ? '+' : ''}${dailyData.trends.netProfit.toFixed(1)}%`,
                        color: "text-purple-500",
                        bg: "bg-purple-500/10"
                    }
                ].map((stat, i) => (
                    <div key={i} className="relative overflow-hidden bg-white dark:bg-[#1c1c1e] border border-gray-100 dark:border-white/5 rounded-3xl p-6 group transition-all duration-300 hover:scale-[1.02] shadow-sm dark:shadow-none">
                        <div className={`absolute top-0 right-0 w-32 h-32 ${stat.bg} blur-[60px] opacity-20 rounded-full group-hover:opacity-40 transition-opacity`} />

                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                                    <stat.icon className="h-6 w-6" />
                                </div>
                                <div className="flex items-center gap-1 text-xs font-medium bg-gray-50 dark:bg-white/5 px-2 py-1 rounded-lg text-muted-foreground border border-gray-100 dark:border-transparent">
                                    <span className={stat.trend.startsWith('+') ? "text-green-600 dark:text-green-400" : stat.trend.startsWith('-') ? "text-red-600 dark:text-red-400" : "text-gray-500"}>
                                        {stat.trend}
                                    </span>
                                    {i !== 0 && <span>مقارنة بالأمس</span>}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <h3 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{stat.value}</h3>
                                <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* CHARTS & ACTIVITY */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Main Chart Section */}
                <div className="col-span-4 bg-white dark:bg-[#1c1c1e] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm dark:shadow-none">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">تحليل المبيعات</h3>
                        <select className="bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-xs rounded-lg px-2 py-1 text-muted-foreground outline-none">
                            <option>آخر 7 أيام</option>
                        </select>
                    </div>
                    <div className="h-[300px] w-full bg-gradient-to-t from-[#f7941d]/5 to-transparent rounded-2xl border border-gray-100 dark:border-white/5 relative overflow-hidden flex items-end justify-between px-4 pb-0 pt-8 gap-2">
                        {chartData.map((day, i) => {
                            const heightPercent = maxChartValue > 0 ? (day.value / maxChartValue) * 100 : 0;
                            // Ensure min height for visibility if value > 0, else 0
                            const finalHeight = day.value > 0 ? Math.max(heightPercent, 5) : 0;

                            return (
                                <div key={i} className="w-full h-full flex items-end group relative">
                                    <div
                                        className="w-full bg-[#f7941d] rounded-t-lg opacity-80 group-hover:opacity-100 transition-all duration-300 relative z-10"
                                        style={{ height: `${finalHeight}%` }}
                                    >
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-black text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shadow-lg whitespace-nowrap z-20 pointer-events-none">
                                            {day.value.toLocaleString()} د.ل
                                        </div>
                                        {/* Date Label on Bottom (Optional or on Hover) */}
                                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
                                            {day.name}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Recent Orders List */}
                <div className="col-span-3 bg-white dark:bg-[#1c1c1e] border border-gray-100 dark:border-white/5 rounded-3xl p-6 flex flex-col shadow-sm dark:shadow-none">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">أحدث الطلبات</h3>
                        <Button variant="ghost" size="sm" className="text-[#f7941d] hover:text-[#f7941d] hover:bg-[#f7941d]/10 text-xs" onClick={() => window.location.href = '/admin/orders'}>عرض الكل</Button>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-white/10">
                        {recentOrders.length > 0 ? (
                            recentOrders.map((order, i) => (
                                <div key={order.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors group border border-transparent hover:border-gray-200 dark:hover:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-white dark:bg-gradient-to-br dark:from-gray-700 dark:to-gray-900 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-white font-bold text-sm shadow-sm">
                                            {order.customerName.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-[#f7941d] transition-colors line-clamp-1">{order.customerName}</p>
                                            <p className="text-xs text-muted-foreground">{format(new Date(order.operationDate), 'HH:mm')} • {order.invoiceNumber}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">{order.sellingPriceLYD?.toFixed(0)} د.ل</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${order.status === 'delivered' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                                            order.status === 'cancelled' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                                'bg-[#f7941d]/10 text-[#f7941d]'
                                            }`}>
                                            {statusConfig[order.status]?.text || order.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                <Package className="h-8 w-8 mb-2 opacity-20" />
                                <p className="text-sm">لا توجد طلبات حديثة</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Access Grid */}
            <div className="bg-white dark:bg-[#1c1c1e] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm dark:shadow-none">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">الوصول السريع</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {allDashboardItems.slice(0, 4).map((item) => (
                        <Link href={item.href} key={item.title}>
                            <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors group border border-transparent hover:border-gray-200 dark:hover:border-white/5">
                                <div className={`p-3 rounded-xl ${item.gradient} bg-gradient-to-br`}>
                                    <item.icon className={`w-5 h-5 ${item.color}`} />
                                </div>
                                <span className="font-bold text-sm text-foreground group-hover:text-[#f7941d] transition-colors">{item.title}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

        </motion.div>
    );
};

export default AdminDashboardPage;
