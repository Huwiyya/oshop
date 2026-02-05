
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileText, Search, Filter, Trash } from 'lucide-react';
import { getPurchaseInvoices, deletePurchaseInvoice } from '@/lib/purchase-actions';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function PurchaseInvoicesPage() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();
    const { toast } = useToast();

    const fetchInvoices = () => {
        setIsLoading(true);
        getPurchaseInvoices().then(data => {
            setInvoices(data || []);
            setIsLoading(false);
        });
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟ سيتم إلغاء تأثيرها على المخزون وحساب المورد.')) return;

        try {
            await deletePurchaseInvoice(id);
            toast({ title: 'تم حذف الفاتورة بنجاح' });
            fetchInvoices();
        } catch (err: any) {
            toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
        }
    };

    const filteredInvoices = invoices.filter(inv =>
        inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.supplier?.name_ar.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">فواتير الشراء</h1>
                    <p className="text-slate-500">إدارة مشتريات المخزون والموردين</p>
                </div>
                <Button className="gap-2 bg-emerald-600" onClick={() => router.push('/accounting/purchase-invoices/create')}>
                    <Plus className="w-4 h-4" />
                    فاتورة شراء جديدة
                </Button>
            </div>

            <Card>
                <div className="p-4 border-b flex items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <Input
                            placeholder="بحث برقم الفاتورة أو المورد..."
                            className="pr-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>رقم الفاتورة</TableHead>
                                <TableHead>تاريخ الفاتورة</TableHead>
                                <TableHead>المورد</TableHead>
                                <TableHead>العملة</TableHead>
                                <TableHead>الإجمالي</TableHead>
                                <TableHead>المدفوع</TableHead>
                                <TableHead>المتبقي</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={9} className="text-center py-10">جاري التحميل...</TableCell></TableRow>
                            ) : filteredInvoices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-10 text-slate-500">
                                        لا توجد فواتير شراء
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredInvoices.map((inv) => (
                                    <TableRow key={inv.id} className="cursor-pointer hover:bg-slate-50">
                                        <TableCell className="font-mono font-medium">{inv.invoice_number}</TableCell>
                                        <TableCell className="text-xs text-slate-500">{inv.invoice_date}</TableCell>
                                        <TableCell>{inv.supplier?.name_ar}</TableCell>
                                        <TableCell className="text-xs font-mono">{inv.currency} {inv.exchange_rate > 1 && `(${inv.exchange_rate})`}</TableCell>
                                        <TableCell className="font-bold">{formatCurrency(inv.total_amount)}</TableCell>
                                        <TableCell className="text-emerald-600">{formatCurrency(inv.paid_amount)}</TableCell>
                                        <TableCell className="text-red-600 font-medium">
                                            {inv.remaining_amount > 0 ? formatCurrency(inv.remaining_amount) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <PaymentStatusBadge status={inv.payment_status} />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="sm">عرض</Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={(e) => handleDelete(e, inv.id)}>
                                                    <Trash className="w-4 h-4" />
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

function PaymentStatusBadge({ status }: { status: string }) {
    const styles: any = {
        'paid': 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
        'partial': 'bg-amber-100 text-amber-700 hover:bg-amber-100',
        'unpaid': 'bg-red-100 text-red-700 hover:bg-red-100',
    };
    const labels: any = {
        'paid': 'مدفوعة',
        'partial': 'جزئي',
        'unpaid': 'غير مدفوعة',
    };
    return <Badge variant="secondary" className={styles[status] || ''}>{labels[status] || status}</Badge>;
}
