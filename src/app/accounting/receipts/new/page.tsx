'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createReceipt } from '@/lib/receipt-actions';
import { getUsers } from '@/lib/actions';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ArrowRight, User, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { AccountSelector } from '@/components/accounting/AccountSelector';
import { createEntityV2, getChartOfAccountsV2 } from '@/lib/accounting-v2-actions';
import { useToast } from '@/components/ui/use-toast';


// ... imports ...

export default function NewReceiptPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [accountId, setAccountId] = useState(''); // Debit Account (Cash/Bank)
    const [payer, setPayer] = useState('');
    const [relatedUserId, setRelatedUserId] = useState('');
    const [description, setDescription] = useState('');
    const [lineItems, setLineItems] = useState<{ accountId: string; amount: number; description: string }[]>([
        { accountId: '', amount: 0, description: '' }
    ]);
    const [currency, setCurrency] = useState('LYD');
    const [openPayer, setOpenPayer] = useState(false);

    const selectedUser = accounts.find(u => u.id === relatedUserId);

    useEffect(() => {
        async function load() {
            // Load V2 Accounts and Map to Legacy Format for Selector
            const { success, data } = await getChartOfAccountsV2();
            if (success && data) {
                const mappedAccounts = data.map((a: any) => ({
                    ...a,
                    account_code: a.code // Map 'code' to 'account_code' for Selector
                }));
                setAccounts(mappedAccounts);
            }

            const usersList = await getUsers();
            setUsers(usersList || []);
        }
        load();
    }, []);

    const handleCreateCustomer = async (name: string) => {
        try {
            const res = await createEntityV2({ name_ar: name, type: 'customer' });
            if (res.success) {
                const data = (res as any).data; // Fix lint error
                toast({ title: 'تم الإنشاء', description: `تم إنشاء العميل "${name}" بنجاح` });

                // Refresh and Auto-Select
                const { success, data: accountsData } = await getChartOfAccountsV2();
                if (success && accountsData) {
                    const mappedAccounts = accountsData.map((a: any) => ({
                        ...a,
                        account_code: a.code
                    }));
                    setAccounts(mappedAccounts);
                }
            } else {
                toast({ title: 'خطأ', description: res.error || 'فشل إنشاء العميل', variant: 'destructive' });
            }
        } catch (error) {
            console.error(error);
            toast({ title: 'خطأ', description: 'حدث خطأ أثناء الإنشاء', variant: 'destructive' });
        }
    };

    const totalAmount = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const currencySymbol = currency === 'LYD' ? 'د.ل' : '$';

    const handleAddLine = () => {
        setLineItems([...lineItems, { accountId: '', amount: 0, description: '' }]);
    };

    const handleRemoveLine = (index: number) => {
        if (lineItems.length === 1) return;
        setLineItems(lineItems.filter((_, i) => i !== index));
    };

    const handleLineChange = (index: number, field: string, value: any) => {
        const newLines = [...lineItems];
        newLines[index] = { ...newLines[index], [field]: value };
        setLineItems(newLines);
    };

    const handleSubmit = async () => {
        if (!accountId) {
            toast({ title: 'تنبيه', description: 'يرجى اختيار حساب الخزينة/البنك', variant: 'destructive' });
            return;
        }
        if (totalAmount <= 0) {
            toast({ title: 'تنبيه', description: 'يجب أن يكون المبلغ أكبر من صفر', variant: 'destructive' });
            return;
        }

        // Filter invalid lines
        const validLines = lineItems.filter(li => li.accountId && Number(li.amount) > 0);
        if (validLines.length === 0) {
            toast({ title: 'تنبيه', description: 'يجب إضافة بند واحد على الأقل مع حساب ومبلغ', variant: 'destructive' });
            return;
        }

        setIsLoading(true);

        try {
            const res = await createReceipt({
                date,
                payer: payer || (selectedUser ? (selectedUser.name || selectedUser.username) : 'غير محدد'),
                relatedUserId: relatedUserId || undefined,
                receiveAccountId: accountId,
                receiveAccountName: '', // Backend handles this or we can lookup
                description: description || 'سند قبض',
                amount: totalAmount,
                currency: currency as 'LYD' | 'USD',
                lineItems: validLines.map(l => ({
                    accountId: l.accountId,
                    amount: Number(l.amount),
                    description: l.description
                }))
            });

            if (res.success) {
                toast({ title: 'تم الحفظ', description: 'تم حفظ سند القبض بنجاح' });
                router.push('/accounting/receipts');
                router.refresh();
            } else {
                console.error('Save Error:', res.error);
                toast({ title: 'خطأ في الحفظ', description: res.error || 'حدث خطأ غير معروف', variant: 'destructive' });
            }
        } catch (e: any) {
            console.error('Exception:', e);
            toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    // Filter accounts for line items (Credit Side): 
    // Allow Level 3 and above (to include detailed Revenue 4101... which are Level 3)
    // Also allow Customers (112...) and Suppliers (211...)
    const creditAccounts = accounts.filter(a => (a.level || 0) >= 3);

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-4">
                <Link href="/accounting/receipts">
                    <Button variant="ghost" size="icon">
                        <ArrowRight className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">سند قبض جديد</h1>
                    <p className="text-slate-500">استلام نقدية أو شيكات</p>
                </div>
            </div>

            <Card className="border-t-4 border-t-emerald-600">
                <CardHeader>
                    <CardTitle>بيانات السند الأساسية</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>تاريخ السند</Label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-emerald-700 font-semibold">حساب القيد (إلى / Debit)</Label>
                            <Select value={accountId} onValueChange={(val) => {
                                setAccountId(val);
                                const acc = accounts.find(a => a.id === val);
                                if (acc) setCurrency(acc.currency || 'LYD');
                            }}>
                                <SelectTrigger className="h-10 border-emerald-200 focus:ring-emerald-500">
                                    <SelectValue placeholder="اختر الخزينة أو البنك..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>الخزائن (الصناديق)</SelectLabel>
                                        {accounts
                                            .filter(a => a.account_code.startsWith('1110'))
                                            .map(acc => (
                                                <SelectItem key={acc.id} value={acc.id}>{acc.name_ar}</SelectItem>
                                            ))}
                                    </SelectGroup>
                                    <SelectGroup>
                                        <SelectLabel>المصارف</SelectLabel>
                                        {accounts
                                            .filter(a => a.account_code.startsWith('1111'))
                                            .map(acc => (
                                                <SelectItem key={acc.id} value={acc.id}>{acc.name_ar}</SelectItem>
                                            ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-slate-400">الحساب الذي ستدخل إليه الأموال</p>
                        </div>
                    </div>

                    {/* Payer Section */}
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 mb-4 text-slate-700 font-medium">
                            <User className="w-4 h-4" />
                            <span>بيانات المستلم منه (العميل / الجهة)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>اختيار عميل مسجل (حسابات العملاء)</Label>
                                <Popover open={openPayer} onOpenChange={setOpenPayer}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between h-9 text-right font-normal">
                                            <span className="truncate">
                                                {selectedUser ? (selectedUser.name_ar || selectedUser.name_en) : "بحث في حسابات العملاء..."}
                                            </span>
                                            <ChevronsUpDown className="ml-2 h-3 w-3 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="بحث..." />
                                            <CommandList>
                                                <CommandEmpty>لا يوجد عميل بهذا الاسم.</CommandEmpty>
                                                <CommandGroup>
                                                    {accounts
                                                        .filter(a => a.account_code?.startsWith('112') || a.code?.startsWith('112')) // Filter Customers
                                                        .map((user) => (
                                                            <CommandItem
                                                                key={user.id}
                                                                onSelect={() => {
                                                                    setRelatedUserId(user.id);
                                                                    setPayer(user.name_ar || user.name_en || '');
                                                                    setOpenPayer(false);
                                                                }}
                                                            >
                                                                <Check className={cn("mr-2 h-4 w-4", relatedUserId === user.id ? "opacity-100" : "opacity-0")} />
                                                                <div className="flex flex-col">
                                                                    <span>{user.name_ar}</span>
                                                                    {user.name_en && <span className="text-xs text-muted-foreground">{user.name_en}</span>}
                                                                    <span className="text-xs text-slate-400 font-mono">{user.account_code || user.code}</span>
                                                                </div>
                                                            </CommandItem>
                                                        ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className="space-y-2">
                                <Label>الاسم في السند (يدوي / جهة خارجية)</Label>
                                <Input placeholder="اسم الجهة الدافعة..." value={payer} onChange={e => setPayer(e.target.value)} className="h-9" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>البيان العام</Label>
                        <Input placeholder="مثال: دفعة من الحساب، سداد فاتورة رقم..." value={description} onChange={e => setDescription(e.target.value)} />
                    </div>

                    {/* Lines Section */}
                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="font-semibold text-slate-800">بنود الاستلام (التوجيه المحاسبي)</h3>
                                <p className="text-xs text-slate-500">حدد الحسابات الدائنة (مثل: العملاء، الإيرادات)</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleAddLine} type="button" className="gap-2">
                                + إضافة بند
                            </Button>
                        </div>

                        <div className="border rounded-md overflow-hidden bg-white">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 border-b text-slate-600">
                                    <tr>
                                        <th className="px-4 py-3 text-right font-medium">الحساب (من / Credit)</th>
                                        <th className="px-4 py-3 text-right font-medium">البيان (اختياري)</th>
                                        <th className="px-4 py-3 text-right font-medium w-40">المبلغ ({currencySymbol})</th>
                                        <th className="px-4 py-3 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {lineItems.map((line, index) => (
                                        <tr key={index} className="group hover:bg-slate-50/50">
                                            <td className="p-2 w-[40%]">
                                                <AccountSelector
                                                    accounts={creditAccounts}
                                                    value={line.accountId}
                                                    onChange={(val) => handleLineChange(index, 'accountId', val)}
                                                    onCreate={handleCreateCustomer}
                                                    // Important: Pass showAllLevels to allow displaying the filtered list (Level 3+)
                                                    showAllLevels={true}
                                                    placeholder="اختر حساب (عميل/إيراد)..."
                                                />
                                            </td>
                                            <td className="p-2">
                                                <Input
                                                    className="h-9 border-slate-200 focus:border-emerald-500"
                                                    placeholder={description || "وصف البند..."}
                                                    value={line.description}
                                                    onChange={e => handleLineChange(index, 'description', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={line.amount || ''}
                                                    onChange={e => handleLineChange(index, 'amount', e.target.value)}
                                                    className="h-9 font-mono font-semibold text-emerald-700 border-slate-200 focus:border-emerald-500"
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveLine(index)}
                                                    className="text-slate-400 hover:text-red-500 h-8 w-8"
                                                    disabled={lineItems.length === 1}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-emerald-50/50 border-t border-emerald-100">
                                    <tr>
                                        <td colSpan={2} className="px-4 py-3 text-left font-bold text-emerald-800">إجمالي المبلغ المستلم:</td>
                                        <td className="px-4 py-3 font-mono text-xl font-bold text-emerald-700">{formatCurrency(totalAmount)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t pt-6 bg-slate-50/50">
                    <Button variant="ghost" onClick={() => router.back()}>إلغاء الأمر</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="bg-emerald-600 hover:bg-emerald-700 min-w-[150px]"
                    >
                        {isLoading ? 'جاري الحفظ...' : 'حفظ وترحيل السند'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}


import { Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
