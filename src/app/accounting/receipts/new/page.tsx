'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createReceipt } from '@/lib/receipt-actions';
import { getUsers } from '@/lib/actions';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ArrowRight, User, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { AccountSelector } from '@/components/accounting/AccountSelector';
import { createQuickAccount, getEntities } from '@/lib/accounting-actions';
import { useToast } from '@/components/ui/use-toast';

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
    const [currency, setCurrency] = useState<'LYD' | 'USD'>('LYD');
    const [openPayer, setOpenPayer] = useState(false);

    const selectedUser = users.find(u => u.id === relatedUserId);

    useEffect(() => {
        async function load() {
            const { getAllAccounts } = await import('@/lib/accounting-actions');
            const [allAccounts, usersList] = await Promise.all([
                getAllAccounts(),
                getUsers()
            ]);
            setAccounts(allAccounts);
            setUsers(usersList);
        }
        load();
    }, []);

    const handleCreateCustomer = async (name: string) => {
        try {
            const res = await createQuickAccount(name, 'customer');
            if (res.success && res.id) {
                toast({ title: 'تم الإنشاء', description: `تم إنشاء العميل "${name}" بنجاح` });
                // Refresh list
                const { getAllAccounts } = await import('@/lib/accounting-actions');
                const newAccounts = await getAllAccounts();
                setAccounts(newAccounts);
                // Return id to be used by the selector if needed, 
                // but AccountSelector handles calling onChange itself? 
                // No, AccountSelector calls onCreate(term). 
                // We need to find the new account and select it?
                // The AccountSelector component closes on Create. 
                // We actually need to return the ID or handle selection here?
                // Wait, AccountSelector calls `onCreate` then closes. It doesn't auto-select.
                // The user has to search again? 
                // "Select new customer" comment in my previous code: `handleCustomerChange(res.id);`
                // Here we have multiple lines. We don't know which line triggered it easily unless we pass index.
                // Constraint: AccountSelector's onCreate doesn't pass back the new ID to the immediate caller in a way that allows auto-selecting specific line.
                // I will improve AccountSelector later or just accept that they search again for now (it appears in list).
                // Actually, for better UX, I should probably reload accounts and let them select it.
            } else {
                toast({ title: 'خطأ', description: res.error || 'فشل إنشاء العميل', variant: 'destructive' });
            }
        } catch (error) {
            console.error(error);
            toast({ title: 'خطأ', description: 'حدث خطأ أثناء الإنشاء', variant: 'destructive' });
        }
    };

    const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
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
        if (!accountId || totalAmount <= 0) return;
        setIsLoading(true);

        const res = await createReceipt({
            date,
            payer,
            relatedUserId: relatedUserId || undefined,
            receiveAccountId: accountId,
            receiveAccountName: '',
            description,
            amount: totalAmount,
            currency,
            lineItems: lineItems.filter(li => li.accountId && li.amount > 0)
        });

        if (res.success) {
            router.push('/accounting/receipts');
            router.refresh();
        } else {
            alert('Error: ' + res.error);
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/accounting/receipts">
                    <Button variant="ghost" size="icon">
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold">سند قبض جديد</h1>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>تفاصيل السند</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>التاريخ</Label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>الحساب المستلم (إلى / Debit) - حساب الخزينة أو البنك</Label>
                            <Select value={accountId} onValueChange={(val) => {
                                setAccountId(val);
                                const acc = accounts.find(a => a.id === val);
                                if (acc) setCurrency(acc.currency);
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر حساب الخزينة أو البنك" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts
                                        .filter(a => (a.account_code.startsWith('111') || a.account_code.startsWith('1')) && a.level === 4)
                                        .map(acc => (
                                            <SelectItem key={acc.id} value={acc.id}>
                                                {acc.name_ar || acc.name_en} ({acc.currency || 'LYD'})
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-lg border space-y-4">
                        <div className="flex items-center gap-2 mb-2 text-primary font-semibold">
                            <User className="w-4 h-4" />
                            <span>بيانات المستلم منه</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>ربط بمستخدم النظام (اختياري)</Label>
                                <Popover open={openPayer} onOpenChange={setOpenPayer}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between h-auto py-3">
                                            {selectedUser ? selectedUser.name || selectedUser.username : "بحث عن عميل..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[350px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="ابحث باسم العميل..." />
                                            <CommandList>
                                                <CommandEmpty>لم يتم العثور على عميل.</CommandEmpty>
                                                <CommandGroup>
                                                    {users.map((user) => (
                                                        <CommandItem
                                                            key={user.id}
                                                            onSelect={() => {
                                                                setRelatedUserId(user.id);
                                                                setPayer(user.name || user.username || '');
                                                                setOpenPayer(false);
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", relatedUserId === user.id ? "opacity-100" : "opacity-0")} />
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">{user.name || user.username}</span>
                                                                <span className="text-xs text-muted-foreground">{user.username}</span>
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
                                <Label>الاسم في السند (Payer Name)</Label>
                                <Input placeholder="أو ادخل الاسم يدوياً..." value={payer} onChange={e => setPayer(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>البيان العام (وصف السند)</Label>
                        <Input placeholder="شرح عام لسند القبض..." value={description} onChange={e => setDescription(e.target.value)} />
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">بنود السند (Account Distribution)</h3>
                            <Button variant="outline" size="sm" onClick={handleAddLine} type="button">إضافة بند +</Button>
                        </div>
                        <div className="border rounded-md overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="px-4 py-2 text-right">الحساب الدائن (من / Credit)</th>
                                        <th className="px-4 py-2 text-right">البيان (اختياري)</th>
                                        <th className="px-4 py-2 text-right w-32">المبلغ ({currencySymbol})</th>
                                        <th className="px-4 py-2 text-center w-16"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((line, index) => (
                                        <tr key={index} className="border-b last:border-0">
                                            <td className="p-2">
                                                <td className="p-2">
                                                    <AccountSelector
                                                        accounts={accounts}
                                                        value={line.accountId}
                                                        onChange={(val) => handleLineChange(index, 'accountId', val)}
                                                        onCreate={handleCreateCustomer}
                                                        onAccountSelected={(acc) => {
                                                            if (line.description === '') {
                                                                handleLineChange(index, 'description', description);
                                                            }
                                                        }}
                                                    />
                                                </td>
                                            </td>
                                            <td className="p-2">
                                                <Input
                                                    placeholder="وصف لهذا البند..."
                                                    value={line.description}
                                                    onChange={e => handleLineChange(index, 'description', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <Input
                                                    type="number"
                                                    value={line.amount || ''}
                                                    onChange={e => handleLineChange(index, 'amount', Number(e.target.value))}
                                                    className="font-mono text-emerald-600 font-bold"
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveLine(index)}
                                                    className="text-red-500 h-8 w-8"
                                                    disabled={lineItems.length === 1}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 font-bold">
                                    <tr>
                                        <td colSpan={2} className="px-4 py-2 text-left">إجمالي السند:</td>
                                        <td className="px-4 py-2 text-emerald-600 font-mono text-lg">{formatCurrency(totalAmount)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t pt-4">
                    <Button variant="outline" onClick={() => router.back()}>إلغاء</Button>
                    <Button onClick={handleSubmit} disabled={isLoading || !accountId || totalAmount <= 0} className="bg-emerald-600 hover:bg-emerald-700">
                        {isLoading ? 'جاري الحفظ...' : 'حفظ سند القبض'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

import { Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
