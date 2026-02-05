'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Creditor, ExternalDebt } from '@/lib/types';
import { getCreditorById, getExternalDebtsForCreditor } from '@/lib/actions';
import { Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const PrintCreditorStatementPage = () => {
    const params = useParams();
    const creditorId = params.creditorId as string;
    const [creditor, setCreditor] = useState<Creditor | null>(null);
    const [debts, setDebts] = useState<ExternalDebt[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (creditorId) {
            const fetchData = async () => {
                setIsLoading(true);
                const [creditorData, debtsData] = await Promise.all([
                    getCreditorById(creditorId),
                    getExternalDebtsForCreditor(creditorId)
                ]);
                setCreditor(creditorData);
                setDebts(debtsData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
                setIsLoading(false);
            };
            fetchData();
        }
    }, [creditorId]);

    useEffect(() => {
        if (!isLoading && creditor) {
            // Automatically trigger print dialog
            setTimeout(() => window.print(), 1000);
        }
    }, [isLoading, creditor]);

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center no-print">
                <Loader2 className="h-12 w-12 animate-spin" />
            </div>
        );
    }

    if (!creditor) {
        return <div className="p-8 text-center text-red-500 no-print">لم يتم العثور على الحساب.</div>;
    }

    const currencySymbol = creditor.currency === 'USD' ? '$' : 'د.ل';
    let balance = 0;

    return (
        <div className="bg-gray-100 p-4 min-h-screen">
            <div className="w-full max-w-4xl mx-auto flex justify-between items-center mb-4 no-print">
                <h1 className="text-xl font-bold">معاينة الطباعة</h1>
                <Button onClick={() => window.print()}>
                    <Printer className="w-4 h-4 ml-2" />
                    طباعة
                </Button>
            </div>
            <div className="printable-content statement-page bg-white shadow-lg p-8 w-full max-w-4xl mx-auto">
                <header className="text-center mb-8 border-b pb-4">
                    <h1 className="text-3xl font-bold">كشف حساب</h1>
                    <h2 className="text-2xl mt-2">{creditor.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">{creditor.type === 'company' ? 'شركة' : 'شخص'}</p>
                </header>

                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <p className="text-sm"><span className="font-semibold">تاريخ الطباعة:</span> {format(new Date(), 'yyyy/MM/dd', { locale: ar })}</p>
                    </div>
                    <div className="text-left">
                        <p className="text-sm font-semibold">الرصيد النهائي:</p>
                        <p className={`text-xl font-bold ${creditor.totalDebt === 0 ? '' : (creditor.totalDebt > 0 ? 'text-red-600' : 'text-green-600')}`}>
                            {Math.abs(creditor.totalDebt).toFixed(2)} {currencySymbol}
                            <span className="text-xs"> {creditor.totalDebt > 0 ? '(عليه)' : '(له)'}</span>
                        </p>
                    </div>
                </div>

                <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-gray-300 p-2 text-right">التاريخ</th>
                            <th className="border border-gray-300 p-2 text-right">البيان</th>
                            <th className="border border-gray-300 p-2 text-right">مدين</th>
                            <th className="border border-gray-300 p-2 text-right">دائن</th>
                            <th className="border border-gray-300 p-2 text-right">الرصيد</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="border border-gray-300 p-2" colSpan={4}>رصيد سابق</td>
                            <td className="border border-gray-300 p-2 font-mono font-semibold">0.00</td>
                        </tr>
                        {debts.map(debt => {
                            const isDebit = debt.amount > 0;
                            balance += debt.amount;
                            return (
                                <tr key={debt.id}>
                                    <td className="border border-gray-300 p-2">{format(new Date(debt.date), 'yyyy/MM/dd')}</td>
                                    <td className="border border-gray-300 p-2">{debt.notes}</td>
                                    <td className="border border-gray-300 p-2 font-mono text-red-600">
                                        {isDebit ? `${Math.abs(debt.amount).toFixed(2)}` : ''}
                                    </td>
                                    <td className="border border-gray-300 p-2 font-mono text-green-600">
                                        {!isDebit ? `${Math.abs(debt.amount).toFixed(2)}` : ''}
                                    </td>
                                    <td className={`border border-gray-300 p-2 font-mono font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {Math.abs(balance).toFixed(2)}
                                    </td>
                                </tr>
                            );
                        })}
                        {debts.length === 0 && (
                            <tr>
                                <td colSpan={5} className="text-center p-4 text-gray-500">لا توجد حركات مالية مسجلة.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
                <footer className="text-center text-xs text-gray-400 mt-8">
                    هذا المستند تم إنشاؤه بواسطة نظام Oshop.
                </footer>
            </div>
        </div>
    );
};

export default PrintCreditorStatementPage;
