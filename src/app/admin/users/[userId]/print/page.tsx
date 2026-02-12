'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { User, Order, Transaction, OrderStatus, Deposit } from '@/lib/types';
import { getUserById, getOrdersByUserId, getTransactionsByUserId, getDepositsByUserId } from '@/lib/actions';
import { Loader2, Printer, User as UserIcon, Phone, Home, ShoppingCart, CreditCard, ListOrdered, History, HandCoins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import logo from '@/app/assets/logo.png';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const statusConfig: Record<string, { text: string; className: string }> = {
    pending: { text: 'قيد التجهيز', className: 'bg-yellow-100 text-yellow-700' },
    processed: { text: 'تم التنفيذ', className: 'bg-cyan-100 text-cyan-700' },
    ready: { text: 'تم التجهيز', className: 'bg-indigo-100 text-indigo-700' },
    shipped: { text: 'تم الشحن', className: 'bg-blue-100 text-blue-700' },
    arrived_misrata: { text: 'وصلت إلى مصراتة', className: 'bg-teal-100 text-teal-700' },
    out_for_delivery: { text: 'مع المندوب', className: 'bg-lime-100 text-lime-700' },
    delivered: { text: 'تم التسليم', className: 'bg-green-100 text-green-700' },
    cancelled: { text: 'ملغي', className: 'bg-red-100 text-red-700' },
    paid: { text: 'مدفوع', className: 'bg-green-100 text-green-700' },
    returned: { text: 'راجع', className: 'bg-red-100 text-red-700' },
    // Legacy
    arrived_dubai: { text: 'وصلت إلى دبي', className: 'bg-orange-100 text-orange-700' },
    arrived_benghazi: { text: 'وصلت إلى بنغازي', className: 'bg-teal-100 text-teal-700' },
    arrived_tobruk: { text: 'وصلت إلى طبرق', className: 'bg-purple-100 text-purple-700' },
};

const PrintUserStatementPageContent = () => {
    const params = useParams();
    const userId = params.userId as string;

    const [user, setUser] = useState<User | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [deposits, setDeposits] = useState<Deposit[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (userId) {
            const fetchData = async () => {
                setIsLoading(true);
                const [userData, ordersData, transactionsData, depositsData] = await Promise.all([
                    getUserById(userId),
                    getOrdersByUserId(userId),
                    getTransactionsByUserId(userId),
                    getDepositsByUserId(userId),
                ]);
                setUser(userData);
                setOrders(ordersData);
                setTransactions(transactionsData);
                setDeposits(depositsData);
                setIsLoading(false);
            };
            fetchData();
        }
    }, [userId]);

    useEffect(() => {
        if (!isLoading && user) {
            // Automatically trigger print dialog after a short delay to ensure rendering
            const timer = setTimeout(() => window.print(), 1000);
            return () => clearTimeout(timer);
        }
    }, [isLoading, user]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center no-print">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="ml-4">جاري تحميل البيانات...</p>
            </div>
        );
    }

    if (!user) {
        return <div className="p-8 text-center text-red-500 no-print">لم يتم العثور على المستخدم.</div>;
    }

    const totalOrdersValue = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.sellingPriceLYD, 0);

    const allFinancialEvents = [
        ...transactions,
        ...deposits.map(d => ({
            id: d.id,
            date: d.date,
            description: `عربون: ${d.description || 'بدون وصف'}`,
            amount: d.amount,
            type: 'payment', // Treat deposit as a payment (credit)
        }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="bg-gray-100 p-4 min-h-screen">
            <div className="w-full max-w-4xl mx-auto flex justify-between items-center mb-4 no-print">
                <h1 className="text-xl font-bold">معاينة طباعة كشف الحساب</h1>
                <Button onClick={() => window.print()}>
                    <Printer className="w-4 h-4 ml-2" />
                    طباعة
                </Button>
            </div>
            <div className="statement-page printable-content bg-white shadow-lg p-8 w-full max-w-4xl mx-auto">
                <header className="flex justify-between items-center mb-8 border-b-2 border-black pb-4">
                    <div className="flex items-center gap-4">
                        <img src={logo.src} alt="Logo" style={{ width: '80px', height: '80px' }} />
                        <div>
                            <h1 className="text-2xl font-bold">شركة Oshop</h1>
                            <p className="text-sm text-gray-500">للخدمات اللوجستية والتجارة العامة</p>
                        </div>
                    </div>
                    <div className="text-left">
                        <h2 className="text-3xl font-bold">كشف حساب عميل</h2>
                        <p className="text-sm text-gray-500 mt-1">تاريخ الطباعة: {format(new Date(), 'yyyy/MM/dd', { locale: ar })}</p>
                    </div>
                </header>

                <section className="mb-6 border border-gray-300 rounded-lg p-4">
                    <h3 className="text-lg font-bold mb-3">بيانات العميل</h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                        <InfoRow icon={<UserIcon className="w-4 h-4" />} label="اسم العميل:" value={user.name} />
                        <InfoRow icon={<UserIcon className="w-4 h-4" />} label="اسم المستخدم:" value={`@${user.username}`} />
                        <InfoRow icon={<Phone className="w-4 h-4" />} label="رقم الهاتف:" value={user.phone} />
                        <InfoRow icon={<Home className="w-4 h-4" />} label="العنوان:" value={user.address || 'غير محدد'} />
                    </div>
                </section>

                <section className="mb-6 grid grid-cols-3 gap-4 text-center">
                    <SummaryBox icon={<ShoppingCart />} title="إجمالي قيمة الطلبات" value={`${totalOrdersValue.toFixed(2)} د.ل`} />
                    <SummaryBox icon={<CreditCard />} title="الدين الكلي المستحق" value={`${user.debt.toFixed(2)} د.ل`} valueColor="text-red-600" />
                    <SummaryBox icon={<ListOrdered />} title="عدد الطلبات" value={user.orderCount.toString()} />
                </section>

                {deposits.length > 0 && (
                    <section className="mb-6">
                        <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><HandCoins className="w-5 h-5" /> سجل العربون</h3>
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-100">
                                    <TableHead>تاريخ العربون</TableHead>
                                    <TableHead>الوصف</TableHead>
                                    <TableHead className="text-left">المبلغ</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {deposits.map(deposit => (
                                    <TableRow key={deposit.id}>
                                        <TableCell>{format(new Date(deposit.date), 'yyyy/MM/dd')}</TableCell>
                                        <TableCell>{deposit.description}</TableCell>
                                        <TableCell className="text-left font-semibold text-green-600">{deposit.amount.toFixed(2)} د.ل</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </section>
                )}


                <section className="mb-6">
                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> سجل الطلبات</h3>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-100">
                                <TableHead>رقم الفاتورة</TableHead>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead>تكلفة إضافية</TableHead>
                                <TableHead>إجمالي الفاتورة</TableHead>
                                <TableHead>المتبقي</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.map(order => {
                                const addedCost = (order.customerWeightCostUSD ?? 0) * (order.exchangeRate ?? 1);
                                return (
                                    <TableRow key={order.id}>
                                        <TableCell>{order.invoiceNumber}</TableCell>
                                        <TableCell>{format(new Date(order.operationDate), 'yyyy/MM/dd')}</TableCell>
                                        <TableCell>{statusConfig[order.status]?.text}</TableCell>
                                        <TableCell className="text-gray-500">{addedCost.toFixed(2)}</TableCell>
                                        <TableCell>{order.sellingPriceLYD.toFixed(2)}</TableCell>
                                        <TableCell className="font-bold text-red-600">{order.remainingAmount.toFixed(2)}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </section>

                <section>
                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><History className="w-5 h-5" /> السجل المالي المتكامل</h3>
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-100">
                                <TableHead>التاريخ</TableHead>
                                <TableHead>الوصف</TableHead>
                                <TableHead>مدين (-)</TableHead>
                                <TableHead>دائن (+)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allFinancialEvents.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell>{format(new Date(tx.date), 'yyyy/MM/dd')}</TableCell>
                                    <TableCell>{tx.description}</TableCell>
                                    <TableCell className="text-red-600 font-mono text-left">
                                        {tx.type === 'order' ? tx.amount.toFixed(2) : ''}
                                    </TableCell>
                                    <TableCell className="text-green-600 font-mono text-left">
                                        {tx.type === 'payment' ? tx.amount.toFixed(2) : ''}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </section>

                <footer className="text-center text-xs text-gray-400 mt-12 pt-4 border-t">
                    هذا المستند تم إنشاؤه بواسطة نظام Oshop.
                </footer>
            </div>
        </div>
    );
};

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
    <div className="flex items-baseline">
        <div className="flex-shrink-0 w-28 text-gray-600 font-semibold flex items-center gap-1.5 whitespace-nowrap">
            {icon} {label}
        </div>
        <div className="font-medium border-b border-dotted flex-grow">{value}</div>
    </div>
);

const SummaryBox = ({ icon, title, value, valueColor }: { icon: React.ReactNode, title: string, value: string, valueColor?: string }) => (
    <div className="border rounded-lg p-3">
        <div className="flex items-center justify-center gap-2 text-gray-500">{icon} <span className="text-sm font-semibold">{title}</span></div>
        <p className={`text-xl font-bold mt-1 ${valueColor || ''}`}>{value}</p>
    </div>
);

const Page = () => (
    <Suspense fallback={<div className="flex h-screen items-center justify-center no-print"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>}>
        <PrintUserStatementPageContent />
    </Suspense>
);

export default Page;
