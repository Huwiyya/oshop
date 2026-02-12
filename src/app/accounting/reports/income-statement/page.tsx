'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getIncomeStatement } from '@/lib/report-actions';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { Printer, ArrowLeft, Search, Download } from 'lucide-react';

export default function IncomeStatementDetail() {
    const router = useRouter();
    const [startDate, setStartDate] = useState(new Date().getFullYear() + '-01-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);

    const loadReport = async () => {
        setLoading(true);
        try {
            const result = await getIncomeStatement(startDate, endDate);
            setData(result);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReport();
    }, []);

    const handleExportExcel = () => {
        if (!data) return;

        const wb = XLSX.utils.book_new();
        const wsData = [
            ['قائمة الدخل التفصيلية'],
            [`للفترة من ${startDate} إلى ${endDate}`],
            [''],
            ['الإيرادات (Revenues)', 'الكود', 'المبلغ'],
        ];

        data.revenues.forEach((r: any) => {
            wsData.push([r.accountName, r.accountCode, r.balance]);
        });
        wsData.push(['إجمالي الإيرادات', '', data.totalRevenue]);
        wsData.push(['']);

        wsData.push(['تكلفة الإيرادات (Cost of Revenue)', 'الكود', 'المبلغ']);
        data.cogs.forEach((r: any) => {
            wsData.push([r.accountName, r.accountCode, r.balance]);
        });
        wsData.push(['إجمالي تكلفة الإيرادات', '', data.totalCOGS]);
        wsData.push(['']);

        wsData.push(['مجمل الربح (Gross Profit)', '', data.grossProfit]);
        wsData.push(['']);

        wsData.push(['المصروفات التشغيلية (Expenses)', 'الكود', 'المبلغ']);
        data.expenses.forEach((r: any) => {
            wsData.push([r.accountName, r.accountCode, r.balance]);
        });
        wsData.push(['إجمالي المصروفات التشغيلية', '', data.totalExpense]);
        wsData.push(['']);

        wsData.push(['صافي الربح / (الخسارة)', '', data.netIncome]);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Column widths
        ws['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 20 }];

        XLSX.utils.book_append_sheet(wb, ws, 'Income Statement');
        XLSX.writeFile(wb, `Income_Statement_${startDate}_${endDate}.xlsx`);
    };

    return (
        <div className="container mx-auto py-8 max-w-5xl space-y-6 print:py-0 print:max-w-none">
            {/* Header - Hidden in Print */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 print:hidden">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">قائمة الدخل التفصيلية</h1>
                        <p className="text-slate-500">تقرير الأرباح والخسائر المفصل</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 items-end bg-white p-2 rounded-lg border shadow-sm">
                    <div className="space-y-1">
                        <span className="text-xs font-medium text-slate-500">من</span>
                        <Input type="date" className="h-9" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <span className="text-xs font-medium text-slate-500">إلى</span>
                        <Input type="date" className="h-9" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <Button onClick={loadReport} disabled={loading} className="h-9 gap-2">
                        <Search className="w-4 h-4" /> عرض
                    </Button>
                    <Button variant="outline" onClick={handleExportExcel} disabled={loading || !data} className="h-9 gap-2">
                        <Download className="w-4 h-4" /> تصدير Excel
                    </Button>
                    <Button variant="outline" onClick={() => window.print()} className="h-9 gap-2">
                        <Printer className="w-4 h-4" /> طباعة
                    </Button>
                </div>
            </div>

            {/* Report Content */}
            <Card className="print:shadow-none print:border-none">
                <CardHeader className="text-center border-b pb-6">
                    <CardTitle className="text-3xl font-serif">قائمة الدخل</CardTitle>
                    <CardDescription className="text-lg">
                        للفترة من {startDate} إلى {endDate}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {!data ? (
                        <div className="py-20 text-center text-slate-500">
                            {loading ? 'جاري إعداد التقرير...' : 'لا توجد بيانات للعرض'}
                        </div>
                    ) : (
                        <div className="text-sm">
                            {/* 1. Revenues */}
                            <div className="section">
                                <div className="bg-slate-50 px-6 py-3 font-bold text-slate-700 flex justify-between items-center border-b">
                                    <span>الإيرادات (Revenues)</span>
                                </div>
                                {data.revenues.length === 0 ? (
                                    <div className="px-6 py-3 text-slate-400 italic">لا توجد إيرادات مسجلة</div>
                                ) : (
                                    data.revenues.map((r: any) => (
                                        <div key={r.accountCode} className="flex justify-between px-6 py-3 border-b hover:bg-slate-50">
                                            <span className="flex items-center gap-2">
                                                <Link href={`/accounting/ledger/${r.accountId}`} className="hover:underline text-blue-600 font-medium">
                                                    {r.accountName}
                                                </Link>
                                                <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1 rounded">{r.accountCode}</span>
                                            </span>
                                            <span className="font-mono">{formatCurrency(Math.abs(r.balance))}</span>
                                        </div>
                                    ))
                                )}
                                <div className="bg-emerald-50 px-6 py-3 font-bold text-emerald-800 flex justify-between items-center border-t border-b-2 border-emerald-100">
                                    <span>إجمالي الإيرادات</span>
                                    <span className="text-lg">{formatCurrency(data.totalRevenue)}</span>
                                </div>
                            </div>

                            {/* 2. Cost of Goods Sold (COGS) */}
                            <div className="section mt-4">
                                <div className="bg-slate-50 px-6 py-3 font-bold text-slate-700 flex justify-between items-center border-b border-t">
                                    <span>تكلفة الإيرادات (Cost of Revenue)</span>
                                </div>
                                {data.cogs.length === 0 ? (
                                    <div className="px-6 py-3 text-slate-400 italic">لا توجد تكاليف مباشرة مسجلة</div>
                                ) : (
                                    data.cogs.map((r: any) => (
                                        <div key={r.accountCode} className="flex justify-between px-6 py-3 border-b hover:bg-slate-50">
                                            <span className="flex items-center gap-2">
                                                <Link href={`/accounting/ledger/${r.accountId}`} className="hover:underline text-blue-600 font-medium">
                                                    {r.accountName}
                                                </Link>
                                                <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1 rounded">{r.accountCode}</span>
                                            </span>
                                            <span className="font-mono text-slate-600">({formatCurrency(Math.abs(r.balance))})</span>
                                        </div>
                                    ))
                                )}
                                <div className="bg-orange-50 px-6 py-3 font-bold text-orange-800 flex justify-between items-center border-t border-b-2 border-orange-100">
                                    <span>إجمالي تكلفة الإيرادات</span>
                                    <span className="text-lg">({formatCurrency(data.totalCOGS)})</span>
                                </div>
                            </div>

                            {/* 3. Gross Profit */}
                            <div className="bg-slate-100 px-6 py-4 font-bold text-slate-900 flex justify-between items-center border-y-2 border-slate-300 mt-2 mb-6">
                                <span className="text-lg">مجمل الربح (Gross Profit)</span>
                                <span className="text-2xl">{formatCurrency(data.grossProfit)}</span>
                            </div>

                            {/* 4. Operating Expenses */}
                            <div className="section">
                                <div className="bg-slate-50 px-6 py-3 font-bold text-slate-700 flex justify-between items-center border-b border-t">
                                    <span>المصروفات التشغيلية (Expenses)</span>
                                </div>
                                {data.expenses.length === 0 ? (
                                    <div className="px-6 py-3 text-slate-400 italic">لا توجد مصروفات أخرى مسجلة</div>
                                ) : (
                                    data.expenses.map((r: any) => (
                                        <div key={r.accountCode} className="flex justify-between px-6 py-3 border-b hover:bg-slate-50">
                                            <span className="flex items-center gap-2">
                                                <Link href={`/accounting/ledger/${r.accountId}`} className="hover:underline text-blue-600 font-medium">
                                                    {r.accountName}
                                                </Link>
                                                <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1 rounded">{r.accountCode}</span>
                                            </span>
                                            <span className="font-mono text-slate-600">({formatCurrency(Math.abs(r.balance))})</span>
                                        </div>
                                    ))
                                )}
                                <div className="bg-red-50 px-6 py-3 font-bold text-red-800 flex justify-between items-center border-t border-b-2 border-red-100">
                                    <span>إجمالي المصروفات التشغيلية</span>
                                    <span className="text-lg">({formatCurrency(data.totalExpense)})</span>
                                </div>
                            </div>

                            {/* 5. Net Income */}
                            <div className={`mt-8 px-6 py-8 flex justify-between items-center rounded-b-lg border-t-4 ${data.netIncome >= 0
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                                : 'bg-red-50 border-red-500 text-red-900'
                                }`}>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-bold">صافي الربح / (الخسارة)</span>
                                    <span className="text-sm opacity-80">Net Income</span>
                                </div>
                                <span className="text-4xl font-bold font-mono tracking-tight">
                                    {formatCurrency(data.netIncome)}
                                </span>
                            </div>

                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
