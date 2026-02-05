
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, PlusCircle, Trash2, DollarSign, Weight, Calendar as CalendarIcon, Users2, Home, User, Check, ChevronsUpDown, Loader2, FileText, Copy, QrCode } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter, useSearchParams } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from '@/components/ui/use-toast';
import { addTempOrder, updateTempOrder, getTempOrderById, getUsers, getOrders, getRepresentatives } from '@/lib/actions';
import { TempOrder, OrderStatus, SubOrder, User as AppUser, Order, Representative } from '@/lib/types';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';


const onlineStores = [
    { value: 'shein', label: 'شي إن (Shein)' },
    { value: 'amazon', label: 'أمازون (Amazon)' },
    { value: 'alibaba', label: 'علي بابا (Alibaba)' },
    { value: 'trendyol', label: 'ترينديول (Trendyol)' },
    { value: 'other', label: 'متجر آخر (يدوي)' },
];

const EXCHANGE_RATE = 8.6;

const generatePassword = () => Math.floor(100000 + Math.random() * 900000).toString();

const createNewSubOrder = (): SubOrder => ({
    subOrderId: `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    trackingId: `TM${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    username: '', // Will be set to the phone number
    password: generatePassword(),
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    purchasePriceUSD: 0,
    sellingPriceLYD: 0,
    downPaymentLYD: 0,
    paymentMethod: 'cash',
    shipmentStatus: 'pending',
    selectedStore: '',
    manualStoreName: '',
    productLinks: '',
    operationDate: new Date().toISOString(),
    deliveryDate: undefined,
    itemDescription: '',
    weightKG: 0,
    pricePerKiloUSD: 0,
    remainingAmount: 0,
    representativeId: null,
    representativeName: null,
});

const AddTemporaryBatchForm = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderId = searchParams.get('id');
    const { toast } = useToast();

    const [subOrders, setSubOrders] = useState<SubOrder[]>([createNewSubOrder()]);
    const [invoiceNumber, setInvoiceNumber] = useState(`TEMP-BATCH-${Date.now().toString().slice(-6)}`);
    const [invoiceName, setInvoiceName] = useState(`فاتورة ${new Date().toLocaleDateString('ar-LY')}`);

    const [isLoadingPage, setIsLoadingPage] = useState(!!orderId);
    const [isSaving, setIsSaving] = useState(false);
    const [allUsers, setAllUsers] = useState<AppUser[]>([]);
    const [representatives, setRepresentatives] = useState<Representative[]>([]);
    const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
    const [isUserSearchOpen, setIsUserSearchOpen] = useState(false);


    useEffect(() => {
        const fetchInitialData = async () => {
            const [users, reps] = await Promise.all([
                getUsers(),
                getRepresentatives(),
            ]);
            setAllUsers(users);
            setRepresentatives(reps);

            if (orderId) {
                const existingOrder = await getTempOrderById(orderId);
                if (existingOrder) {
                    setInvoiceName(existingOrder.invoiceName);
                    setSubOrders(existingOrder.subOrders);
                    setAssignedUserId(existingOrder.assignedUserId || null);
                    setInvoiceNumber(existingOrder.id.slice(-6));
                } else {
                    toast({ title: "خطأ", description: "لم يتم العثور على الفاتورة.", variant: "destructive" });
                    router.push('/admin/temporary-users');
                }
            }
            setIsLoadingPage(false);
        };
        fetchInitialData();
    }, [orderId, router, toast]);

    const handleAddSubOrder = () => {
        setSubOrders([...subOrders, createNewSubOrder()]);
    };

    const handleRemoveSubOrder = (id: string) => {
        setSubOrders(subOrders.filter(order => order.subOrderId !== id));
    };

    const handleSubOrderChange = (id: string, field: keyof SubOrder, value: any) => {
        setSubOrders(subOrders.map(order => {
            if (order.subOrderId === id) {
                const updatedOrder = { ...order, [field]: value };

                // Set username to phone number
                if (field === 'customerPhone') {
                    updatedOrder.username = value;
                }

                if (field === 'sellingPriceLYD' || field === 'downPaymentLYD') {
                    updatedOrder.remainingAmount = updatedOrder.sellingPriceLYD - updatedOrder.downPaymentLYD;
                }
                if (field === 'representativeId') {
                    const rep = representatives.find(r => r.id === value);
                    updatedOrder.representativeName = rep?.name || null;
                }
                return updatedOrder;
            }
            return order;
        }));
    };

    const handleUserSelect = (userId: string | null) => {
        setAssignedUserId(userId);
    }

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: "تم النسخ!", description: `تم نسخ ${label} إلى الحافظة.` });
        });
    };


    const calculatedTotals = useMemo(() => {
        return subOrders.map(order => {
            const shippingCostLYD = (order.weightKG * order.pricePerKiloUSD) * EXCHANGE_RATE;
            const purchaseCostLYD = order.purchasePriceUSD * EXCHANGE_RATE;
            const netProfit = order.sellingPriceLYD - purchaseCostLYD - shippingCostLYD;
            return {
                shippingCostLYD,
                purchaseCostLYD,
                remainingAmount: order.remainingAmount,
                netProfit
            };
        });
    }, [subOrders]);

    const grandTotal = useMemo(() => {
        return subOrders.reduce((acc, order) => acc + order.sellingPriceLYD, 0);
    }, [subOrders]);

    const grandTotalProfit = useMemo(() => {
        return calculatedTotals.reduce((acc, totals) => acc + totals.netProfit, 0);
    }, [calculatedTotals]);

    const totalRemaining = useMemo(() => {
        return subOrders.reduce((acc, order) => acc + order.remainingAmount, 0);
    }, [subOrders]);


    const handleSaveInvoice = async () => {
        if (subOrders.some(so => !so.customerName || !so.customerPhone)) {
            toast({
                title: "بيانات ناقصة",
                description: "الرجاء التأكد من إدخال اسم ورقم هاتف لكل عميل.",
                variant: "destructive"
            });
            return;
        }
        setIsSaving(true);

        const selectedUser = allUsers.find(u => u.id === assignedUserId);

        const finalSubOrders: SubOrder[] = subOrders.map(so => ({
            ...so,
            operationDate: so.operationDate ? new Date(so.operationDate).toISOString() : new Date().toISOString(),
            deliveryDate: so.deliveryDate ? new Date(so.deliveryDate).toISOString() : undefined,
        }));

        const orderData: Partial<Omit<TempOrder, 'id'>> = {
            invoiceName,
            totalAmount: grandTotal,
            remainingAmount: totalRemaining,
            status: 'pending',
            subOrders: finalSubOrders,
            assignedUserId: assignedUserId,
            assignedUserName: selectedUser?.name || null,
        };

        try {
            if (orderId) {
                await updateTempOrder(orderId, orderData);
                toast({
                    title: "تم التحديث بنجاح",
                    description: `تم تحديث الفاتورة المجمعة ${invoiceName}.`
                });
            } else {
                const addedOrder = await addTempOrder(orderData as Omit<TempOrder, 'id'>);
                if (!addedOrder) throw new Error("Failed to add temp order");

                toast({
                    title: "تم الحفظ بنجاح",
                    description: `تم حفظ الفاتورة المجمعة ${invoiceName}.`
                });
            }
            router.push('/admin/temporary-users');
        } catch (error) {
            console.error(error);
            toast({
                title: "خطأ",
                description: "فشل حفظ الفاتورة المجمعة.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };


    if (isLoadingPage) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
            <header className="bg-card/30 backdrop-blur-lg border-b p-4 flex justify-between items-center shadow-sm sticky top-0 z-30">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <div className="flex flex-col sm:flex-row items-baseline gap-2">
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Users2 />
                            {orderId ? "تعديل فاتورة مجمعة" : "فاتورة مجمعة جديدة"}
                        </h1>
                        <span className='font-mono text-sm text-muted-foreground'>#{orderId ? invoiceNumber : 'N/A'}</span>
                    </div>
                </div>
                <div className='w-full max-w-xs'>
                    <Input
                        placeholder="اسم الفاتورة (مثال: شحنة شي إن 25/7)"
                        value={invoiceName}
                        onChange={(e) => setInvoiceName(e.target.value)}
                    />
                </div>
            </header>

            <main className="p-4 sm:p-6 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>إسناد الفاتورة بالكامل لمستخدم (اختياري)</CardTitle>
                        <CardContent className="pt-6 space-y-4">
                            <FormField label="ابحث عن مستخدم مسجل لإسناد الدين إليه" id="assign-user">
                                <Popover open={isUserSearchOpen} onOpenChange={setIsUserSearchOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={isUserSearchOpen}
                                            className="w-full justify-between"
                                        >
                                            {assignedUserId
                                                ? allUsers.find((user) => user.id === assignedUserId)?.name
                                                : "اختر مستخدم..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                        <Command>
                                            <CommandInput placeholder="ابحث بالاسم، اسم المستخدم، أو الهاتف..." />
                                            <CommandList>
                                                <CommandEmpty>لم يتم العثور على مستخدم.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem onSelect={() => { handleUserSelect(null); setIsUserSearchOpen(false); }}>
                                                        <Check className={cn("mr-2 h-4 w-4", !assignedUserId ? "opacity-100" : "opacity-0")} />
                                                        بدون إسناد
                                                    </CommandItem>
                                                    {allUsers.map((user) => (
                                                        <CommandItem
                                                            key={user.id}
                                                            value={`${user.name} ${user.username} ${user.phone}`}
                                                            onSelect={() => { handleUserSelect(user.id); setIsUserSearchOpen(false); }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", assignedUserId === user.id ? "opacity-100" : "opacity-0")} />
                                                            {user.name} ({user.username})
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </FormField>
                        </CardContent>
                    </CardHeader>
                </Card>

                {subOrders.map((order, index) => (
                    <Card key={order.subOrderId} className="relative overflow-hidden bg-card/60 backdrop-blur-lg border-border">
                        <CardHeader className='bg-muted/30'>
                            <div className="flex justify-between items-center">
                                <CardTitle>الطلب الفرعي للعميل: {order.customerName || `طلب #${index + 1}`}</CardTitle>
                                {subOrders.length > 1 && (
                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveSubOrder(order.subOrderId)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            {/* Customer Info */}
                            <div className="space-y-4 p-4 border rounded-lg bg-background/30">
                                <h3 className='font-semibold'>1. بيانات العميل المؤقت</h3>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <FormField label="اسم العميل المؤقت" id={`customer-name-${order.subOrderId}`}>
                                        <Input value={order.customerName} onChange={e => handleSubOrderChange(order.subOrderId, 'customerName', e.target.value)} placeholder="الاسم الكامل للعميل" className="bg-transparent" />
                                    </FormField>
                                    <FormField label="رقم هاتف العميل" id={`customer-phone-${order.subOrderId}`}>
                                        <Input
                                            value={order.customerPhone}
                                            onChange={e => handleSubOrderChange(order.subOrderId, 'customerPhone', e.target.value)}
                                            onFocus={(e) => {
                                                if (e.target.value.startsWith('0')) {
                                                    handleSubOrderChange(order.subOrderId, 'customerPhone', e.target.value.substring(1));
                                                }
                                            }}
                                            placeholder="09xxxxxxxx"
                                            dir="ltr"
                                            className="bg-transparent"
                                        />
                                    </FormField>
                                    <FormField label="العنوان" id={`customer-address-${order.subOrderId}`}>
                                        <Input value={order.customerAddress} onChange={e => handleSubOrderChange(order.subOrderId, 'customerAddress', e.target.value)} placeholder="المدينة، الشارع" className="bg-transparent" />
                                    </FormField>
                                </div>
                                <Separator />
                                <h4 className='font-semibold text-sm'>بيانات الدخول والشحن</h4>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <FormField label="اسم المستخدم (رقم الهاتف)" id={`username-${order.subOrderId}`}>
                                        <div className="flex items-center">
                                            <Input value={order.username} readOnly className="bg-muted/50" />
                                            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(order.username, 'اسم المستخدم')}><Copy className="w-4 h-4" /></Button>
                                        </div>
                                    </FormField>
                                    <FormField label="كلمة المرور" id={`password-${order.subOrderId}`}>
                                        <div className="flex items-center">
                                            <Input value={order.password || ''} readOnly className="bg-muted/50" />
                                            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(order.password || '', 'كلمة المرور')}><Copy className="w-4 h-4" /></Button>
                                        </div>
                                    </FormField>
                                    <FormField label="كود التتبع" id={`trackingId-${order.subOrderId}`}>
                                        <div className="flex items-center">
                                            <Input value={order.trackingId || ''} readOnly className="bg-muted/50" dir="ltr" />
                                            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(order.trackingId || '', 'كود التتبع')}><Copy className="w-4 h-4" /></Button>
                                        </div>
                                    </FormField>
                                </div>
                            </div>

                            {/* Operation Details */}
                            <div className="space-y-4 p-4 border rounded-lg bg-background/30">
                                <h3 className='font-semibold'>2. تفاصيل العملية</h3>
                                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <FormField label="سعر الشراء (بالدولار)" id={`purchase-price-${order.subOrderId}`}>
                                        <Input type="number" value={order.purchasePriceUSD} onChange={e => handleSubOrderChange(order.subOrderId, 'purchasePriceUSD', e.target.value === '' ? 0 : parseFloat(e.target.value))} dir="ltr" className="bg-transparent" />
                                    </FormField>
                                    <FormField label="سعر البيع (دينار)" id={`selling-price-${order.subOrderId}`}>
                                        <Input type="number" value={order.sellingPriceLYD} onChange={e => handleSubOrderChange(order.subOrderId, 'sellingPriceLYD', e.target.value === '' ? 0 : parseFloat(e.target.value))} dir="ltr" className="bg-transparent" />
                                    </FormField>
                                    <FormField label="المقدم (دينار)" id={`down-payment-${order.subOrderId}`}>
                                        <Input type="number" value={order.downPaymentLYD} onChange={e => handleSubOrderChange(order.subOrderId, 'downPaymentLYD', e.target.value === '' ? 0 : parseFloat(e.target.value))} dir="ltr" className="bg-transparent" />
                                    </FormField>
                                    <FormField label="الباقي (دينار)" id={`remaining-${order.subOrderId}`}>
                                        <Input value={calculatedTotals[index].remainingAmount.toFixed(2)} readOnly className="bg-muted/50 font-bold" dir="ltr" />
                                    </FormField>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-4 pt-4">
                                    <FormField label="طريقة السداد" id={`payment-method-${order.subOrderId}`}>
                                        <RadioGroup value={order.paymentMethod} onValueChange={val => handleSubOrderChange(order.subOrderId, 'paymentMethod', val)} className="flex gap-4 pt-2">
                                            <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="cash" id={`cash-${order.subOrderId}`} /><Label htmlFor={`cash-${order.subOrderId}`}>نقدي</Label></div>
                                            <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="card" id={`card-${order.subOrderId}`} /><Label htmlFor={`card-${order.subOrderId}`}>بطاقة مصرفية</Label></div>
                                        </RadioGroup>
                                    </FormField>
                                    <FormField label="إسناد إلى مندوب" id={`rep-${order.subOrderId}`}>
                                        <Select value={order.representativeId || 'none'} onValueChange={(val) => handleSubOrderChange(order.subOrderId, 'representativeId', val === 'none' ? null : val)}>
                                            <SelectTrigger><SelectValue placeholder="اختر مندوبًا..." /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">بدون إسناد</SelectItem>
                                                {representatives.map(rep => (
                                                    <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormField>
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                ))}

                <Button variant="secondary" className="w-full gap-2" onClick={handleAddSubOrder}>
                    <PlusCircle className="w-4 h-4" />
                    إضافة طلب فرعي آخر للفاتورة
                </Button>

                <Card className="sticky bottom-4 z-10 shadow-xl border-primary border-2 bg-card/80 backdrop-blur-lg">
                    <CardHeader>
                        <CardTitle className="text-center text-primary">الإجماليات الكلية للفاتورة المجمعة</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 text-center">
                        <div>
                            <Label className="text-sm text-muted-foreground">إجمالي قيمة البيع</Label>
                            <p className="text-3xl font-bold text-primary">{grandTotal.toFixed(2)} د.ل</p>
                        </div>
                        <div>
                            <Label className="text-sm text-muted-foreground">إجمالي صافي الربح</Label>
                            <p className={`text-3xl font-bold ${grandTotalProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{grandTotalProfit.toFixed(2)} د.ل</p>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-2 mt-8">
                    <Button variant="outline" onClick={() => router.back()}>إلغاء</Button>
                    <Button size="lg" onClick={handleSaveInvoice} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {orderId ? 'حفظ التعديلات' : 'حفظ الفاتورة المجمعة'}
                    </Button>
                </div>
            </main>
        </>
    );
};

// Helper Components
const FormField = ({ id, label, children, icon }: { id: string, label: string, children: React.ReactNode, icon?: React.ReactNode }) => (
    <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="relative">
            {children}
            {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>}
        </div>
    </div>
);

const DatePopover = ({ date, setDate }: { date?: Date | string, setDate: (date?: Date) => void }) => (
    <Popover>
        <PopoverTrigger asChild>
            <Button
                variant={"outline"}
                className={cn("w-full justify-start text-right font-normal bg-transparent", !date && "text-muted-foreground")}
            >
                <CalendarIcon className="ml-2 h-4 w-4" />
                {date ? format(new Date(date), "PPP") : <span>اختر التاريخ</span>}
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-card/80 backdrop-blur-lg" align="start">
            <Calendar mode="single" selected={date ? new Date(date) : undefined} onSelect={setDate} initialFocus />
        </PopoverContent>
    </Popover>
);

const CalculationBox = ({ label, value, isWarning, isProfit }: { label: string, value: number, isWarning?: boolean, isProfit?: boolean }) => {
    const valueColor = isWarning ? 'text-destructive' : (isProfit ? (value >= 0 ? 'text-green-600' : 'text-destructive') : 'text-foreground');
    return (
        <div className="text-center">
            <Label className="text-sm text-muted-foreground">{label}</Label>
            <p className={`text-lg font-bold ${valueColor}`}>{value.toFixed(2)}</p>
        </div>
    );
};

export default AddTemporaryBatchForm;
