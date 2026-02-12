'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { getSalesInvoices, deleteSalesInvoice } from '@/lib/sales-actions';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ListFilter } from '@/components/accounting/list-filter';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function SalesInvoicesContent() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    useEffect(() => {
        setIsLoading(true);
        getSalesInvoices({
            query: searchParams.get('q') || undefined,
            startDate: searchParams.get('from') || undefined,
            endDate: searchParams.get('to') || undefined
        }).then(data => {
            setInvoices(data || []);
            setIsLoading(false);
        });
    }, [searchParams]);

    const handleDelete = async () => {
        if (!deletingId) return;
        try {
            const res = await deleteSalesInvoice(deletingId);
            if (res.success) {
                toast({ title: 'تم حذف الفاتورة بنجاح', description: 'تم التراجع عن جميع التأثيرات المالية والمخزنية.' });
                setInvoices(invoices.filter(i => i.id !== deletingId));
            } else {
                toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            }
        } catch (error) {
            toast({ title: 'خطأ', description: 'حدث خطأ أثناء الحذف', variant: 'destructive' });
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">فواتير البيع</h1>
                    <p className="text-slate-500">سجل المبيعات والأرباح</p>
                </div>
                <Button className="gap-2 bg-emerald-600" onClick={() => router.push('/accounting/sales-invoices/create')}>
                    <Plus className="w-4 h-4" />
                    فاتورة بيع جديدة
                </Button>
            </div>

            <ListFilter placeholder="بحث برقم الفاتورة أو الملاحظات..." />

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>رقم الفاتورة</TableHead>
                                <TableHead>تاريخ الفاتورة</TableHead>
                                <TableHead>العميل</TableHead>
                                <TableHead>البيان</TableHead>
                                <TableHead>العملة</TableHead>
                                <TableHead>الإجمالي (بيع)</TableHead>
                                <TableHead className="text-slate-500">التكلفة</TableHead>
                                <TableHead className="text-emerald-600">الربح</TableHead>
                                <TableHead>المدفوع</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={11} className="text-center py-10">جاري التحميل...</TableCell></TableRow>
                            ) : invoices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={11} className="text-center py-10 text-slate-500">
                                        لا توجد فواتير بيع
                                    </TableCell>
                                </TableRow>
                            ) : (
                                invoices.map((inv) => (
                                    <TableRow key={inv.id} className="cursor-pointer hover:bg-slate-50">
                                        <TableCell className="font-mono font-medium">{inv.invoice_number}</TableCell>
                                        <TableCell className="text-xs text-slate-500">{inv.invoice_date}</TableCell>
                                        <TableCell>{inv.customer?.name_ar}</TableCell>
                                        <TableCell className="text-xs text-slate-500 max-w-[200px] truncate" title={inv.notes}>
                                            {inv.notes || '-'}
                                        </TableCell>
                                        <TableCell className="text-xs font-mono">{inv.currency}</TableCell>
                                        <TableCell className="font-bold">{formatCurrency(inv.total_amount)}</TableCell>
                                        <TableCell className="text-slate-500 font-mono text-xs">{formatCurrency(inv.total_cost)}</TableCell>
                                        <TableCell className="text-emerald-600 font-bold font-mono">
                                            {formatCurrency(inv.total_amount - (inv.total_cost || 0))}
                                        </TableCell>
                                        <TableCell className="text-blue-600">{formatCurrency(inv.paid_amount)}</TableCell>
                                        <TableCell>
                                            <Badge variant={inv.payment_status === 'paid' ? 'default' : 'secondary'}>
                                                {inv.payment_status === 'paid' ? 'مدفوعة' : inv.payment_status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/accounting/sales-invoices/edit/${inv.id}`);
                                                    }}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-700 h-8 w-8 p-0"
                                                    onClick={(e) => { e.stopPropagation(); setDeletingId(inv.id); }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
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

            <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>حذف الفاتورة</AlertDialogTitle>
                        <AlertDialogDescription>
                            هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إلغاء جميع الحركات المالية والمخزنية المرتبطة بها.
                            لا يمكن التراجع عن هذا الإجراء.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            حذف نهائي
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default function SalesInvoicesPage() {
    return (
        <Suspense fallback={<div className="text-center py-10">جاري التحميل...</div>}>
            <SalesInvoicesContent />
        </Suspense>
    );
}
