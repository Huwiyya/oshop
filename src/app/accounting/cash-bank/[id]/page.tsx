'use client';

import React, { useState, useEffect } from 'react';
import { getAccountDetailsV2, getAccountLedgerV2, deleteJournalEntryV2 } from '@/lib/accounting-v2-actions';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { ArrowRight, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { useParams } from 'next/navigation';

export default function AccountDetailsPage() {
    const params = useParams();
    const id = params.id as string;
    const [account, setAccount] = useState<any>(null);
    const [ledger, setLedger] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const loadData = async () => {
        setLoading(true);
        try {
            const accountData = await getAccountDetailsV2(id);
            const ledgerData = await getAccountLedgerV2(id);
            setAccount(accountData);
            setLedger(ledgerData || []);
        } catch (error) {
            toast({ title: 'خطأ', description: 'فشل تحميل البيانات', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    if (loading) {
        return <div className="p-8 text-center">جاري التحميل...</div>;
    }

    if (!account) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-red-500">الحساب غير موجود</h1>
                <Link href="/accounting/cash-bank" className="text-primary hover:underline mt-4 block">
                    العودة للنقدية والبنوك
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/accounting/cash-bank">
                    <Button variant="ghost" size="icon">
                        <ArrowRight className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">{account.name_ar}</h1>
                    <p className="text-muted-foreground font-mono">{account.code}</p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-t-4 border-t-primary">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">الرصيد الحالي</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold font-mono text-primary">
                            {formatCurrency(account.current_balance)}
                            <span className="text-lg font-normal text-muted-foreground ml-2">{account.currency}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>سجل الحركات (Ledger)</CardTitle>
                    <CardDescription>آخر العمليات المالية على هذا الحساب</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>رقم القيد</TableHead>
                                <TableHead>البيان</TableHead>
                                <TableHead className="text-left">مدين (Debit)</TableHead>
                                <TableHead className="text-left">دائن (Credit)</TableHead>
                                <TableHead className="text-center">إجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ledger && ledger.length > 0 ? (
                                ledger.map((entry: any) => (
                                    <TableRow key={entry.id}>
                                        <TableCell>{entry.journal_entries?.entry_date ? new Date(entry.journal_entries.entry_date).toLocaleDateString('en-GB') : '-'}</TableCell>
                                        <TableCell className="font-mono text-xs">{entry.journal_entries?.entry_number}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{entry.description || entry.journal_entries?.description}</span>
                                                {entry.journal_entries?.source_type && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {getReferenceBadge(entry.journal_entries?.source_type, entry.journal_entries?.source_id)}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-left font-mono text-emerald-600 font-medium">
                                            {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                                        </TableCell>
                                        <TableCell className="text-left font-mono text-red-600 font-medium">
                                            {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {!entry.journal_entries?.source_type && !entry.journal_entries?.source_id ? (
                                                <DeleteJournalEntryButton
                                                    journalEntryId={entry.journal_id}
                                                    entryNumber={entry.journal_entries?.entry_number}
                                                    onSuccess={loadData}
                                                />
                                            ) : (
                                                <span className="text-xs text-muted-foreground">مرتبط بمستند</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        لا توجد حركات مسجلة حتى الآن
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

function getReferenceBadge(referenceType: string, referenceId: string) {
    const typeMap: Record<string, string> = {
        'receipt': 'سند قبض',
        'payment': 'سند صرف',
        'sales_invoice': 'فاتورة بيع',
        'purchase_invoice': 'فاتورة شراء',
        'asset_acquisition': 'شراء أصل',
        'inventory_adjustment': 'تسوية مخزنية',
        'manual_entry': 'قيد يدوي'
    };

    return `${typeMap[referenceType] || referenceType} #${referenceId?.slice(0, 8)}`;
}

function DeleteJournalEntryButton({ journalEntryId, entryNumber, onSuccess }: {
    journalEntryId: string;
    entryNumber: string;
    onSuccess: () => void
}) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleDelete = async () => {
        setLoading(true);
        try {
            const res = await deleteJournalEntryV2(journalEntryId);
            if (res.success) {
                toast({ title: 'تم حذف القيد اليدوي بنجاح' });
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
                    <AlertDialogTitle>حذف القيد المحاسبي؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        هل أنت متأكد من حذف القيد <strong>#{entryNumber}</strong>؟
                        <br /><br />
                        سيتم حذف القيد نهائياً ولا يمكن التراجع عن هذا الإجراء.
                        <br /><br />
                        <strong className="text-red-600">تحذير:</strong> سيؤثر هذا على أرصدة الحسابات المرتبطة.
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
