'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Order, OrderStatus, Representative, Transaction } from '@/lib/types';
import { getOrderById, getRepresentativeById, getTransactionsByOrderId } from '@/lib/actions';
import { Loader2, ArrowRight, Clock, Truck, Building, Plane, MapPin, PackageCheck, PackageX, CheckCircle, User, Phone, Copy, DollarSign, CreditCard, Weight, Package as PackageIcon, Tag, Calendar, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { GlassCard } from '@/components/ui/GlassCard';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const statusConfig: Record<string, { text: string; icon: React.ReactNode; className: string; bgClass: string }> = {
    pending: { text: 'قيد التجهيز', icon: <Clock className="w-5 h-5" />, className: 'text-yellow-700 border-yellow-200', bgClass: 'bg-yellow-100' },
    processed: { text: 'تم التنفيذ', icon: <CheckCircle className="w-5 h-5" />, className: 'text-cyan-700 border-cyan-200', bgClass: 'bg-cyan-100' },
    ready: { text: 'تم التجهيز', icon: <PackageIcon className="w-5 h-5" />, className: 'text-indigo-700 border-indigo-200', bgClass: 'bg-indigo-100' },
    shipped: { text: 'تم الشحن', icon: <Truck className="w-5 h-5" />, className: 'text-blue-700 border-blue-200', bgClass: 'bg-blue-100' },
    arrived_misrata: { text: 'وصلت إلى مصراتة', icon: <Building className="w-5 h-5" />, className: 'text-teal-700 border-teal-200', bgClass: 'bg-teal-100' },
    out_for_delivery: { text: 'مع المندوب', icon: <MapPin className="w-5 h-5" />, className: 'text-lime-700 border-lime-200', bgClass: 'bg-lime-100' },
    delivered: { text: 'تم التسليم', icon: <PackageCheck className="w-5 h-5" />, className: 'text-green-700 border-green-200', bgClass: 'bg-green-100' },
    cancelled: { text: 'ملغي', icon: <PackageX className="w-5 h-5" />, className: 'text-red-700 border-red-200', bgClass: 'bg-red-100' },
    paid: { text: 'مدفوع', icon: <DollarSign className="w-5 h-5" />, className: 'text-green-700 border-green-200', bgClass: 'bg-green-100' },
    returned: { text: 'راجع', icon: <PackageX className="w-5 h-5" />, className: 'text-red-700 border-red-200', bgClass: 'bg-red-100' },
    // Legacy
    arrived_dubai: { text: 'وصلت إلى دبي', icon: <Plane className="w-5 h-5" />, className: 'text-orange-700 border-orange-200', bgClass: 'bg-orange-100' },
    arrived_benghazi: { text: 'وصلت إلى بنغازي', icon: <Building className="w-5 h-5" />, className: 'text-teal-700 border-teal-200', bgClass: 'bg-teal-100' },
    arrived_tobruk: { text: 'وصلت إلى طبرق', icon: <Building className="w-5 h-5" />, className: 'text-purple-700 border-purple-200', bgClass: 'bg-purple-100' },
};

const DetailRow = ({ icon, label, value, valueClassName }: { icon: React.ReactNode, label: string, value: string | number | undefined, valueClassName?: string }) => (
    <div className="flex justify-between items-center py-3 group">
        <div className="flex items-center gap-3 text-muted-foreground group-hover:text-primary transition-colors">
            <div className="p-2 rounded-full bg-secondary/50 group-hover:bg-primary/10 transition-colors">
                {icon}
            </div>
            <span className="text-sm font-medium">{label}</span>
        </div>
        <span className={cn("font-bold text-base text-right", valueClassName)}>{value || 'غير محدد'}</span>
    </div>
);

const OrderDetailsContent = () => {
    const router = useRouter();
    const params = useParams();
    const orderId = params.orderId as string;
    const { toast } = useToast();

    const [order, setOrder] = useState<Order | null>(null);
    const [representative, setRepresentative] = useState<Representative | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (orderId) {
            const fetchData = async () => {
                setIsLoading(true);
                try {
                    const fetchedOrder = await getOrderById(orderId);
                    setOrder(fetchedOrder);

                    if (fetchedOrder?.representativeId) {
                        const fetchedRep = await getRepresentativeById(fetchedOrder.representativeId);
                        setRepresentative(fetchedRep);
                    }

                    if (fetchedOrder) {
                        const fetchedTransactions = await getTransactionsByOrderId(fetchedOrder.id);
                        setTransactions(fetchedTransactions);
                    }

                } catch (error) {
                    toast({ title: "خطأ", description: "فشل في تحميل بيانات الطلب.", variant: "destructive" });
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        }
    }, [orderId, toast]);

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({
                title: "تم النسخ!",
                description: `تم نسخ ${label} إلى الحافظة.`,
            });
        });
    };

    const totalPaid = transactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);
    const shipmentWeight = order?.weightKG || 0;

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center font-sans">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-6 space-y-4" dir="rtl">
                <GlassCard className="p-8 flex flex-col items-center">
                    <PackageX className="w-16 h-16 text-destructive mb-4" />
                    <h1 className="text-xl font-bold text-destructive">تعذر العثور على الطلب</h1>
                    <p className="text-muted-foreground mt-2">قد يكون الطلب قد تم حذفه أو أن الرابط غير صحيح.</p>
                    <Button onClick={() => router.back()} className="mt-6 w-full">العودة</Button>
                </GlassCard>
            </div>
        )
    }

    const statusInfo = statusConfig[order.status] || { text: order.status, icon: <Clock />, className: 'text-gray-500', bgClass: 'bg-gray-100' };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans pb-10" dir="rtl">
            {/* Background Effects */}
            <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-orange-500/10 via-background to-background" />
            <div className="fixed top-0 left-0 w-full h-96 bg-gradient-to-b from-orange-500/5 to-transparent -z-10" />

            <header className="px-6 py-4 flex items-center justify-between sticky top-0 z-30 bg-background/60 backdrop-blur-xl border-b border-border/50">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-secondary/80">
                    <ArrowRight className="w-5 h-5" />
                </Button>
                <h1 className="text-lg font-bold">تفاصيل الطلب</h1>
                <div className="w-10" />
            </header>

            <main className="flex-grow p-6 flex flex-col items-center max-w-lg mx-auto w-full space-y-6">

                {/* Status Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full"
                >
                    <GlassCard className="p-6 text-center space-y-4 rounded-[2rem] border-primary/10 overflow-hidden relative">
                        <div className={`absolute inset-0 opacity-10 ${statusInfo.bgClass}`} />
                        <div className="relative">
                            <Badge variant="outline" className={`px-4 py-1.5 text-sm gap-2 bg-background/50 backdrop-blur-sm ${statusInfo.className}`}>
                                {statusInfo.icon}
                                {statusInfo.text}
                            </Badge>
                            <h3 className="text-2xl font-bold mt-4 font-mono tracking-wide">{order.trackingId || order.invoiceNumber}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                تم التحديث: {new Date(order.operationDate).toLocaleDateString('ar-LY')}
                            </p>
                        </div>
                    </GlassCard>
                </motion.div>

                {/* Shipment Details */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="w-full"
                >
                    <GlassCard className="p-0 rounded-[2rem] overflow-hidden border-white/10">
                        <div className="p-5 bg-secondary/30 border-b border-border/50">
                            <h3 className="font-bold flex items-center gap-2">
                                <PackageIcon className="w-5 h-5 text-primary" />
                                تفاصيل الشحنة
                            </h3>
                        </div>
                        <div className="p-5 space-y-1">
                            <DetailRow icon={<Tag size={16} />} label="الوصف" value={order.itemDescription} />
                            <Separator className="bg-border/50 my-1" />
                            <DetailRow icon={<Weight size={16} />} label="الوزن" value={`${shipmentWeight.toFixed(2)} كجم`} />
                            <Separator className="bg-border/50 my-1" />
                            <DetailRow icon={<Building size={16} />} label="الوجهة" value={order.customerAddress} />
                        </div>
                    </GlassCard>
                </motion.div>

                {/* Representative Info */}
                {representative && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="w-full"
                    >
                        <GlassCard className="p-0 rounded-[2rem] overflow-hidden border-white/10">
                            <div className="p-5 bg-secondary/30 border-b border-border/50">
                                <h3 className="font-bold flex items-center gap-2">
                                    <User className="w-5 h-5 text-primary" />
                                    بيانات المندوب
                                </h3>
                            </div>
                            <div className="p-5 space-y-1">
                                <DetailRow icon={<ShieldCheck size={16} />} label="الاسم" value={representative.name} />
                                <Separator className="bg-border/50 my-1" />
                                <div className="flex justify-between items-center py-3 group">
                                    <div className="flex items-center gap-3 text-muted-foreground">
                                        <div className="p-2 rounded-full bg-secondary/50">
                                            <Phone size={16} />
                                        </div>
                                        <span className="text-sm font-medium">رقم الهاتف</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold font-mono tracking-wider">{representative.phone}</span>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => copyToClipboard(representative.phone, 'رقم هاتف المندوب')}>
                                            <Copy className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </GlassCard>
                    </motion.div>
                )}

                {/* Financial Summary */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="w-full"
                >
                    <GlassCard className="p-0 rounded-[2rem] overflow-hidden border-white/10">
                        <div className="p-5 bg-secondary/30 border-b border-border/50">
                            <h3 className="font-bold flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-green-600" />
                                الملخص المالي
                            </h3>
                        </div>
                        <div className="p-5 space-y-1">
                            <DetailRow icon={<Tag size={16} />} label="إجمالي الفاتورة" value={`${order.sellingPriceLYD.toFixed(2)} د.ل`} valueClassName="text-primary" />
                            <Separator className="bg-border/50 my-1" />
                            <DetailRow icon={<CheckCircle size={16} />} label="إجمالي المدفوع" value={`${totalPaid.toFixed(2)} د.ل`} valueClassName="text-green-600" />
                            <Separator className="bg-border/50 my-1" />
                            <DetailRow icon={<CreditCard size={16} />} label="المبلغ المتبقي" value={`${order.remainingAmount.toFixed(2)} د.ل`} valueClassName={order.remainingAmount > 0 ? "text-destructive" : "text-green-600"} />
                        </div>
                    </GlassCard>
                </motion.div>

                {/* Transactions Table */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="w-full"
                >
                    <GlassCard className="p-0 rounded-[2rem] overflow-hidden border-white/10">
                        <div className="p-5 bg-secondary/30 border-b border-border/50">
                            <h3 className="font-bold flex items-center gap-2">
                                <Clock className="w-5 h-5 text-primary" />
                                سجل العمليات
                            </h3>
                        </div>
                        <div className="p-2">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border/50 hover:bg-transparent">
                                        <TableHead className="text-right">التاريخ</TableHead>
                                        <TableHead className="text-right">الوصف</TableHead>
                                        <TableHead className="text-left">المبلغ</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length > 0 ? (
                                        transactions.map((tx) => (
                                            <TableRow key={tx.id} className="border-border/50 hover:bg-secondary/20">
                                                <TableCell className="font-medium">{new Date(tx.date).toLocaleDateString('ar-LY')}</TableCell>
                                                <TableCell>{tx.description}</TableCell>
                                                <TableCell className={cn("text-left font-bold", tx.type === 'payment' ? "text-green-600" : "text-destructive")}>
                                                    {tx.type === 'payment' ? '+' : '-'}{tx.amount.toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow className="hover:bg-transparent">
                                            <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                                                لا توجد عمليات مسجلة
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </GlassCard>
                </motion.div>

            </main>
        </div>
    );
};

export default function Page() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
            <OrderDetailsContent />
        </Suspense>
    );
}
