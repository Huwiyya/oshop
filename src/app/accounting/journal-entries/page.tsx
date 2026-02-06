
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileText } from 'lucide-react';
import { getJournalEntries } from '@/lib/journal-actions';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ListFilter } from '@/components/accounting/list-filter';

export default function JournalEntriesPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getJournalEntries({
            query: searchParams.get('q') || undefined,
            startDate: searchParams.get('from') || undefined,
            endDate: searchParams.get('to') || undefined
        }).then(data => {
            setEntries(data || []);
            setLoading(false);
        });
    }, [searchParams]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">القيود اليومية</h1>
                    <p className="text-slate-500">سجل المعاملات المالية والمحاسبية</p>
                </div>
                <Button className="gap-2 bg-emerald-600" onClick={() => router.push('/accounting/journal-entries/create')}>
                    <Plus className="w-4 h-4" />
                    قيد يومية جديد
                </Button>
            </div>

            <ListFilter placeholder="بحث برقم القيد أو الوصف..." />

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>رقم القيد</TableHead>
                                <TableHead>التاريخ</TableHead>
                                <TableHead className="w-[40%]">البيان (الوصف)</TableHead>
                                <TableHead>النوع</TableHead>
                                <TableHead>الإجمالي</TableHead>
                                <TableHead>الحالة</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-10">جاري التحميل...</TableCell></TableRow>
                            ) : entries.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-10 text-slate-500">لا توجد قيود مسجلة</TableCell>
                                </TableRow>
                            ) : (
                                entries.map((entry) => (
                                    <TableRow key={entry.id} className="hover:bg-slate-50">
                                        <TableCell className="font-mono font-medium">{entry.entry_number}</TableCell>
                                        <TableCell className="text-sm">{entry.entry_date}</TableCell>
                                        <TableCell className="text-slate-600">{entry.description}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal text-xs">
                                                {entry.reference_type === 'manual' ? 'يدوي' :
                                                    entry.reference_type === 'invoice' ? 'فاتورة' :
                                                        entry.reference_type === 'payroll' ? 'رواتب' :
                                                            entry.reference_type === 'depreciation' ? 'إهلاك' : entry.reference_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-bold font-mono text-emerald-700">
                                            {formatCurrency(entry.total_debit)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={entry.status === 'posted' ? 'bg-emerald-500' : 'bg-slate-500'}>
                                                {entry.status === 'posted' ? 'مرحل' : 'مسودة'}
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
