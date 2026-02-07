'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getPaymentById } from '@/lib/payment-actions';
import { getUsers } from '@/lib/actions';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, User, Trash2, ChevronsUpDown, Check } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/components/ui/use-toast';
import { AccountSelector } from '@/components/accounting/AccountSelector';

export default function EditPaymentPage() {
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const paymentId = params.id as string;

    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    // Form State
    const [date, setDate] = useState('');
    const [paymentAccountId, setPaymentAccountId] = useState(''); // Credit Account (Cash/Bank)
    const [payee, setPayee] = useState('');
    const [relatedUserId, setRelatedUserId] = useState('');
    const [description, setDescription] = useState('');
    const [lineItems, setLineItems] = useState<{ accountId: string; amount: number; description: string }[]>([]);
    const [currency, setCurrency] = useState<'LYD' | 'USD'>('LYD');
    const [openPayee, setOpenPayee] = useState(false);
    const [reference, setReference] = useState('');

    const selectedUser = users.find(u => u.id === relatedUserId);

    useEffect(() => {
        async function loadData() {
            setIsFetching(true);
            try {
                const { getAllAccounts } = await import('@/lib/accounting-actions');
                const [paymentData, allAccounts, usersList] = await Promise.all([
                    getPaymentById(paymentId),
                    getAllAccounts(),
                    getUsers()
                ]);

                if (!paymentData) {
                    toast({ title: 'خطأ', description: 'لم يتم العثور على السند', variant: 'destructive' });
                    router.push('/accounting/payments');
                    return;
                }

                setDate(paymentData.date);
                setPaymentAccountId(paymentData.paymentAccountId);
                setPayee(paymentData.payee === '-' || !paymentData.payee ? '' : paymentData.payee);
                setRelatedUserId(paymentData.relatedUserId || '');
                setDescription(paymentData.description || '');
                setCurrency(paymentData.currency);
                setReference(paymentData.reference);
                setLineItems(paymentData.lineItems && paymentData.lineItems.length > 0
                    ? paymentData.lineItems.map(li => ({
                        accountId: li.accountId,
                        amount: li.amount,
                        description: li.description || ''
                    }))
                    : [{ accountId: '', amount: paymentData.amount, description: paymentData.description || '' }]);

                setAccounts(allAccounts);
                setUsers(usersList);
            } catch (e) {
                toast({ title: 'خطأ', description: 'فشل تحميل البيانات', variant: 'destructive' });
            } finally {
                setIsFetching(false);
            }
        }
        loadData();
    }, [paymentId]);

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
        if (!paymentAccountId || totalAmount <= 0) {
            toast({ title: 'خطأ', description: 'يرجى ملء جميع الحقول المطلوبة', variant: 'destructive' });
            return;
        }
        setIsLoading(true);

        const { updatePayment } = await import('@/lib/payment-actions');
        const res = await updatePayment(paymentId, {
            date,
            payee,
            paymentAccountId: paymentAccountId,
            paymentAccountName: '',
            description,
            amount: totalAmount,
            currency,
            lineItems: lineItems.filter(li => li.accountId && li.amount > 0)
        });

        if (res.success) {
            toast({ title: 'تم التحديث بنجاح', description: 'تم تحديث سند الصرف' });
            router.push('/accounting/payments');
            router.refresh();
        } else {
            toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            setIsLoading(false);
        }
    };

    if (isFetching) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center font-bold text-lg">جاري التحميل...</div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/accounting/payments">
                    <Button variant="ghost" size="icon">
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">تعديل سند صرف</h1>
                    <p className="text-sm text-muted-foreground">{reference}</p>
                </div>
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
                            <Label>الحساب الدافع (من / Credit) - حساب الخزينة أو البنك</Label>
                            <Select value={paymentAccountId} onValueChange={(val) => {
                                setPaymentAccountId(val);
                                const acc = accounts.find(a => a.id === val);
                                if (acc) setCurrency(acc.currency);
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر حساب الخزينة أو البنك" />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts
                                        .filter(a => a.account_code.startsWith('111') || a.account_code.startsWith('1'))
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
                            <span>بيانات المستلم (Payee)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>ربط بمستخدم النظام (اختياري)</Label>
                                <Popover open={openPayee} onOpenChange={setOpenPayee}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between h-auto py-3">
                                            {selectedUser ? selectedUser.name || selectedUser.username : "بحث عن مورد/موظف..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[350px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="ابحث بالاسم..." />
                                            <CommandList>
                                                <CommandEmpty>لم يتم العثور على نتيجة.</CommandEmpty>
                                                <CommandGroup>
                                                    {users.map((user) => (
                                                        <CommandItem
                                                            key={user.id}
                                                            onSelect={() => {
                                                                setRelatedUserId(user.id);
                                                                setPayee(user.name || user.username || '');
                                                                setOpenPayee(false);
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
                                <Label>الاسم في السند (Payee Name)</Label>
                                <Input placeholder="أو ادخل الاسم يدوياً..." value={payee} onChange={e => setPayee(e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>البيان العام (وصف السند)</Label>
                        <Input placeholder="شرح عام لسند الصرف..." value={description} onChange={e => setDescription(e.target.value)} />
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">بنود الصرف (Debit Distribution)</h3>
                            <Button variant="outline" size="sm" onClick={handleAddLine} type="button">إضافة بند +</Button>
                        </div>
                        <div className="border rounded-md overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="px-4 py-2 text-right">الحساب المدين (إلى / Debit)</th>
                                        <th className="px-4 py-2 text-right">البيان (اختياري)</th>
                                        <th className="px-4 py-2 text-right w-32">المبلغ ({currencySymbol})</th>
                                        <th className="px-4 py-2 text-center w-16"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.map((line, index) => (
                                        <tr key={index} className="border-b last:border-0">
                                            <td className="p-2">
                                                <AccountSelector
                                                    accounts={accounts}
                                                    value={line.accountId}
                                                    onChange={(val) => handleLineChange(index, 'accountId', val)}
                                                    onAccountSelected={(acc) => {
                                                        if (line.description === '') {
                                                            handleLineChange(index, 'description', description);
                                                        }
                                                    }}
                                                />
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
                                                    className="font-mono text-rose-600 font-bold"
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
                                        <td className="px-4 py-2 text-rose-600 font-mono text-lg">{formatCurrency(totalAmount)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t pt-4">
                    <Button variant="outline" onClick={() => router.back()}>إلغاء</Button>
                    <Button onClick={handleSubmit} disabled={isLoading || !paymentAccountId || totalAmount <= 0} className="bg-rose-600 hover:bg-rose-700">
                        {isLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

