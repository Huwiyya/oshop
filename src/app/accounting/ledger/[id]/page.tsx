import React from 'react';
import { getAccountDetailsV2, getAccountLedgerV2 } from '@/lib/accounting-v2-actions';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default async function AccountLedgerPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const account = await getAccountDetailsV2(id);
    const ledger = await getAccountLedgerV2(id);

    if (!account) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-red-500">الحساب غير موجود</h1>
                <Link href="/accounting/dashboard" className="text-primary hover:underline mt-4 block">
                    العودة للملخص المالي
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/accounting/dashboard">
                    <Button variant="ghost" size="icon">
                        <ArrowRight className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">{account.name_ar}</h1>
                    <div className="flex gap-2 items-center">
                        <p className="text-muted-foreground font-mono">{account.code}</p>
                        {/* Show category badge if available */}
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-t-4 border-t-primary">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">الرصيد الحالي</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold font-mono text-primary">
                            {formatCurrency(account.current_balance)}
                            <span className="text-lg font-normal text-muted-foreground ml-2">{account.currency}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>سجل الحركات (Ledger)</CardTitle>
                    <CardDescription>آخر العمليات المالية على هذا الحساب</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>رقم القيد</TableHead>
                                <TableHead>البيان</TableHead>
                                <TableHead className="text-left">مدين (Debit)</TableHead>
                                <TableHead className="text-left">دائن (Credit)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ledger && ledger.length > 0 ? (
                                ledger.map((entry: any) => (
                                    <TableRow key={entry.id}>
                                        <TableCell>{entry.journal_entries?.entry_date ? new Date(entry.journal_entries.entry_date).toLocaleDateString('en-GB') : '-'}</TableCell>
                                        <TableCell className="font-mono text-xs">{entry.journal_entries?.entry_number}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{entry.description || entry.journal_entries?.description}</span>
                                                {entry.journal_entries?.source_type && (
                                                    <span className="text-xs text-muted-foreground">
                                                        Ref: {entry.journal_entries?.source_type} #{entry.journal_entries?.source_id}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-left font-mono text-emerald-600 font-medium">
                                            {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                                        </TableCell>
                                        <TableCell className="text-left font-mono text-red-600 font-medium">
                                            {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        لا توجد حركات مسجلة حتى الآن
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
