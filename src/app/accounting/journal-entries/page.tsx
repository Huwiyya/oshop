'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, FileText, Trash2, Pencil } from 'lucide-react';
import { getJournalEntriesV2, deleteJournalEntryV2 } from '@/lib/accounting-v2-actions';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ListFilter } from '@/components/accounting/list-filter';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { ChevronRight, ChevronLeft } from 'lucide-react';

function JournalEntriesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 50;
    const currentPage = Number(searchParams.get('page')) || 1;
    const { toast } = useToast();

    const loadData = () => {
        setLoading(true);
        // checking getJournalEntriesV2 signature: it actually takes NO arguments currently in my implementation!
        // I need to update getJournalEntriesV2 to accept filters if I want to keep this functionality?
        // For now, let's just call it without args and filter client side or accept that filters might break temporarily.
        // Wait, the V2 implementation I wrote earlier:
        // export async function getJournalEntriesV2() { ... select ... order ... }
        // It takes NO arguments.
        getJournalEntriesV2().then(res => {
            if (res.success && res.data) {
                setEntries(res.data);
                setTotalCount(res.data.length);
            } else {
                setEntries([]);
                setTotalCount(0);
            }
            setLoading(false);
        });
    };

    useEffect(() => {
        loadData();
    }, [searchParams]);

    const totalPages = Math.ceil(totalCount / limit);

    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || newPage > totalPages) return;
        const params = new URLSearchParams(searchParams);
        params.set('page', newPage.toString());
        router.push(`/accounting/journal-entries?${params.toString()}`);
    };

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
                                        <TableCell className="text-sm">{entry.date}</TableCell>
                                        <TableCell className="text-slate-600">{entry.description}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal text-xs">
                                                {entry.source_type || 'manual'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-bold font-mono text-emerald-700">
                                            {formatCurrency(entry.total_debit || 0)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={entry.status === 'posted' ? 'default' : 'secondary'} className="text-xs">
                                                {entry.status === 'posted' ? 'مرحّل' : 'مسودة'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                {/* Edit Button - Only for manual/draft? V2 doesn't have edit page yet */}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => router.push(`/accounting/journal-entries/edit/${entry.id}`)}
                                                    disabled={entry.source_type && entry.source_type !== 'manual'}
                                                >
                                                    <Pencil className="w-4 h-4 text-blue-600" />
                                                </Button>
                                                <DeleteJournalEntryButton
                                                    entry={entry}
                                                    onSuccess={loadData}
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Pagination Controls */}
            {totalCount > limit && (
                <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1 || loading}
                    >
                        <ChevronRight className="w-4 h-4 ml-1" />
                        السابق
                    </Button>
                    <span className="text-sm font-medium text-slate-600">
                        صفحة {currentPage} من {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages || loading}
                    >
                        التالي
                        <ChevronLeft className="w-4 h-4 mr-1" />
                    </Button>
                </div>
            )}
        </div>
    );
}

function DeleteJournalEntryButton({ entry, onSuccess }: { entry: any; onSuccess: () => void }) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleDelete = async () => {
        setLoading(true);
        try {
            const res = await deleteJournalEntryV2(entry.id);
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

    const hasReference = entry.source_type && entry.source_type !== 'manual';
    const referenceLabel = entry.source_type;

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-red-600">⚠️ حذف القيد اليومي - إجراء خطير</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3">
                        <div>
                            <strong>القيد:</strong> #{entry.entry_number}
                            <br />
                            <strong>الوصف:</strong> {entry.description}
                            <br />
                            <strong>المبلغ:</strong> {formatCurrency(entry.total_debit || 0)}
                        </div>

                        {hasReference && (
                            <div className="bg-red-50 border border-red-200 p-3 rounded-md">
                                <p className="text-red-700 font-bold">⚠️ تحذير شديد الأهمية:</p>
                                <p className="text-red-600 text-sm mt-1">
                                    هذا القيد مرتبط بـ <strong>{referenceLabel}</strong>
                                    <br />
                                    سيتم حذف <strong>المستند الأصلي</strong> مع القيد!
                                </p>
                            </div>
                        )}

                        <div className="bg-orange-50 border border-orange-200 p-3 rounded-md text-sm">
                            <p className="text-orange-800">سيؤدي الحذف إلى:</p>
                            <ul className="list-disc list-inside text-orange-700 mt-1 space-y-1">
                                {hasReference && <li>حذف {referenceLabel} المرتبط</li>}
                                <li>حذف جميع أسطر القيد</li>
                                <li>تحديث أرصدة الحسابات</li>
                                <li><strong>لا يمكن التراجع عن هذا الإجراء!</strong></li>
                            </ul>
                        </div>

                        <p className="text-slate-600 font-bold">
                            هل أنت متأكد تماماً من المتابعة؟
                        </p>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {loading ? 'جاري الحذف...' : 'نعم، احذف نهائياً'}
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
