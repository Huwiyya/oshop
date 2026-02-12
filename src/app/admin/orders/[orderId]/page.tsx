// This file was created by the AI to enable the feature.
// It can be removed if it's not needed.
import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { getOrderById, getRepresentativeById, getTransactionsByOrderId } from '@/lib/actions';
import { Order, OrderStatus, Representative, Transaction } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    Clock,
    Truck,
    Building,
    Plane,
    MapPin,
    PackageCheck,
    PackageX,
    CheckCircle,
    User,
    Phone,
    Copy,
    DollarSign,
    CreditCard,
    Weight,
    Package as PackageIcon,
    ArrowLeft
} from 'lucide-react';

const statusConfig: Record<string, { text: string; icon: React.ReactNode; className: string }> = {
    pending: { text: 'قيد التجهيز', icon: <Clock className="w-5 h-5" />, className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    processed: { text: 'تم التنفيذ', icon: <CheckCircle className="w-5 h-5" />, className: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
    ready: { text: 'تم التجهيز', icon: <PackageIcon className="w-5 h-5" />, className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    shipped: { text: 'تم الشحن', icon: <Truck className="w-5 h-5" />, className: 'bg-blue-100 text-blue-700 border-blue-200' },
    arrived_misrata: { text: 'وصلت إلى مصراتة', icon: <Building className="w-5 h-5" />, className: 'bg-teal-100 text-teal-700 border-teal-200' },
    out_for_delivery: { text: 'مع المندوب', icon: <MapPin className="w-5 h-5" />, className: 'bg-lime-100 text-lime-700 border-lime-200' },
    delivered: { text: 'تم التسليم', icon: <PackageCheck className="w-5 h-5" />, className: 'bg-green-100 text-green-700 border-green-200' },
    cancelled: { text: 'ملغي', icon: <PackageX className="w-5 h-5" />, className: 'bg-red-100 text-red-700 border-red-200' },
    paid: { text: 'مدفوع', icon: <CheckCircle className="w-4 h-4" />, className: 'bg-green-100 text-green-700' },
    returned: { text: 'راجع', icon: <PackageX className="w-5 h-5" />, className: 'bg-red-100 text-red-700 border-red-200' },
    // Legacy
    arrived_dubai: { text: 'وصلت إلى دبي', icon: <Plane className="w-5 h-5" />, className: 'bg-orange-100 text-orange-700 border-orange-200' },
    arrived_benghazi: { text: 'وصلت إلى بنغازي', icon: <Building className="w-5 h-5" />, className: 'bg-teal-100 text-teal-700 border-teal-200' },
    arrived_tobruk: { text: 'وصلت إلى طبرق', icon: <Building className="w-5 h-5" />, className: 'bg-purple-100 text-purple-700 border-purple-200' },
};


async function OrderDetails({ orderId }: { orderId: string }) {
    const order = await getOrderById(orderId);

    if (!order) {
        notFound();
    }

    const [representative, transactions] = await Promise.all([
        order.representativeId ? getRepresentativeById(order.representativeId) : Promise.resolve(null),
        getTransactionsByOrderId(order.id)
    ]);

    const totalPaid = transactions.filter(t => t.type === 'payment').reduce((sum, t) => sum + t.amount, 0);

    return (
        <div className="min-h-screen bg-secondary/50" dir="rtl">
            <header className="bg-background p-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/admin/orders">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                </Button>
                <h1 className="text-xl font-bold flex-grow text-center">تفاصيل الطلب: {order.invoiceNumber}</h1>
                <Button variant="outline" asChild>
                    <Link href={`/admin/orders/add?id=${orderId}`}>
                        تعديل
                    </Link>
                </Button>
            </header>

            <main className="p-4 space-y-6 max-w-4xl mx-auto">
                <Card>
                    <CardHeader>
                        <CardTitle>حالة الطلب</CardTitle>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <Badge variant="outline" className={`font-semibold text-lg py-3 px-6 gap-2 ${statusConfig[order.status].className}`}>
                            {statusConfig[order.status].icon}
                            {statusConfig[order.status].text}
                        </Badge>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>تفاصيل الشحنة والعميل</CardTitle>
                    </CardHeader>
                    <CardContent className="grid md:grid-cols-2 gap-x-8 gap-y-4">
                        <InfoRow icon={<User className="w-4 h-4" />} label="اسم العميل:" value={order.customerName} />
                        <InfoRow icon={<Phone className="w-4 h-4" />} label="رقم الهاتف:" value={order.customerPhone || 'N/A'} />
                        <InfoRow icon={<MapPin className="w-4 h-4" />} label="العنوان:" value={order.customerAddress || 'N/A'} />
                        <InfoRow icon={<PackageIcon className="w-4 h-4" />} label="وصف السلعة:" value={order.itemDescription || 'غير محدد'} />
                        <InfoRow icon={<Weight className="w-4 h-4" />} label="وزن الشحنة:" value={`${order.weightKG?.toFixed(2) || '0.00'} كجم`} />
                    </CardContent>
                </Card>


                {representative && (
                    <Card>
                        <CardHeader>
                            <CardTitle>بيانات المندوب</CardTitle>
                            <CardDescription>المندوب المسؤول عن توصيل الشحنة.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <InfoRow icon={<User className="w-4 h-4" />} label="الاسم:" value={representative.name} />
                            <Separator />
                            <InfoRow icon={<Phone className="w-4 h-4" />} label="رقم الهاتف:" value={representative.phone} />
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>الملخص المالي</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <InfoRow icon={<DollarSign className="w-4 h-4" />} label="إجمالي الفاتورة:" value={`${order.sellingPriceLYD.toFixed(2)} د.ل`} valueClassName="text-primary text-lg" />
                        <Separator />
                        <InfoRow icon={<CheckCircle className="w-4 h-4 text-green-500" />} label="إجمالي المدفوع:" value={`${totalPaid.toFixed(2)} د.ل`} valueClassName="text-green-600" />
                        <Separator />
                        <InfoRow icon={<CreditCard className="w-4 h-4 text-destructive" />} label="المبلغ المتبقي:" value={`${order.remainingAmount.toFixed(2)} د.ل`} valueClassName="text-destructive text-lg" />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>سجل العمليات المالية</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>التاريخ</TableHead>
                                    <TableHead>الوصف</TableHead>
                                    <TableHead className="text-left">المبلغ</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transactions.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell>{new Date(tx.date).toLocaleDateString('ar-LY')}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell className={`text-left font-bold ${tx.type === 'payment' ? 'text-green-600' : 'text-destructive'}`}>
                                            {tx.type === 'payment' ? '+' : '-'}{tx.amount.toFixed(2)} د.ل
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {transactions.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                                            لا توجد عمليات مالية مسجلة لهذا الطلب بعد.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

const InfoRow = ({ icon, label, value, valueClassName }: { icon: React.ReactNode, label: string, value: string | number, valueClassName?: string }) => (
    <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-muted-foreground">{icon} {label}</span>
        <span className={`font-bold ${valueClassName || ''}`}>{value}</span>
    </div>
);

export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
    const { orderId } = await params;
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-secondary/50"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>}>
            <OrderDetails orderId={orderId} />
        </Suspense>
    );
}
