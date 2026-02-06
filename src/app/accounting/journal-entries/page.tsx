'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileText, Trash2, Pencil } from 'lucide-react';
import { getJournalEntries } from '@/lib/journal-actions';
import { deleteManualJournalEntry } from '@/lib/accounting-actions';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ListFilter } from '@/components/accounting/list-filter';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

function JournalEntriesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const loadData = () => {
        setLoading(true);
        getJournalEntries({
            query: searchParams.get('q') || undefined,
            startDate: searchParams.get('from') || undefined,
            endDate: searchParams.get('to') || undefined
        }).then(data => {
            setEntries(data || []);
            setLoading(false);
        });
    };

    useEffect(() => {
        loadData();
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
                                <TableHead className="text-center">إجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-10">جاري التحميل...</TableCell></TableRow>
                            ) : entries.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10 text-slate-500">لا توجد قيود مسجلة</TableCell>
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
                                            {formatCurrency(entry.total_debit || 0)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={entry.is_posted ? 'default' : 'secondary'} className="text-xs">
                                                {entry.is_posted ? 'مرحّل' : 'مسودة'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {(!entry.reference_type || entry.reference_type === 'manual') ? (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 p-0"
                                                            onClick={() => router.push(`/accounting/journal-entries/${entry.id}/edit`)}
                                                        >
                                                            <Pencil className="w-4 h-4 text-blue-600" />
                                                        </Button>
                                                        <DeleteJournalEntryButton
                                                            entry={entry}
                                                            onSuccess={loadData}
                                                        />
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">مرتبط</span>
                                                )}
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

function DeleteJournalEntryButton({ entry, onSuccess }: { entry: any; onSuccess: () => void }) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleDelete = async () => {
        setLoading(true);
        try {
            const res = await deleteManualJournalEntry(entry.id);
            if (res.success) {
                toast({ title: 'تم حذف القيد اليومي بنجاح' });
                onSuccess();
            } else {
                toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>حذف القيد اليومي؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        هل أنت متأكد من حذف القيد <strong>#{entry.entry_number}</strong>؟
                        <br /><br />
                        <strong className="text-slate-900">{entry.description}</strong>
                        <br />
                        المبلغ: <strong>{formatCurrency(entry.total_debit || 0)}</strong>
                        <br /><br />
                        <strong className="text-red-600">تحذير:</strong> سيؤثر هذا على أرصدة الحسابات المرتبطة ولا يمكن التراجع.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {loading ? 'جاري الحذف...' : 'حذف'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function JournalEntriesPage() {
    return (
        <Suspense fallback={<div className="text-center py-10">جاري التحميل...</div>}>
            <JournalEntriesContent />
        </Suspense>
    );
}
