// This file was created by the AI to enable the feature.
// It can be removed if it's not needed.
'use client';

import React, { useState, useMemo } from 'react';
import { Representative, Order, Deposit, SubOrder } from '@/lib/types';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    ArrowLeft, 
    DollarSign, 
    Package, 
    User, 
    Phone, 
    Copy,
    Landmark,
    PackageCheck,
    ListFilter
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from "@/components/ui/use-toast";
import { Separator } from '@/components/ui/separator';

const OrderCard = ({ order }: { order: Order }) => (
    <Card className="bg-card/70">
        <CardHeader className="pb-3">
            <CardTitle className="text-md font-bold">{order.customerName}</CardTitle>
            <p className="text-xs text-muted-foreground">#{order.invoiceNumber}</p>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
             <InfoRow label="الهاتف:" value={order.customerPhone} canCopy />
             <InfoRow label="العنوان:" value={order.customerAddress} />
             <Separator/>
             <InfoRow label="المبلغ المطلوب:" value={`${order.remainingAmount.toFixed(2)} د.ل`} valueClass="text-destructive font-bold" />
        </CardContent>
    </Card>
);
const DeliveredOrderCard = ({ order }: { order: Order }) => (
    <Card className="bg-card/70">
        <CardHeader className="pb-3">
             <CardTitle className="text-md font-bold">{order.customerName}</CardTitle>
            <p className="text-xs text-muted-foreground">#{order.invoiceNumber}</p>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
             <InfoRow label="تاريخ التسليم:" value={new Date(order.deliveryDate!).toLocaleDateString('ar-LY')} />
             <Separator/>
             <InfoRow label="المبلغ المحصّل:" value={`${order.collectedAmount?.toFixed(2)} د.ل`} valueClass="text-green-500 font-bold" />
        </CardContent>
    </Card>
);

const DepositCard = ({ deposit }: { deposit: Deposit }) => (
     <Card className="bg-card/70">
        <CardHeader className="pb-3">
             <CardTitle className="text-md font-bold">{deposit.customerName}</CardTitle>
            <p className="text-xs text-muted-foreground">#{deposit.receiptNumber}</p>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
             <InfoRow label="تاريخ الإيداع:" value={new Date(deposit.date).toLocaleDateString('ar-LY')} />
             <Separator/>
             <InfoRow label="المبلغ:" value={`${deposit.amount.toFixed(2)} د.ل`} valueClass="text-primary font-bold" />
        </CardContent>
    </Card>
)

const InfoRow = ({ label, value, canCopy, valueClass }: { label: string, value?: string, canCopy?: boolean, valueClass?: string }) => {
    const { toast } = useToast();
    const copy = () => {
        if(value) {
            navigator.clipboard.writeText(value);
            toast({ title: 'تم النسخ!' });
        }
    }
    return (
        <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2">
                <span className={`font-semibold ${valueClass}`}>{value || '-'}</span>
                {canCopy && value && <Copy className="w-3.5 h-3.5 cursor-pointer" onClick={copy}/>}
            </div>
        </div>
    )
}

export function RepresentativeDetails({ initialRepresentative, initialOrders, initialDeposits, initialTempSubOrders }: {
    initialRepresentative: Representative;
    initialOrders: Order[];
    initialDeposits: Deposit[];
    initialTempSubOrders: SubOrder[];
}) {
    const router = useRouter();
    const [representative] = useState(initialRepresentative);
    const [orders] = useState(initialOrders);
    const [deposits] = useState(initialDeposits);
    const [tempSubOrders] = useState(initialTempSubOrders);
    const [filter, setFilter] = useState('all');

    const pendingOrders = useMemo(() => orders.filter(o => o.status === 'out_for_delivery'), [orders]);
    const deliveredOrders = useMemo(() => orders.filter(o => o.status === 'delivered'), [orders]);

    const pendingAmount = useMemo(() => {
        const regularOrdersAmount = pendingOrders.reduce((sum, order) => sum + order.remainingAmount, 0);
        const tempOrdersAmount = tempSubOrders.reduce((sum, order) => sum + order.remainingAmount, 0);
        return regularOrdersAmount + tempOrdersAmount;
    }, [pendingOrders, tempSubOrders]);
    
    const collectedAmount = useMemo(() => deliveredOrders.reduce((sum, order) => sum + (order.collectedAmount || 0), 0), [deliveredOrders]);
    const pendingDepositsAmount = useMemo(() => deposits.filter(d => d.status === 'pending').reduce((sum, d) => sum + d.amount, 0), [deposits]);

    const displayedPendingOrders = useMemo(() => {
        const allPending = [
            ...pendingOrders,
            ...tempSubOrders.map(so => ({
                ...so,
                id: so.subOrderId,
                invoiceNumber: so.invoiceName || 'فاتورة مجمعة',
                isTemp: true
            }))
        ];
        if (filter === 'all') return allPending;
        if (filter === 'regular') return pendingOrders;
        if (filter === 'temp') return allPending.filter(o => (o as any).isTemp);
        return [];
    }, [pendingOrders, tempSubOrders, filter]);


    return (
        <div className="p-4 sm:p-6" dir="rtl">
             <div className="flex items-center gap-4 mb-6">
                <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{representative.name}</h1>
                    <p className="text-sm text-muted-foreground">كود المندوب: {representative.username}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                <SummaryCard title="المبلغ المطلوب تحصيله" value={pendingAmount.toFixed(2)} icon={<DollarSign/>} color="text-destructive"/>
                <SummaryCard title="المبلغ المحصّل والمسلّم" value={collectedAmount.toFixed(2)} icon={<PackageCheck/>} color="text-green-500"/>
                <SummaryCard title="مبلغ العربون المطلوب" value={pendingDepositsAmount.toFixed(2)} icon={<Landmark/>} color="text-primary"/>
            </div>

            <Card>
                 <CardHeader>
                    <CardTitle>سجل العمليات</CardTitle>
                </CardHeader>
                <CardContent>
                     <Tabs defaultValue="pending" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="pending">طلبات معلقة ({pendingOrders.length + tempSubOrders.length})</TabsTrigger>
                            <TabsTrigger value="delivered">طلبات مسلمة ({deliveredOrders.length})</TabsTrigger>
                            <TabsTrigger value="deposits">سجل العربون ({deposits.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="pending" className="pt-4">
                             <div className="flex items-center gap-2 mb-4">
                                <ListFilter className="w-5 h-5 text-muted-foreground" />
                                <Button variant={filter === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilter('all')}>الكل</Button>
                                <Button variant={filter === 'regular' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilter('regular')}>طلبات عادية</Button>
                                <Button variant={filter === 'temp' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilter('temp')}>فواتير مجمعة</Button>
                             </div>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {displayedPendingOrders.map((order: any) => <OrderCard key={order.id} order={order} />)}
                            </div>
                        </TabsContent>
                        <TabsContent value="delivered" className="pt-4">
                             <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {deliveredOrders.map(order => <DeliveredOrderCard key={order.id} order={order} />)}
                            </div>
                        </TabsContent>
                         <TabsContent value="deposits" className="pt-4">
                             <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {deposits.map(deposit => <DepositCard key={deposit.id} deposit={deposit} />)}
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}

const SummaryCard = ({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) => (
    <Card>
        <CardContent className="p-4 flex items-center gap-4">
             <div className={`p-3 rounded-lg bg-primary/10 ${color}`}>
                {icon}
            </div>
            <div>
                <p className="text-sm text-muted-foreground">{title}</p>
                <p className={`text-2xl font-bold ${color}`}>{value} د.ل</p>
            </div>
        </CardContent>
    </Card>
)

