// src/app/representative/deposits/[depositId]/print/page.tsx
'use client';

import React, { useEffect, useState, Suspense, useRef } from 'react';
import { useParams } from 'next/navigation';
import logo from '@/app/assets/logo.png';
import { Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Deposit } from '@/lib/types';
import { getDepositById } from '@/lib/actions';

const PrintView = () => {
    const params = useParams();
    const depositId = params.depositId as string;
    const [deposit, setDeposit] = useState<Deposit | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (depositId) {
            const fetchData = async () => {
                setIsLoading(true);
                const data = await getDepositById(depositId);
                setDeposit(data);
                setIsLoading(false);
            };
            fetchData();
        }
    }, [depositId]);

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
        if (!isLoading && deposit) {
            const timer = setTimeout(triggerPrint, 500);
            return () => clearTimeout(timer);
        }
    }, [isLoading, deposit]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center no-print">
                <Loader2 className="h-12 w-12 animate-spin" />
                <p className="ml-4">جاري تجهيز الإيصال...</p>
            </div>
        );
    }

    if (!deposit) {
        return <div className="p-8 text-center text-red-500 no-print">لم يتم العثور على الإيصال.</div>;
    }

    return (
        <div className="bg-gray-100 p-4 min-h-screen" dir="rtl">
            <div className="w-full max-w-4xl mx-auto flex justify-between items-center mb-4 no-print">
                <h1 className="text-xl font-bold">معاينة الطباعة</h1>
                <Button onClick={triggerPrint}>
                    <Printer className="w-4 h-4 ml-2" />
                    طباعة
                </Button>
            </div>
            <div className="printable-content deposit-receipt-page" ref={printRef}>
                <div className="bg-white shadow-lg flex flex-col border border-gray-300 w-full h-full mx-auto p-6">
                    <header className="flex justify-between items-center mb-8 pb-4 border-b">
                        <div className="flex items-center gap-4">
                            <img src={logo.src} alt="Logo" style={{ width: '60px', height: '60px' }} />
                            <div>
                                <h1 className="text-xl font-bold whitespace-nowrap">شركة Oshop</h1>
                                <p className="text-xs text-gray-500">للخدمات اللوجستية والتجارة</p>
                            </div>
                        </div>
                        <div className="text-left">
                            <h2 className="text-2xl font-bold text-gray-700">إيصال استلام عربون</h2>
                            <p className="font-mono text-sm">#{deposit.receiptNumber}</p>
                        </div>
                    </header>

                    <section className="flex-grow space-y-4 text-sm">
                        <InfoRow label="تاريخ الإيصال" value={format(new Date(deposit.date), 'yyyy/MM/dd', { locale: ar })} />
                        <InfoRow label="استلمنا من السيد/ة" value={deposit.customerName} />
                        <InfoRow label="مبلغ وقدره" value={`${deposit.amount.toFixed(2)} د.ل`} valueClass="font-bold text-lg text-primary" />
                        <InfoRow label="وذلك عن" value={deposit.description} />
                        <InfoRow label="رقم الهاتف" value={deposit.customerPhone} />
                    </section>

                    <footer className="mt-auto pt-8 flex-shrink-0">
                        <div className="flex justify-between items-end">
                            <div className="text-center w-1/2">
                                <p className="font-semibold">المستلم</p>
                                <p className="border-b-2 border-dotted w-full h-8 mt-6"></p>
                                <p className="text-xs text-gray-500">{deposit.representativeName || 'الإدارة'}</p>
                            </div>
                            <div className="text-center w-1/2">
                                <p className="font-semibold">العميل</p>
                                <p className="border-b-2 border-dotted w-full h-8 mt-6"></p>
                                <p className="text-xs text-gray-500">{deposit.customerName}</p>
                            </div>
                        </div>
                        <p className="text-center text-xs text-gray-400 mt-6">هذا المستند لا يعتبر فاتورة. generated by Oshop</p>
                    </footer>
                </div>
            </div>
        </div>
    );
};

const InfoRow = ({ label, value, valueClass }: { label: string, value: string, valueClass?: string }) => (
    <div className="flex items-baseline">
        <span className="w-32 font-semibold text-gray-600">{label}:</span>
        <span className={`flex-1 border-b border-dotted ${valueClass}`}>{value}</span>
    </div>
);


const Page = () => (
    <Suspense fallback={<div className="flex justify-center items-center h-screen no-print"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>}>
        <PrintView />
    </Suspense>
);

export default Page;
