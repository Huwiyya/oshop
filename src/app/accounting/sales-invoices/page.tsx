
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, DollarSign } from 'lucide-react';
import { getSalesInvoices } from '@/lib/sales-actions';
import { formatCurrency } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function SalesInvoicesPage() {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();

    useEffect(() => {
        getSalesInvoices().then(data => {
            setInvoices(data || []);
            setIsLoading(false);
        });
    }, []);

    const filteredInvoices = invoices.filter(inv =>
        inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.customer?.name_ar.includes(searchTerm)
    );

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

            <Card>
                <div className="p-4 border-b flex items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <Input
                            placeholder="بحث برقم الفاتورة أو العميل..."
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
                                <TableHead>العميل</TableHead>
                                <TableHead>العملة</TableHead>
                                <TableHead>الإجمالي (بيع)</TableHead>
                                <TableHead className="text-slate-500">التكلفة</TableHead>
                                <TableHead className="text-emerald-600">الربح</TableHead>
                                <TableHead>المدفوع</TableHead>
                                <TableHead>الحالة</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={9} className="text-center py-10">جاري التحميل...</TableCell></TableRow>
                            ) : filteredInvoices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-10 text-slate-500">
                                        لا توجد فواتير بيع
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredInvoices.map((inv) => (
                                    <TableRow key={inv.id} className="cursor-pointer hover:bg-slate-50">
                                        <TableCell className="font-mono font-medium">{inv.invoice_number}</TableCell>
                                        <TableCell className="text-xs text-slate-500">{inv.invoice_date}</TableCell>
                                        <TableCell>{inv.customer?.name_ar}</TableCell>
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
