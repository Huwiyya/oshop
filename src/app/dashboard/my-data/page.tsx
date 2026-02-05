'use client';

import { ArrowLeft, User as UserIcon, Phone, Hash, Calendar, DollarSign, AlertCircle, Loader2, LogOut, ShieldCheck, Mail, MapPin } from 'lucide-react';
import Image from 'next/image';
import logo from '@/app/assets/logo.png';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { getOrders, getUsers } from '@/lib/actions';
import { User, Order } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/GlassCard';
import { motion } from 'framer-motion';
import { Separator } from '@/components/ui/separator';

const MyDataPage = () => {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
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
                    setOrders(allOrders.filter(o => o.userId === currentUser.id));
                } else {
                    router.push('/login');
                }
            } catch (error) {
                console.error("Failed to fetch user data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem('loggedInUser');
        router.push('/login');
    };

    const totalAmount = useMemo(() => {
        return orders
            .filter(o => o.status !== 'cancelled')
            .reduce((sum, o) => sum + o.sellingPriceLYD, 0);
    }, [orders]);

    const lastOrderDate = useMemo(() => {
        const userOrders = orders.filter(o => o.status !== 'cancelled');
        if (userOrders.length === 0) return 'لا يوجد';
        return new Date(Math.max(...userOrders.map(o => new Date(o.operationDate).getTime()))).toLocaleDateString('ar-LY');
    }, [orders]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center font-sans">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        )
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans text-foreground pb-10" dir="rtl">
            {/* Background Effects */}
            <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-orange-500/10 via-background to-background" />
            <div className="fixed top-0 left-0 w-full h-96 bg-gradient-to-b from-orange-500/5 to-transparent -z-10" />

            <header className="px-6 py-4 flex items-center justify-between sticky top-0 z-30 bg-background/60 backdrop-blur-xl border-b border-border/50">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-secondary/80">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-lg font-bold">بياناتي</h1>
                <div className="w-10" />
            </header>

            <main className="flex-grow p-6 flex flex-col items-center max-w-lg mx-auto w-full space-y-6">

                {/* Profile Header */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4 py-6"
                >
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-orange-600 p-1 shadow-xl shadow-primary/20 relative overflow-hidden">
                        <div className="absolute inset-0 bg-white/20 blur-xl rounded-full animate-pulse" />
                        <div className="w-full h-full rounded-full bg-background flex items-center justify-center border-4 border-background relative z-10 p-2">
                            <Image src={logo} alt="Oshop Logo" className="w-full h-full object-contain" />
                        </div>
                    </div>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold">{user.name}</h2>
                        <p className="text-muted-foreground font-mono mt-1 text-sm bg-secondary/50 px-2 py-0.5 rounded inline-block">{user.username}</p>
                    </div>
                </motion.div>

                {/* Stats Row */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 gap-4 w-full"
                >
                    <GlassCard className="p-4 flex flex-col items-center justify-center text-center gap-2 bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
                        <div className="p-2 bg-primary/10 rounded-full text-primary">
                            <Hash className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{user.orderCount}</p>
                            <p className="text-xs text-muted-foreground">عدد الطلبات</p>
                        </div>
                    </GlassCard>
                    <GlassCard className="p-4 flex flex-col items-center justify-center text-center gap-2 bg-gradient-to-br from-green-500/5 to-transparent border-green-500/10">
                        <div className="p-2 bg-green-500/10 rounded-full text-green-600">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{totalAmount.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">د.ل</span></p>
                            <p className="text-xs text-muted-foreground">إجمالي المصروفات</p>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* Info Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="w-full"
                >
                    <GlassCard className="p-0 overflow-hidden">
                        <div className="p-4 bg-secondary/30 border-b border-border/50 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                            <h3 className="font-bold">المعلومات الشخصية</h3>
                        </div>
                        <div className="p-4 space-y-4">
                            <InfoRow icon={<Phone size={18} />} label="رقم الهاتف" value={user.phone} />
                            <Separator className="bg-border/50" />
                            <InfoRow icon={<MapPin size={18} />} label="العنوان" value={user.address || "غير محدد"} />
                            <Separator className="bg-border/50" />
                            <InfoRow icon={<Calendar size={18} />} label="آخر نشاط" value={lastOrderDate} />

                            {user.debt > 0 && (
                                <>
                                    <Separator className="bg-border/50" />
                                    <div className="flex items-center justify-between p-3 bg-red-500/5 rounded-xl border border-red-500/10 mt-2">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-red-500/10 rounded-full text-red-500">
                                                <AlertCircle size={18} />
                                            </div>
                                            <span className="text-sm font-medium text-red-700 dark:text-red-400">الدين المستحق</span>
                                        </div>
                                        <span className="font-bold text-red-600 dark:text-red-400">{user.debt.toLocaleString()} د.ل</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </GlassCard>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="w-full pt-4"
                >
                    <Button
                        variant="destructive"
                        size="lg"
                        className="w-full rounded-2xl h-14 bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white border border-red-500/20 hover:border-red-500 transition-all shadow-none hover:shadow-lg hover:shadow-red-500/20"
                        onClick={handleLogout}
                    >
                        <LogOut className="w-5 h-5 ml-2" />
                        تسجيل الخروج
                    </Button>
                </motion.div>

            </main>
        </div>
    );
};

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
    <div className="flex items-center justify-between group">
        <div className="flex items-center gap-4 text-muted-foreground group-hover:text-primary transition-colors">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                {icon}
            </div>
            <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="font-bold text-foreground">{value}</span>
    </div>
);

export default MyDataPage;
