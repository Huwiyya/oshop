'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getPaymentById } from '@/lib/payment-actions';
import { getCashAccounts, getBankAccounts } from '@/lib/accounting-actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/use-toast';

export default function EditPaymentPage() {
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const paymentId = params.id as string;

    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [accounts, setAccounts] = useState<any[]>([]);

    // Form State
    const [date, setDate] = useState('');
    const [accountId, setAccountId] = useState('');
    const [payee, setPayee] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<'LYD' | 'USD'>('LYD');
    const [reference, setReference] = useState('');

    const currencySymbol = currency === 'LYD' ? 'د.ل' : '$';

    useEffect(() => {
        async function loadData() {
            setIsFetching(true);
            try {
                const [paymentData, cash, bank] = await Promise.all([
                    getPaymentById(paymentId),
                    getCashAccounts(),
                    getBankAccounts()
                ]);

                if (!paymentData) {
                    toast({ title: 'خطأ', description: 'لم يتم العثور على السند', variant: 'destructive' });
                    router.push('/accounting/payments');
                    return;
                }

                // تعبئة البيانات
                setDate(paymentData.date);
                setAccountId(paymentData.paymentAccountId);
                setPayee(paymentData.payee === '-' ? '' : paymentData.payee);
                setDescription(paymentData.description);
                setAmount(paymentData.amount.toString());
                setCurrency(paymentData.currency);
                setReference(paymentData.reference);

                setAccounts([...cash, ...bank]);
            } catch (e) {
                toast({ title: 'خطأ', description: 'فشل تحميل البيانات', variant: 'destructive' });
            } finally {
                setIsFetching(false);
            }
        }
        loadData();
    }, [paymentId]);

    const handleSubmit = async () => {
        if (!accountId || !amount) {
            toast({ title: 'خطأ', description: 'يرجى ملء جميع الحقول المطلوبة', variant: 'destructive' });
            return;
        }
        setIsLoading(true);

        const { updatePayment } = await import('@/lib/payment-actions');
        const result = await updatePayment(paymentId, {
            date,
            payee,
            relatedSupplierId: undefined,
            paymentAccountId: accountId,
            paymentAccountName: '',
            description,
            amount: Number(amount),
            currency,
            lineItems: []
        });

        if (result.success) {
            toast({ title: 'تم التحديث بنجاح', description: 'تم تحديث سند الصرف' });
            router.push('/accounting/payments');
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
                                            {acc.name_ar || acc.name_en} ({acc.currency})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>المستفيد (Payee)</Label>
                        <Input
                            placeholder="اسم المستفيد..."
                            value={payee}
                            onChange={e => setPayee(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>المبلغ</Label>
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
                            placeholder="شرح لسند الصرف..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex gap-4 justify-end">
                <Link href="/accounting/payments">
                    <Button variant="outline">إلغاء</Button>
                </Link>
                <Button
                    onClick={handleSubmit}
                    disabled={isLoading || !accountId || !amount}
                    className="bg-rose-600 hover:bg-rose-700"
                >
                    {isLoading ? 'جاري التحديث...' : 'حفظ التعديلات'}
                </Button>
            </div>
        </div>
    );
}
