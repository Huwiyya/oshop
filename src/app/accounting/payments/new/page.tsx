'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPayment } from '@/lib/payment-actions';
import { getCashAccounts, getBankAccounts } from '@/lib/accounting-actions';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Check, ChevronsUpDown, Search } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
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

export default function NewPaymentPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const [paymentAccounts, setPaymentAccounts] = useState<any[]>([]); // Cash/Bank
    const [allAccounts, setAllAccounts] = useState<any[]>([]); // For Expenses/Liabilities

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Credit Side (The Payer)
    const [paymentAccountId, setPaymentAccountId] = useState('');
    const [openPaymentCombo, setOpenPaymentCombo] = useState(false);

    // Debit Side (The Expense/liability)
    const [targetAccountId, setTargetAccountId] = useState('');
    const [openTargetCombo, setOpenTargetCombo] = useState(false);

    const [payee, setPayee] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<'LYD' | 'USD'>('LYD');

    useEffect(() => {
        async function load() {
            // 1. Get Payment Accounts (Cash/Bank)
            const [cash, bank] = await Promise.all([getCashAccounts(), getBankAccounts()]);
            setPaymentAccounts([...cash, ...bank]);

            // 2. Get All Accounts (For selecting expense/liability)
            // We fetch active, non-parent accounts
            const { data } = await supabase
                .from('accounts')
                .select('id, name_ar, account_code, currency')
                .eq('is_active', true)
                .neq('is_parent', true)
                .order('account_code');

            if (data) setAllAccounts(data);
        }
        load();
    }, []);

    const currencySymbol = currency === 'LYD' ? 'د.ل' : '$';

    const handleSubmit = async () => {
        if (!paymentAccountId || !amount || !targetAccountId) return;
        setIsLoading(true);

        const targetAccountName = allAccounts.find(a => a.id === targetAccountId)?.name_ar || 'Unknown';

        const res = await createPayment({
            date,
            payee,
            paymentAccountId,
            paymentAccountName: '',
            description,
            amount: Number(amount),
            currency,
            lineItems: [
                {
                    accountId: targetAccountId,
                    amount: Number(amount),
                    description: description || `صرف إلى: ${targetAccountName}`
                }
            ]
        });

        if (res.success) {
            router.push('/accounting/payments');
            router.refresh();
        } else {
            alert('Error: ' + res.error);
            setIsLoading(false);
        }
    };

    const selectedPaymentAccount = paymentAccounts.find(a => a.id === paymentAccountId);
    const selectedTargetAccount = allAccounts.find(a => a.id === targetAccountId);

    return (
        <div className="max-w-3xl mx-auto space-y-6 pb-20">
            <div className="flex items-center gap-4">
                <Link href="/accounting/payments">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">سند صرف جديد</h1>
                    <p className="text-slate-500">إثبات مدفوعات نقدية أو بنكية</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>تفاصيل المعاملة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* التاريخ والحساب الدافع */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>تاريخ السند</Label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-rose-600 font-semibold">حساب الدفع (الدائن - من أين؟)</Label>
                            <Popover open={openPaymentCombo} onOpenChange={setOpenPaymentCombo}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={openPaymentCombo}
                                        className="w-full justify-between"
                                    >
                                        {selectedPaymentAccount ? (
                                            <div className="flex flex-col items-start text-left">
                                                <span className="font-semibold">{selectedPaymentAccount.name}</span>
                                                <span className="text-xs text-slate-500">{selectedPaymentAccount.currency}</span>
                                            </div>
                                        ) : (
                                            "خزينة أو بنك..."
                                        )}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                        <CommandInput placeholder="بحث عن خزينة..." />
                                        <CommandList>
                                            <CommandEmpty>لا يوجد حساب.</CommandEmpty>
                                            <CommandGroup>
                                                {paymentAccounts.map((acc) => (
                                                    <CommandItem
                                                        key={acc.id}
                                                        value={acc.id}
                                                        onSelect={(currentValue) => {
                                                            setPaymentAccountId(currentValue === paymentAccountId ? '' : currentValue);
                                                            setOpenPaymentCombo(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                paymentAccountId === acc.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {acc.name_ar || acc.name_en}
                                                        <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-1 rounded">{acc.currency}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* الحساب المستفيد (المصروف) */}
                    <div className="space-y-2">
                        <Label className="text-emerald-600 font-semibold">توجيه الصرف (المدين - مصروف/مورد/أصل)</Label>
                        <Popover open={openTargetCombo} onOpenChange={setOpenTargetCombo}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openTargetCombo}
                                    className="w-full justify-between h-auto py-2"
                                >
                                    {selectedTargetAccount ? (
                                        <div className="flex flex-col items-start text-left">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-emerald-700">{selectedTargetAccount.name_ar}</span>
                                            </div>
                                            <span className="text-xs text-slate-500 font-mono">CODE: {selectedTargetAccount.account_code}</span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-500 flex items-center gap-2"><Search className="w-4 h-4" /> ابحث عن حساب المصروف أو المورد...</span>
                                    )}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[500px] p-0" align="start">
                                <Command filter={(value, search) => {
                                    const acc = allAccounts.find(a => a.id === value);
                                    if (!acc) return 0;
                                    const text = `${acc.account_code} ${acc.name_ar}`.toLowerCase();
                                    return text.includes(search.toLowerCase()) ? 1 : 0;
                                }}>
                                    <CommandInput placeholder="بحث بالكود أو الاسم..." />
                                    <CommandList>
                                        <CommandEmpty>لا يوجد حساب بهذا الاسم.</CommandEmpty>
                                        <CommandGroup className="max-h-[300px] overflow-auto">
                                            {allAccounts.map((acc) => (
                                                <CommandItem
                                                    key={acc.id}
                                                    value={acc.id}
                                                    onSelect={(currentValue) => {
                                                        setTargetAccountId(currentValue === targetAccountId ? "" : currentValue)
                                                        setOpenTargetCombo(false)
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            targetAccountId === acc.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    <span className="font-mono text-slate-500 w-16">{acc.account_code}</span>
                                                    <span>{acc.name_ar}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>اسم المستفيد (الجهة المستلمة)</Label>
                            <Input placeholder="مثال: شركة الكهرباء، أحمد محمد..." value={payee} onChange={e => setPayee(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>المبلغ ({currencySymbol})</Label>
                            <Input
                                type="number"
                                step="0.001"
                                className="text-lg font-bold text-rose-600"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>البيان (الوصف)</Label>
                        <Input placeholder="شرح لسند الصرف..." value={description} onChange={e => setDescription(e.target.value)} />
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t pt-4 bg-slate-50">
                    <Button variant="outline" onClick={() => router.back()}>إلغاء</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading || !paymentAccountId || !amount || !targetAccountId}
                        className="bg-rose-600 hover:bg-rose-700 min-w-[120px]"
                    >
                        {isLoading ? 'جاري الحفظ...' : 'حفظ السند'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
