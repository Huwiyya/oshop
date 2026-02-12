
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Zap, TrendingUp, TrendingDown, RefreshCw, Type, Save, BookOpen, Loader2 } from "lucide-react";
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { addInstantSale, getAppSettings } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import type { AppSettings } from '@/lib/types';


const SummaryRow = ({ label, value, icon, className }: { label: string; value: string; icon: React.ReactNode; className?: string }) => (
    <div className={`flex justify-between items-center py-3 ${className}`}>
        <div className="flex items-center gap-3 text-muted-foreground">
            {icon}
            <span className="font-medium">{label}</span>
        </div>
        <span className="text-lg font-bold">{value}</span>
    </div>
);

const InstantSalesCalculator = () => {
    const { toast } = useToast();
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [settings, setSettings] = useState<AppSettings | null>(null);


    const [productName, setProductName] = useState<string>('');
    const [costUSD, setCostUSD] = useState<number>(0);
    const [costExchangeRate, setCostExchangeRate] = useState<number>(0);

    const [salePriceMode, setSalePriceMode] = useState<'LYD' | 'USD'>('LYD');

    const [salePriceLYD, setSalePriceLYD] = useState<number>(0);
    const [salePriceUSD, setSalePriceUSD] = useState<number>(0);
    const [saleExchangeRate, setSaleExchangeRate] = useState<number>(0);

    useEffect(() => {
        const fetchSettings = async () => {
            const currentSettings = await getAppSettings();
            setSettings(currentSettings);
            if (currentSettings.exchangeRate) {
                setCostExchangeRate(currentSettings.exchangeRate);
                setSaleExchangeRate(currentSettings.exchangeRate); // Also set the sale exchange rate initially
            }
        };
        fetchSettings();
    }, []);

    const totalCostLYD = useMemo(() => costUSD * costExchangeRate, [costUSD, costExchangeRate]);

    const finalSalePriceLYD = useMemo(() => {
        if (salePriceMode === 'LYD') {
            return salePriceLYD;
        }
        return salePriceUSD * saleExchangeRate;
    }, [salePriceMode, salePriceLYD, salePriceUSD, saleExchangeRate]);

    const netProfit = useMemo(() => finalSalePriceLYD - totalCostLYD, [finalSalePriceLYD, totalCostLYD]);

    const handleReset = () => {
        setProductName('');
        setCostUSD(0);
        setCostExchangeRate(settings?.exchangeRate || 0);
        setSalePriceLYD(0);
        setSalePriceUSD(0);
        setSaleExchangeRate(settings?.exchangeRate || 0);
        setSalePriceMode('LYD');
    };

    const handleSave = async () => {
        if (netProfit === 0 && totalCostLYD === 0 && finalSalePriceLYD === 0) {
            toast({
                title: "لا يمكن الحفظ",
                description: "الرجاء إدخال بيانات صالحة قبل الحفظ في السجل.",
                variant: "destructive"
            });
            return;
        }
        setIsSaving(true);
        try {
            await addInstantSale({
                productName,
                costUSD,
                costExchangeRate,
                totalCostLYD,
                salePriceMode,
                salePriceLYD,
                salePriceUSD,
                saleExchangeRate,
                finalSalePriceLYD,
                netProfit,
                createdAt: new Date().toISOString()
            });
            toast({
                title: "تم الحفظ",
                description: "تم حفظ العملية في سجل المبيعات الفورية.",
            });
        } catch (error) {
            toast({
                title: "خطأ",
                description: "فشل حفظ العملية في السجل.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-4 sm:p-6" dir="rtl">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
                            <Zap className="text-primary" />
                            حاسبة المبيعات الفورية
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            أداة سريعة لحساب تكلفة وربح المنتجات بأسعار صرف مخصصة.
                        </p>
                    </div>
                    <Button variant="outline" className="gap-2" onClick={() => router.push('/admin/instant-sales/history')}>
                        <BookOpen className="h-4 w-4" />
                        الانتقال إلى السجل
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Type size={20} /> اسم المنتج</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <Label htmlFor="productName">اسم المنتج (اختياري)</Label>
                            <Input
                                id="productName"
                                type="text"
                                placeholder="مثال: حذاء رياضي مقاس 42"
                                value={productName}
                                onChange={(e) => setProductName(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>1. حساب التكلفة</CardTitle>
                    </CardHeader>
                    <CardContent className="grid sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="costUSD">تكلفة المنتج (بالدولار)</Label>
                            <Input
                                id="costUSD"
                                type="number"
                                dir="ltr"
                                placeholder="0.00"
                                value={costUSD || ''}
                                onChange={(e) => setCostUSD(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="costExchangeRate">سعر صرف التكلفة (للدولار الواحد)</Label>
                            <Input
                                id="costExchangeRate"
                                type="number"
                                dir="ltr"
                                placeholder="0.00"
                                value={costExchangeRate || ''}
                                onChange={(e) => setCostExchangeRate(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>2. تحديد سعر البيع</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <RadioGroup value={salePriceMode} onValueChange={(val) => setSalePriceMode(val as 'LYD' | 'USD')} className="flex gap-4">
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="LYD" id="modeLYD" />
                                <Label htmlFor="modeLYD" className="cursor-pointer">تحديد السعر بالدينار الليبي</Label>
                            </div>
                            <div className="flex items-center space-x-2 space-x-reverse">
                                <RadioGroupItem value="USD" id="modeUSD" />
                                <Label htmlFor="modeUSD" className="cursor-pointer">تحديد السعر بالدولار</Label>
                            </div>
                        </RadioGroup>

                        {salePriceMode === 'LYD' ? (
                            <div className="space-y-2 pt-2 animate-in fade-in">
                                <Label htmlFor="salePriceLYD">سعر البيع النهائي (بالدينار)</Label>
                                <Input
                                    id="salePriceLYD"
                                    type="number"
                                    dir="ltr"
                                    placeholder="0.00"
                                    value={salePriceLYD || ''}
                                    onChange={(e) => setSalePriceLYD(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                />
                            </div>
                        ) : (
                            <div className="grid sm:grid-cols-2 gap-6 pt-2 animate-in fade-in">
                                <div className="space-y-2">
                                    <Label htmlFor="salePriceUSD">سعر البيع (بالدولار)</Label>
                                    <Input
                                        id="salePriceUSD"
                                        type="number"
                                        dir="ltr"
                                        placeholder="0.00"
                                        value={salePriceUSD || ''}
                                        onChange={(e) => setSalePriceUSD(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="saleExchangeRate">سعر صرف البيع (للدولار الواحد)</Label>
                                    <Input
                                        id="saleExchangeRate"
                                        type="number"
                                        dir="ltr"
                                        placeholder="0.00"
                                        value={saleExchangeRate || ''}
                                        onChange={(e) => setSaleExchangeRate(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="flex-row justify-between items-center">
                        <CardTitle className="text-primary">النتائج {productName && `- ${productName}`}</CardTitle>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" className="gap-1.5" onClick={handleReset}>
                                <RefreshCw className="w-4 h-4" />
                                إعادة تعيين
                            </Button>
                            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                حفظ في السجل
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <SummaryRow label="إجمالي التكلفة" value={`${totalCostLYD.toFixed(2)} د.ل`} icon={<TrendingDown className="text-destructive" />} className="text-destructive" />
                        <Separator />
                        <SummaryRow label="إجمالي سعر البيع" value={`${finalSalePriceLYD.toFixed(2)} د.ل`} icon={<TrendingUp className="text-green-600" />} className="text-green-600" />
                        <Separator />
                        <SummaryRow label="صافي الربح" value={`${netProfit.toFixed(2)} د.ل`} icon={<DollarSign className="text-primary" />} className="text-primary text-2xl" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default InstantSalesCalculator;

