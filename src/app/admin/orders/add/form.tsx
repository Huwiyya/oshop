

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Calendar as CalendarIcon, DollarSign, Weight, Home, Loader2, QrCode, Check, ChevronsUpDown, Download, Link as LinkIcon, Image as ImageIcon, X, Sparkles, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Order, User, GlobalSite, OrderStatus, SheinCard, AppSettings, TempOrder, SubOrder } from '@/lib/types';
import {
    getUsers,
    addOrder,
    updateOrder,
    getGlobalSites,
    getAvailableSheinCards,
    processCostDeduction,
    addExpense,
    getAppSettings,
    getOrderById,
    deleteOrder,
    getTempOrders,
    updateTempOrder,
    distributePayment
} from '@/lib/actions';
import { useToast } from "@/components/ui/use-toast";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/lib/supabase';


const onlineStores = [
    { value: 'shein', label: 'شي إن (Shein)' },
    { value: 'amazon', label: 'أمازون (Amazon)' },
    { value: 'alibaba', label: 'علي بابا (Alibaba)' },
    { value: 'trendyol', label: 'ترينديول (Trendyol)' },
    { value: 'other', label: 'متجر آخر (يدوي)' },
];

const AddOrderForm = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderId = searchParams.get('id');
    const { toast } = useToast();

    const [isLoadingPage, setIsLoadingPage] = useState(!!orderId);
    const [isSaving, setIsSaving] = useState(false);
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [isUsersLoading, setIsUsersLoading] = useState(true);
    const [tempOrders, setTempOrders] = useState<TempOrder[]>([]);
    const [globalSites, setGlobalSites] = useState<GlobalSite[]>([]);

    const [selectedUserId, setSelectedUserId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');

    const [purchasePriceUSD, setPurchasePriceUSD] = useState(0);
    const [costExchangeRate, setCostExchangeRate] = useState(0);
    const [shippingExchangeRate, setShippingExchangeRate] = useState(0); // Added
    const [sellingPriceLYD, setSellingPriceLYD] = useState(0);
    const [downPaymentLYD, setDownPaymentLYD] = useState(0);
    const [weightKG, setWeightKG] = useState(0);
    const [customerWeightCost, setCustomerWeightCost] = useState(0);
    const [customerWeightCostCurrency, setCustomerWeightCostCurrency] = useState<'LYD' | 'USD'>('LYD');
    const [addedCost, setAddedCost] = useState(0);
    const [addedCostCurrency, setAddedCostCurrency] = useState<'LYD' | 'USD'>('LYD');
    const [addedCostNotes, setAddedCostNotes] = useState('');

    const [pricePerKilo, setPricePerKilo] = useState(0);
    const [pricePerKiloCurrency, setPricePerKiloCurrency] = useState<'LYD' | 'USD'>('USD');

    const [selectedStore, setSelectedStore] = useState('');
    const [manualStoreName, setManualStoreName] = useState('');
    const [operationDate, setOperationDate] = useState<Date>(new Date());
    const [deliveryDate, setDeliveryDate] = useState<Date>();
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'cash_dollar'>('cash');
    const [status, setStatus] = useState<OrderStatus>('pending');
    const [productLinks, setProductLinks] = useState('');
    const [cartUrl, setCartUrl] = useState('');
    const [imageUrls, setImageUrls] = useState<string[]>([]);

    // Deduction Logic State
    const [availableCards, setAvailableCards] = useState<SheinCard[]>([]);
    const [selectedCardId, setSelectedCardId] = useState<string>('none');
    const [isAnalyzingCards, setIsAnalyzingCards] = useState<boolean>(false); // Keep for loading state if needed
    const [manualCardAmount, setManualCardAmount] = useState<number | null>(null);
    const [manualTreasuryAmount, setManualTreasuryAmount] = useState<number | null>(null);
    const [selectedUserWalletBalance, setSelectedUserWalletBalance] = useState<number>(0);
    const [isFreeShipping, setIsFreeShipping] = useState(false);

    const [isUploading, setIsUploading] = useState(false);

    const [itemDescription, setItemDescription] = useState('');
    const [trackingId, setTrackingId] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [isUserSearchOpen, setIsUserSearchOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [orderData, setOrderData] = useState<Order | null>(null);
    const [importedTempOrderId, setImportedTempOrderId] = useState<string | null>(null);



    useEffect(() => {
        const fetchInitialData = async () => {
            setIsUsersLoading(true);
            try {
                const [fetchedUsers, settings, fetchedTempOrders, fetchedSites, fetchedCards] = await Promise.all([
                    getUsers(),
                    getAppSettings(),
                    getTempOrders(),
                    getGlobalSites(),
                    getAvailableSheinCards()
                ]);
                setUsers(fetchedUsers);
                setAppSettings(settings);
                setGlobalSites(fetchedSites);
                setAvailableCards(fetchedCards);
                // Filter out temp orders that have already been converted
                setTempOrders(fetchedTempOrders.filter(o => !o.parentInvoiceId));

                if (orderId) {
                    const existingOrder = await getOrderById(orderId);
                    if (existingOrder) {
                        setOrderData(existingOrder);
                        setSelectedUserId(existingOrder.userId);
                        setCustomerName(existingOrder.customerName);
                        setCustomerPhone(existingOrder.customerPhone || '');
                        setCustomerAddress(existingOrder.customerAddress || '');
                        setPurchasePriceUSD(existingOrder.purchasePriceUSD || 0);
                        setCostExchangeRate(existingOrder.exchangeRate || settings.exchangeRate || 0);
                        // Use saved shipping rate, or existing general rate if not set (backward compat), or system default
                        setShippingExchangeRate(existingOrder.shippingExchangeRate || existingOrder.exchangeRate || settings.shippingExchangeRate || settings.exchangeRate || 0);

                        const customerCostLYD = (existingOrder.customerWeightCost || 0) * (existingOrder.weightKG || 0);
                        const addedCostInLYD = (existingOrder.addedCostUSD || 0) * (existingOrder.exchangeRate || settings.exchangeRate || 1);

                        // Set the base selling price, excluding calculated costs
                        setSellingPriceLYD(existingOrder.sellingPriceLYD - customerCostLYD - addedCostInLYD);

                        setDownPaymentLYD(existingOrder.downPaymentLYD || 0);
                        setWeightKG(existingOrder.weightKG || 0);
                        setCustomerWeightCost(existingOrder.customerWeightCost || settings.pricePerKiloLYD || 0);
                        setCustomerWeightCostCurrency(existingOrder.customerWeightCostCurrency || 'LYD');
                        setAddedCost(existingOrder.addedCostUSD || 0);
                        setAddedCostNotes(existingOrder.addedCostNotes || '');
                        setTrackingId(existingOrder.trackingId);
                        setInvoiceNumber(existingOrder.invoiceNumber);

                        setPricePerKilo(existingOrder.pricePerKilo || settings.pricePerKiloUSD || 0);
                        setPricePerKiloCurrency(existingOrder.pricePerKiloCurrency || 'USD');

                        let storeValue = existingOrder.store;
                        // Check if store is in predefined list OR in fetched global sites
                        const isPredefined = onlineStores.some(s => s.value === storeValue);
                        const isGlobalSite = fetchedSites.some(s => s.id === existingOrder.siteId); // or checks name?
                        // For legacy compatibility, we keep logic simple
                        if (!isPredefined && !isGlobalSite) storeValue = 'other';
                        else if (isGlobalSite) storeValue = existingOrder.siteId!;

                        setSelectedStore(storeValue || '');
                        if (storeValue === 'other') {
                            setManualStoreName(existingOrder.store || '');
                        }

                        setOperationDate(new Date(existingOrder.operationDate));
                        if (existingOrder.deliveryDate) setDeliveryDate(new Date(existingOrder.deliveryDate));
                        setPaymentMethod(existingOrder.paymentMethod || 'cash');
                        setStatus(existingOrder.status);
                        setProductLinks(existingOrder.productLinks);
                        setCartUrl(existingOrder.cartUrl || '');
                        setImageUrls(existingOrder.images || []);
                        setItemDescription(existingOrder.itemDescription || '');

                    } else {
                        toast({ title: "خطأ", description: "لم يتم العثور على الطلب.", variant: "destructive" });
                        router.push('/admin/orders');
                    }
                } else { // Only set defaults for new orders
                    setPricePerKilo(settings.pricePerKiloUSD ?? 0);
                    setPricePerKiloCurrency('USD');
                    setCustomerWeightCost(settings.customerPricePerKiloUSD ?? 0);
                    setCustomerWeightCostCurrency('USD');
                    setCostExchangeRate(settings.exchangeRate || 0);
                    setShippingExchangeRate(settings.shippingExchangeRate || settings.exchangeRate || 0); // Default to shipping rate or general rate
                }

            } catch (error) {
                console.error("Failed to fetch initial data:", error);
                toast({
                    title: "خطأ",
                    description: "فشل في تحميل البيانات الأولية.",
                    variant: "destructive",
                });
            } finally {
                setIsUsersLoading(false);
                setIsLoadingPage(false);
            }
        };
        fetchInitialData();
    }, [orderId, router, toast]);

    const handleUserSelect = (userId: string) => {
        const selectedUser = users.find(u => u.id === userId);
        if (selectedUser) {
            setSelectedUserId(userId);
            setCustomerName(selectedUser.name);
            setCustomerPhone(selectedUser.phone);
            setCustomerAddress(selectedUser.address || '');
            setSelectedUserWalletBalance(selectedUser.walletBalance || 0);
        }
        setIsUserSearchOpen(false);
    };

    const handleImportTempOrder = (tempOrder: TempOrder) => {
        setImportedTempOrderId(tempOrder.id);
        const totalPurchaseUSD = tempOrder.subOrders.reduce((sum, so) => sum + so.purchasePriceUSD, 0);
        const totalSellingLYD = tempOrder.totalAmount;

        const totalPaidAmount = tempOrder.totalAmount - tempOrder.remainingAmount;

        const totalWeightKG = tempOrder.subOrders.reduce((sum, so) => sum + so.weightKG, 0);
        const allLinks = tempOrder.subOrders.map(so => so.productLinks).filter(Boolean).join('\\n');
        const customerNames = tempOrder.subOrders.map(so => so.customerName).join(', ');
        const description = `فاتورة مجمعة للعملاء: ${customerNames}`;
        const firstStore = tempOrder.subOrders.length > 0 ? tempOrder.subOrders[0].selectedStore : '';

        // If in edit mode, merge data. Otherwise, set it.
        if (orderId) {
            setPurchasePriceUSD(prev => prev + totalPurchaseUSD);
            setSellingPriceLYD(prev => prev + totalSellingLYD);
            setDownPaymentLYD(prev => prev + totalPaidAmount); // Use total paid amount
            setWeightKG(prev => prev + totalWeightKG);
            setProductLinks(prev => prev ? `${prev}\\n${allLinks}` : allLinks);
            setItemDescription(prev => prev ? `${prev} | ${description}` : description);
        } else {
            if (tempOrder.assignedUserId) {
                handleUserSelect(tempOrder.assignedUserId);
            } else {
                setCustomerName(tempOrder.invoiceName);
                setCustomerPhone('');
                setCustomerAddress('');
            }
            setPurchasePriceUSD(totalPurchaseUSD);
            setSellingPriceLYD(totalSellingLYD);
            setDownPaymentLYD(totalPaidAmount);
            setWeightKG(totalWeightKG);
            setProductLinks(allLinks);
            setItemDescription(description);

            const storeValue = onlineStores.find(s => s.value === firstStore) ? firstStore : 'other';
            setSelectedStore(storeValue);
            if (storeValue === 'other' && tempOrder.subOrders.length > 0) {
                setManualStoreName(tempOrder.subOrders[0].manualStoreName);
            }
        }

        setIsImportDialogOpen(false);
        toast({ title: "تم الاستيراد", description: `تم استيراد ودمج بيانات الفاتورة: ${tempOrder.invoiceName}` });
    };

    const purchaseCostLYD = useMemo(() => purchasePriceUSD * costExchangeRate, [purchasePriceUSD, costExchangeRate]);
    const shippingCostLYD = useMemo(() => {
        if (pricePerKiloCurrency === 'USD') {
            return weightKG * pricePerKilo * (shippingExchangeRate || appSettings?.exchangeRate || 1);
        }
        return weightKG * pricePerKilo;
    }, [weightKG, pricePerKilo, pricePerKiloCurrency, appSettings, shippingExchangeRate]);

    const customerWeightCostLYD = useMemo(() => {
        const costPerKilo = customerWeightCost;
        if (customerWeightCostCurrency === 'USD') {
            return (costPerKilo * weightKG) * (shippingExchangeRate || appSettings?.exchangeRate || 1);
        }
        return costPerKilo * weightKG;
    }, [customerWeightCost, weightKG, customerWeightCostCurrency, appSettings, shippingExchangeRate]);

    const addedCostLYD = useMemo(() => {
        if (addedCostCurrency === 'USD') {
            return addedCost * (costExchangeRate || appSettings?.exchangeRate || 1); // Added cost usually follows purchase rate or specified rate? Assuming cost rate.
        }
        return addedCost;
    }, [addedCost, addedCostCurrency, appSettings, costExchangeRate]);

    const finalSellingPrice = useMemo(() => {
        const basePrice = sellingPriceLYD + addedCostLYD;
        // إضافة تكلفة الشحن فقط إذا لم يكن مجانياً
        const shippingCost = isFreeShipping ? 0 : customerWeightCostLYD;
        return basePrice + shippingCost;
    }, [sellingPriceLYD, customerWeightCostLYD, addedCostLYD, isFreeShipping]);
    const remainingAmount = useMemo(() => finalSellingPrice - downPaymentLYD, [finalSellingPrice, downPaymentLYD]);

    // حساب الدفع المختلط (محفظة + نقدي)
    const walletPaymentAmount = useMemo(() => {
        if (!selectedUserId || downPaymentLYD <= 0) return 0;
        return Math.min(selectedUserWalletBalance, downPaymentLYD);
    }, [selectedUserWalletBalance, downPaymentLYD, selectedUserId]);

    const cashPaymentAmount = useMemo(() => {
        return Math.max(0, downPaymentLYD - walletPaymentAmount);
    }, [downPaymentLYD, walletPaymentAmount]);
    const netProfit = useMemo(() => finalSellingPrice - purchaseCostLYD - shippingCostLYD, [finalSellingPrice, purchaseCostLYD, shippingCostLYD]);



    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        setIsUploading(true);
        const files = Array.from(e.target.files);
        const newUrls: string[] = [];

        for (const file of files) {
            try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('order-images')
                    .upload(filePath, file);

                if (uploadError) {
                    throw uploadError;
                }

                const { data } = supabase.storage.from('order-images').getPublicUrl(filePath);
                newUrls.push(data.publicUrl);
            } catch (error) {
                console.error('Upload failed:', error);
                toast({ title: 'فشل الرفع', description: `فشل رفع الملف ${file.name}`, variant: 'destructive' });
            }
        }
        setImageUrls(prev => [...prev, ...newUrls]);
        setIsUploading(false);
    };

    const removeImage = (index: number) => {
        setImageUrls(prev => prev.filter((_, i) => i !== index));
    };



    const handleSaveOrder = async () => {
        setIsSaving(true);
        if (!selectedUserId) {
            toast({ title: "خطأ", description: "الرجاء اختيار مستخدم مسجل أولاً.", variant: "destructive" });
            setIsSaving(false);
            return;
        }
        if (!operationDate) {
            toast({ title: "خطأ", description: "الرجاء تحديد تاريخ العملية.", variant: "destructive" });
            setIsSaving(false);
            return;
        }

        const commonOrderData = {
            userId: selectedUserId,
            customerName: customerName,
            customerPhone: customerPhone,
            customerAddress: customerAddress,
            operationDate: operationDate.toISOString(),
            sellingPriceLYD: finalSellingPrice,
            remainingAmount: remainingAmount,
            status: status,
            productLinks: productLinks,
            purchasePriceUSD,
            downPaymentLYD,
            weightKG,
            customerWeightCost: customerWeightCost,
            customerWeightCostCurrency: customerWeightCostCurrency,
            addedCostUSD: addedCost,
            addedCostNotes: addedCostNotes,
            pricePerKilo: pricePerKilo,
            pricePerKiloCurrency: pricePerKiloCurrency,

            paymentMethod,
            deliveryDate: deliveryDate?.toISOString(),
            itemDescription,
            shippingCostLYD: shippingCostLYD,
            trackingId: trackingId,
            images: imageUrls,
            cartUrl: cartUrl,
            siteId: globalSites.find(s => s.id === selectedStore)?.id,
            store: selectedStore === 'other' ? manualStoreName : (globalSites.find(s => s.id === selectedStore)?.name || selectedStore),

            // ✅ تم إضافة isFreeShipping لقاعدة البيانات
            isFreeShipping,
        };

        try {
            let savedOrder: Order | null = null;
            if (orderId && orderData) {
                const updateData: Partial<Omit<Order, 'id'>> = {
                    ...commonOrderData,
                    exchangeRate: costExchangeRate,
                    shippingExchangeRate: shippingExchangeRate, // Added
                    representativeId: orderData.representativeId,
                    representativeName: orderData.representativeName,
                    collectedAmount: orderData.collectedAmount,
                };
                await updateOrder(orderId, updateData);
                savedOrder = { ...orderData, ...updateData, id: orderId };
                toast({ title: "تم التحديث بنجاح", description: "تم تحديث بيانات الطلب." });

            } else {
                const newOrderData: Omit<Order, 'id' | 'invoiceNumber'> = {
                    ...commonOrderData,
                    exchangeRate: costExchangeRate,
                    shippingExchangeRate: shippingExchangeRate, // Added
                    representativeId: null,
                    representativeName: null,
                    collectedAmount: 0,
                };

                savedOrder = await addOrder(newOrderData);

                if (!savedOrder) {
                    throw new Error("Failed to add order in the form.");
                }

                // --- HYBRID DEDUCTION LOGIC ---
                try {
                    await processCostDeduction(
                        savedOrder.id,
                        savedOrder.invoiceNumber,
                        purchasePriceUSD,
                        selectedCardId,
                        manualCardAmount ?? undefined,
                        manualTreasuryAmount ?? undefined
                    );
                } catch (deductError: any) {
                    console.error("Deduction Error:", deductError);

                    // حذف الطلب المحفوظ لأن الخصم فشل
                    try {
                        await deleteOrder(savedOrder.id);
                    } catch (deleteError) {
                        console.error("Failed to delete order:", deleteError);
                    }

                    toast({
                        title: "خطأ في الخصم",
                        description: deductError.message || "فشل خصم التكلفة. تم إلغاء الطلب.",
                        variant: "destructive"
                    });

                    setIsSaving(false);
                    return; // إيقاف العملية
                }
                // -----------------------------

                // ملاحظة: distributePayment يُستدعى تلقائياً داخل addOrder
                // لا حاجة لاستدعائه مرة أخرى هنا لتجنب التكرار

                toast({ title: "تم الحفظ بنجاح", description: "تم تسجيل العملية الجديدة في النظام." });
            }

            if (importedTempOrderId && savedOrder) {
                await updateTempOrder(importedTempOrderId, { parentInvoiceId: savedOrder.id });
            }


            router.push('/admin/orders');

        } catch (error: any) {
            console.error("Failed to save order:", error);
            toast({
                title: "حدث خطأ",
                description: error.message || "فشل حفظ العملية.",
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
        )
    }

    return (
        <div className='p-4 sm:p-6'>
            <div className="flex items-center gap-4 mb-6">
                <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="w-6 h-6" />
                </Button>
                <h1 className="text-2xl font-bold">{orderId ? `تعديل العملية | ${invoiceNumber}` : 'تسجيل عملية جديدة'}</h1>
            </div>

            <p className="text-muted-foreground mb-6">املأ الحقول التالية لتسجيل عملية بيع وشحن جديدة في النظام.</p>
            <div className="space-y-8">

                <FormSection title="بيانات العميل">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="اختيار مستخدم مسجل" id="select-user">
                            <Popover open={isUserSearchOpen} onOpenChange={setIsUserSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isUserSearchOpen}
                                        className="w-full justify-between"
                                        disabled={isUsersLoading || !!orderId}
                                    >
                                        {isUsersLoading
                                            ? "جاري تحميل المستخدمين..."
                                            : selectedUserId
                                                ? (() => {
                                                    const u = users.find((user) => user.id === selectedUserId);
                                                    return u ? `${u.name} (${u.username})` : "ابحث عن مستخدم...";
                                                })()
                                                : "ابحث عن مستخدم..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder="ابحث بالاسم، اسم المستخدم، أو الهاتف..." />
                                        <CommandList>
                                            <CommandEmpty>لم يتم العثور على مستخدم.</CommandEmpty>
                                            <CommandGroup>
                                                {users.map((user) => (
                                                    <CommandItem
                                                        key={user.id}
                                                        value={`${user.name} ${user.username} ${user.phone}`}
                                                        onSelect={() => handleUserSelect(user.id)}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                selectedUserId === user.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {user.name} ({user.username})
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </FormField>

                        <div className="space-y-2">
                            <Label>استيراد بيانات (اختياري)</Label>
                            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="w-full gap-2">
                                        <Download className="w-4 h-4" />
                                        استيراد من فاتورة مجمعة
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl" dir="rtl">
                                    <DialogHeader>
                                        <DialogTitle>استيراد فاتورة مجمعة</DialogTitle>
                                        <DialogDescription>
                                            اختر الفاتورة المجمعة التي تريد استيراد بياناتها ودمجها مع الطلب الحالي.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="max-h-[60vh] overflow-y-auto p-1">
                                        {tempOrders.map(tOrder => (
                                            <Button
                                                key={tOrder.id}
                                                variant="ghost"
                                                className="w-full justify-start text-right h-auto flex-col items-start"
                                                onClick={() => handleImportTempOrder(tOrder)}
                                            >
                                                <span className="font-bold">{tOrder.invoiceName}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    الإجمالي: {tOrder.totalAmount.toFixed(2)} د.ل | العملاء: {tOrder.subOrders.length}
                                                </span>
                                            </Button>
                                        ))}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 pt-4">
                        <FormField label="اسم العميل" id="customer-name">
                            <Input id="customer-name" placeholder="الاسم الكامل للعميل" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                        </FormField>
                        <FormField label="رقم الهاتف" id="customer-phone">
                            <Input
                                id="customer-phone"
                                placeholder="09xxxxxxxx"
                                dir="ltr"
                                value={customerPhone}
                                onChange={e => setCustomerPhone(e.target.value)}
                                onFocus={(e) => {
                                    if (e.target.value.startsWith('0')) {
                                        setCustomerPhone(e.target.value.substring(1));
                                    }
                                }}
                            />
                        </FormField>
                    </div>
                    <div className="pt-4">
                        <FormField label="العنوان" id="customer-address" icon={<Home className="w-4 h-4 text-muted-foreground" />}>
                            <Textarea id="customer-address" placeholder="اذكر المدينة والشارع وأقرب نقطة دالة" rows={2} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
                        </FormField>
                    </div>
                </FormSection>

                <FormSection title="تفاصيل العملية والأسعار">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <FormField label="سعر الشراء (بالدولار)" id="purchase-price-usd">
                            <Input type="number" id="purchase-price-usd" value={purchasePriceUSD || ''} onChange={e => setPurchasePriceUSD(e.target.value === '' ? 0 : parseFloat(e.target.value))} dir="ltr" />
                        </FormField>
                        <FormField label="سعر صرف التكلفة" id="cost-exchange-rate">
                            <Input type="number" id="cost-exchange-rate" value={costExchangeRate || ''} onChange={e => setCostExchangeRate(e.target.value === '' ? 0 : parseFloat(e.target.value))} dir="ltr" />
                        </FormField>
                        <FormField label="سعر صرف الشحن" id="shipping-exchange-rate">
                            <Input type="number" id="shipping-exchange-rate" value={shippingExchangeRate || ''} onChange={e => setShippingExchangeRate(e.target.value === '' ? 0 : parseFloat(e.target.value))} dir="ltr" />
                        </FormField>
                        <FormField label="سعر البيع الأساسي (دينار)" id="selling-price-lyd">
                            <Input type="number" id="selling-price-lyd" value={sellingPriceLYD || ''} onChange={e => setSellingPriceLYD(e.target.value === '' ? 0 : parseFloat(e.target.value))} dir="ltr" />
                        </FormField>
                        <div className="space-y-2">
                            <FormField label="المقدم (دينار)" id="down-payment-lyd">
                                <Input type="number" id="down-payment-lyd" value={downPaymentLYD || ''} onChange={e => setDownPaymentLYD(e.target.value === '' ? 0 : parseFloat(e.target.value))} dir="ltr" />
                            </FormField>
                            {selectedUserId && downPaymentLYD > 0 && walletPaymentAmount > 0 && (
                                <div className="text-sm space-y-1 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                    <div className="font-semibold text-emerald-700 dark:text-emerald-400 mb-2">توزيع المبلغ المدفوع:</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">من المحفظة:</span>
                                        <span className="font-bold text-emerald-600">{walletPaymentAmount.toFixed(2)} د.ل</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">{paymentMethod === 'cash' ? 'نقدي' : paymentMethod === 'card' ? 'بطاقة' : 'دولار'}:</span>
                                        <span className="font-bold text-blue-600">{cashPaymentAmount.toFixed(2)} د.ل</span>
                                    </div>
                                    <div className="border-t border-emerald-200 dark:border-emerald-800 pt-1 mt-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold">الإجمالي:</span>
                                            <span className="font-bold">{downPaymentLYD.toFixed(2)} د.ل</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 pt-4 items-start">
                        <div className="space-y-2">
                            <Label>التكلفة الإضافية</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    value={addedCost || ''}
                                    onChange={e => setAddedCost(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                    dir="ltr"
                                    className="w-full"
                                />
                                <RadioGroup value={addedCostCurrency} onValueChange={(val) => setAddedCostCurrency(val as 'LYD' | 'USD')} className="flex gap-2 items-center border p-2 rounded-md bg-background">
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="LYD" id="lyd-added" />
                                        <Label htmlFor="lyd-added">د.ل</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="USD" id="usd-added" />
                                        <Label htmlFor="usd-added">$</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>
                        <FormField label="ملاحظات التكلفة الإضافية" id="added-cost-notes">
                            <Input id="added-cost-notes" value={addedCostNotes} onChange={e => setAddedCostNotes(e.target.value)} placeholder="مثال: رسوم جمركية" />
                        </FormField>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                        <FormField label="طريقة السداد" id="payment-method">
                            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'cash' | 'card' | 'cash_dollar')} className="flex gap-4 pt-2 flex-wrap">
                                <div className="flex items-center space-x-2 space-x-reverse">
                                    <RadioGroupItem value="cash" id="cash" />
                                    <Label htmlFor="cash">نقدي</Label>
                                </div>
                                <div className="flex items-center space-x-2 space-x-reverse">
                                    <RadioGroupItem value="card" id="card" />
                                    <Label htmlFor="card">بطاقة مصرفية</Label>
                                </div>
                                <div className="flex items-center space-x-2 space-x-reverse">
                                    <RadioGroupItem value="cash_dollar" id="cash_dollar" />
                                    <Label htmlFor="cash_dollar">دولار كاش</Label>
                                </div>
                            </RadioGroup>
                            {selectedUserId && selectedUserWalletBalance > 0 && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    💡 سيتم استخدام رصيد المحفظة ({selectedUserWalletBalance.toFixed(2)} د.ل) تلقائياً أولاً
                                </p>
                            )}
                        </FormField>
                        <FormField label="حالة الشحنة" id="shipment-status">
                            <Select value={status} onValueChange={(value: OrderStatus) => setStatus(value)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر الحالة" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">قيد التجهيز</SelectItem>
                                    <SelectItem value="processed">تم التنفيذ</SelectItem>
                                    <SelectItem value="ready">تم التجهيز</SelectItem>
                                    <SelectItem value="shipped">تم الشحن</SelectItem>
                                    <SelectItem value="arrived_dubai">وصلت إلى دبي</SelectItem>
                                    <SelectItem value="arrived_benghazi">وصلت إلى بنغازي</SelectItem>
                                    <SelectItem value="arrived_tobruk">وصلت إلى طبرق</SelectItem>
                                    <SelectItem value="out_for_delivery">مع المندوب</SelectItem>
                                    <SelectItem value="delivered">تم التسليم</SelectItem>
                                    <SelectItem value="cancelled">ملغي</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormField>
                        <FormField label={orderId ? "كود التتبع" : "كود التتبع (اختياري)"} id="tracking-id-input" icon={<QrCode className="w-4 h-4 text-muted-foreground" />}>
                            <Input
                                value={trackingId}
                                onChange={e => setTrackingId(e.target.value.toUpperCase())}
                                placeholder={orderId ? "" : "فارغ لتوليد كود تلقائي"}
                                dir="ltr"
                            />
                        </FormField>
                    </div>
                </FormSection>

                <FormSection title="المتجر الإلكتروني وروابط المنتجات">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <FormField label="المتجر الإلكتروني" id="online-store">
                            <Select value={selectedStore} onValueChange={setSelectedStore}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر المتجر" />
                                </SelectTrigger>
                                <SelectContent>
                                    {onlineStores.map(store => (
                                        <SelectItem key={store.value} value={store.value}>{store.label}</SelectItem>
                                    ))}
                                    {globalSites.length > 0 && <div className="border-t my-1"></div>}
                                    {globalSites.map(site => (
                                        <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </FormField>
                        {selectedStore === 'other' && (
                            <FormField label="اسم المتجر اليدوي" id="manual-store-name">
                                <Input value={manualStoreName} onChange={e => setManualStoreName(e.target.value)} placeholder="أدخل اسم المتجر" />
                            </FormField>
                        )}
                        <FormField label="رابط السلة (Cart URL)" id="cart-url" icon={<LinkIcon className="w-4 h-4 text-muted-foreground" />}>
                            <Input value={cartUrl} onChange={e => setCartUrl(e.target.value)} placeholder="رابط سلة الشراء المباشر" dir="ltr" />
                        </FormField>
                    </div>
                    <div className="pt-4">
                        <FormField label="صورة الطلب / السلة" id="order-images">
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <Input
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        className="hidden"
                                        id="image-upload"
                                        onChange={handleImageUpload}
                                        disabled={isUploading}
                                    />
                                    <Label htmlFor="image-upload" className={`flex cursor-pointer items-center justify-center rounded-md border border-dashed p-4 hover:bg-muted/50 w-full sm:w-auto ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        {isUploading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                جاري الرفع...
                                            </>
                                        ) : (
                                            <>
                                                <ImageIcon className="mr-2 h-4 w-4" />
                                                رفع صور
                                            </>
                                        )}
                                    </Label>
                                </div>
                                {imageUrls.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        {imageUrls.map((url, index) => (
                                            <div key={index} className="relative group">
                                                <img src={url} alt={`Order image ${index + 1}`} className="w-full h-24 object-cover rounded-md border" />
                                                <button
                                                    onClick={() => removeImage(index)}
                                                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    type="button"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </FormField>
                    </div>
                    <div className="pt-4">
                        <FormField label="روابط المنتجات" id="product-links">
                            <Textarea value={productLinks} onChange={(e) => setProductLinks(e.target.value)} id="product-links" placeholder="ضع كل رابط في سطر مستقل" rows={4} dir="ltr" />
                        </FormField>
                    </div>
                </FormSection>

                <FormSection title="خصم التكلفة (Hybrid: Shein + Treasury)">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>استخدام بطاقة Shein (اختياري)</Label>
                            <Select value={selectedCardId} onValueChange={(val) => {
                                setSelectedCardId(val);
                                // Reset manuals to auto-calc when card changes
                                setManualCardAmount(null);
                                setManualTreasuryAmount(null);
                            }}>
                                <SelectTrigger className="w-full text-left font-mono" dir="ltr">
                                    <SelectValue placeholder="اختر بطاقة..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">بدون بطاقة (خصم كامل من الخزينة)</SelectItem>
                                    {availableCards.map(card => (
                                        <SelectItem key={card.id} value={card.id}>
                                            {card.code} | Bal: {(card.remainingValue ?? card.value).toFixed(2)}$
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Manual Amounts Inputs */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>الخصم من البطاقة ($)</Label>
                                <Input
                                    type="number"
                                    dir="ltr"
                                    value={(() => {
                                        // If manual is set, use it. Else calculate auto default for visual
                                        if (manualCardAmount !== null) return manualCardAmount;
                                        // Auto Calc
                                        const card = availableCards.find(c => c.id === selectedCardId);
                                        if (!card || selectedCardId === 'none') return 0;
                                        const balance = card.remainingValue ?? card.value ?? 0;
                                        return Math.min(balance, purchasePriceUSD);
                                    })()}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setManualCardAmount(isNaN(val) ? 0 : val);
                                    }}
                                    disabled={selectedCardId === 'none'}
                                    className={manualCardAmount !== null ? "border-orange-500" : ""}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>الخصم من الخزينة USDT ($)</Label>
                                <Input
                                    type="number"
                                    dir="ltr"
                                    value={(() => {
                                        // If manual is set, use it. Else calculate auto default
                                        if (manualTreasuryAmount !== null) return manualTreasuryAmount;
                                        // Auto Calc
                                        const card = availableCards.find(c => c.id === selectedCardId);
                                        let fromCard = 0;
                                        if (card && selectedCardId !== 'none') {
                                            // If card amount is manually set, respect it to calc remainder
                                            if (manualCardAmount !== null) {
                                                const balance = card.remainingValue ?? card.value ?? 0;
                                                fromCard = Math.min(balance, manualCardAmount);
                                            } else {
                                                const balance = card.remainingValue ?? card.value ?? 0;
                                                fromCard = Math.min(balance, purchasePriceUSD);
                                            }
                                        }
                                        return Math.max(0, purchasePriceUSD - fromCard);
                                    })()}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setManualTreasuryAmount(isNaN(val) ? 0 : val);
                                    }}
                                    className={manualTreasuryAmount !== null ? "border-orange-500" : ""}
                                />
                            </div>
                        </div>

                        {/* Breakdown Display */}
                        <div className="bg-muted/30 p-3 rounded-md text-sm space-y-1 font-mono" dir="ltr">
                            <div className="flex justify-between">
                                <span>Total Cost:</span>
                                <span className="font-bold">{purchasePriceUSD.toFixed(2)} $</span>
                            </div>
                            {selectedCardId !== 'none' && (() => {
                                const card = availableCards.find(c => c.id === selectedCardId);
                                const balance = card?.remainingValue ?? card?.value ?? 0;
                                let deduct = 0;
                                if (manualCardAmount !== null) {
                                    deduct = Math.min(balance, manualCardAmount);
                                } else {
                                    deduct = Math.min(balance, purchasePriceUSD);
                                }

                                return (
                                    <div className="flex justify-between text-green-600">
                                        <span>From Card ({card?.code.substring(0, 4)}...):</span>
                                        <span>- {deduct.toFixed(2)} $</span>
                                    </div>
                                );
                            })()}
                            <div className="flex justify-between text-blue-600 border-t pt-1 mt-1">
                                <span>From Treasury:</span>
                                <span className="font-bold">
                                    {(() => {
                                        if (manualTreasuryAmount !== null) return manualTreasuryAmount.toFixed(2);

                                        const card = availableCards.find(c => c.id === selectedCardId);
                                        let fromCard = 0;
                                        if (card && selectedCardId !== 'none') {
                                            if (manualCardAmount !== null) {
                                                fromCard = Math.min(card.remainingValue ?? card.value, manualCardAmount);
                                            } else {
                                                fromCard = Math.min(card.remainingValue ?? card.value, purchasePriceUSD);
                                            }
                                        }
                                        const fromTreasury = Math.max(0, purchasePriceUSD - fromCard);
                                        return fromTreasury.toFixed(2);
                                    })()} $
                                </span>
                            </div>
                            {(manualCardAmount !== null || manualTreasuryAmount !== null) && (
                                <div className="text-xs text-orange-600 mt-2 text-right" dir="rtl">
                                    * تم تعيين قيم يدوية للخصم.
                                    <Button
                                        variant="link"
                                        className="h-auto p-0 mr-1 text-xs"
                                        onClick={() => {
                                            setManualCardAmount(null);
                                            setManualTreasuryAmount(null);
                                        }}
                                    >
                                        إعادة للوضع التلقائي
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </FormSection>

                <FormSection title="التواريخ">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <FormField label="تاريخ العملية" id="operation-date">
                            <DatePopover date={operationDate} setDate={(date) => date && setOperationDate(date)} />
                        </FormField>
                        <FormField label="موعد التسليم المتوقع" id="delivery-date">
                            <DatePopover date={deliveryDate} setDate={setDeliveryDate} />
                        </FormField>
                    </div>
                </FormSection>

                <FormSection title="بيانات وتكاليف الشحن">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6">
                        <FormField label="وصف السلعة" id="item-description">
                            <Input value={itemDescription} onChange={e => setItemDescription(e.target.value)} id="item-description" placeholder="وصف مختصر للشحنة" />
                        </FormField>
                        <FormField label="الوزن (كغ)" id="weight-kg" icon={<Weight className="w-4 h-4 text-muted-foreground" />}>
                            <Input type="number" id="weight-kg" value={weightKG || ''} onChange={e => setWeightKG(e.target.value === '' ? 0 : parseFloat(e.target.value))} dir="ltr" />
                        </FormField>
                        <div className="space-y-2">
                            <Label>سعر الكيلو (للشركة)</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    value={pricePerKilo || ''}
                                    onChange={e => setPricePerKilo(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                    dir="ltr"
                                    className="w-full"
                                />
                                <RadioGroup value={pricePerKiloCurrency} onValueChange={(val) => setPricePerKiloCurrency(val as 'LYD' | 'USD')} className="flex gap-2 items-center border p-2 rounded-md bg-background">
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="LYD" id="lyd-kilo" />
                                        <Label htmlFor="lyd-kilo">د.ل</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="USD" id="usd-kilo" />
                                        <Label htmlFor="usd-kilo">$</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>سعر الكيلو (للزبون)</Label>
                                <Button
                                    type="button"
                                    variant={isFreeShipping ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setIsFreeShipping(!isFreeShipping)}
                                    className="h-7 text-xs"
                                >
                                    {isFreeShipping ? "✅" : "🎁"} شحن مجاني
                                </Button>
                            </div>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    value={customerWeightCost || ''}
                                    onChange={e => setCustomerWeightCost(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                    dir="ltr"
                                    className="w-full"
                                    disabled={isFreeShipping}
                                />
                                <RadioGroup value={customerWeightCostCurrency} onValueChange={(val) => setCustomerWeightCostCurrency(val as 'LYD' | 'USD')} className="flex gap-2 items-center border p-2 rounded-md bg-background">
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="LYD" id="lyd-customer" />
                                        <Label htmlFor="lyd-customer">د.ل</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="USD" id="usd-customer" />
                                        <Label htmlFor="usd-customer">$</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>
                    </div>
                </FormSection>

                <FormSection title="الحسابات الآلية">
                    <div className='text-xs text-muted-foreground mb-2'>سعر الصرف المستخدم في الحسابات: 1 دولار = {costExchangeRate.toFixed(2)} دينار</div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 p-4 bg-muted/30 rounded-lg border">
                        <CalculationBox label="تكلفة الشحن (دينار)" value={shippingCostLYD} />
                        <CalculationBox label="تكلفة الشراء (دينار)" value={purchaseCostLYD} />
                        <CalculationBox label="إجمالي البيع" value={finalSellingPrice} />
                        <CalculationBox label="المبلغ المتبقي" value={remainingAmount} isWarning={remainingAmount > 0} />
                        <CalculationBox label="صافي الربح" value={netProfit} isProfit={true} />
                    </div>
                </FormSection>
            </div>

            <div className="flex justify-end gap-2 mt-8">
                <Button variant="outline" onClick={() => router.back()}>إلغاء</Button>
                <Button onClick={handleSaveOrder} disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                    {orderId ? 'حفظ التعديلات' : 'حفظ العملية'}
                </Button>
            </div>
        </div>
    );
};

// Helper Components
const FormSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <Card>
        <CardHeader>
            <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
            {children}
        </CardContent>
    </Card>
);

const FormField = ({ id, label, children, icon }: { id: string, label: string, children: React.ReactNode, icon?: React.ReactNode }) => (
    <div className="space-y-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="relative">
            {children}
            {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2">{icon}</div>}
        </div>
    </div>
);

const DatePopover = ({ date, setDate }: { date?: Date, setDate: (date?: Date) => void }) => (
    <Popover>
        <PopoverTrigger asChild>
            <Button
                variant={"outline"}
                className={cn(
                    "w-full justify-start text-right font-normal",
                    !date && "text-muted-foreground"
                )}
            >
                <CalendarIcon className="ml-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>اختر التاريخ</span>}
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
            <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
            />
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
}

export default AddOrderForm;



