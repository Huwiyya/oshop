'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getReceipts, deleteReceipt } from '@/lib/receipt-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, ArrowDownLeft, Trash2, Edit } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ListFilter } from '@/components/accounting/list-filter';
import { useToast } from '@/components/ui/use-toast';

function ReceiptsContent() {
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [receipts, setReceipts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchReceipts = async () => {
        setIsLoading(true);
        const data = await getReceipts({
            query: searchParams.get('q') || undefined,
            startDate: searchParams.get('from') || undefined,
            endDate: searchParams.get('to') || undefined
        });
        setReceipts(data);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchReceipts();
    }, [searchParams]);

    const handleDelete = async (id: string, reference: string) => {
        if (!confirm(`هل أنت متأكد من حذف سند القبض ${reference}؟ سيتم حذف القيد اليومي المرتبط أيضاً.`)) {
            return;
        }

        const result = await deleteReceipt(id);
        if (result.success) {
            toast({ title: 'تم الحذف بنجاح', description: 'تم حذف سند القبض والقيد المرتبط' });
            fetchReceipts();
        } else {
            toast({ title: 'خطأ', description: result.error, variant: 'destructive' });
        }
    };

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

            <ListFilter placeholder="بحث بالمرجع، البيان، أو اسم العميل..." />

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
                                <TableHead className="text-center">الإجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">جاري التحميل...</TableCell>
                                </TableRow>
                            ) : receipts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        لا توجد سندات قبض مسجلة
                                    </TableCell>
                                </TableRow>
                            ) : (
                                receipts.map((rec) => (
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
                                        <TableCell>
                                            <div className="flex items-center justify-center gap-2">
                                                <Link href={`/accounting/receipts/edit/${rec.id}`}>
                                                    <Button variant="ghost" size="sm" className="h-8 gap-1">
                                                        <Edit className="w-3.5 h-3.5" />
                                                        تعديل
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDelete(rec.id, rec.reference)}
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

export default function ReceiptsPage() {
    return (
        <Suspense fallback={<div className="text-center py-10">جاري التحميل...</div>}>
            <ReceiptsContent />
        </Suspense>
    );
}
