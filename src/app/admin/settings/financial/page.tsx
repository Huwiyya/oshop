'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getSystemSettings, updateSystemSettings } from '@/lib/actions';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Save, DollarSign, Calculator } from 'lucide-react';
import { SystemSettings } from '@/lib/types';

export default function FinancialSettingsPage() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const data = await getSystemSettings();
                setSettings(data);
            } catch (error) {
                toast({
                    title: "خطأ",
                    description: "فشل تحميل الإعدادات.",
                    variant: "destructive"
                });
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, [toast]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        setIsSaving(true);
        try {
            await updateSystemSettings({
                exchangeRate: Number(settings.exchangeRate),
                shippingCostUSD: Number(settings.shippingCostUSD),
                shippingPriceUSD: Number(settings.shippingPriceUSD),
            });
            toast({
                title: "تم الحفظ",
                description: "تم تحديث الإعدادات المالية بنجاح.",
            });
        } catch (error) {
            toast({
                title: "خطأ",
                description: "فشل حفظ التغييرات.",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="flex justify-center py-10"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;
    }

    if (!settings) return null;

    // Calculate profit margin for preview
    const profitMargin = settings.shippingPriceUSD - settings.shippingCostUSD;
    const profitMarginLYD = profitMargin * settings.exchangeRate;

    return (
        <div className="p-6 space-y-6" dir="rtl">
            <div>
                <h1 className="text-3xl font-bold">الإعدادات المالية</h1>
                <p className="text-muted-foreground mt-2">ضبط أسعار الصرف وتكاليف الشحن لحساب الفواتير تلقائياً.</p>
            </div>

            <form onSubmit={handleSave} className="grid md:grid-cols-2 gap-6">
                {/* Exchange Rate Card */}
                <Card className="hover:shadow-lg transition-shadow border-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calculator className="w-5 h-5 text-primary" />
                            سعر الصرف
                        </CardTitle>
                        <CardDescription>القيمة الحالية للدولار مقابل الدينار الليبي.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>سعر الدولار (د.ل)</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    step="0.001"
                                    value={settings.exchangeRate}
                                    onChange={(e) => setSettings({ ...settings, exchangeRate: parseFloat(e.target.value) })}
                                    className="pl-10 text-lg font-bold"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">LYD</span>
                            </div>
                            <p className="text-xs text-muted-foreground">يستخدم هذا السعر لتحويل جميع القيم الدولارية في النظام.</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Shipping Config Card */}
                <Card className="hover:shadow-lg transition-shadow border-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-green-600" />
                            تسعير الشحن الجوي
                        </CardTitle>
                        <CardDescription>التكلفة والسعر للكيلوغرام الواحد.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">التكلفة (على الشركة)</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={settings.shippingCostUSD}
                                        onChange={(e) => setSettings({ ...settings, shippingCostUSD: parseFloat(e.target.value) })}
                                        className="pl-8"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$ / KG</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-primary font-bold">سعر البيع (للزبون)</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        step="0.1"
                                        value={settings.shippingPriceUSD}
                                        onChange={(e) => setSettings({ ...settings, shippingPriceUSD: parseFloat(e.target.value) })}
                                        className="pl-8 border-primary/50 bg-primary/5"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$ / KG</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2 mt-4">
                            <div className="flex justify-between">
                                <span>الربح المتوقع للكيلو ($):</span>
                                <span className={profitMargin > 0 ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                                    {profitMargin.toFixed(2)} $
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>الربح المتوقع للكيلو (د.ل):</span>
                                <span className={profitMarginLYD > 0 ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                                    {profitMarginLYD.toFixed(2)} د.ل
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="md:col-span-2 flex justify-end">
                    <Button type="submit" size="lg" disabled={isSaving} className="gap-2">
                        {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                        حفظ الإعدادات
                    </Button>
                </div>
            </form>
        </div>
    );
}
