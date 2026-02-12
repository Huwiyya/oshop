'use client';

import React, { useState, useEffect } from 'react';
import { getCustomerStatement, CustomerStatement } from '@/lib/report-actions';
import { getUsers } from '@/lib/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function CustomerStatementPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(true);

    // Filter State
    const [selectedUser, setSelectedUser] = useState('');
    const [fromDate, setFromDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')); // Start of month
    const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Report Data
    const [statement, setStatement] = useState<CustomerStatement | null>(null);
    const [loadingReport, setLoadingReport] = useState(false);

    useEffect(() => {
        getUsers().then(data => {
            setUsers(data);
            setLoadingUsers(false);
        });
    }, []);

    const handleSearch = async () => {
        if (!selectedUser) return;
        setLoadingReport(true);
        try {
            const data = await getCustomerStatement(selectedUser, fromDate, toDate);
            setStatement(data);
        } catch (e) {
            console.error(e);
            alert('حدث خطأ أثناء جلب الكشف');
        } finally {
            setLoadingReport(false);
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Control Panel (Hidden when printing) */}
            <Card className="print:hidden border-t-4 border-t-primary">
                <CardHeader>
                    <CardTitle>كشف حساب عميل (Customer Statement)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2 md:col-span-1">
                            <Label>العميل</Label>
                            <Select value={selectedUser} onValueChange={setSelectedUser}>
                                <SelectTrigger>
                                    <SelectValue placeholder={loadingUsers ? "جاري التحميل..." : "اختر العميل"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {users.map(u => (
                                        <SelectItem key={u.id} value={u.id}>
                                            {u.username || u.name || 'بدون اسم'} ({u.id.substring(0, 4)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>من تاريخ</Label>
                            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>إلى تاريخ</Label>
                            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
                        </div>
                        <Button onClick={handleSearch} disabled={loadingReport || !selectedUser} className="bg-primary gap-2">
                            {loadingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                            عراض الكشف
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Report Content */}
            {statement && (
                <div className="bg-white text-black p-8 rounded-xl shadow-sm border print:border-none print:shadow-none min-h-[500px]">

                    {/* Header */}
                    <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
                        <div>
                            <h1 className="text-3xl font-bold">Oshop - فرع مصراته</h1>
                            <p className="text-gray-600 mt-1">بناية التجارة العالمية، مصراته، ليبيا</p>
                            <p className="text-gray-600">هاتف: 0910000000</p>
                        </div>
                        <div className="text-left">
                            <h2 className="text-2xl font-bold uppercase tracking-wider text-primary print:text-black">كشف حساب</h2>
                            <h2 className="text-lg text-gray-500">Statement of Account</h2>
                            <div className="mt-4 text-sm">
                                <p><span className="font-bold">التاريخ:</span> {format(new Date(), 'yyyy-MM-dd')}</p>
                                <p><span className="font-bold">الفترة:</span> {fromDate} إلى {toDate}</p>
                            </div>
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200 print:bg-transparent print:border-gray-300">
                        <p className="text-sm text-gray-500 uppercase mb-1">بيانات العميل (Bill To)</p>
                        <h3 className="text-xl font-bold">{statement.customerName}</h3>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-4 mb-8 text-center print:hidden">
                        <div className="p-4 bg-gray-100 rounded-lg">
                            <div className="text-sm text-gray-500">رصيد افتتاحي</div>
                            <div className="font-bold text-lg">{statement.openingBalance.toLocaleString()}</div>
                        </div>
                        <div className="p-4 bg-emerald-50 rounded-lg text-emerald-700">
                            <div className="text-sm">إجمالي مدين (لنا)</div>
                            <div className="font-bold text-lg">{statement.totalDebit.toLocaleString()}</div>
                        </div>
                        <div className="p-4 bg-rose-50 rounded-lg text-rose-700">
                            <div className="text-sm">إجمالي دائن (لهم/دفعات)</div>
                            <div className="font-bold text-lg">{statement.totalCredit.toLocaleString()}</div>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg text-blue-700 border border-blue-200">
                            <div className="text-sm">رصيد ختامي</div>
                            <div className="font-bold text-lg">{statement.closingBalance.toLocaleString()}</div>
                        </div>
                    </div>

                    {/* Table */}
                    <Table className="border-collapse w-full">
                        <TableHeader className="bg-gray-100 print:bg-gray-200">
                            <TableRow>
                                <TableHead className="font-bold text-black border border-gray-300">التاريخ</TableHead>
                                <TableHead className="font-bold text-black border border-gray-300 w-1/4">البيان / الوصف</TableHead>
                                <TableHead className="font-bold text-black border border-gray-300 text-center">Reference</TableHead>
                                <TableHead className="font-bold text-black border border-gray-300 text-right">مدين (Debit)</TableHead>
                                <TableHead className="font-bold text-black border border-gray-300 text-right">دائن (Credit)</TableHead>
                                <TableHead className="font-bold text-black border border-gray-300 text-right bg-gray-200 print:bg-gray-300">الرصيد (Balance)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {/* Opening Balance Row */}
                            <TableRow className="bg-gray-50 font-medium">
                                <TableCell className="border border-gray-300">{fromDate}</TableCell>
                                <TableCell className="border border-gray-300 text-right" colSpan={4}>رصيد افتتاحي (Opening Balance)</TableCell>
                                <TableCell className="border border-gray-300 text-right dir-ltr font-mono">{statement.openingBalance.toLocaleString()}</TableCell>
                            </TableRow>

                            {/* Transactions */}
                            {statement.transactions.map((trx, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="border border-gray-300 text-sm">{format(new Date(trx.date), 'yyyy-MM-dd')}</TableCell>
                                    <TableCell className="border border-gray-300 text-sm">{trx.description}</TableCell>
                                    <TableCell className="border border-gray-300 text-center text-xs font-mono">{trx.reference}</TableCell>
                                    <TableCell className="border border-gray-300 text-right font-mono">{trx.debit > 0 ? trx.debit.toLocaleString() : '-'}</TableCell>
                                    <TableCell className="border border-gray-300 text-right font-mono">{trx.credit > 0 ? trx.credit.toLocaleString() : '-'}</TableCell>
                                    <TableCell className="border border-gray-300 text-right font-mono font-bold bg-gray-50">{trx.balance.toLocaleString()}</TableCell>
                                </TableRow>
                            ))}

                            {/* Closing Balance Row */}
                            <TableRow className="bg-gray-100 font-bold border-t-2 border-black">
                                <TableCell className="border border-gray-300" colSpan={3}>الإجماليات / الرصيد الختامي</TableCell>
                                <TableCell className="border border-gray-300 text-right">{statement.totalDebit.toLocaleString()}</TableCell>
                                <TableCell className="border border-gray-300 text-right">{statement.totalCredit.toLocaleString()}</TableCell>
                                <TableCell className="border border-gray-300 text-right text-lg">{statement.closingBalance.toLocaleString()}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>

                    {/* Footer */}
                    <div className="mt-12 grid grid-cols-2 gap-8 print:mt-24">
                        <div className="text-center">
                            <p className="border-t border-black pt-2 w-1/2 mx-auto">توقيع المحاسب</p>
                        </div>
                        <div className="text-center">
                            <p className="border-t border-black pt-2 w-1/2 mx-auto">توقيع / ختم العميل</p>
                        </div>
                    </div>

                    <div className="fixed bottom-8 left-8 print:hidden">
                        <Button size="lg" onClick={() => window.print()} className="shadow-xl rounded-full px-8 gap-2">
                            <Printer className="w-5 h-5" />
                            طباعة الكشف
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
