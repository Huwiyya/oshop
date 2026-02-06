import React from 'react';
import { getReceipts } from '@/lib/receipt-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, ArrowDownLeft } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

export default async function ReceiptsPage() {
    const receipts = await getReceipts();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">المقبوضات (Receipts)</h1>
                    <p className="text-muted-foreground">سندات القبض والدخل النقدي</p>
                </div>
                <Link href="/accounting/receipts/new">
                    <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4" />
                        سند قبض جديد
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>سجل المقبوضات</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>المرجع</TableHead>
                                <TableHead>الحساب المستلم</TableHead>
                                <TableHead>المستلم منه</TableHead>
                                <TableHead>البيان</TableHead>
                                <TableHead>المبلغ</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {receipts.map((rec) => (
                                <TableRow key={rec.id}>
                                    <TableCell>{format(new Date(rec.date), 'yyyy-MM-dd')}</TableCell>
                                    <TableCell className="font-mono text-xs">{rec.reference}</TableCell>
                                    <TableCell className="flex items-center gap-2">
                                        <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                                        {rec.receiveAccountName}
                                    </TableCell>
                                    <TableCell>{rec.payer || '-'}</TableCell>
                                    <TableCell>{rec.description}</TableCell>
                                    <TableCell className="font-bold text-emerald-600">
                                        {rec.amount.toLocaleString()} <span className="text-xs text-gray-400">{rec.currency}</span>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {receipts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        لا توجد سندات قبض مسجلة
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
