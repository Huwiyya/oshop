
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, FileText, Printer, Calendar } from 'lucide-react';
import { getAccountDetails, getAccountLedger } from '@/lib/accounting-actions';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export default function AccountLedgerPage() {
    const { id } = useParams();
    const router = useRouter();
    const [account, setAccount] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            if (!id) return;
            setIsLoading(true);
            try {
                const [accData, transData] = await Promise.all([
                    getAccountDetails(id as string),
                    getAccountLedger(id as string)
                ]);
                setAccount(accData);

                // Calculate Running Balance
                // 1. Sort Oldest to Newest
                // transData comes Newest first (DESC) from backend usually, let's ensure.
                // We trust backend sorting, so simple reverse makes it Oldest First.
                const sortedAsc = [...(transData || [])].reverse();

                // 2. Determine Normal Balance
                // Assets/Expenses = Debit Normal
                // Liab/Equity/Revenue = Credit Normal
                const isCreditNormal = accData.account_code.startsWith('2') ||
                    accData.account_code.startsWith('3') ||
                    accData.account_code.startsWith('4');

                let balance = 0;
                const withBalance = sortedAsc.map(t => {
                    const dr = Number(t.debit) || 0;
                    const cr = Number(t.credit) || 0;

                    if (isCreditNormal) {
                        balance += (cr - dr); // Increase with Credit
                    } else {
                        balance += (dr - cr); // Increase with Debit
                    }

                    return { ...t, runningBalance: balance, isCreditNormal };
                });

                // 3. Reverse back to Newest First for Display
                setTransactions(withBalance.reverse());

            } catch (error) {
                console.error("Error loading ledger:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [id]);

    if (isLoading) {
        return <div className="p-8 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>;
    }

    if (!account) {
        return <div className="text-center p-8">الحساب غير موجود</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border shadow-sm">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" onClick={() => router.back()}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h1 className="text-2xl font-bold text-slate-900">{account.name_ar}</h1>
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-mono text-slate-500">
                            {account.account_code}
                        </span>
                    </div>
                    <p className="text-slate-500 mr-8">
                        {account.name_en} • {account.currency}
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-left px-4 border-l border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">الرصيد الحالي</p>
                        <p className={`text-2xl font-bold font-mono ${Number(account.current_balance) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {formatCurrency(Math.abs(Number(account.current_balance)))}
                            <span className="text-sm font-normal text-slate-400 mr-1">
                                {Number(account.current_balance) >= 0 ? 'له' : 'عليه'}
                            </span>
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon">
                            <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" className="gap-2">
                            <Download className="w-4 h-4" />
                            PDF
                        </Button>
                    </div>
                </div>
            </div>

            {/* Transactions Table */}
            <Card>
                <CardHeader className="border-b bg-slate-50/50 pb-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="w-5 h-5 text-slate-500" />
                            حركة الحساب التفصيلية
                        </CardTitle>
                        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-3 py-1.5 rounded-md border">
                            <Calendar className="w-4 h-4" />
                            <span>جميع الفترات</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="w-[120px]">التاريخ</TableHead>
                                <TableHead className="w-[120px]">رقم المستند</TableHead>
                                <TableHead className="w-[150px]">نوع الحركة</TableHead>
                                <TableHead>البيان / الشرح</TableHead>
                                <TableHead className="text-left w-[120px] text-emerald-600">مدين (لنا)</TableHead>
                                <TableHead className="text-left w-[120px] text-red-600">دائن (لهم)</TableHead>
                                <TableHead className="text-left w-[120px] font-bold">الرصيد</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10 text-slate-500">
                                        لا توجد حركات مسجلة لهذا الحساب
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.map((trx) => (
                                    <TableRow key={trx.id} className="group hover:bg-slate-50 transition-colors">
                                        <TableCell className="font-mono text-xs">
                                            {trx.journal_entries?.entry_date}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-slate-500">
                                            {trx.journal_entries?.entry_number}
                                        </TableCell>
                                        <TableCell>
                                            <span className="bg-slate-100 px-2 py-1 rounded text-xs font-medium">
                                                {getReferenceLabel(trx.journal_entries?.reference_type)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="max-w-[300px] truncate" title={trx.description || trx.journal_entries?.description}>
                                            {trx.description || trx.journal_entries?.description}
                                        </TableCell>
                                        <TableCell className="text-left font-mono">
                                            {Number(trx.debit) > 0 ? formatCurrency(trx.debit) : '-'}
                                        </TableCell>
                                        <TableCell className="text-left font-mono">
                                            {Number(trx.credit) > 0 ? formatCurrency(trx.credit) : '-'}
                                        </TableCell>
                                        <TableCell className={`text-left font-mono font-bold ${trx.runningBalance < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                                            {formatCurrency(Math.abs(trx.runningBalance))}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function getReferenceLabel(type: string) {
    switch (type) {
        case 'manual': return 'قيد يدوي';
        case 'receipt': return 'سند قبض';
        case 'payment': return 'سند دفع';
        case 'sales_invoice': return 'فاتورة مبيعات';
        case 'purchase_invoice': return 'فاتورة مشتريات';
        default: return type || 'غير محدد';
    }
}
