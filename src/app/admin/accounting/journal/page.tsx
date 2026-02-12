import React from 'react';
import { getJournalEntries } from '@/lib/journal-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Plus } from 'lucide-react';

export default async function JournalEntriesPage() {
    const { data: entries } = await getJournalEntries();

    return (
        <div className="container mx-auto p-4 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/accounting">
                        <Button variant="ghost" size="icon">
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">قيود اليومية (Journal Entries)</h1>
                        <p className="text-muted-foreground">سجل العمليات المحاسبية اليدوية</p>
                    </div>
                </div>
                <Link href="/admin/accounting/journal/new">
                    <Button className="gap-2">
                        <Plus className="w-4 h-4" />
                        قيد جديد
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>أحدث القيود</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>رقم القيد</TableHead>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>البيان</TableHead>
                                <TableHead>إجمالي المدين</TableHead>
                                <TableHead>إجمالي الدائن</TableHead>
                                <TableHead>بواسطة</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries?.map((entry: any) => {
                                return (
                                    <TableRow key={entry.id}>
                                        <TableCell className="font-mono">{entry.entry_number}</TableCell>
                                        <TableCell>{entry.entry_date ? format(new Date(entry.entry_date), 'yyyy-MM-dd') : '-'}</TableCell>
                                        <TableCell>{entry.description}</TableCell>
                                        <TableCell className="text-emerald-600 font-bold">{Number(entry.total_debit || 0).toFixed(3)}</TableCell>
                                        <TableCell className="text-rose-600 font-bold">{Number(entry.total_credit || 0).toFixed(3)}</TableCell>
                                        <TableCell>{entry.created_by || '-'}</TableCell>
                                    </TableRow>
                                );
                            })}
                            {entries.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        لا توجد قيود مسجلة بعد
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
