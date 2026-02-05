import React from 'react';
import { getPayments } from '@/lib/payment-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, ArrowUpRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

export default async function PaymentsPage() {
    const payments = await getPayments();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">المدفوعات (Payments)</h1>
                    <p className="text-muted-foreground">سندات الصرف والمصروفات</p>
                </div>
                <Link href="/admin/accounting/payments/new">
                    <Button className="gap-2 bg-rose-600 hover:bg-rose-700">
                        <Plus className="w-4 h-4" />
                        سند صرف جديد
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>سجل المدفوعات</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>المرجع</TableHead>
                                <TableHead>الحساب الدافع</TableHead>
                                <TableHead>المستفيد</TableHead>
                                <TableHead>البيان</TableHead>
                                <TableHead>المبلغ</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payments.map((pay) => (
                                <TableRow key={pay.id}>
                                    <TableCell>{format(new Date(pay.date), 'yyyy-MM-dd')}</TableCell>
                                    <TableCell className="font-mono text-xs">{pay.reference}</TableCell>
                                    <TableCell className="flex items-center gap-2">
                                        <ArrowUpRight className="w-4 h-4 text-rose-500" />
                                        {pay.paymentAccountName}
                                    </TableCell>
                                    <TableCell>{pay.payee || '-'}</TableCell>
                                    <TableCell>{pay.description}</TableCell>
                                    <TableCell className="font-bold text-rose-600">
                                        {pay.amount.toLocaleString()} <span className="text-xs text-gray-400">{pay.currency}</span>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {payments.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        لا توجد سندات صرف مسجلة
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
