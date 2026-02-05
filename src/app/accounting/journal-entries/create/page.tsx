
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash, Save, ArrowLeft, Box, Check } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { createJournalEntry } from '@/lib/journal-actions';
import { supabase } from '@/lib/supabase'; // Client side for direct fetching if needed or use action
import { getInventoryItems } from '@/lib/inventory-actions'; // For the popup

// We need accounts list
import { getEmployees } from '@/lib/payroll-actions'; // Just using this to get accounts? No better create getAccounts helper

// Quick helper to fetch all accounts
async function getAccounts() {
    // This should ideally be in accoutning-actions
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
        setLines([...lines, { id: Date.now(), accountId: '', description: '', debit: 0, credit: 0 }]);
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
                                            <Select
                                                value={line.accountId}
                                                onValueChange={v => updateLine(line.id, 'accountId', v)}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue placeholder="اختر الحساب..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {accounts.map(acc => (
                                                        <SelectItem key={acc.id} value={acc.id}>
                                                            <span className="font-mono text-slate-400 mr-2">{acc.account_code}</span>
                                                            {acc.name_ar}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
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
                                                    const val = e.target.value;
                                                    updateLine(line.id, 'debit', val);
                                                    if (parseFloat(val) > 0) {
                                                        updateLine(line.id, 'credit', '');
                                                    }
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
                                                    const val = e.target.value;
                                                    updateLine(line.id, 'credit', val);
                                                    if (parseFloat(val) > 0) {
                                                        updateLine(line.id, 'debit', '');
                                                    }
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

// Simple Popover for Inventory Selection inside the row
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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
