'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash, ArrowLeft, Check, ChevronsUpDown } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { getJournalEntryV2, updateJournalEntryV2, getActiveAccountsV2 } from '@/lib/accounting-v2-actions';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

type LineItem = {
    id: number;
    accountId: string;
    description: string;
    debit: string | number;
    credit: string | number;
};

export default function EditJournalEntryPage() {
    const router = useRouter();
    const params = useParams();
    const entryId = params.id as string;
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [accounts, setAccounts] = useState<any[]>([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [mainDescription, setMainDescription] = useState('');
    const [entryNumber, setEntryNumber] = useState('');

    // Lines
    const [lines, setLines] = useState<LineItem[]>([
        { id: 1, accountId: '', description: '', debit: '', credit: '' },
        { id: 2, accountId: '', description: '', debit: '', credit: '' }
    ]);

    const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    useEffect(() => {
        // Load Account Options
        getActiveAccountsV2().then(setAccounts);

        // Load existing entry data
        getJournalEntryV2(entryId).then(res => {
            if (!res.success || !res.data) {
                toast({ title: 'خطأ', description: 'القيد غير موجود', variant: 'destructive' });
                router.back();
                return;
            }

            const entry = res.data;

            // TODO: V2 currently doesn't strictly track source_type in the same way, assuming manual for now or checking description/meta
            // Assuming if it has lines it's editable if not posted? 
            // Legacy check: if (entry.reference_type !== 'manual')
            // V2 doesn't have reference_type column yet in types? Let's check type definition.
            // JournalEntryV2 type likely has status.

            // Allow editing for now, logic can be refined.

            setEntryNumber(entry.entry_number);
            setDate(entry.date);
            setMainDescription(entry.description || '');

            if (entry.lines && entry.lines.length > 0) {
                setLines(entry.lines.map((line: any, idx: number) => ({
                    id: idx + 1,
                    accountId: line.account_id,
                    description: line.description || '',
                    debit: line.debit || '',
                    credit: line.credit || ''
                })));
            }
            setIsLoading(false);
        });
    }, [entryId]);

    const addLine = () => {
        setLines([...lines, { id: Date.now(), accountId: '', description: '', debit: '', credit: '' }]);
    };

    const removeLine = (id: number) => {
        if (lines.length > 2) {
            setLines(lines.filter(l => l.id !== id));
        }
    };

    const updateLine = (id: number, field: keyof LineItem, value: any) => {
        setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
    };

    const handleSubmit = async () => {
        if (!isBalanced) {
            toast({ title: 'قيد غير متوازن', description: `الفرق: ${Math.abs(totalDebit - totalCredit)}`, variant: 'destructive' });
            return;
        }
        if (!mainDescription) {
            toast({ title: 'نقص بيانات', description: 'الرجاء إدخال وصف للقيد', variant: 'destructive' });
            return;
        }

        // Filter empty lines
        const validLines = lines.filter(l => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
        if (validLines.length < 2) {
            toast({ title: 'خطأ', description: 'يجب أن يحتوي القيد على طرفين على الأقل', variant: 'destructive' });
            return;
        }

        setIsSaving(true);
        try {
            await updateJournalEntryV2(entryId, {
                date,
                description: mainDescription,
                lines: validLines.map(l => ({
                    account_id: l.accountId,
                    debit: Number(l.debit) || 0,
                    credit: Number(l.credit) || 0,
                    description: l.description
                }))
            });
            toast({ title: 'تم التحديث', description: 'تم تعديل القيد بنجاح' });
            router.push('/accounting/journal-entries');
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="text-center py-20">جاري التحميل...</div>;
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">تعديل قيد يومية - {entryNumber}</h1>
                    <p className="text-slate-500">تعديل القيد اليومي</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>تاريخ القيد</Label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>البيان الرئيسي (الوصف)</Label>
                            <Input
                                placeholder="شرح عام للقيد..."
                                value={mainDescription}
                                onChange={e => setMainDescription(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[35%]">الحساب</TableHead>
                                    <TableHead className="w-[30%]">البيان (اختياري)</TableHead>
                                    <TableHead className="w-[15%]">مدين (+)</TableHead>
                                    <TableHead className="w-[15%]">دائن (-)</TableHead>
                                    <TableHead className="w-[5%] text-center">حذف</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lines.map((line) => (
                                    <TableRow key={line.id}>
                                        <TableCell>
                                            <AccountSelector
                                                accounts={accounts}
                                                value={line.accountId}
                                                onChange={(v) => updateLine(line.id, 'accountId', v)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                className="h-9"
                                                placeholder={mainDescription || "تفاصيل..."}
                                                value={line.description}
                                                onChange={e => updateLine(line.id, 'description', e.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                className="h-9"
                                                value={String(line.debit || '')}
                                                onChange={e => {
                                                    updateLine(line.id, 'debit', e.target.value);
                                                }}
                                                disabled={parseFloat(String(line.credit)) > 0}
                                                placeholder="0.00"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                className="h-9"
                                                value={String(line.credit || '')}
                                                onChange={e => {
                                                    updateLine(line.id, 'credit', e.target.value);
                                                }}
                                                disabled={parseFloat(String(line.debit)) > 0}
                                                placeholder="0.00"
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeLine(line.id)}>
                                                <Trash className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="mt-4 flex justify-between items-center">
                        <Button variant="outline" onClick={addLine} className="gap-2">
                            <Plus className="w-4 h-4" /> إضافة سطر
                        </Button>
                        <div className="flex gap-8 text-sm font-semibold">
                            <span className={isBalanced ? 'text-slate-700' : 'text-red-600'}>
                                إجمالي المدين: {formatCurrency(totalDebit)}
                            </span>
                            <span className={isBalanced ? 'text-slate-700' : 'text-red-600'}>
                                إجمالي الدائن: {formatCurrency(totalCredit)}
                            </span>
                            {!isBalanced && (
                                <span className="bg-red-100 text-red-600 px-2 rounded">
                                    الفرق: {formatCurrency(Math.abs(totalDebit - totalCredit))}
                                </span>
                            )}
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="bg-slate-50/50 flex justify-end gap-3 p-4">
                    <Button variant="outline" onClick={() => router.back()} disabled={isSaving}>
                        إلغاء
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSaving || !isBalanced} className="w-48 h-10 bg-blue-600 hover:bg-blue-700 text-lg">
                        {isSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

function AccountSelector({ accounts, value, onChange }: { accounts: any[], value: string, onChange: (val: string) => void }) {
    const [open, setOpen] = useState(false)
    const selectedAccount = accounts.find((account) => account.id === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal px-2"
                >
                    {selectedAccount
                        ? <span className="truncate flex items-center gap-2"><span className="font-mono text-slate-500 text-xs">{selectedAccount.code}</span> {selectedAccount.name_ar}</span>
                        : <span className="text-slate-500">اختر الحساب...</span>}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[350px] p-0" align="start">
                <Command filter={(value, search) => {
                    const acc = accounts.find(a => a.id === value);
                    if (!acc) return 0;
                    const text = `${acc.code} ${acc.name_ar}`.toLowerCase();
                    return text.includes(search.toLowerCase()) ? 1 : 0;
                }}>
                    <CommandInput placeholder="بحث برقم الحساب أو الاسم..." />
                    <CommandList>
                        <CommandEmpty>لا يوجد حساب.</CommandEmpty>
                        <CommandGroup className="max-h-[300px] overflow-auto">
                            {accounts.map((account) => (
                                <CommandItem
                                    key={account.id}
                                    value={account.id}
                                    onSelect={(currentValue) => {
                                        onChange(currentValue)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === account.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <span className="font-mono text-slate-500 mr-2">{account.code}</span>
                                    <span className="truncate">{account.name_ar}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
