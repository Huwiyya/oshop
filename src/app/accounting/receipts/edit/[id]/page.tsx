'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getReceiptById } from '@/lib/receipt-actions';
import { getCashAccounts, getBankAccounts } from '@/lib/accounting-actions';
import { getUsers } from '@/lib/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, User } from 'lucide-react';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

export default function EditReceiptPage() {
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const receiptId = params.id as string;

    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    // Form State
    const [date, setDate] = useState('');
    const [accountId, setAccountId] = useState('');
    const [payer, setPayer] = useState('');
    const [relatedUserId, setRelatedUserId] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<'LYD' | 'USD'>('LYD');
    const [open, setOpen] = useState(false);
    const [reference, setReference] = useState('');

    const selectedUser = users.find(u => u.id === relatedUserId);
    const currencySymbol = currency === 'LYD' ? 'د.ل' : '$';

    useEffect(() => {
        async function loadData() {
            setIsFetching(true);
            try {
                const [receiptData, cash, bank, usersList] = await Promise.all([
                    getReceiptById(receiptId),
                    getCashAccounts(),
                    getBankAccounts(),
                    getUsers()
                ]);

                if (!receiptData) {
                    toast({ title: 'خطأ', description: 'لم يتم العثور على السند', variant: 'destructive' });
                    router.push('/accounting/receipts');
                    return;
                }

                // تعبئة البيانات
                setDate(receiptData.date);
                setAccountId(receiptData.receiveAccountId);
                setPayer(receiptData.payer === '-' ? '' : receiptData.payer);
                setRelatedUserId(receiptData.relatedUserId || '');
                setDescription(receiptData.description);
                setAmount(receiptData.amount.toString());
                setCurrency(receiptData.currency);
                setReference(receiptData.reference);

                setAccounts([...cash, ...bank]);
                setUsers(usersList);
            } catch (e) {
                toast({ title: 'خطأ', description: 'فشل تحميل البيانات', variant: 'destructive' });
            } finally {
                setIsFetching(false);
            }
        }
        loadData();
    }, [receiptId]);

    const handleSubmit = async () => {
        if (!accountId || !amount) {
            toast({ title: 'خطأ', description: 'يرجى ملء جميع الحقول المطلوبة', variant: 'destructive' });
            return;
        }
        setIsLoading(true);

        const { updateReceipt } = await import('@/lib/receipt-actions');
        const result = await updateReceipt(receiptId, {
            date,
            payer,
            relatedUserId: relatedUserId || undefined,
            receiveAccountId: accountId,
            receiveAccountName: '',
            description,
            amount: Number(amount),
            currency,
            lineItems: []
        });

        if (result.success) {
            toast({ title: 'تم التحديث بنجاح', description: 'تم تحديث سند القبض' });
            router.push('/accounting/receipts');
        } else {
            toast({ title: 'خطأ', description: result.error, variant: 'destructive' });
        }
        setIsLoading(false);
    };

    if (isFetching) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="text-lg">جاري التحميل...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/accounting/receipts">
                    <Button variant="ghost" size="icon">
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">تعديل سند قبض</h1>
                    <p className="text-sm text-muted-foreground">{reference}</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>تفاصيل السند</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>التاريخ</Label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>الحساب المستلم (إلى)</Label>
                            <Select value={accountId} onValueChange={(val) => {
                                setAccountId(val);
                                const acc = accounts.find(a => a.id === val);
                                if (acc) setCurrency(acc.currency);
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر الخزينة أو البنك" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>
                                            {acc.name_ar || acc.name_en} ({acc.currency})
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
                                <Label>الاسم في السند (Payer Name)</Label>
                                <Input
                                    placeholder="أو أدخل الاسم يدوياً..."
                                    value={payer}
                                    onChange={e => setPayer(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>اختيار عميل (ربط بالحساب)</Label>
                                <Popover open={open} onOpenChange={setOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className="w-full justify-between"
                                        >
                                            {selectedUser ? selectedUser.name : "بحث عن عميل بالاسم أو الجواز..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0">
                                        <Command>
                                            <CommandInput placeholder="بحث عن عميل..." />
                                            <CommandEmpty>لم يتم العثور على عميل</CommandEmpty>
                                            <CommandList>
                                                <CommandGroup>
                                                    {users.map((user) => (
                                                        <CommandItem
                                                            key={user.id}
                                                            value={user.id}
                                                            onSelect={(currentValue) => {
                                                                setRelatedUserId(currentValue === relatedUserId ? '' : currentValue);
                                                                setOpen(false);
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", relatedUserId === user.id ? "opacity-100" : "opacity-0")} />
                                                            {user.name}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>المبلغ (د.ل)</Label>
                        <div className="relative">
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="text-lg font-bold"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                {currencySymbol}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>البيان (الوصف)</Label>
                        <Input
                            placeholder="شرح لسند القبض..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex gap-4 justify-end">
                <Link href="/accounting/receipts">
                    <Button variant="outline">إلغاء</Button>
                </Link>
                <Button
                    onClick={handleSubmit}
                    disabled={isLoading || !accountId || !amount}
                    className="bg-emerald-600 hover:bg-emerald-700"
                >
                    {isLoading ? 'جاري التحديث...' : 'حفظ التعديلات'}
                </Button>
            </div>
        </div>
    );
}
