
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash, ArrowLeft, Box, Check, ChevronsUpDown } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { createJournalEntry } from '@/lib/journal-actions';
import { supabase } from '@/lib/supabase';
import { getInventoryItems } from '@/lib/inventory-actions';
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

// Quick helper to fetch all accounts
async function getAccounts() {
    const { data } = await supabase.from('accounts').select('id, name_ar, account_code').eq('is_active', true).neq('is_parent', true).order('account_code');
    return data || [];
}

type LineItem = {
    id: number;
    accountId: string;
    description: string;
    debit: string | number;
    credit: string | number;
    // Inventory
    inventoryItemId?: string;
    quantity?: number;
};

export default function CreateJournalEntryPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const [accounts, setAccounts] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [mainDescription, setMainDescription] = useState('');
    const [currency, setCurrency] = useState('LYD');

    // Lines
    const [lines, setLines] = useState<LineItem[]>([
        { id: 1, accountId: '', description: '', debit: '', credit: '' },
        { id: 2, accountId: '', description: '', debit: '', credit: '' }]);

    const totalDebit = lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    useEffect(() => {
        getAccounts().then(setAccounts);
        getInventoryItems().then(setInventoryItems);
    }, []);

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

        setIsLoading(true);
        try {
            await createJournalEntry({
                date,
                description: mainDescription,
                lines: validLines.map(l => ({
                    ...l,
                    debit: Number(l.debit) || 0,
                    credit: Number(l.credit) || 0
                })),
                currency
            });
            toast({ title: 'تم الحفظ', description: 'تم إنشاء القيد بنجاح' });
            router.push('/accounting/journal-entries');
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">قيد يومية جديد</h1>
                    <p className="text-slate-500">إدخال يدوي للمعاملات المتعددة</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>تاريخ القيد</Label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div className="space-y-2 lg:col-span-2">
                            <Label>البيان الرئيسي (الوصف)</Label>
                            <Input
                                placeholder="شرح عام للقيد..."
                                value={mainDescription}
                                onChange={e => setMainDescription(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>العملة</Label>
                            <Select value={currency} onValueChange={setCurrency}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LYD">دينار ليبي (LYD)</SelectItem>
                                    <SelectItem value="USD">دولار أمريكي (USD)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[30%]">الحساب</TableHead>
                                    <TableHead className="w-[25%]">البيان (اختياري)</TableHead>
                                    <TableHead className="w-[15%]">مدين (+)</TableHead>
                                    <TableHead className="w-[15%]">دائن (-)</TableHead>
                                    <TableHead className="w-[15%] text-center">مخزون / أدوات</TableHead>
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
                                        <TableCell className="flex items-center justify-center gap-1">
                                            <InventoryPopover
                                                line={line}
                                                items={inventoryItems}
                                                onSave={(itemId, qty) => {
                                                    updateLine(line.id, 'inventoryItemId', itemId);
                                                    updateLine(line.id, 'quantity', qty);
                                                }}
                                            />
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
                <CardFooter className="bg-slate-50/50 flex justify-end p-4">
                    <Button onClick={handleSubmit} disabled={isLoading || !isBalanced} className="w-48 h-10 bg-emerald-600 hover:bg-emerald-700 text-lg">
                        {isLoading ? 'جاري الحفظ...' : 'حفظ وترحيل القيد'}
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
                        ? <span className="truncate flex items-center gap-2"><span className="font-mono text-slate-500 text-xs">{selectedAccount.account_code}</span> {selectedAccount.name_ar}</span>
                        : <span className="text-slate-500">اختر الحساب...</span>}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[350px] p-0" align="start">
                <Command filter={(value, search) => {
                    const acc = accounts.find(a => a.id === value);
                    if (!acc) return 0;
                    const text = `${acc.account_code} ${acc.name_ar}`.toLowerCase();
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
                                    <span className="font-mono text-slate-500 mr-2">{account.account_code}</span>
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

function InventoryPopover({ line, items, onSave }: { line: LineItem, items: any[], onSave: (id: string, qty: number) => void }) {
    const hasInventory = Boolean(line.inventoryItemId);
    const [open, setOpen] = useState(false);
    const [selectedId, setSelectedId] = useState(line.inventoryItemId || '');
    const [qty, setQty] = useState(line.quantity || 1);

    const handleSave = () => {
        onSave(selectedId, qty);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${hasInventory ? 'text-blue-600 bg-blue-50' : 'text-slate-400'}`}
                    title="ربط بصنف مخزني"
                >
                    {hasInventory ? <Check className="w-4 h-4" /> : <Box className="w-4 h-4" />}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="space-y-4">
                    <h4 className="font-semibold text-sm">تعديل مخزني لهذا السطر</h4>
                    <p className="text-xs text-slate-500">
                        سيتم {Number(line.debit) > 0 ? 'زيادة' : 'إنقاص'} مخزون الصنف المختار بالكمية المحددة.
                    </p>
                    <div className="space-y-2">
                        <Label>الصنف</Label>
                        <Select value={selectedId} onValueChange={setSelectedId}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="اختر الصنف" /></SelectTrigger>
                            <SelectContent>
                                {items.map(i => <SelectItem key={i.id} value={i.id}>{i.name_ar}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>الكمية</Label>
                        <Input type="number" step="1" value={qty} onChange={e => setQty(Number(e.target.value))} className="h-8" />
                    </div>
                    <Button size="sm" className="w-full" onClick={handleSave}>حفظ الربط</Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
