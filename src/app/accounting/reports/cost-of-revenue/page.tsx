'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getIncomeStatement } from '@/lib/report-actions'; // We can reuse this as it already separates COGS
import { formatCurrency } from '@/lib/utils';
import { Printer, ArrowLeft, Search, TrendingUp, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CostOfRevenueReport() {
    const router = useRouter();
    const [startDate, setStartDate] = useState(new Date().getFullYear() + '-01-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);

    const loadReport = async () => {
        setLoading(true);
        try {
            // function returns { revenues, cogs, expenses, ... }
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

    // Calculate percentage of total cost
    const totalCost = data?.totalCOGS || 0;

    return (
        <div className="container mx-auto py-8 max-w-4xl space-y-6 print:py-0 print:max-w-none">
            {/* Header - Hidden in Print */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 print:hidden">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">تقرير تكلفة المبيعات</h1>
                        <p className="text-slate-500">تحليل تفصيلي لتكاليف الإيرادات المباشرة</p>
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
                    <Button onClick={loadReport} disabled={loading} className="h-9 gap-2 bg-orange-600 hover:bg-orange-700">
                        <Search className="w-4 h-4" /> عرض
                    </Button>
                    <Button variant="outline" onClick={() => window.print()} className="h-9 gap-2">
                        <Printer className="w-4 h-4" /> طباعة
                    </Button>
                </div>
            </div>

            {/* Key Metrics Cards */}
            {data && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
                    <Card className="bg-orange-50 border-orange-200">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-orange-800">إجمالي تكلفة المبيعات</p>
                                <h3 className="text-2xl font-bold text-orange-900 mt-2">{formatCurrency(data.totalCOGS)}</h3>
                            </div>
                            <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                                <DollarSign className="h-5 w-5 text-orange-600" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-blue-800">نسبة التكلفة من الإيرادات</p>
                                <h3 className="text-2xl font-bold text-blue-900 mt-2">
                                    {data.totalRevenue > 0
                                        ? ((data.totalCOGS / data.totalRevenue) * 100).toFixed(1) + '%'
                                        : 'N/A'}
                                </h3>
                            </div>
                            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <TrendingUp className="h-5 w-5 text-blue-600" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Report Content */}
            <Card className="print:shadow-none print:border-none">
                <CardHeader className="text-center border-b pb-6">
                    <CardTitle className="text-3xl font-serif">تقرير تكلفة المبيعات</CardTitle>
                    <CardDescription className="text-lg">
                        Cost of Revenue Statement<br />
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
                            {/* Table Header */}
                            <div className="bg-slate-50 px-6 py-3 font-bold text-slate-700 flex justify-between items-center border-b">
                                <div className="w-2/3">بند التكلفة (Account)</div>
                                <div className="w-1/3 text-left">القيمة (Amount)</div>
                            </div>

                            {/* Data Rows */}
                            {data.cogs.length === 0 ? (
                                <div className="px-6 py-8 text-center text-slate-400 italic bg-gray-50/50">
                                    لا توجد تكاليف مبيعات مسجلة في هذه الفترة
                                </div>
                            ) : (
                                data.cogs.map((r: any) => (
                                    <div key={r.accountCode} className="flex justify-between px-6 py-4 border-b hover:bg-orange-50/10 transition-colors">
                                        <div className="flex flex-col w-2/3">
                                            <span className="font-semibold text-slate-800">{r.accountName}</span>
                                            <span className="text-xs text-slate-400 font-mono">{r.accountCode}</span>
                                        </div>
                                        <div className="w-1/3 text-left font-mono font-medium text-slate-700">
                                            {formatCurrency(Math.abs(r.balance))}
                                        </div>
                                    </div>
                                ))
                            )}

                            {/* Total Footer */}
                            <div className="bg-orange-50 px-6 py-4 font-bold text-orange-900 flex justify-between items-center border-t border-b-2 border-orange-200">
                                <span className="text-lg">الإجمالي (Total Cost of Sales)</span>
                                <span className="text-2xl">{formatCurrency(data.totalCOGS)}</span>
                            </div>
                        </div>
                    )}
                </CardContent>
                {data?.cogs.length > 0 && (
                    <div className="bg-slate-50 p-4 text-xs text-slate-400 text-center">
                        تقرير صادر من النظام المحاسبي - {new Date().toLocaleDateString('en-GB')}
                    </div>
                )}
            </Card>
        </div>
    );
}
