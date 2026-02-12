'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    ArrowLeft,
    Trash2,
    Plus,
    ShoppingCart,
    Truck,
    CheckCircle,
    Info,
    Hash,
    List,
    Boxes,
    FileText,
    Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState, useMemo, useEffect } from 'react';
import { getAppSettings } from '@/lib/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { predefinedItems } from '@/lib/items';
import type { AppSettings } from '@/lib/types';


// --- Helper Components ---
const IconWrapper = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <div className={`flex h-10 w-10 items-center justify-center rounded-full ${className}`}>
        {children}
    </div>
);

const SectionTitle = ({ icon, title }: { icon: React.ReactNode, title: string }) => (
    <div className="flex items-center gap-3 mb-4">
        <IconWrapper className="bg-primary/10 text-primary">
            {icon}
        </IconWrapper>
        <h2 className="text-xl font-bold">{title}</h2>
    </div>
);

const SummaryRow = ({ icon, label, value, isFinal = false }: { icon: React.ReactNode, label: string, value: string, isFinal?: boolean }) => (
    <div className={`flex items-center justify-between ${isFinal ? 'text-lg font-bold text-primary mt-2 pt-2 border-t' : 'text-md'}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <span>{label}</span>
        </div>
        <span className={isFinal ? 'text-primary' : 'text-foreground font-semibold'}>{value}</span>
    </div>
);


// --- Main Component ---
interface ShipmentItem {
    id: number;
    itemId: string; // references key from predefinedItems
    quantity: number;
}


const CalculateShipmentPage = () => {
    const router = useRouter();
    const [basketPriceUSD, setBasketPriceUSD] = useState<number>(0);
    const [items, setItems] = useState<ShipmentItem[]>([
        { id: 1, itemId: 'tshirt', quantity: 1 }
    ]);
    const [settings, setSettings] = useState<AppSettings | null>(null);

    useEffect(() => {
        const fetchRate = async () => {
            const fetchedSettings = await getAppSettings();
            setSettings(fetchedSettings);
        };
        fetchRate();
    }, []);

    const exchangeRate = settings?.exchangeRate ?? 1;
    const pricePerKiloLYD = settings?.pricePerKiloLYD ?? 0;

    const basketPriceLYD = useMemo(() => {
        if (exchangeRate === 0) return 0;
        return basketPriceUSD * exchangeRate;
    }, [basketPriceUSD, exchangeRate]);

    const totalShippingCost = useMemo(() => {
        return items.reduce((total, item) => {
            const itemData = predefinedItems[item.itemId];
            if (!itemData) return total;
            const itemShippingCost = itemData.weight * item.quantity * pricePerKiloLYD;
            return total + itemShippingCost;
        }, 0);
    }, [items, pricePerKiloLYD]);

    const finalTotal = useMemo(() => {
        return basketPriceLYD + totalShippingCost;
    }, [basketPriceLYD, totalShippingCost]);

    const handleAddItem = () => {
        const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
        setItems([...items, { id: newId, itemId: 'tshirt', quantity: 1 }]);
    };

    const handleRemoveItem = (id: number) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const handleItemChange = (id: number, field: keyof Omit<ShipmentItem, 'id'>, value: string | number) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    if (settings === null) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-secondary/30" dir="rtl">
            <header className="bg-card p-4 flex justify-between items-center shadow-sm sticky top-0 z-10">
                <div className="text-center flex-grow">
                    <h1 className="text-2xl font-bold">حاسبة تكلفة الطلبية</h1>
                    <p className="text-sm text-muted-foreground">احسب تكلفة شحنتك ومنتجاتك بسهولة</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="w-6 h-6" />
                </Button>
            </header>

            <main className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
                <Card className="shadow-lg border-t-4 border-primary">
                    <CardContent className="p-6 space-y-8">

                        {/* Basket Price Section */}
                        <div>
                            <SectionTitle icon={<ShoppingCart size={22} />} title="سعر السلة" />
                            <div className="text-xs text-muted-foreground mb-2">
                                سعر الصرف: 1$ = {exchangeRate.toFixed(2)} د.ل | سعر الكيلو: 1 كجم = {pricePerKiloLYD.toFixed(2)} د.ل
                            </div>
                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex flex-col md:flex-row items-center gap-4">
                                <div className="flex-1 w-full space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                                        <FileText size={16} /> قيمة الطلبية بالدولار
                                        <span className="text-xs text-primary flex items-center gap-1">(<Info size={12} /> هام جدا: اضغط هنا)</span>
                                    </label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            placeholder="0.00"
                                            dir="ltr"
                                            className="text-lg h-12 pr-8 bg-card"
                                            value={basketPriceUSD || ''}
                                            onChange={(e) => setBasketPriceUSD(parseFloat(e.target.value) || 0)}
                                        />
                                        <span className="absolute top-1/2 -translate-y-1/2 right-3 font-bold text-muted-foreground">$</span>
                                    </div>
                                </div>
                                <div className="text-3xl font-bold text-primary opacity-50 hidden md:block">=</div>
                                <div className="flex-1 w-full space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                                        <Boxes size={16} /> القيمة بالدينار الليبي
                                    </label>
                                    <div className="relative">
                                        <Input
                                            readOnly
                                            dir="ltr"
                                            value={basketPriceLYD.toFixed(2)}
                                            className="text-lg h-12 pl-10 bg-primary/10 text-primary font-bold"
                                        />
                                        <span className="absolute top-1/2 -translate-y-1/2 left-3 text-sm font-bold text-primary">د.ل</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Shipping Cost Section */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <SectionTitle icon={<Truck size={22} />} title="تكلفة الشحن" />
                                <Button onClick={handleAddItem} className="gap-1.5 rounded-full shadow-md">
                                    <Plus size={16} />
                                    إضافة صنف
                                </Button>
                            </div>
                            <div className="space-y-3">
                                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-sm font-semibold text-muted-foreground">
                                    <div className="col-span-5 flex items-center gap-2"><List size={16} /> الصنف</div>
                                    <div className="col-span-3 flex items-center gap-2"><Hash size={16} /> الكمية</div>
                                    <div className="col-span-3 flex items-center gap-2"><Truck size={16} /> تكلفة الشحن</div>
                                    <div className="col-span-1"></div>
                                </div>
                                {items.map((item) => {
                                    const itemData = predefinedItems[item.itemId];
                                    const itemShippingCost = itemData ? (itemData.weight * item.quantity * pricePerKiloLYD) : 0;
                                    return (
                                        <div key={item.id} className="grid grid-cols-12 gap-x-4 gap-y-2 items-center p-3 bg-secondary/60 rounded-lg">
                                            <div className="col-span-12 md:col-span-5">
                                                <Select value={item.itemId} onValueChange={(value) => handleItemChange(item.id, 'itemId', value)}>
                                                    <SelectTrigger className="bg-card">
                                                        <SelectValue placeholder="اختر صنفًا..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {Object.entries(predefinedItems).map(([key, value]) => (
                                                            <SelectItem key={key} value={key}>{value.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="col-span-6 md:col-span-3">
                                                <Input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                                    min="1"
                                                    className="bg-card"
                                                />
                                            </div>
                                            <div className="col-span-6 md:col-span-3 flex items-center justify-center font-bold text-primary">
                                                {itemShippingCost.toFixed(2)} د.ل
                                            </div>
                                            <div className="col-span-12 md:col-span-1 flex justify-end">
                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveItem(item.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="flex justify-end items-center gap-4 px-4 py-2 text-md font-bold text-muted-foreground border-t mt-3 pt-3">
                                    <span>إجمالي الشحن:</span>
                                    <span className="text-primary">{totalShippingCost.toFixed(2)} د.ل</span>
                                </div>
                            </div>
                        </div>

                        {/* Summary Section */}
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 space-y-3">
                            <SummaryRow icon={<ShoppingCart size={18} />} label="تكلفة المنتجات:" value={`${basketPriceLYD.toFixed(2)} د.ل`} />
                            <SummaryRow icon={<Truck size={18} />} label="تكلفة الشحن:" value={`${totalShippingCost.toFixed(2)} د.ل`} />
                            <SummaryRow icon={<CheckCircle size={20} />} label="الإجمالي النهائي:" value={`${finalTotal.toFixed(2)} د.ل`} isFinal={true} />
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default CalculateShipmentPage;
