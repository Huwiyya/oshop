'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createJournalEntry } from '@/lib/journal-actions';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Trash2, Plus } from 'lucide-react';
import Link from 'next/link';
import { AccountCategory } from '@/lib/accounting-types';

// Define local type for form handling
type JournalLine = {
    accountId: string;
    accountName: string;
    debit: number;
    credit: number;
    accountType?: AccountCategory;
    description?: string;
};

const ACCOUNT_TYPES: { value: AccountCategory; label: string }[] = [
    { value: 'asset', label: 'أصول (Asset)' },
    { value: 'liability', label: 'خصوم (Liability)' },
    { value: 'equity', label: 'حقوق ملكية (Equity)' },
    { value: 'revenue', label: 'إيرادات (Income)' },
    { value: 'expense', label: 'مصروفات (Expense)' },
];

// Stub accounts list - In real app, fetch from generic accounts table or specific entities
const MOCK_ACCOUNTS = [
    { id: 'cash_lyd', name: 'الخزينة الرئيسية (LYD)', type: 'asset' },
    { id: 'cash_usd', name: 'الخزينة الدولارية (USD)', type: 'asset' },
    { id: 'sales', name: 'المبيعات', type: 'revenue' },
    { id: 'shipping_income', name: 'إيرادات الشحن', type: 'revenue' },
    { id: 'transport_expense', name: 'مصروفات نقل', type: 'expense' },
    { id: 'capital', name: 'رأس المال', type: 'equity' },
    { id: 'suppliers', name: 'موردين', type: 'liability' },
];

export default function NewJournalEntryPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [description, setDescription] = useState('');
    const [lines, setLines] = useState<Omit<JournalLine, 'accountType'>[]>([
        { accountId: '', accountName: '', debit: 0, credit: 0 },
        { accountId: '', accountName: '', debit: 0, credit: 0 },
    ]);

    const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    const difference = totalDebit - totalCredit;
    const isBalanced = Math.abs(difference) < 0.01;

    const handleLineChange = (index: number, field: keyof JournalLine, value: any) => {
        const newLines = [...lines];

        if (field === 'accountId') {
            const account = MOCK_ACCOUNTS.find(a => a.id === value);
            if (account) {
                newLines[index].accountId = account.id;
                newLines[index].accountName = account.name;
                // In real logic, we'd set accountType too
            }
        } else {
            (newLines[index] as any)[field] = value;
        }
        setLines(newLines);
    };

    const addLine = () => {
        setLines([...lines, { accountId: '', accountName: '', debit: 0, credit: 0 }]);
    };

    const removeLine = (index: number) => {
        if (lines.length > 2) {
            setLines(lines.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async () => {
        if (!isBalanced) return;
        setIsLoading(true);

        // Map mockup accounts types
        const finalLines: JournalLine[] = lines.map(l => {
            const acc = MOCK_ACCOUNTS.find(a => a.id === l.accountId);
            return {
                ...l,
                accountType: (acc?.type || 'asset') as AccountCategory, // Explicit cast to fix build error
                debit: Number(l.debit),
                credit: Number(l.credit)
            };
        });

        try {
            await createJournalEntry({
                date,
                description,
                lines: finalLines.map((l, index) => ({
                    accountId: l.accountId,
                    description: description,
                    debit: Number(l.debit),
                    credit: Number(l.credit),
                }))
            });

            router.push('/admin/accounting/journal');
            router.refresh();
        } catch (error: any) {
            alert('Error: ' + error.message);
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4 max-w-4xl space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin/accounting/journal">
                    <Button variant="ghost" size="icon">
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold">قيد يومية جديد</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>بيانات القيد</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>التاريخ</Label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>البيان (الوصف)</Label>
                            <Input placeholder="شرح للقيد..." value={description} onChange={e => setDescription(e.target.value)} />
                        </div>
                    </div>

                    <div className="border rounded-lg p-4 bg-gray-50 dark:bg-black/20 space-y-4">
                        <div className="grid grid-cols-12 gap-2 text-sm font-semibold text-muted-foreground mb-2 px-2">
                            <div className="col-span-5">الحساب</div>
                            <div className="col-span-3">مدين</div>
                            <div className="col-span-3">دائن</div>
                            <div className="col-span-1"></div>
                        </div>

                        {lines.map((line, index) => (
                            <div key={index} className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-5">
                                    <Select
                                        value={line.accountId}
                                        onValueChange={(val) => handleLineChange(index, 'accountId', val)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر الحساب" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {MOCK_ACCOUNTS.map(acc => (
                                                <SelectItem key={acc.id} value={acc.id}>
                                                    {acc.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-3">
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        placeholder="0.000"
                                        value={line.debit || ''}
                                        onChange={(e) => handleLineChange(index, 'debit', e.target.value)}
                                        className={line.debit > 0 ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : ""}
                                    />
                                </div>
                                <div className="col-span-3">
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.001"
                                        placeholder="0.000"
                                        value={line.credit || ''}
                                        onChange={(e) => handleLineChange(index, 'credit', e.target.value)}
                                        className={line.credit > 0 ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20" : ""}
                                    />
                                </div>
                                <div className="col-span-1 text-center">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive"
                                        onClick={() => removeLine(index)}
                                        disabled={lines.length <= 2}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}

                        <div className="flex justify-center pt-2">
                            <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-2">
                                <Plus className="w-4 h-4" /> إضافة صف
                            </Button>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col md:flex-row justify-between items-center gap-4 border-t pt-6">
                    <div className="flex gap-8 text-lg font-mono">
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-muted-foreground">مجموع المدين</span>
                            <span className="text-emerald-600 font-bold">{totalDebit.toFixed(3)}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-muted-foreground">مجموع الدائن</span>
                            <span className="text-rose-600 font-bold">{totalCredit.toFixed(3)}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs text-muted-foreground">الفرق</span>
                            <span className={isBalanced ? "text-gray-400" : "text-red-600 font-bold"}>
                                {Math.abs(difference).toFixed(3)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {!isBalanced && (
                            <span className="text-sm text-red-500 font-medium animate-pulse">
                                القيد غير متوازن!
                            </span>
                        )}
                        <Button onClick={handleSubmit} disabled={!isBalanced || isLoading || !description || lines.some(l => !l.accountId)}>
                            {isLoading ? 'جاري الحفظ...' : 'حفظ القيد'}
                        </Button>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
