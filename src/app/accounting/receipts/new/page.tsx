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

export default function NewReceiptPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [accountId, setAccountId] = useState(''); // Debit Account (Cash/Bank)
    const [creditAccountId, setCreditAccountId] = useState(''); // Credit Account (Customer/Revenue)
    const [payer, setPayer] = useState('');
    const [relatedUserId, setRelatedUserId] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<'LYD' | 'USD'>('LYD');
    const [openPayer, setOpenPayer] = useState(false);
    const [openCreditAccount, setOpenCreditAccount] = useState(false);

    const selectedUser = users.find(u => u.id === relatedUserId);

    useEffect(() => {
        async function load() {
            // Load ALL accounts from chart of accounts instead of just cash/bank
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

    const currencySymbol = currency === 'LYD' ? 'د.ل' : '$';

    const handleSubmit = async () => {
        if (!accountId || !amount) return;
        setIsLoading(true);

        const res = await createReceipt({
            date,
            payer,
            relatedUserId: relatedUserId || undefined, // Send if selected
            receiveAccountId: accountId,
            receiveAccountName: '',
            creditAccountId: creditAccountId, // Pass credit account
            description,
            amount: Number(amount),
            currency,
            lineItems: []
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
        <div className="max-w-3xl mx-auto space-y-6">
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
                <CardContent className="space-y-4">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                        .filter(a => a.account_code.startsWith('111') || a.account_code.startsWith('1')) // Filter for Cash/Bank logic if possible, or just Show All
                                        .map(acc => (
                                            <SelectItem key={acc.id} value={acc.id}>
                                                {acc.name_ar || acc.name_en} ({acc.currency || 'LYD'})
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>الحساب الدائن (من / Credit) - العميل أو الإيراد</Label>
                            <Popover open={openCreditAccount} onOpenChange={setOpenCreditAccount}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openCreditAccount}
                                        className="w-full justify-between h-auto py-3 text-right"
                                    >
                                        {creditAccountId
                                            ? accounts.find((a) => a.id === creditAccountId)?.name_ar || "اختر حساب..."
                                            : "اختر الحساب (عميل / إيراد)..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[400px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="بحث عن حساب..." />
                                        <CommandList>
                                            <CommandEmpty>لم يتم العثور على حساب.</CommandEmpty>
                                            <CommandGroup heading="الأصول (العملاء)">
                                                {accounts.filter(a => a.account_code.startsWith('1120')).map((account) => ( // Customers
                                                    <CommandItem
                                                        key={account.id}
                                                        value={`${account.name_ar} ${account.account_code}`}
                                                        onSelect={() => {
                                                            setCreditAccountId(account.id);
                                                            setPayer(account.name_ar); // Auto-fill payer name
                                                            setOpenCreditAccount(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                creditAccountId === account.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span>{account.name_ar}</span>
                                                            <span className="text-xs text-slate-500 font-mono">{account.account_code}</span>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                            <CommandGroup heading="الإيرادات">
                                                {accounts.filter(a => a.account_code.startsWith('4')).map((account) => (
                                                    <CommandItem
                                                        key={account.id}
                                                        value={`${account.name_ar} ${account.account_code}`}
                                                        onSelect={() => {
                                                            setCreditAccountId(account.id);
                                                            setOpenCreditAccount(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                creditAccountId === account.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span>{account.name_ar}</span>
                                                            <span className="text-xs text-slate-500 font-mono">{account.account_code}</span>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                            <CommandGroup heading="أخرى">
                                                {accounts.filter(a => !a.account_code.startsWith('1120') && !a.account_code.startsWith('4') && !a.account_code.startsWith('111')).slice(0, 10).map((account) => (
                                                    <CommandItem
                                                        key={account.id}
                                                        value={`${account.name_ar} ${account.account_code}`}
                                                        onSelect={() => {
                                                            setCreditAccountId(account.id);
                                                            setOpenCreditAccount(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                creditAccountId === account.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span>{account.name_ar}</span>
                                                            <span className="text-xs text-slate-500 font-mono">{account.account_code}</span>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-lg border space-y-4">
                        <div className="flex items-center gap-2 mb-2 text-primary font-semibold">
                            <User className="w-4 h-4" />
                            <span>بيانات المستلم منه</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>ربط بمستخدم النظام (اختياري - للمراجعة فقط)</Label>
                                <Popover open={openPayer} onOpenChange={setOpenPayer}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openPayer}
                                            className="w-full justify-between h-auto py-3"
                                        >
                                            {selectedUser
                                                ? (
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className="font-medium">{selectedUser.name || selectedUser.username || 'عميل بدون اسم'}</span>
                                                        <span className="text-xs text-muted-foreground font-mono">{selectedUser.username || selectedUser.id.substring(0, 8)}</span>
                                                    </div>
                                                )
                                                : "بحث عن عميل بالاسم أو الكود..."}
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
                                                            value={`${user.name || ''} ${user.username || ''} ${user.id}`} // Searchable string
                                                            onSelect={() => {
                                                                setRelatedUserId(user.id);
                                                                setPayer(user.name || user.username || '');
                                                                setOpenPayer(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    relatedUserId === user.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <div className="flex flex-col whitespace-normal">
                                                                <span className="font-medium">{user.name || user.username || 'عميل بدون اسم'}</span>
                                                                <span className="text-xs text-muted-foreground font-mono">{user.username || user.id.substring(0, 8)}</span >
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
                                <Input
                                    placeholder="أو ادخل الاسم يدوياً..."
                                    value={payer}
                                    onChange={e => setPayer(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>المبلغ ({currencySymbol})</Label>
                        <Input
                            type="number"
                            step="0.001"
                            className="text-lg font-bold text-emerald-600"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>البيان (الوصف)</Label>
                        <Input placeholder="شرح لسند القبض..." value={description} onChange={e => setDescription(e.target.value)} />
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t pt-4">
                    <Button variant="outline" onClick={() => router.back()}>إلغاء</Button>
                    <Button onClick={handleSubmit} disabled={isLoading || !accountId || !amount} className="bg-emerald-600 hover:bg-emerald-700">
                        {isLoading ? 'جاري الحفظ...' : 'حفظ وسند'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
