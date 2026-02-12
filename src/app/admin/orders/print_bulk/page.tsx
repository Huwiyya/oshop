'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getOrdersByIds } from '@/lib/actions';
import { Order } from '@/lib/types';
import { Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PrintableInvoice } from '@/components/admin/PrintableInvoice';

const BulkPrintContent = () => {
    const searchParams = useSearchParams();
    const idsParam = searchParams.get('ids');
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [customValues, setCustomValues] = useState<Record<string, number>>({});

    useEffect(() => {
        const fetchOrders = async () => {
            if (idsParam) {
                setIsLoading(true);
                const ids = idsParam.split(',');
                if (ids.length > 0) {
                    const data = await getOrdersByIds(ids);
                    setOrders(data);

                    // Initialize custom values
                    const initialValues: Record<string, number> = {};
                    data.forEach(order => {
                        initialValues[order.id] = order.remainingAmount;
                    });
                    setCustomValues(initialValues);
                }
                setIsLoading(false);
            } else {
                setIsLoading(false);
            }
        };

        fetchOrders();
    }, [idsParam]);

    const handlePrint = () => {
        window.print();
    };

    const handleValueChange = (orderId: string, newValue: string) => {
        const numValue = parseFloat(newValue);
        setCustomValues(prev => ({
            ...prev,
            [orderId]: isNaN(numValue) ? 0 : numValue
        }));
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen no-print">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="ml-4">جاري تجهيز البوليصات...</p>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="flex justify-center items-center h-screen no-print">
                <p className="text-red-500">لا توجد طلبات للطباعة.</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-100 min-h-screen">
            <style jsx global>{`
                @media print {
                   @page {
                        margin: 0;
                    }
                    
                    /* Reset global print styles that cause conflicts */
                    body * {
                        visibility: visible !important;
                        position: static !important;
                    }
                    
                    .no-print {
                        display: none !important;
                    }
                    
                    body {
                        background-color: white !important;
                    }
                    
                    /* Bulk print specific wrapper */
                    .bulk-print-wrapper {
                        display: block !important;
                        width: 100% !important;
                    }
                    
                    .printable-wrapper {
                        width: 100% !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        display: block !important;
                        position: relative !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    
                    .printable-wrapper:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                    
                    /* Override the problematic global .printable-content class */
                    .bulk-print-content {
                        position: static !important;
                        left: auto !important;
                        top: auto !important;
                        display: block !important;
                        visibility: visible !important;
                        box-shadow: none !important;
                        border: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                    }
                }
            `}</style>

            {/* Header / Config Bar */}
            <div className="w-full max-w-4xl mx-auto p-4 mb-6 no-print sticky top-0 bg-gray-100 z-10 border-b shadow-sm">
                <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                    <div>
                        <h2 className="text-lg font-bold">معاينة الطباعة الجماعية</h2>
                        <span className="text-sm text-muted-foreground">عدد البوليصات: {orders.length}</span>
                    </div>
                    <Button onClick={handlePrint} className="gap-2">
                        <Printer className="w-4 h-4 ml-2" />
                        طباعة الكل
                    </Button>
                </div>

                <div className="mt-4 bg-white p-4 rounded-lg shadow-sm">
                    <p className="text-sm font-semibold mb-2">تعديل القيم قبل الطباعة:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {orders.map(order => (
                            <div key={order.id} className="flex items-center gap-2 border p-2 rounded">
                                <span className="text-xs font-mono text-gray-500">{order.invoiceNumber}</span>
                                <input
                                    type="number"
                                    className="border rounded px-2 py-1 w-24 text-sm"
                                    value={customValues[order.id] ?? 0}
                                    onChange={(e) => handleValueChange(order.id, e.target.value)}
                                />
                                <span className="text-xs">د.ل</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mx-auto w-full max-w-[210mm] bulk-print-wrapper">
                {orders.map((order, index) => (
                    <div key={order.id} className="mb-8 print:mb-0 printable-wrapper">
                        <div className="bulk-print-content bg-white h-full">
                            <PrintableInvoice
                                labelData={order}
                                customValue={customValues[order.id]}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default function Page() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen no-print"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>}>
            <BulkPrintContent />
        </Suspense>
    );
}
