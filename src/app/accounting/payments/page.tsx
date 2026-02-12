'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getPayments, deletePayment } from '@/lib/payment-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, ArrowUpRight, Trash2, Edit } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ListFilter } from '@/components/accounting/list-filter';
import { useToast } from '@/components/ui/use-toast';

function PaymentsContent() {
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [payments, setPayments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchPayments = async () => {
        setIsLoading(true);
        const data = await getPayments({
            query: searchParams.get('q') || undefined,
            startDate: searchParams.get('from') || undefined,
            endDate: searchParams.get('to') || undefined
        });
        setPayments(data);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchPayments();
    }, [searchParams]);

    const handleDelete = async (id: string, reference: string) => {
        if (!confirm(`هل أنت متأكد من حذف سند الصرف ${reference}؟ سيتم حذف القيد اليومي المرتبط أيضاً.`)) {
            return;
        }

        const result = await deletePayment(id);
        if (result.success) {
            toast({ title: 'تم الحذف بنجاح', description: 'تم حذف سند الصرف والقيد المرتبط' });
            fetchPayments();
        } else {
            toast({ title: 'خطأ', description: result.error, variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">المدفوعات (Payments)</h1>
                    <p className="text-muted-foreground">سندات الصرف والمصروفات</p>
                </div>
                <Link href="/accounting/payments/new">
                    <Button className="gap-2 bg-rose-600 hover:bg-rose-700">
                        <Plus className="w-4 h-4" />
                        سند صرف جديد
                    </Button>
                </Link>
            </div>

            <ListFilter placeholder="بحث بالمستفيد، البيان، أو المرجع..." />

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
                                <TableHead className="text-center">الإجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">جاري التحميل...</TableCell>
                                </TableRow>
                            ) : payments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        لا توجد سندات صرف مسجلة
                                    </TableCell>
                                </TableRow>
                            ) : (
                                payments.map((pay) => (
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
                                        <TableCell>
                                            <div className="flex items-center justify-center gap-2">
                                                <Link href={`/accounting/payments/edit/${pay.id}`}>
                                                    <Button variant="ghost" size="sm" className="h-8 gap-1">
                                                        <Edit className="w-3.5 h-3.5" />
                                                        تعديل
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDelete(pay.id, pay.reference)}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    حذف
                                                </Button>
                                            </div>
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

export default function PaymentsPage() {
    return (
        <Suspense fallback={<div className="text-center py-10">جاري التحميل...</div>}>
            <PaymentsContent />
        </Suspense>
    );
}
