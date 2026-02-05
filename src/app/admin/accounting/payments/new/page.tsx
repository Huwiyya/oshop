'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPayment } from '@/lib/payment-actions';
import { getCashAccounts, getBankAccounts } from '@/lib/accounting-actions';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewPaymentPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [accountId, setAccountId] = useState('');
    const [payee, setPayee] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<'LYD' | 'USD'>('LYD');

    useEffect(() => {
        async function load() {
            const [cash, bank] = await Promise.all([getCashAccounts(), getBankAccounts()]);
            setAccounts([...cash, ...bank]);
        }
        load();
    }, []);

    const currencySymbol = currency === 'LYD' ? 'د.ل' : '$';

    const handleSubmit = async () => {
        if (!accountId || !amount) return;
        setIsLoading(true);

        const res = await createPayment({
            date,
            payee,
            paymentAccountId: accountId,
            paymentAccountName: '', // Handled by ID
            description,
            amount: Number(amount),
            currency,
            lineItems: []
        });

        if (res.success) {
            router.push('/admin/accounting/payments');
            router.refresh();
        } else {
            alert('Error: ' + res.error);
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin/accounting/payments">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold">سند صرف جديد</h1>
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
                            <Label>الحساب الدافع (من)</Label>
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
                                            {acc.name} ({acc.currency})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>المستفيد (Payee)</Label>
                        <Input placeholder="اسم المستفيد..." value={payee} onChange={e => setPayee(e.target.value)} />
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

                    <div className="space-y-2">
                        <Label>البيان (الوصف)</Label>
                        <Input placeholder="شرح لسند الصرف..." value={description} onChange={e => setDescription(e.target.value)} />
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2 border-t pt-4">
                    <Button variant="outline" onClick={() => router.back()}>إلغاء</Button>
                    <Button onClick={handleSubmit} disabled={isLoading || !accountId || !amount} className="bg-rose-600 hover:bg-rose-700">
                        {isLoading ? 'جاري الصرف...' : 'حفظ السند'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
