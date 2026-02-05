// src/app/representative/orders/[orderId]/print/page.tsx
'use client';

import React, { useEffect, useState, Suspense, useRef } from 'react';
import { useParams } from 'next/navigation';
import logo from '@/app/assets/logo.png';
import { Loader2, DollarSign, Package, Hash, Calendar as CalendarIcon, Printer } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { getOrderById } from '@/lib/actions';
import { Order } from '@/lib/types';

const PrintView = () => {
    const params = useParams();
    const orderId = params.orderId as string;
    const [labelData, setLabelData] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (orderId) {
            const fetchOrderData = async () => {
                setIsLoading(true);
                const data = await getOrderById(orderId);
                setLabelData(data);
                setIsLoading(false);
            };
            fetchOrderData();
        }
    }, [orderId]);

    const triggerPrint = () => {
        // Force light mode for printing
        document.documentElement.classList.remove('dark');
        setTimeout(() => {
            window.print();
            // Optional: Re-add dark mode after printing if needed, though layout will handle it on navigation
            // document.documentElement.classList.add('dark');
        }, 100); // Small delay to ensure styles apply
    };

    useEffect(() => {
        if (labelData && !isLoading) {
            const timer = setTimeout(triggerPrint, 500);
            return () => clearTimeout(timer);
        }
    }, [labelData, isLoading]);


    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen no-print">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="ml-4">جاري تجهيز البوليصة...</p>
            </div>
        );
    }

    if (!labelData) {
        return (
            <div className="flex justify-center items-center h-screen no-print">
                <p className="text-red-500">لم يتم العثور على الطلب.</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-100 p-4 min-h-screen">
            <div className="w-full max-w-4xl mx-auto flex justify-end mb-4 no-print">
                <Button onClick={triggerPrint}>
                    <Printer className="w-4 h-4 ml-2" />
                    طباعة
                </Button>
            </div>
            <div ref={printRef} className="mx-auto printable-content shipping-label-page">
                <PrintableContent labelData={labelData} />
            </div>
        </div>
    );
};

const PrintableContent = ({ labelData }: { labelData: Order }) => {
    const isPaymentOnReceipt = labelData.remainingAmount > 0;
    return (
        <div className="bg-white shadow-lg flex flex-col border border-gray-300 w-full h-full mx-auto">
            {/* Header */}
            <header className="grid grid-cols-3 items-center p-4 border-b border-gray-300">
                <div className="col-span-1 flex items-center gap-4">
                    <img src={logo.src} alt="Logo" style={{ width: '60px', height: '60px' }} />
                    <div>
                        <h1 className="text-lg font-bold whitespace-nowrap">بوليصة شحن</h1>
                        <p className="text-xs text-gray-500">شركة Oshop</p>
                    </div>
                </div>
                <div className="col-span-1"></div>
                <div className="col-span-1 text-left">
                    <p className="font-bold text-sm whitespace-nowrap">رقم الفاتورة: {labelData.invoiceNumber}</p>
                    <p className="text-xs text-gray-500">{format(new Date(labelData.operationDate), 'yyyy/MM/dd')}</p>
                </div>
            </header>

            {/* Sender & Receiver */}
            <section className="grid grid-cols-2 gap-4 p-4 border-b border-gray-300 text-sm">
                <div className="border-l border-gray-300 pl-4">
                    <h2 className="font-bold mb-2 whitespace-nowrap">من: المرسل</h2>
                    <p className="font-semibold">شركة Oshop</p>
                    <p>المقاوبة - الدائري الثاني - بالقرب من التقاطع, Misurata, Libya</p>
                    <p dir="ltr" className="text-right font-mono">0927172021</p>
                </div>
                <div>
                    <h2 className="font-bold mb-2 whitespace-nowrap">إلى: المستلم</h2>
                    <p className="font-semibold">{labelData.customerName}</p>
                    <p>{labelData.customerAddress}</p>
                    <p dir="ltr" className="text-right font-mono">{labelData.customerPhone}</p>
                </div>
            </section>

            {/* Order Details */}
            <section className="p-4 flex-grow">
                <h2 className="font-bold mb-2 whitespace-nowrap">تفاصيل الشحنة</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <InfoRow icon={<Package className="w-4 h-4" />} label="وصف المحتوى:" value={labelData.itemDescription || 'غير محدد'} />
                    <InfoRow icon={<Hash className="w-4 h-4" />} label="كود التتبع:" value={labelData.trackingId || 'N/A'} />
                    <InfoRow icon={<CalendarIcon className="w-4 h-4" />} label="تاريخ الطلب:" value={format(new Date(labelData.operationDate), 'yyyy/MM/dd')} />
                    <InfoRow icon={<DollarSign className="w-4 h-4" />} label="المبلغ الإجمالي:" value={`${labelData.sellingPriceLYD.toFixed(2)} د.ل`} />
                </div>
                <Separator className="my-4" />
                <div className="bg-gray-100 p-3 rounded-md text-center">
                    <p className="font-bold text-base whitespace-nowrap">
                        {isPaymentOnReceipt ? "المبلغ المطلوب عند الاستلام" : "الدفعة تمت بالكامل"}
                    </p>
                    {isPaymentOnReceipt && (
                        <p className="text-xl font-bold text-red-600">
                            {labelData.remainingAmount.toFixed(2)} د.ل
                        </p>
                    )}
                </div>
            </section>

            {/* Footer */}
            <footer className="mt-auto p-4 border-t border-gray-300 text-center flex-shrink-0">
                <p className="text-sm font-bold">شكراً لتعاملكم معنا!</p>
                <p className="text-xs text-gray-500 mt-1">
                    ملاحظات: الرجاء التأكد من سلامة الشحنة قبل التوقيع على الاستلام.
                </p>
            </footer>
        </div>
    );
};

const Page = () => (
    <Suspense fallback={<div className="flex justify-center items-center h-screen no-print"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>}>
        <PrintView />
    </Suspense>
);

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
    <div className="flex items-start">
        <div className="flex-shrink-0 w-28 text-gray-600 font-semibold flex items-center gap-1.5 whitespace-nowrap">
            {icon} {label}
        </div>
        <div className="font-medium">{value}</div>
    </div>
);

export default Page;
