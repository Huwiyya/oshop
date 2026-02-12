
'use client';

import { ArrowLeft, FileText, PackageCheck, PackageX, Truck, Building, Package, Plane, CheckCircle, Clock, MapPin, Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import React, { useMemo, useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Order, OrderStatus } from '@/lib/types';
import { getOrders } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';


const statusConfig: Record<string, { text: string; icon: React.ReactNode; className: string }> = {
    pending: { text: 'قيد التجهيز', icon: <Clock className="w-4 h-4" />, className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    processed: { text: 'تم التنفيذ', icon: <CheckCircle className="w-4 h-4" />, className: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
    ready: { text: 'تم التجهيز', icon: <Package className="w-4 h-4" />, className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    shipped: { text: 'تم الشحن', icon: <Truck className="w-4 h-4" />, className: 'bg-blue-100 text-blue-700 border-blue-200' },
    arrived_misrata: { text: 'وصلت إلى مصراتة', icon: <Building className="w-4 h-4" />, className: 'bg-teal-100 text-teal-700 border-teal-200' },
    out_for_delivery: { text: 'مع المندوب', icon: <MapPin className="w-4 h-4" />, className: 'bg-lime-100 text-lime-700 border-lime-200' },
    delivered: { text: 'تم التسليم', icon: <PackageCheck className="w-4 h-4" />, className: 'bg-green-100 text-green-700 border-green-200' },
    cancelled: { text: 'ملغي', icon: <PackageX className="w-4 h-4" />, className: 'bg-red-100 text-red-700 border-red-200' },
    paid: { text: 'مدفوع', icon: <CheckCircle className="w-4 h-4" />, className: 'bg-green-100 text-green-700 border-green-200' },
    returned: { text: 'راجع', icon: <PackageX className="w-4 h-4" />, className: 'bg-red-100 text-red-700 border-red-200' },
    // Legacy
    arrived_dubai: { text: 'وصلت إلى دبي', icon: <Plane className="w-4 h-4" />, className: 'bg-orange-100 text-orange-700 border-orange-200' },
    arrived_benghazi: { text: 'وصلت إلى بنغازي', icon: <Building className="w-4 h-4" />, className: 'bg-teal-100 text-teal-700 border-teal-200' },
    arrived_tobruk: { text: 'وصلت إلى طبرق', icon: <Building className="w-4 h-4" />, className: 'bg-purple-100 text-purple-700 border-purple-200' },
};

const OrderCard = ({ order }: { order: Order }) => {
    const { toast } = useToast();

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({
                title: "تم النسخ!",
                description: "تم نسخ كود التتبع إلى الحافظة.",
            });
        });
    };

    return (
        <Link href={`/dashboard/my-orders/${order.id}`} passHref>
            <Card className="bg-card shadow-md cursor-pointer hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg font-bold">رقم الفاتورة: {order.invoiceNumber}</CardTitle>
                        <Badge variant="outline" className={`font-semibold text-xs py-1 px-2 gap-1.5 ${statusConfig[order.status].className}`}>
                            {statusConfig[order.status].icon}
                            {statusConfig[order.status].text}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2 pt-2">
                    <div className="flex justify-between">
                        <span>تاريخ الطلب:</span>
                        <span>{new Date(order.operationDate).toLocaleDateString('ar-LY')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-mono flex-grow">كود التتبع: {order.trackingId}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.preventDefault(); copyToClipboard(order.trackingId); }}>
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex justify-between font-medium text-foreground">
                        <span>الدين المتبقي:</span>
                        <span className={order.remainingAmount > 0 ? 'text-destructive' : 'text-green-600'}>
                            {order.remainingAmount.toFixed(2)} د.ل
                        </span>
                    </div>
                </CardContent>
                <CardFooter className="bg-secondary/50 p-3 flex justify-between items-center rounded-b-lg mt-2">
                    <span className="text-sm font-semibold text-primary">الإجمالي</span>
                    <span className="text-lg font-bold text-primary">{order.sellingPriceLYD.toFixed(2)} د.ل</span>
                </CardFooter>
            </Card>
        </Link>
    )
};

const MyOrdersPage = () => {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('all');
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUserOrders = async () => {
            setIsLoading(true);
            try {
                const loggedInUserStr = localStorage.getItem('loggedInUser');
                if (!loggedInUserStr) {
                    router.push('/login');
                    return;
                }
                const loggedInUser = JSON.parse(loggedInUserStr);

                const allOrders = await getOrders();
                const userOrders = allOrders.filter(order => order.userId === loggedInUser.id);
                setOrders(userOrders.sort((a, b) => new Date(b.operationDate).getTime() - new Date(a.operationDate).getTime()));

            } catch (error) {
                console.error("Failed to fetch orders:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchUserOrders();
    }, [router]);

    const { totalAmount, totalRemainingDebt } = useMemo(() => {
        return orders.reduce((acc, order) => {
            if (order.status !== 'cancelled') {
                acc.totalAmount += order.sellingPriceLYD;
                acc.totalRemainingDebt += order.remainingAmount;
            }
            return acc;
        }, { totalAmount: 0, totalRemainingDebt: 0 });
    }, [orders]);

    const filteredOrders = useMemo(() => {
        if (activeTab === 'all') return orders;
        if (activeTab === 'pending') {
            return orders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled');
        }
        return orders.filter(order => order.status === activeTab);
    }, [activeTab, orders]);

    const tabs = [
        { value: "all", label: "الكل" },
        { value: "pending", label: "الحالية" },
        { value: "delivered", label: "المسلمة" },
        { value: "cancelled", label: "الملغية" },
    ];

    return (
        <div className="min-h-screen bg-secondary/50 flex flex-col" dir="rtl">
            <header className="bg-primary text-primary-foreground p-4 flex justify-between items-center shadow-md sticky top-0 z-10">
                <h1 className="text-xl font-bold flex-grow text-center">طلباتي</h1>
                <button onClick={() => router.back()} className="text-primary-foreground">
                    <ArrowLeft className="w-6 h-6" />
                </button>
            </header>

            <main className="flex-grow p-4 space-y-4">
                <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-4 h-auto p-1.5">
                        {tabs.map(tab => (
                            <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
                        ))}
                    </TabsList>
                    <div className="py-4 space-y-4">
                        {isLoading ? (
                            <div className="text-center text-muted-foreground py-10"><p>جاري تحميل الطلبات...</p></div>
                        ) : filteredOrders.length > 0 ? (
                            filteredOrders.map(order => <OrderCard key={order.id} order={order} />)
                        ) : (
                            <div className="text-center text-muted-foreground py-10">
                                <p>لا توجد طلبات في هذه الفئة.</p>
                            </div>
                        )}
                    </div>
                </Tabs>
            </main>

            <footer className="sticky bottom-0 bg-card border-t-2 shadow-inner p-4 z-10 space-y-3">
                <div className="flex justify-between items-center text-md">
                    <span className="font-semibold text-foreground">الإجمالي الكلي للطلبات:</span>
                    <span className="text-lg font-bold text-primary">{totalAmount.toFixed(2)} د.ل</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center text-md">
                    <span className="font-semibold text-foreground">إجمالي الدين المتبقي:</span>
                    <span className="text-lg font-bold text-destructive">{totalRemainingDebt.toFixed(2)} د.ل</span>
                </div>
            </footer>
        </div>
    );
};

export default MyOrdersPage;
