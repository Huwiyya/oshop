'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createReceipt } from '@/lib/receipt-actions';
import { getCashAccounts, getBankAccounts } from '@/lib/accounting-actions';
import { getUsers } from '@/lib/actions';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, User } from 'lucide-react';
import Link from 'next/link';

export default function NewReceiptPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [accountId, setAccountId] = useState('');
    const [payer, setPayer] = useState('');
    const [relatedUserId, setRelatedUserId] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState<'LYD' | 'USD'>('LYD');

    useEffect(() => {
        async function load() {
            const [cash, bank, usersList] = await Promise.all([
                getCashAccounts(),
                getBankAccounts(),
                getUsers()
            ]);
            setAccounts([...cash, ...bank]);
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
            description,
            amount: Number(amount),
            currency,
            lineItems: []
        });

        if (res.success) {
            router.push('/admin/accounting/receipts');
            router.refresh();
        } else {
            alert('Error: ' + res.error);
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin/accounting/receipts">
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
                                            {acc.name} ({acc.currency})
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
                                <Label>اختيار عميل (ربط بالحساب)</Label>
                                <Select value={relatedUserId} onValueChange={(val) => {
                                    setRelatedUserId(val);
                                    const u = users.find(u => u.id === val);
                                    if (u) setPayer(u.username || u.name);
                                }}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="بحث عن عميل..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map(u => (
                                            <SelectItem key={u.id} value={u.id}>
                                                {u.username || u.name || 'Unknown'} ({u.id.substring(0, 4)})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
