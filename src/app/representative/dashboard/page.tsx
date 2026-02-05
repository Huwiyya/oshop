'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import {
    ArrowUpFromLine,
    ArrowDownToLine,
    Receipt,
    CreditCard,
    Phone,
    LogOut,
    CheckCircle,
    Clock,
    XCircle,
    Copy,
    DollarSign,
    HandCoins,
    Package,
    MapPin,
    Loader2,
    CalendarCheck,
    Search,
    User,
    Printer,
    History,
    Calendar as CalendarIcon,
    Filter,
    Archive,
    X,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import Image from 'next/image';
import logo from '@/app/assets/logo.png';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { Order, OrderStatus, Representative, Deposit, DepositStatus, SubOrder } from '@/lib/types';
import { getOrdersByRepresentativeId, recordRepresentativePayment, getDepositsByRepresentativeId, updateDepositStatus, getRepresentativeById, getTempSubOrdersByRepresentativeId } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, isValid } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { ar } from 'date-fns/locale';
import { type DateRange } from "react-day-picker";
import { motion, AnimatePresence } from 'framer-motion';

const depositStatusConfig: { [key in DepositStatus]: { text: string; icon: React.ReactNode; className: string } } = {
    pending: { text: 'قيد الانتظار', icon: <Clock className="w-4 h-4" />, className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    collected: { text: 'تم التحصيل', icon: <CheckCircle className="w-4 h-4" />, className: 'bg-green-500/10 text-green-400 border-green-500/20' },
    cancelled: { text: 'ملغي', icon: <XCircle className="w-4 h-4" />, className: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const subOrderStatusConfig = {
    pending: { text: 'قيد التسليم', icon: <Clock className="w-4 h-4" />, className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
}

type TempDisplayOrder = {
    id: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    remainingAmount: number;
    invoiceNumber: string;
    type: 'temp';
};

const RepresentativeDashboardPage = () => {
    const { toast } = useToast();
    const router = useRouter();
    const [allOrders, setAllOrders] = useState<Order[]>([]);
    const [allTempSubOrders, setAllTempSubOrders] = useState<SubOrder[]>([]);
    const [allDeposits, setAllDeposits] = useState<Deposit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [rep, setRep] = useState<Representative | null>(null);

    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
    const [collectedAmount, setCollectedAmount] = useState(0);

    const [isPendingOrdersSheetOpen, setIsPendingOrdersSheetOpen] = useState(false);
    const [isDeliveredOrdersSheetOpen, setIsDeliveredOrdersSheetOpen] = useState(false);
    const [isDepositsSheetOpen, setIsDepositsSheetOpen] = useState(false);
    const [isFinancialLogSheetOpen, setIsFinancialLogSheetOpen] = useState(false);
    const [isSearchSheetOpen, setIsSearchSheetOpen] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [logSearchQuery, setLogSearchQuery] = useState('');

    const [filterType, setFilterType] = useState('all');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    const [searchResults, setSearchResults] = useState<{ orders: Order[], deposits: Deposit[], tempSubOrders: SubOrder[] }>({ orders: [], deposits: [], tempSubOrders: [] });


    const fetchRepData = async (repId: string) => {
        setIsLoading(true);
        try {
            const [fetchedRep, fetchedOrders, fetchedDeposits, fetchedTempSubOrders] = await Promise.all([
                getRepresentativeById(repId),
                getOrdersByRepresentativeId(repId),
                getDepositsByRepresentativeId(repId),
                getTempSubOrdersByRepresentativeId(repId),
            ]);

            if (fetchedRep) {
                setRep(fetchedRep);
                setAllOrders(fetchedOrders);
                setAllTempSubOrders(fetchedTempSubOrders);
                setAllDeposits(fetchedDeposits);
            } else {
                toast({ title: "خطأ", description: "لم يتم العثور على المندوب.", variant: "destructive" });
                router.push('/representative/login');
            }
        } catch (e) {
            toast({ title: "خطأ", description: "فشل تحميل البيانات.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const checkAuth = async () => {
            document.documentElement.classList.add('dark'); // Enforce dark/glass mode
            const loggedInUserStr = localStorage.getItem('loggedInUser');
            if (!loggedInUserStr) {
                router.push('/representative/login');
                return;
            }
            try {
                const loggedInUser = JSON.parse(loggedInUserStr);
                if (loggedInUser.type !== 'representative' || !loggedInUser.id) {
                    router.push('/representative/login');
                    return;
                }
                fetchRepData(loggedInUser.id);
            } catch (e) {
                router.push('/representative/login');
            }
        };
        checkAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    const { pendingOrders, deliveredOrders, pendingDeposits, collectedDeposits } = useMemo(() => {
        const pOrders = allOrders.filter(o => o.status !== 'delivered' && o.status !== 'cancelled').sort((a, b) => b.remainingAmount - a.remainingAmount);
        const dOrders = allOrders.filter(o => o.status === 'delivered').sort((a, b) => (b.deliveryDate && a.deliveryDate) ? new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime() : 0);
        const pDeposits = allDeposits.filter(d => d.status === 'pending');
        const cDeposits = allDeposits.filter(d => d.status === 'collected');

        return {
            pendingOrders: pOrders,
            deliveredOrders: dOrders,
            pendingDeposits: pDeposits,
            collectedDeposits: cDeposits,
        };
    }, [allOrders, allDeposits]);

    const fullPendingList: ((Order & { type: 'regular' }) | (TempDisplayOrder & { type: 'temp' }))[] = useMemo(() => {
        const regularPending = pendingOrders.map(o => ({ ...o, type: 'regular' as const }));
        const tempPending = allTempSubOrders.map(so => ({
            id: so.subOrderId,
            customerName: so.customerName,
            customerPhone: so.customerPhone || '',
            customerAddress: so.customerAddress || '',
            remainingAmount: so.remainingAmount,
            invoiceNumber: so.invoiceName || 'فاتورة مجمعة',
            type: 'temp' as const
        }));
        return [...regularPending, ...tempPending];
    }, [pendingOrders, allTempSubOrders]);

    const fullFinancialLog = useMemo(() => {
        const deliveredLogs = deliveredOrders.map(o => ({
            id: o.id,
            type: 'delivered',
            description: `توصيل طلب #${o.invoiceNumber}`,
            customerName: o.customerName,
            amount: o.collectedAmount || 0,
            date: o.deliveryDate ? new Date(o.deliveryDate) : new Date(0)
        }));

        const depositLogs = collectedDeposits.map(d => ({
            id: d.id,
            type: 'deposit',
            description: `تحصيل عربون #${d.receiptNumber}`,
            customerName: d.customerName,
            amount: d.amount,
            date: d.collectedDate ? new Date(d.collectedDate) : new Date(0)
        }));

        return [...deliveredLogs, ...depositLogs].sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [deliveredOrders, collectedDeposits]);

    const filteredFinancialLog = useMemo(() => {
        let dateFilteredLog = fullFinancialLog;
        let startDate: Date | null = null;
        let endDate: Date | null = null;

        const now = new Date();

        switch (filterType) {
            case 'daily': startDate = startOfDay(now); endDate = endOfDay(now); break;
            case 'weekly': startDate = startOfWeek(now, { locale: ar }); endDate = endOfWeek(now, { locale: ar }); break;
            case 'monthly': startDate = startOfMonth(now); endDate = endOfMonth(now); break;
            case 'yearly': startDate = startOfYear(now); endDate = endOfYear(now); break;
            case 'custom':
                if (dateRange?.from) startDate = startOfDay(dateRange.from);
                if (dateRange?.to) endDate = endOfDay(dateRange.to);
                else if (dateRange?.from) endDate = endOfDay(dateRange.from);
                break;
        }

        if (startDate && endDate) {
            dateFilteredLog = fullFinancialLog.filter(log => {
                const logDate = log.date;
                return logDate >= startDate! && logDate <= endDate!;
            });
        }

        if (!logSearchQuery) return dateFilteredLog;

        const query = logSearchQuery.toLowerCase();
        return dateFilteredLog.filter(log =>
            log.description.toLowerCase().includes(query) ||
            log.customerName.toLowerCase().includes(query)
        );

    }, [fullFinancialLog, filterType, dateRange, logSearchQuery]);

    const financialSummary = useMemo(() => {
        const totalCollected = filteredFinancialLog.reduce((sum, log) => sum + log.amount, 0);
        const deliveredCount = filteredFinancialLog.filter(log => log.type === 'delivered').length;
        const depositCount = filteredFinancialLog.filter(log => log.type === 'deposit').length;
        return { totalCollected, deliveredCount, depositCount };
    }, [filteredFinancialLog]);


    const handleUpdateDepositStatus = async (depositId: string, status: DepositStatus) => {
        try {
            await updateDepositStatus(depositId, status);
            toast({ title: "تم تحديث حالة العربون بنجاح" });
            if (rep) fetchRepData(rep.id);
        } catch (error) {
            toast({ title: "خطأ", description: "فشل تحديث الحالة", variant: "destructive" });
        }
    };

    const handleOpenConfirmDialog = (order: Order) => {
        setCurrentOrder(order);
        setCollectedAmount(order.remainingAmount);
        setIsConfirmDialogOpen(true);
    };

    const handleRecordPayment = async () => {
        if (!currentOrder || collectedAmount < 0) {
            toast({ title: "خطأ", description: "الرجاء إدخال مبلغ صحيح.", variant: "destructive" });
            return;
        }

        const success = await recordRepresentativePayment(currentOrder.id, collectedAmount);

        if (success) {
            toast({ title: "تم تأكيد الاستلام بنجاح!" });
            setIsConfirmDialogOpen(false);
            if (rep) {
                fetchRepData(rep.id);
            }
        } else {
            toast({ title: "خطأ", description: "فشل تسجيل العملية.", variant: "destructive" });
        }
    }

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: `تم نسخ ${label} بنجاح!` });
        });
    };

    const handleSearch = () => {
        if (!searchQuery) {
            setSearchResults({ orders: [], deposits: [], tempSubOrders: [] });
            return;
        }
        const query = searchQuery.toLowerCase();
        const foundOrders = allOrders.filter(o =>
            o.customerName.toLowerCase().includes(query) ||
            o.customerPhone?.toLowerCase().includes(query) ||
            o.invoiceNumber.toLowerCase().includes(query)
        );
        const foundTempSubOrders = allTempSubOrders.filter(so =>
            so.customerName.toLowerCase().includes(query) ||
            so.customerPhone?.toLowerCase().includes(query)
        );
        const foundDeposits = allDeposits.filter(d =>
            d.customerName.toLowerCase().includes(query) ||
            d.customerPhone.toLowerCase().includes(query) ||
            d.receiptNumber.toLowerCase().includes(query)
        );
        setSearchResults({ orders: foundOrders, deposits: foundDeposits, tempSubOrders: foundTempSubOrders });
    };

    const handlePrintShippingLabel = (orderId: string) => {
        const printUrl = `/representative/orders/${orderId}/print`;
        window.open(printUrl, '_blank', 'height=842,width=595,resizable=yes,scrollbars=yes');
    };

    const handlePrintDepositReceipt = (depositId: string) => {
        const printUrl = `/representative/deposits/${depositId}/print`;
        window.open(printUrl, '_blank', 'height=842,width=595,resizable=yes,scrollbars=yes');
    };

    const handleFilterChange = (type: string) => {
        setFilterType(type);
        if (type !== 'custom') {
            setDateRange(undefined);
        }
    }

    const handleDateRangeSelect = (range: DateRange | undefined) => {
        setDateRange(range);
        setFilterType('custom');
    }

    return (
        <div className="bg-transparent text-foreground min-h-screen p-4 sm:p-6 space-y-6" dir="rtl">

            {/* Profile Header */}
            <GlassCard variant="premium" className="relative overflow-hidden mb-6 border-primary/20">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-lg border-2 border-white/10 bg-black/40 p-3">
                            <Image
                                src={logo}
                                alt="Rep Logo"
                                width={60}
                                height={60}
                                className="object-contain"
                            />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-white to-white/70">{rep?.name}</h2>
                            <p className="opacity-80 font-mono text-sm px-2 py-0.5 rounded bg-primary/10 border border-primary/10 inline-block mt-1 text-primary-foreground">ID: {rep?.username}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-xl border border-primary/20">
                        <Phone className="w-5 h-5 text-primary" />
                        <span className="text-lg font-semibold tracking-wider font-mono text-white">{rep?.phone}</span>
                    </div>
                </div>
            </GlassCard>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <ActionButton
                    icon={<ArrowDownToLine />}
                    label="الطلبات المعلقة"
                    count={fullPendingList.length}
                    onClick={() => setIsPendingOrdersSheetOpen(true)}
                    colorClass="text-orange-400"
                    bgClass="bg-orange-500/10"
                />
                <ActionButton
                    icon={<CheckCircle />}
                    label="الطلبات المسلّمة"
                    count={deliveredOrders.length}
                    onClick={() => setIsDeliveredOrdersSheetOpen(true)}
                    colorClass="text-green-400"
                    bgClass="bg-green-500/10"
                />
                <ActionButton
                    icon={<Receipt />}
                    label="سجل العربون"
                    count={pendingDeposits.length}
                    onClick={() => setIsDepositsSheetOpen(true)}
                    isHighlighted={pendingDeposits.length > 0}
                    colorClass="text-purple-400"
                    bgClass="bg-purple-500/10"
                />
                <ActionButton
                    icon={<History />}
                    label="السجل المالي"
                    count={fullFinancialLog.length}
                    onClick={() => setIsFinancialLogSheetOpen(true)}
                    colorClass="text-blue-400"
                    bgClass="bg-blue-500/10"
                />
            </div>

            {/* Search Bar */}
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <Button
                    variant="ghost"
                    className="w-full h-16 text-lg gap-3 bg-secondary/50 hover:bg-secondary/70 border border-white/5 rounded-2xl backdrop-blur-md justify-start px-6 transform transition-all"
                    onClick={() => setIsSearchSheetOpen(true)}
                >
                    <Search className="w-6 h-6 text-primary" />
                    <span className="opacity-50">بحث عن طلب أو عميل...</span>
                </Button>
            </motion.div>

            {/* Recent Activity */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <History className="w-5 h-5 text-primary" />
                        آخر العمليات
                    </h3>
                </div>
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
                    ) : fullFinancialLog.length > 0 ? (
                        fullFinancialLog.slice(0, 5).map((log, i) => (
                            <motion.div
                                key={`${log.type}-${log.id}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <FinancialLogItem log={log} />
                            </motion.div>
                        ))
                    ) : (
                        <GlassCard className="p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
                            <History className="w-12 h-12 opacity-20" />
                            <p>لا توجد عمليات مالية مسجلة بعد.</p>
                        </GlassCard>
                    )}
                </div>
            </div>

            {/* Sheets for details */}
            <FullScreenSheet isOpen={isPendingOrdersSheetOpen} setIsOpen={setIsPendingOrdersSheetOpen} title="الطلبات المعلقة">
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {fullPendingList.length > 0 ? fullPendingList.map(order => (
                        order.type === 'regular' ?
                            <OrderCard key={order.id} order={order as Order} onPaymentRecord={handleOpenConfirmDialog} copyToClipboard={copyToClipboard} onPrint={handlePrintShippingLabel} /> :
                            <TempSubOrderCard key={order.id} subOrder={order as TempDisplayOrder} copyToClipboard={copyToClipboard} />
                    )) : (
                        <div className="col-span-2 flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50 space-y-4">
                            <Package className="w-20 h-20" />
                            <p className="text-lg">لا توجد طلبات معلقة</p>
                        </div>
                    )}
                </div>
            </FullScreenSheet>

            <FullScreenSheet isOpen={isDeliveredOrdersSheetOpen} setIsOpen={setIsDeliveredOrdersSheetOpen} title="الطلبات المسلّمة">
                <div className="p-4 space-y-3">
                    {deliveredOrders.length > 0 ? deliveredOrders.map(order => (
                        <DeliveredOrderCard key={order.id} order={order} onPrint={handlePrintShippingLabel} />
                    )) : <p className="text-muted-foreground text-center pt-20">لم يتم تسليم أي طلبات بعد.</p>}
                </div>
            </FullScreenSheet>

            <FullScreenSheet isOpen={isDepositsSheetOpen} setIsOpen={setIsDepositsSheetOpen} title="سجل العربون">
                <div className="p-4">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-yellow-500" /> مطلوب تحصيله</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        {pendingDeposits.length > 0 ? pendingDeposits.map(deposit => (
                            <DepositCard key={deposit.id} deposit={deposit} onStatusUpdate={handleUpdateDepositStatus} onPrint={handlePrintDepositReceipt} copyToClipboard={copyToClipboard} />
                        )) : <p className="text-muted-foreground opacity-60 text-sm">لا يوجد عربون مطلوب حالياً.</p>}
                    </div>

                    <Separator className="my-6 bg-white/10" />

                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500" /> تم تحصيله</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {collectedDeposits.length > 0 ? collectedDeposits.map(deposit => (
                            <DepositCard key={deposit.id} deposit={deposit} onPrint={handlePrintDepositReceipt} copyToClipboard={copyToClipboard} />
                        )) : <p className="text-muted-foreground opacity-60 text-sm">لم يتم تحصيل أي عربون بعد.</p>}
                    </div>
                </div>
            </FullScreenSheet>

            <FullScreenSheet isOpen={isFinancialLogSheetOpen} setIsOpen={setIsFinancialLogSheetOpen} title="السجل المالي الكامل">
                <div className="p-4 space-y-4">
                    {/* Search and Filter Controls */}
                    <div className="sticky top-0 bg-background/95 backdrop-blur-xl z-10 py-4 -mt-4 border-b border-white/5 space-y-3">
                        <Input
                            placeholder="بحث بالاسم أو رقم الفاتورة/الإيصال..."
                            value={logSearchQuery}
                            onChange={(e) => setLogSearchQuery(e.target.value)}
                            className="bg-secondary/50 border-white/5"
                        />
                        <div className="flex flex-wrap items-center gap-2 no-scrollbar overflow-x-auto pb-1">
                            {['all', 'daily', 'weekly', 'monthly', 'yearly'].map(t => (
                                <Button
                                    key={t}
                                    variant={filterType === t ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => handleFilterChange(t)}
                                    className={filterType === t ? 'bg-primary text-white' : 'bg-transparent border-white/10'}
                                >
                                    {t === 'all' ? 'الكل' : t === 'daily' ? 'اليوم' : t === 'weekly' ? 'أسبوعي' : t === 'monthly' ? 'شهري' : 'سنوي'}
                                </Button>
                            ))}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
                                        size="sm"
                                        className={cn("bg-transparent border-white/10 font-normal", filterType === 'custom' && "border-primary text-primary")}
                                    >
                                        <CalendarIcon className="ml-2 h-4 w-4" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>{format(dateRange.from, "d MMM", { locale: ar })} - {format(dateRange.to, "d MMM", { locale: ar })}</>
                                            ) : (format(dateRange.from, "d MMM, y", { locale: ar }))
                                        ) : (<span>فترة مخصصة</span>)}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 border-white/10 bg-black/90" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={dateRange?.from}
                                        selected={dateRange}
                                        onSelect={handleDateRangeSelect}
                                        numberOfMonths={1}
                                        locale={ar}
                                        className="bg-black text-white"
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <GlassCard className="bg-gradient-to-br from-primary/20 to-orange-600/20 border-primary/20 no-print p-4">
                        <div className="flex items-center gap-2 text-primary mb-4">
                            <Filter className="w-5 h-5" />
                            <h3 className="font-bold">ملخص الفترة المحددة</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="bg-black/20 rounded-xl p-2">
                                <p className="text-xs text-muted-foreground mb-1">إجمالي التحصيل</p>
                                <p className="text-lg font-bold text-green-400" dir="ltr">{financialSummary.totalCollected.toFixed(2)}</p>
                            </div>
                            <div className="bg-black/20 rounded-xl p-2">
                                <p className="text-xs text-muted-foreground mb-1">طلبات مسلمة</p>
                                <p className="text-lg font-bold text-white">{financialSummary.deliveredCount}</p>
                            </div>
                            <div className="bg-black/20 rounded-xl p-2">
                                <p className="text-xs text-muted-foreground mb-1">عرابين محصلة</p>
                                <p className="text-lg font-bold text-white">{financialSummary.depositCount}</p>
                            </div>
                        </div>
                    </GlassCard>

                    <div className="space-y-3 print-section pb-20">
                        {isLoading ? (
                            <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                        ) : filteredFinancialLog.length > 0 ? filteredFinancialLog.map(log => (
                            <FinancialLogItem key={`${log.type}-${log.id}`} log={log} />
                        )) : (
                            <p className="text-center text-muted-foreground pt-4">لا توجد عمليات مالية في هذه الفترة.</p>
                        )}
                    </div>
                </div>
            </FullScreenSheet>

            <FullScreenSheet isOpen={isSearchSheetOpen} setIsOpen={setIsSearchSheetOpen} title="بحث">
                <div className="p-4 space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="ابحث بالاسم، الهاتف، رقم الفاتورة أو الإيصال..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-secondary/50 border-white/10"
                        />
                        <Button onClick={handleSearch} className="bg-primary hover:bg-primary/90">بحث</Button>
                    </div>
                    {searchResults.orders.length > 0 || searchResults.deposits.length > 0 || searchResults.tempSubOrders.length > 0 ? (
                        <SearchResults results={searchResults} onPrintOrder={handlePrintShippingLabel} onPrintDeposit={handlePrintDepositReceipt} />
                    ) : (
                        searchQuery && <p className="text-muted-foreground text-center pt-20">لا توجد نتائج مطابقة.</p>
                    )}
                </div>
            </FullScreenSheet>


            {/* Payment Confirmation Dialog */}
            <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
                <DialogContent dir='rtl' className="dark bg-[#1a1a1a] border-white/10">
                    <DialogHeader>
                        <DialogTitle>تأكيد استلام وتسليم الطلب</DialogTitle>
                        <DialogDescription>
                            أدخل المبلغ الذي استلمته من العميل: <span className="font-bold text-white">{currentOrder?.customerName}</span>.
                            المبلغ المطلوب هو <span className="font-bold text-destructive">{currentOrder?.remainingAmount.toFixed(2)} د.ل</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="collectedAmount">المبلغ المحصّل (د.ل)</Label>
                        <Input
                            id="collectedAmount"
                            type="number"
                            dir="ltr"
                            value={collectedAmount}
                            onChange={(e) => setCollectedAmount(parseFloat(e.target.value) || 0)}
                            className="mt-2 text-lg font-bold bg-black/20 border-white/10"
                        />
                    </div>
                    <DialogFooter className="sm:justify-start gap-2">
                        <Button onClick={handleRecordPayment} className="w-full bg-green-600 hover:bg-green-700 text-white">نعم، أؤكد الاستلام</Button>
                        <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)} className="w-full bg-transparent border-white/10 hover:bg-white/5">إلغاء</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};


// --- Helper Components ---

const ActionButton = ({ icon, label, count, onClick, isHighlighted, colorClass = "text-primary", bgClass = "bg-primary/10" }: { icon: React.ReactNode, label: string, count: number, onClick: () => void, isHighlighted?: boolean, colorClass?: string, bgClass?: string }) => (
    <GlassCard
        className={`relative flex flex-col items-center justify-center p-4 cursor-pointer group hover:bg-white/5 transition-all duration-300 ${isHighlighted ? 'border-primary/50 bg-primary/5' : 'border-white/5'}`}
        hoverEffect={true}
        onClick={onClick}
    >
        <div className={`p-3 rounded-2xl mb-3 transition-colors duration-300 ${isHighlighted ? 'bg-primary text-white shadow-lg shadow-primary/30' : `${bgClass} ${colorClass}`}`}>
            {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6" })}
        </div>
        <p className="font-bold text-sm text-center">{label}</p>
        <AnimatePresence>
            {count > 0 && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 left-2"
                >
                    <Badge className="bg-red-500 hover:bg-red-600 text-white border-none shadow-sm">{count}</Badge>
                </motion.div>
            )}
        </AnimatePresence>
    </GlassCard>
);

const FinancialLogItem = ({ log }: { log: { type: string, description: string, customerName: string, amount: number, date: Date } }) => (
    <GlassCard className="flex items-center justify-between p-4" hoverEffect={true}>
        <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${log.type === 'delivered' ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'}`}>
                {log.type === 'delivered' ? <DollarSign className="w-5 h-5" /> : <HandCoins className="w-5 h-5" />}
            </div>
            <div>
                <p className="font-bold text-sm text-foreground">{log.description}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <User className="w-3 h-3" /> {log.customerName}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 opacity-60 font-mono">{isValid(log.date) ? format(log.date, 'PP p', { locale: ar }) : ''}</p>
            </div>
        </div>
        <p className="font-black text-green-400 text-lg tracking-wide">+{log.amount.toFixed(2)}</p>
    </GlassCard>
);

const FullScreenSheet = ({ isOpen, setIsOpen, title, children }: { isOpen: boolean, setIsOpen: (isOpen: boolean) => void, title: string, children: React.ReactNode }) => (
    <div className={`fixed inset-0 bg-black/95 backdrop-blur-3xl z-50 transition-transform duration-500 ease-in-out font-sans ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex flex-col h-full max-w-4xl mx-auto border-x border-white/5">
            <header className="p-4 flex justify-between items-center sticky top-0 bg-black/80 backdrop-blur-xl z-20 border-b border-white/10">
                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-white to-white/60">{title}</h2>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="rounded-full hover:bg-white/10 hover:text-red-400 transition-colors">
                    <X className="w-6 h-6" />
                </Button>
            </header>
            <div className="flex-grow overflow-y-auto no-scrollbar">
                {children}
            </div>
        </div>
    </div>
);

const OrderCard = ({ order, onPaymentRecord, copyToClipboard, onPrint }: { order: Order, onPaymentRecord: (order: Order) => void, copyToClipboard: (text: string, label: string) => void, onPrint: (orderId: string) => void }) => (
    <GlassCard className="flex flex-col h-full border-l-4 border-l-primary/50 hover:border-l-primary transition-all duration-300">
        <div className="flex justify-between items-start mb-4">
            <div>
                <h3 className="font-bold text-lg">{order.customerName}</h3>
                <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] font-mono border-white/10 text-muted-foreground">#{order.invoiceNumber}</Badge>
                </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onPrint(order.id)} className="rounded-full hover:bg-primary/20 text-primary">
                <Printer className="w-5 h-5" />
            </Button>
        </div>

        <div className="space-y-4 flex-grow mb-6">
            <div className="flex items-center gap-3 text-sm bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="p-2 bg-primary/10 rounded-full text-primary">
                    <Phone className="h-4 w-4" />
                </div>
                <span className="font-mono tracking-wider flex-grow text-left">{order.customerPhone}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/20 rounded-full" onClick={() => copyToClipboard(order.customerPhone || '', 'رقم الهاتف')}>
                    <Copy className="h-4 w-4" />
                </Button>
            </div>
            <div className="flex items-start gap-3 text-sm px-2">
                <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <span className="leading-relaxed opacity-90">{order.customerAddress}</span>
            </div>
        </div>

        <div className="bg-gradient-to-br from-destructive/10 to-red-900/10 p-4 rounded-xl mb-4 text-center border border-destructive/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-destructive/5 blur-xl"></div>
            <p className="text-xs font-bold text-destructive uppercase tracking-wide mb-1 relative z-10">المبلغ المطلوب</p>
            <p className="text-3xl font-black text-destructive relative z-10">{order.remainingAmount.toFixed(2)} <span className="text-sm font-medium">د.ل</span></p>
        </div>

        <Button className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20 rounded-xl bg-gradient-to-r from-primary to-orange-600 hover:from-primary/90 hover:to-orange-700 transition-all" onClick={() => onPaymentRecord(order)} disabled={order.remainingAmount <= 0}>
            <CheckCircle className="w-5 h-5 ml-2" /> تأكيد الاستلام
        </Button>
    </GlassCard>
);

const TempSubOrderCard = ({ subOrder, copyToClipboard }: { subOrder: TempDisplayOrder, copyToClipboard: (text: string, label: string) => void }) => (
    <GlassCard className="flex flex-col h-full border-dashed border-2 border-white/10 opacity-80 hover:opacity-100 transition-opacity">
        <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
                <CardTitle className="text-base">{subOrder.customerName}</CardTitle>
                <Badge variant="outline" className={`font-normal ${subOrderStatusConfig.pending.className}`}>
                    <span className="mr-1 text-[10px]">{subOrderStatusConfig.pending.text}</span>
                </Badge>
            </div>
            <CardDescription className="text-xs">فاتورة: {subOrder.invoiceNumber}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-grow">
            <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono">{subOrder.customerPhone}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 mr-auto" onClick={() => copyToClipboard(subOrder.customerPhone || '', 'رقم الهاتف')}>
                    <Copy className="h-3 w-3" />
                </Button>
            </div>
            <div className="flex items-start gap-2 text-sm">
                <MapPin className="h-4 w-4 mt-1 flex-shrink-0 text-muted-foreground" />
                <span>{subOrder.customerAddress}</span>
            </div>
            <div className="text-center bg-destructive/10 p-3 rounded-xl mt-2 border border-destructive/10">
                <p className="font-semibold text-destructive text-xs">المبلغ المطلوب</p>
                <p className="text-xl font-bold text-destructive">{subOrder.remainingAmount.toFixed(2)} د.ل</p>
            </div>
        </CardContent>
        <CardContent>
            <Button className="w-full gap-2 bg-secondary/50 text-muted-foreground hover:bg-secondary" disabled>
                <Clock className="w-4 h-4" /> بانتظار التجهيز
            </Button>
        </CardContent>
    </GlassCard>
);

const DeliveredOrderCard = ({ order, onPrint }: { order: Order; onPrint: (orderId: string) => void }) => (
    <GlassCard className="mb-3 hover:bg-white/5 transition-colors">
        <div className="p-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-500/10 text-green-500">
                    <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                    <p className="font-bold">{order.customerName}</p>
                    <p className="text-xs text-muted-foreground font-mono">#{order.invoiceNumber}</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-left">
                    <p className="font-bold text-green-400">+{order.collectedAmount?.toFixed(2) || '0.00'}</p>
                    <p className="text-[10px] text-muted-foreground">{order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('ar-LY') : ''}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onPrint(order.id)} className="text-muted-foreground hover:text-primary">
                    <Printer className="w-5 h-5" />
                </Button>
            </div>
        </div>
    </GlassCard>
);

const DepositCard = ({ deposit, onStatusUpdate, onPrint, copyToClipboard }: { deposit: Deposit, onStatusUpdate?: (depositId: string, status: DepositStatus) => void, onPrint: (depositId: string) => void, copyToClipboard: (text: string, label: string) => void }) => (
    <GlassCard className="flex flex-col h-full border border-white/5 bg-gradient-to-br from-background to-secondary/20">
        <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
                <CardTitle className="text-base">{deposit.customerName}</CardTitle>
                <div className="flex items-center gap-1">
                    <Badge variant="outline" className={`font-normal scale-90 ${depositStatusConfig[deposit.status].className}`}>
                        {depositStatusConfig[deposit.status].icon}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => onPrint(deposit.id)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <Printer className="w-4 h-4" />
                    </Button>
                </div>
            </div>
            <CardDescription className="text-xs">#{deposit.receiptNumber}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow space-y-4 pt-2">
            <div className="flex items-center gap-2 text-sm bg-white/5 p-2 rounded-lg">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono">{deposit.customerPhone}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 mr-auto" onClick={() => copyToClipboard(deposit.customerPhone || '', 'رقم الهاتف')}>
                    <Copy className="h-3 w-3" />
                </Button>
            </div>
            {deposit.description && <p className="text-xs text-muted-foreground bg-black/20 p-2 rounded">{deposit.description}</p>}

            <div className={`text-center p-4 rounded-xl border ${deposit.status === 'pending' ? 'bg-primary/10 border-primary/20' : 'bg-green-500/10 border-green-500/20'}`}>
                <p className={`text-xs font-semibold mb-1 ${deposit.status === 'pending' ? 'text-primary' : 'text-green-400'}`}>
                    {deposit.status === 'pending' ? 'مبلغ العربون' : 'المبلغ المحصّل'}
                </p>
                <p className={`text-2xl font-black ${deposit.status === 'pending' ? 'text-primary' : 'text-green-400'}`}>{deposit.amount.toFixed(2)}</p>
            </div>
        </CardContent>
        {deposit.status === 'pending' && onStatusUpdate && (
            <CardContent>
                <Button className="w-full gap-2 bg-primary hover:bg-primary/90 h-12 text-lg font-bold shadow-lg shadow-primary/20" onClick={() => onStatusUpdate(deposit.id, 'collected')}>
                    <CheckCircle className="w-5 h-5" /> تأكيد التحصيل
                </Button>
            </CardContent>
        )}
    </GlassCard>
);

const SearchResults = ({ results, onPrintOrder, onPrintDeposit }: { results: { orders: Order[], deposits: Deposit[], tempSubOrders: SubOrder[] }, onPrintOrder: (orderId: string) => void, onPrintDeposit: (depositId: string) => void }) => {
    const customerInfo = useMemo(() => {
        const info = new Map<string, { name: string, phone: string, totalDue: number }>();

        results.orders.forEach(o => {
            const phone = o.customerPhone || 'N/A';
            if (!info.has(phone)) {
                info.set(phone, { name: o.customerName, phone, totalDue: 0 });
            }
            if (o.status !== 'delivered' && o.status !== 'cancelled') {
                info.get(phone)!.totalDue += o.remainingAmount;
            }
        });

        results.tempSubOrders.forEach(so => {
            const phone = so.customerPhone || 'N/A';
            if (!info.has(phone)) {
                info.set(phone, { name: so.customerName, phone, totalDue: 0 });
            }
            info.get(phone)!.totalDue += so.remainingAmount;
        });

        results.deposits.forEach(d => {
            const phone = d.customerPhone || 'N/A';
            if (!info.has(phone)) {
                info.set(phone, { name: d.customerName, phone, totalDue: 0 });
            }
        });

        return Array.from(info.values());
    }, [results]);

    return (
        <div className="space-y-4">
            {customerInfo.map(customer => (
                <GlassCard key={customer.phone} className="mb-4">
                    <div className="p-4 border-b border-white/5">
                        <div className="flex justify-between">
                            <h3 className="font-bold flex items-center gap-2"><User className="w-4 h-4 text-primary" /> {customer.name}</h3>
                            <p className="font-mono text-sm bg-white/5 px-2 rounded">{customer.phone}</p>
                        </div>
                        <div className="pt-3 mt-2 border-t border-white/5 flex justify-between items-center">
                            <p className="text-sm text-muted-foreground">إجمالي المبلغ المطلوب</p>
                            <p className="text-xl font-bold text-destructive">{customer.totalDue.toFixed(2)} د.ل</p>
                        </div>
                    </div>
                </GlassCard>
            ))}

            <Separator className="bg-white/10" />

            <h3 className="text-lg font-bold text-muted-foreground">تطابق فردي</h3>
            {/* Render individual items if needed or just rely on the aggregations above for a cleaner view */}
            {/* For now, just showing the grouped view is better for a summary search */}
        </div>
    );
};


export default RepresentativeDashboardPage;
