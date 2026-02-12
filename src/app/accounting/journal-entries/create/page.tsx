
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash, ArrowLeft, Save, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { createAtomicJournalEntryV2, getChartOfAccountsV2, getProductsV2 } from '@/lib/accounting-v2-actions';
import { supabase } from '@/lib/supabase';
import { AccountSelector } from '@/components/accounting/AccountSelector';
import { ProductSelector, Product } from '@/components/accounting/ProductSelector'; // Import ProductSelector

// --- Types ---
type LineItem = {
    id: number;
    accountId: string;
    description: string;
    debit: number;
    credit: number;
    // Inventory linkage
    inventoryItemId?: string;
    quantity?: number;
};

// --- Helper: Fetch Accounts & Products ---
async function fetchData() {
    const [accountsRes, productsRes] = await Promise.all([
        getChartOfAccountsV2(),
        getProductsV2()
    ]);

    const accounts = (accountsRes.data || []).map(acc => ({
        ...acc,
        account_code: acc.code
    }));

    return { accounts, products: productsRes.data || [] };
}

export default function CreateJournalEntryPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Data State
    const [accounts, setAccounts] = useState<any[]>([]);
    const [products, setProducts] = useState<Product[]>([]); // Products State

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [mainDescription, setMainDescription] = useState('');
    const [currency, setCurrency] = useState('LYD');

    // Lines State
    const [lines, setLines] = useState<LineItem[]>([
        { id: 1, accountId: '', description: '', debit: 0, credit: 0, quantity: 0 },
        { id: 2, accountId: '', description: '', debit: 0, credit: 0, quantity: 0 }
    ]);

    // Initial Fetch
    useEffect(() => {
        fetchData().then(data => {
            setAccounts(data.accounts);
            setProducts(data.products);
        });
    }, []);

    // ... (Calculations remain same)
    const totalDebit = useMemo(() => lines.reduce((sum, l) => sum + (l.debit || 0), 0), [lines]);
    const totalCredit = useMemo(() => lines.reduce((sum, l) => sum + (l.credit || 0), 0), [lines]);
    const difference = Math.abs(totalDebit - totalCredit);
    const isBalanced = difference < 0.01;
    const isValid = isBalanced && totalDebit > 0 && lines.filter(l => l.accountId).length >= 2 && mainDescription.trim() !== '';

    // ... (Handlers remain same until handleClear)

    // Updated Handlers for new fields
    const addLine = () => {
        setLines([...lines, { id: Date.now(), accountId: '', description: '', debit: 0, credit: 0, quantity: 0 }]);
    };

    const removeLine = (id: number) => {
        if (lines.length > 2) {
            setLines(lines.filter(l => l.id !== id));
        } else {
            // Updated clear logic
            updateLine(id, 'accountId', '');
            updateLine(id, 'debit', 0);
            updateLine(id, 'credit', 0);
            updateLine(id, 'description', '');
            updateLine(id, 'inventoryItemId', undefined);
            updateLine(id, 'quantity', 0);
        }
    };

    const updateLine = (id: number, field: keyof LineItem, value: any) => {
        setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
    };

    const handleClear = () => {
        if (!confirm('هل أنت متأكد من مسح جميع البيانات؟')) return;
        setMainDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setLines([
            { id: Date.now(), accountId: '', description: '', debit: 0, credit: 0, quantity: 0 },
            { id: Date.now() + 1, accountId: '', description: '', debit: 0, credit: 0, quantity: 0 }
        ]);
    };

    const handleSubmit = async () => {
        if (!isValid) return;

        setIsLoading(true);
        try {
            const validLines = lines.filter(l => l.accountId && (l.debit > 0 || l.credit > 0));

            const payload = {
                date,
                description: mainDescription,
                lines: validLines.map(l => ({
                    account_id: l.accountId,
                    description: l.description || mainDescription,
                    debit: l.debit || 0,
                    credit: l.credit || 0,
                    product_id: l.inventoryItemId, // Pass product_id
                    quantity: l.quantity           // Pass quantity
                })),
            };

            const res = await createAtomicJournalEntryV2(payload);

            if (res.success) {
                toast({ title: 'تم الحفظ', description: 'تم إنشاء القيد بنجاح', variant: 'default' });
                router.push('/accounting/journal-entries');
            } else {
                throw new Error(res.error || 'فشل حفظ القيد');
            }
        } catch (error: any) {
            console.error(error);
            toast({ title: 'خطأ', description: error.message || 'فشل حفظ القيد', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-20 p-6"> {/* Increased max-w */}
            {/* Header ... */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">قيد يومية جديد</h1>
                        <p className="text-slate-500 mt-1">إدخال العمليات المالية اليدوية</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleClear} disabled={isLoading}>
                        <RotateCcw className="w-4 h-4 ml-2" />
                        مسح النموذج
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !isValid}
                        className={cn("w-32", isBalanced ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-400")}
                    >
                        {isLoading ? 'جاري الحفظ...' : (
                            <>
                                <Save className="w-4 h-4 ml-2" />
                                حفظ
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Main Form */}
            <Card className="border-t-4 border-t-primary">
                <CardHeader>
                    {/* ... (Date/Desc/Currency inputs same as before) ... */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div className="md:col-span-3 space-y-2">
                            <Label>تاريخ القيد</Label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                        </div>
                        <div className="md:col-span-6 space-y-2">
                            <Label>البيان / الشرح</Label>
                            <Input
                                placeholder="شرح عام للقيد المستندي..."
                                value={mainDescription}
                                onChange={e => setMainDescription(e.target.value)}
                                className="font-medium"
                            />
                        </div>
                        <div className="md:col-span-3 space-y-2">
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

                <CardContent className="p-0">
                    <div className="border-y bg-slate-50/50 overflow-x-auto">
                        <Table className="min-w-[1000px]">
                            <TableHeader className="bg-slate-100">
                                <TableRow>
                                    <TableHead className="w-[3%] text-center">#</TableHead>
                                    <TableHead className="w-[25%]">الحساب</TableHead>
                                    <TableHead className="w-[20%]">الصنف (اختياري)</TableHead>
                                    <TableHead className="w-[8%]">الكمية</TableHead>
                                    <TableHead className="w-[20%]">البيان</TableHead>
                                    <TableHead className="w-[10%] text-left">مدين</TableHead>
                                    <TableHead className="w-[10%] text-left">دائن</TableHead>
                                    <TableHead className="w-[4%]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lines.map((line, index) => (
                                    <TableRow key={line.id} className="group hover:bg-slate-50">
                                        <TableCell className="text-center font-mono text-slate-500">
                                            {index + 1}
                                        </TableCell>
                                        <TableCell>
                                            <AccountSelector
                                                accounts={accounts}
                                                value={line.accountId}
                                                onChange={(v) => updateLine(line.id, 'accountId', v)}
                                                placeholder="اختر حساب توجيه..."
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <ProductSelector
                                                products={products}
                                                value={line.inventoryItemId}
                                                onChange={(v) => updateLine(line.id, 'inventoryItemId', v)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className="h-9 font-mono text-center"
                                                value={line.quantity || ''}
                                                onChange={e => updateLine(line.id, 'quantity', parseFloat(e.target.value) || 0)}
                                                placeholder="0"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                className="h-9 bg-transparent border-transparent hover:border-slate-300 focus:border-primary"
                                                placeholder={mainDescription || "نفس الشرح الرئيسي"}
                                                value={line.description}
                                                onChange={e => updateLine(line.id, 'description', e.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className={cn(
                                                    "h-9 text-left font-mono",
                                                    line.debit > 0 ? "font-bold text-slate-900 border-slate-300" : "text-slate-400 bg-transparent border-transparent hover:border-slate-200"
                                                )}
                                                value={line.debit || ''}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    updateLine(line.id, 'debit', val);
                                                    if (val > 0) updateLine(line.id, 'credit', 0);
                                                }}
                                                placeholder="0.00"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                className={cn(
                                                    "h-9 text-left font-mono",
                                                    line.credit > 0 ? "font-bold text-slate-900 border-slate-300" : "text-slate-400 bg-transparent border-transparent hover:border-slate-200"
                                                )}
                                                value={line.credit || ''}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    updateLine(line.id, 'credit', val);
                                                    if (val > 0) updateLine(line.id, 'debit', 0);
                                                }}
                                                placeholder="0.00"
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                                                onClick={() => removeLine(line.id)}
                                            >
                                                <Trash className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center p-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={addLine}
                                            className="text-primary hover:text-primary/80 hover:bg-primary/5 w-full border-2 border-dashed border-slate-200"
                                        >
                                            <Plus className="w-4 h-4 ml-2" />
                                            إضافة سطر جديد
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    {/* Footer / Validation Area */}
                    <div className="bg-slate-100 p-6 border-t">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">

                            {/* Status Indicator */}
                            <div className="flex-1">
                                {isBalanced ? (
                                    <div className="flex items-center text-emerald-600 gap-2">
                                        <CheckCircle className="w-6 h-6" />
                                        <div>
                                            <p className="font-bold">القيد متوازن وجاهز للحفظ</p>
                                            <p className="text-sm text-emerald-600/80">إجمالي المعاملة: {formatCurrency(totalDebit)}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center text-red-600 gap-2">
                                        <AlertCircle className="w-6 h-6" />
                                        <div>
                                            <p className="font-bold">القيد غير متوازن</p>
                                            <p className="text-sm">يوجد فرق قدره <span className="font-mono bg-red-200 px-1 rounded">{formatCurrency(difference)}</span> بين المدين والدائن</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Totals Summary */}
                            <div className="flex gap-8 bg-white p-4 rounded-lg shadow-sm border">
                                <div className="text-center">
                                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">إجمالي المدين</p>
                                    <p className="text-xl font-mono font-bold text-slate-900">{formatCurrency(totalDebit)}</p>
                                </div>
                                <div className="h-10 w-px bg-slate-200 self-center"></div>
                                <div className="text-center">
                                    <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">إجمالي الدائن</p>
                                    <p className="text-xl font-mono font-bold text-slate-900">{formatCurrency(totalCredit)}</p>
                                </div>
                            </div>

                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
