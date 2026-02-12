'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Printer, ArrowLeft } from 'lucide-react';
import { getCashFlowStatement, type CashFlowData } from '@/lib/report-actions';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function CashFlowPage() {
    const router = useRouter();
    // Default to current year start to today
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [data, setData] = useState<CashFlowData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSearch = async () => {
        setIsLoading(true);
        try {
            const result = await getCashFlowStatement(startDate, endDate);
            setData(result);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10 p-4">
            {/* Header */}
            <div className="flex items-center justify-between no-print">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">قائمة التدفقات النقدية</h1>
                        <p className="text-slate-500">تحليل حركة النقد التشغيلية والاستثمارية والتمويلية</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => window.print()} className="gap-2">
                        <Printer className="w-4 h-4" />
                        طباعة
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card className="no-print">
                <CardContent className="p-6 flex flex-wrap items-end gap-4">
                    <div className="space-y-2">
                        <Label>من تاريخ</Label>
                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>إلى تاريخ</Label>
                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <Button onClick={handleSearch} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                        <Search className="w-4 h-4" />
                        {isLoading ? 'جاري التحميل...' : 'عرض التقرير'}
                    </Button>
                </CardContent>
            </Card>

            {/* Print Header */}
            <div className="hidden print:block text-center mb-8">
                <h1 className="text-2xl font-bold">قائمة التدفقات النقدية</h1>
                <p className="text-slate-500">للفترة من {startDate} إلى {endDate}</p>
            </div>

            {/* Report Content */}
            {data ? (
                <div className="space-y-6 print:space-y-4">
                    {/* Operating */}
                    <SectionCard
                        title="الأنشطة التشغيلية"
                        total={data.operatingActivities + data.netIncome}
                        color="blue"
                    >
                        <Row label="صافي الربح (قبل البنود غير النقدية)" amount={data.netIncome} bold />
                        {data.operatingDetails.map((item, idx) => (
                            <Row key={idx} label={item.name} amount={item.amount} />
                        ))}
                    </SectionCard>

                    {/* Investing */}
                    <SectionCard
                        title="الأنشطة الاستثمارية"
                        total={data.investingActivities}
                        color="purple"
                    >
                        {data.investingDetails.length === 0 && <p className="text-center text-slate-400 py-2 text-sm">لا توجد حركات استثمارية</p>}
                        {data.investingDetails.map((item, idx) => (
                            <Row key={idx} label={item.name} amount={item.amount} />
                        ))}
                    </SectionCard>

                    {/* Financing */}
                    <SectionCard
                        title="الأنشطة التمويلية"
                        total={data.financingActivities}
                        color="orange"
                    >
                        {data.financingDetails.length === 0 && <p className="text-center text-slate-400 py-2 text-sm">لا توجد حركات تمويلية</p>}
                        {data.financingDetails.map((item, idx) => (
                            <Row key={idx} label={item.name} amount={item.amount} />
                        ))}
                    </SectionCard>

                    {/* Summary */}
                    <Card className="bg-emerald-50 border-emerald-200 print:bg-white print:border-black">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-center text-xl font-bold text-emerald-900 print:text-black">
                                <span>صافي التغير في النقدية</span>
                                <span className="dir-ltr">{formatCurrency(data.netCashFlow)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="text-center py-20 text-slate-400 bg-slate-50 rounded-lg border border-dashed no-print">
                    اختر الفترة واضغط عرض لجلب البيانات
                </div>
            )}
        </div>
    );
}

function SectionCard({ title, total, children, color }: { title: string, total: number, children: React.ReactNode, color: 'blue' | 'purple' | 'orange' }) {
    const colorClasses = {
        blue: 'border-t-4 border-t-blue-500',
        purple: 'border-t-4 border-t-purple-500',
        orange: 'border-t-4 border-t-orange-500',
    };

    return (
        <Card className={`${colorClasses[color]} shadow-sm print:border print:border-slate-300 print:shadow-none`}>
            <CardHeader className="pb-2 border-b bg-slate-50/50 print:bg-white">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">{title}</CardTitle>
                    <span className={`font-bold font-mono text-lg dir-ltr ${total < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {formatCurrency(total)}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-1">
                {children}
            </CardContent>
        </Card>
    );
}

function Row({ label, amount, bold = false }: { label: string, amount: number, bold?: boolean }) {
    return (
        <div className={`flex justify-between items-center py-2 px-2 rounded hover:bg-slate-50 border-b border-slate-50 last:border-0 print:border-slate-200 ${bold ? 'font-semibold bg-slate-50 print:bg-white' : ''}`}>
            <span>{label}</span>
            <span className={`font-mono dir-ltr ${amount < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                {formatCurrency(amount)}
            </span>
        </div>
    );
}
