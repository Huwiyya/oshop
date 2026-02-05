// src/app/admin/orders/[orderId]/print/page.tsx
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


import { PrintableInvoice } from '@/components/admin/PrintableInvoice';

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


    useEffect(() => {
        if (labelData && !isLoading) {
            setTimeout(() => window.print(), 500);
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
                <Button onClick={() => window.print()}>
                    <Printer className="w-4 h-4 ml-2" />
                    طباعة
                </Button>
            </div>
            <div ref={printRef} className="mx-auto printable-content shipping-label-page">
                <PrintableInvoice labelData={labelData} />
            </div>
        </div>
    );
};

const Page = () => (
    <Suspense fallback={<div className="flex justify-center items-center h-screen no-print"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>}>
        <PrintView />
    </Suspense>
);

export default Page;
