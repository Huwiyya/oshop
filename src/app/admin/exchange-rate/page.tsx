'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { getAppSettings, updateAppSettings } from '@/lib/actions';
import type { AppSettings } from '@/lib/types';
import { Loader2 } from 'lucide-react';

const ExchangeRatePage = () => {
    const { toast } = useToast();
    const [settings, setSettings] = useState<Partial<AppSettings>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            setIsLoading(true);
            const currentSettings = await getAppSettings();
            setSettings(currentSettings);
            setIsLoading(false);
        };
        fetchSettings();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setSettings(prev => ({ ...prev, [id]: value === '' ? undefined : parseFloat(value) }));
    }

    const handleSave = async () => {
        setIsSaving(true);

        const settingsToSave: Partial<AppSettings> = {
            exchangeRate: Number(settings.exchangeRate) || 0,
            shippingExchangeRate: Number(settings.shippingExchangeRate) || 0,
            pricePerKiloUSD: Number(settings.pricePerKiloUSD) || 0,
            customerPricePerKiloUSD: Number(settings.customerPricePerKiloUSD) || 0,
        };

        const success = await updateAppSettings(settingsToSave);
        if (success) {
            toast({
                title: "تم الحفظ بنجاح",
                description: "تم تحديث إعدادات النظام.",
            });
        } else {
            toast({
                title: "خطأ",
                description: "فشل تحديث الإعدادات.",
                variant: "destructive",
            });
        }
        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="p-4 sm:p-6" dir="rtl">
            <div className="grid gap-6">
                <Card className="max-w-2xl mx-auto w-full">
                    <CardHeader>
                        <CardTitle>أسعار الصرف والشحن</CardTitle>
                        <CardDescription>
                            قم بإدارة الإعدادات العامة المتعلقة بالعمليات المالية والشحن في النظام.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                            <div className="space-y-2">
                                <Label htmlFor="exchangeRate">سعر الدينار الليبي مقابل الدولار</Label>
                                <Input
                                    id="exchangeRate"
                                    type="number"
                                    step="0.01"
                                    value={settings.exchangeRate || ''}
                                    onChange={handleInputChange}
                                    dir="ltr"
                                />
                                <p className="text-xs text-muted-foreground">
                                    هذا السعر سيتم استخدامه في جميع العمليات الحسابية لتحويل الدولار إلى دينار.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="customerPricePerKiloUSD">سعر الكيلوغرام الافتراضي (للزبون بالدولار)</Label>
                                <Input
                                    id="customerPricePerKiloUSD"
                                    type="number"
                                    step="0.01"
                                    value={settings.customerPricePerKiloUSD || ''}
                                    onChange={handleInputChange}
                                    dir="ltr"
                                />
                                <p className="text-xs text-muted-foreground">
                                    السعر الافتراضي بالدولار الذي يضاف على فاتورة الزبون لكل كيلوغرام.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="shippingExchangeRate">سعر صرف الدولار الخاص بالشحن</Label>
                                <Input
                                    id="shippingExchangeRate"
                                    type="number"
                                    step="0.01"
                                    value={settings.shippingExchangeRate || ''}
                                    onChange={handleInputChange}
                                    dir="ltr"
                                />
                                <p className="text-xs text-muted-foreground">
                                    هذا السعر سيتم استخدامه لحساب تكاليف الشحن من الدولار إلى الدينار. إذا ترك فارغًا سيتم استخدام سعر الصرف العام.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pricePerKiloUSD">سعر الكيلوغرام الافتراضي (للشركة بالدولار)</Label>
                                <Input
                                    id="pricePerKiloUSD"
                                    type="number"
                                    step="0.01"
                                    value={settings.pricePerKiloUSD || ''}
                                    onChange={handleInputChange}
                                    dir="ltr"
                                />
                                <p className="text-xs text-muted-foreground">
                                    التكلفة الفعلية للشحن على الشركة لكل كيلوغرام بالدولار.
                                </p>
                            </div>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                حفظ التغييرات
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ExchangeRatePage;
