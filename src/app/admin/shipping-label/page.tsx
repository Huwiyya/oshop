
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Printer } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LabelData {
    invoiceNumber: string;
    operationDate: string;
    customerName: string;
    customerAddress: string;
    customerPhone: string;
    itemDescription: string;
    trackingId: string;
    sellingPriceLYD: number;
    remainingAmount: number;
}

const ManualShippingLabelPage = () => {
    const router = useRouter();
    const [labelData, setLabelData] = useState<LabelData>({
        invoiceNumber: '',
        operationDate: new Date().toISOString(),
        customerName: '',
        customerAddress: '',
        customerPhone: '',
        itemDescription: '',
        trackingId: '',
        sellingPriceLYD: 0,
        remainingAmount: 0,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setLabelData(prev => ({ ...prev, [id]: value }));
    };

    const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setLabelData(prev => ({ ...prev, [id]: value === '' ? 0 : parseFloat(value) }));
    };

    const handlePreviewAndPrint = () => {
        const params = new URLSearchParams();
        Object.entries(labelData).forEach(([key, value]) => {
            params.append(key, String(value));
        });

        const printWindow = window.open(`/admin/shipping-label/print?${params.toString()}`, '_blank', 'height=842,width=595,resizable=yes,scrollbars=yes');

        printWindow?.addEventListener('load', () => {
            printWindow.print();
        });
    };

    return (
        <div className="p-4 sm:p-6" dir="rtl">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle>إنشاء بوليصة شحن يدوية</CardTitle>
                    <CardDescription>أدخل البيانات لإنشاء وطباعة البوليصة مباشرة.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h3 className="font-semibold mb-4 border-b pb-2">بيانات المستلم</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="customerName">اسم المستلم</Label>
                                <Input id="customerName" value={labelData.customerName} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="customerPhone">رقم هاتف المستلم</Label>
                                <Input id="customerPhone" value={labelData.customerPhone} onChange={handleChange} dir="ltr" />
                            </div>
                        </div>
                        <div className="space-y-2 mt-4">
                            <Label htmlFor="customerAddress">عنوان المستلم</Label>
                            <Textarea id="customerAddress" value={labelData.customerAddress} onChange={handleChange} />
                        </div>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-4 border-b pb-2">بيانات الشحنة والبيانات المالية</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="invoiceNumber">رقم الفاتورة</Label>
                                <Input id="invoiceNumber" value={labelData.invoiceNumber} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="trackingId">كود التتبع</Label>
                                <Input id="trackingId" value={labelData.trackingId} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="itemDescription">وصف المحتوى</Label>
                                <Input id="itemDescription" value={labelData.itemDescription} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sellingPriceLYD">المبلغ الإجمالي (د.ل)</Label>
                                <Input id="sellingPriceLYD" type="number" value={labelData.sellingPriceLYD || ''} onChange={handleNumericChange} dir="ltr" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="remainingAmount">المبلغ المطلوب عند الاستلام (د.ل)</Label>
                                <Input id="remainingAmount" type="number" value={labelData.remainingAmount || ''} onChange={handleNumericChange} dir="ltr" />
                            </div>
                        </div>
                    </div>

                    <Button onClick={handlePreviewAndPrint} className="w-full gap-2 mt-4">
                        <Printer className="w-4 h-4" />
                        طباعة
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default ManualShippingLabelPage;
