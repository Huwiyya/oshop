'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getTrialBalance, getIncomeStatement, getBalanceSheet } from '@/lib/report-actions';
import { formatCurrency } from '@/lib/utils';
import { Printer, DollarSign } from 'lucide-react';
import Link from 'next/link';

export default function FinancialReportsPage() {
    const [startDate, setStartDate] = useState(new Date().getFullYear() + '-01-01');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);

    // Data State
    const [trialBalance, setTrialBalance] = useState<any[]>([]);
    const [incomeData, setIncomeData] = useState<any>(null);
    const [balanceSheet, setBalanceSheet] = useState<any>(null);

    const loadTrialBalance = async () => {
        setLoading(true);
        const data = await getTrialBalance(startDate, endDate);
        setTrialBalance(data || []);
        setLoading(false);
    };

    const loadIncomeStatement = async () => {
        setLoading(true);
        const data = await getIncomeStatement(startDate, endDate);
        setIncomeData(data);
        setLoading(false);
    };

    const loadBalanceSheet = async () => {
        setLoading(true);
        const data = await getBalanceSheet();
        setBalanceSheet(data);
        setLoading(false);
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">التقارير المالية الختامية</h1>
                <div className="flex gap-2">
                    <Button variant="default" onClick={() => window.location.href = '/accounting/reports/cash-flow'} className="gap-2 bg-blue-600 hover:bg-blue-700">
                        <Printer className="w-4 h-4" />
                        قائمة التدفقات النقدية
                    </Button>
                    <Button variant="secondary" onClick={() => window.location.href = '/accounting/reports/income-statement'} className="gap-2 bg-slate-200 hover:bg-slate-300 text-slate-800">
                        <Printer className="w-4 h-4" />
                        قائمة الدخل التفصيلية
                    </Button>
                    <Button variant="secondary" onClick={() => window.location.href = '/accounting/reports/cost-of-revenue'} className="gap-2 bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-200">
                        <DollarSign className="w-4 h-4" />
                        تقرير تكلفة المبيعات
                    </Button>
                    <Button variant="outline" onClick={() => window.print()} className="gap-2">
                        <Printer className="w-4 h-4" /> طباعة
                    </Button>
                </div>
            </div>

            <div className="flex gap-4 items-end bg-white p-4 rounded-lg border shadow-sm">
                <div className="space-y-2">
                    <span className="text-sm font-medium">من تاريخ</span>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <span className="text-sm font-medium">إلى تاريخ</span>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
            </div>

            <Tabs defaultValue="trial" className="w-full">
                <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                    <TabsTrigger value="trial" onClick={loadTrialBalance}>ميزان المراجعة</TabsTrigger>
                    <TabsTrigger value="income" onClick={loadIncomeStatement}>قائمة الدخل</TabsTrigger>
                    <TabsTrigger value="balance" onClick={loadBalanceSheet}>المركز المالي</TabsTrigger>
                </TabsList>

                <TabsContent value="trial">
                    <Card>
                        <CardHeader>
                            <CardTitle>ميزان المراجعة بالأرصدة</CardTitle>
                            <CardDescription>للفترة من {startDate} إلى {endDate}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-right">رقم الحساب</TableHead>
                                            <TableHead className="text-right">اسم الحساب</TableHead>
                                            <TableHead className="text-right">مدين</TableHead>
                                            <TableHead className="text-right">دائن</TableHead>
                                            <TableHead className="text-right">الرصيد</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {trialBalance.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">اضغط لعرض البيانات</TableCell></TableRow>
                                        ) : (
                                            trialBalance.map((row) => (
                                                <TableRow key={row.accountCode}>
                                                    <TableCell className="font-mono">{row.accountCode}</TableCell>
                                                    <TableCell>{row.accountName}</TableCell>
                                                    <TableCell>{formatCurrency(row.debit)}</TableCell>
                                                    <TableCell>{formatCurrency(row.credit)}</TableCell>
                                                    <TableCell className={row.balance < 0 ? 'text-red-500 font-bold' : 'text-emerald-600 font-bold'}>
                                                        {formatCurrency(Math.abs(row.balance))} {row.balance < 0 ? '(Cr)' : '(Dr)'}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                        {trialBalance.length > 0 && (
                                            <TableRow className="bg-slate-50 font-bold">
                                                <TableCell colSpan={2}>الإجمالي</TableCell>
                                                <TableCell>{formatCurrency(trialBalance.reduce((s, r) => s + r.debit, 0))}</TableCell>
                                                <TableCell>{formatCurrency(trialBalance.reduce((s, r) => s + r.credit, 0))}</TableCell>
                                                <TableCell>-</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="income">
                    <Card>
                        <CardHeader>
                            <CardTitle>قائمة الدخل (الأرباح والخسائر)</CardTitle>
                            <CardDescription>للفترة من {startDate} إلى {endDate}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {!incomeData ? <div className="text-center py-8">جاري التحميل...</div> : (
                                <>
                                    {/* Revenues */}
                                    <div className="space-y-2">
                                        <h3 className="font-semibold text-emerald-700 bg-emerald-50 p-2 rounded">الإيرادات</h3>
                                        {incomeData.revenues.map((r: any) => (
                                            <div key={r.accountCode} className="flex justify-between px-4 py-2 border-b text-sm">
                                                <span>{r.accountName} <span className="text-xs text-slate-400">({r.accountCode})</span></span>
                                                <span>{formatCurrency(Math.abs(r.balance))}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between px-4 py-2 font-bold bg-slate-50">
                                            <span>إجمالي الإيرادات</span>
                                            <span>{formatCurrency(incomeData.totalRevenue)}</span>
                                        </div>
                                    </div>

                                    {/* COGS */}
                                    <div className="space-y-2">
                                        <h3 className="font-semibold text-orange-700 bg-orange-50 p-2 rounded">تكلفة الإيرادات</h3>
                                        {incomeData.cogs?.map((r: any) => (
                                            <div key={r.accountCode} className="flex justify-between px-4 py-2 border-b text-sm">
                                                <span>{r.accountName} <span className="text-xs text-slate-400">({r.accountCode})</span></span>
                                                <span>{formatCurrency(Math.abs(r.balance))}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between px-4 py-2 font-bold bg-slate-50">
                                            <span>إجمالي تكلفة الإيرادات</span>
                                            <span>{formatCurrency(incomeData.totalCOGS || 0)}</span>
                                        </div>
                                    </div>

                                    {/* Expenses */}
                                    <div className="space-y-2">
                                        <h3 className="font-semibold text-red-700 bg-red-50 p-2 rounded">المصروفات التشغيلية</h3>
                                        {incomeData.expenses.map((r: any) => (
                                            <div key={r.accountCode} className="flex justify-between px-4 py-2 border-b text-sm">
                                                <span>{r.accountName} <span className="text-xs text-slate-400">({r.accountCode})</span></span>
                                                <span>{formatCurrency(Math.abs(r.balance))}</span>
                                            </div>
                                        ))}
                                        <div className="flex justify-between px-4 py-2 font-bold bg-slate-50">
                                            <span>إجمالي المصروفات</span>
                                            <span>{formatCurrency(incomeData.totalExpense)}</span>
                                        </div>
                                    </div>

                                    {/* Net Income */}
                                    <div className={`flex justify-between p-4 rounded-lg text-lg font-bold ${incomeData.netIncome >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                        <span>صافي الربح / (الخسارة)</span>
                                        <span>{formatCurrency(incomeData.netIncome)}</span>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="balance">
                    <Card>
                        <CardHeader>
                            <CardTitle>قائمة المركز المالي (الميزانية العمومية)</CardTitle>
                            <CardDescription>كما في {new Date().toLocaleDateString()}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {!balanceSheet ? <div className="text-center py-8">جاري التحميل...</div> : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Assets */}
                                    <div className="space-y-4">
                                        <h3 className="text-center font-bold bg-slate-100 p-2 rounded">الأصول (Assets)</h3>
                                        <div className="space-y-1">
                                            {balanceSheet.assets.map((a: any) => (
                                                <div key={a.id} className={`flex justify-between text-sm py-1 border-b border-dashed ${a.is_parent ? 'font-bold bg-slate-50' : ''}`}>
                                                    <span>
                                                        <Link href={`/accounting/ledger/${a.id}`} className="hover:underline text-blue-600">
                                                            {a.name_ar}
                                                        </Link>
                                                        <span className="text-xs text-slate-400 mx-2">({a.account_code})</span>
                                                    </span>
                                                    <span>{formatCurrency(a.balance)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="bg-slate-200 p-2 flex justify-between font-bold rounded">
                                            <span>إجمالي الأصول</span>
                                            <span>{formatCurrency(balanceSheet.totalAssets)}</span>
                                        </div>
                                    </div>

                                    {/* Liabilities & Equity */}
                                    <div className="space-y-8">
                                        {/* Liabilities */}
                                        <div className="space-y-4">
                                            <h3 className="text-center font-bold bg-slate-100 p-2 rounded">الخصوم (Liabilities)</h3>
                                            <div className="space-y-1">
                                                {balanceSheet.liabilities.map((a: any) => (
                                                    <div key={a.id} className={`flex justify-between text-sm py-1 border-b border-dashed ${a.is_parent ? 'font-bold bg-slate-50' : ''}`}>
                                                        <span>
                                                            <Link href={`/accounting/ledger/${a.id}`} className="hover:underline text-blue-600">
                                                                {a.name_ar}
                                                            </Link>
                                                            <span className="text-xs text-slate-400 mx-2">({a.account_code})</span>
                                                        </span>
                                                        <span>{formatCurrency(a.balance)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="bg-slate-200 p-2 flex justify-between font-bold rounded">
                                                <span>إجمالي الخصوم</span>
                                                <span>{formatCurrency(balanceSheet.totalLiabilities)}</span>
                                            </div>
                                        </div>

                                        {/* Equity */}
                                        <div className="space-y-4">
                                            <h3 className="text-center font-bold bg-slate-100 p-2 rounded">حقوق الملكية (Equity)</h3>
                                            <div className="space-y-1">
                                                {balanceSheet.equity.map((a: any) => (
                                                    <div key={a.id} className={`flex justify-between text-sm py-1 border-b border-dashed ${a.is_parent ? 'font-bold bg-slate-50' : ''}`}>
                                                        <span>
                                                            <Link href={`/accounting/ledger/${a.id}`} className="hover:underline text-blue-600">
                                                                {a.name_ar}
                                                            </Link>
                                                            <span className="text-xs text-slate-400 mx-2">({a.account_code})</span>
                                                        </span>
                                                        <span>{formatCurrency(a.balance)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="bg-slate-200 p-2 flex justify-between font-bold rounded">
                                                <span>إجمالي حقوق الملكية</span>
                                                <span>{formatCurrency(balanceSheet.totalEquity)}</span>
                                            </div>
                                        </div>

                                        <div className="bg-slate-800 text-white p-2 flex justify-between font-bold rounded">
                                            <span>إجمالي الخصوم وحقوق الملكية</span>
                                            <span>{formatCurrency(balanceSheet.totalLiabilities + balanceSheet.totalEquity)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
