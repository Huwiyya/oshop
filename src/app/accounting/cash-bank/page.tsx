'use client';

import React, { useState, useEffect } from 'react';
import { getCashAccountsV2, getBankAccountsV2, updateBankAccountV2, updateCashAccountV2, deleteBankAccountV2, createBankAccountV2, createCashAccountV2 } from '@/lib/accounting-v2-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, Landmark, Pencil, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';

type Account = {
    id: string;
    name: string;
    currency: string;
    balance: number;
    accountNumber?: string | null;
    type: 'cash' | 'bank';
    rawData: any;
};

export default function CashAndBankPage() {
    const [cashAccounts, setCashAccounts] = useState<Account[]>([]);
    const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const loadData = async () => {
        setLoading(true);
        try {
            const cashData = await getCashAccountsV2();
            const bankData = await getBankAccountsV2();

            if (cashData.success && cashData.data) {
                setCashAccounts(cashData.data.map((acc: any) => ({
                    id: acc.id,
                    name: acc.name_ar || acc.name_en || 'حساب نقدي',
                    currency: acc.currency || 'LYD',
                    balance: acc.current_balance || 0,
                    type: 'cash' as const,
                    rawData: acc
                })));
            }

            if (bankData.success && bankData.data) {
                setBankAccounts(bankData.data.map((acc: any) => {
                    const descMatch = acc.description?.match(/Account:\s*(\S+)/);
                    const accountNumber = descMatch ? descMatch[1] : null; // Parsing might need adjustment for V2 description format if changed

                    return {
                        id: acc.id,
                        name: acc.name_ar || acc.name_en || 'حساب بنكي',
                        currency: acc.currency || 'LYD',
                        balance: acc.current_balance || 0,
                        accountNumber,
                        type: 'bank' as const,
                        rawData: acc
                    };
                }));
            }
        } catch (error) {
            toast({ title: 'خطأ', description: 'فشل تحميل البيانات', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const totalCashLYD = cashAccounts.filter(a => a.currency === 'LYD').reduce((sum, a) => sum + a.balance, 0);
    const totalCashUSD = cashAccounts.filter(a => a.currency === 'USD').reduce((sum, a) => sum + a.balance, 0);
    const totalBankLYD = bankAccounts.filter(a => a.currency === 'LYD').reduce((sum, a) => sum + a.balance, 0);
    const totalBankUSD = bankAccounts.filter(a => a.currency === 'USD').reduce((sum, a) => sum + a.balance, 0);
    const grandTotalLYD = totalCashLYD + totalBankLYD;
    const grandTotalUSD = totalCashUSD + totalBankUSD;

    if (loading) return <div className="text-center py-20">جاري التحميل...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-orange-500">
                    النقدية والبنوك (Cash & Bank)
                </h1>
                <p className="text-muted-foreground mt-1">
                    نظرة شاملة على جميع الخزائن النقدية والحسابات البنكية
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-t-4 border-t-emerald-500">
                    <CardHeader className="pb-2">
                        <CardDescription>إجمالي النقدية (LYD)</CardDescription>
                        <CardTitle className="text-2xl font-mono text-emerald-600">
                            {totalCashLYD.toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card className="border-t-4 border-t-blue-500">
                    <CardHeader className="pb-2">
                        <CardDescription>إجمالي البنوك (LYD)</CardDescription>
                        <CardTitle className="text-2xl font-mono text-blue-600">
                            {totalBankLYD.toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card className="border-t-4 border-t-emerald-400">
                    <CardHeader className="pb-2">
                        <CardDescription>إجمالي النقدية (USD)</CardDescription>
                        <CardTitle className="text-2xl font-mono text-emerald-500">
                            ${totalCashUSD.toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card className="border-t-4 border-t-blue-400">
                    <CardHeader className="pb-2">
                        <CardDescription>إجمالي البنوك (USD)</CardDescription>
                        <CardTitle className="text-2xl font-mono text-blue-500">
                            ${totalBankUSD.toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Grand Total */}
            <Card className="bg-gradient-to-r from-primary/10 to-orange-500/10 border-2 border-primary/20">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-center md:text-right">
                            <p className="text-sm text-muted-foreground mb-1">المجموع الكلي</p>
                            <p className="text-3xl font-bold font-mono text-primary">
                                {grandTotalLYD.toLocaleString()} LYD
                            </p>
                        </div>
                        <div className="text-center md:text-left">
                            <p className="text-sm text-muted-foreground mb-1">Total</p>
                            <p className="text-3xl font-bold font-mono text-orange-600">
                                ${grandTotalUSD.toLocaleString()} USD
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Cash Accounts Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-emerald-600" />
                        الخزائن النقدية
                    </h2>
                    <AddCashAccountDialog onSuccess={loadData} />
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {cashAccounts.map((account) => (
                        <Card key={account.id} className="hover:border-emerald-500/50 transition-colors group relative">
                            <div className="absolute top-3 left-3 flex gap-1 z-10">
                                <EditCashAccountDialog account={account} onSuccess={loadData} />
                                <DeleteAccountDialog account={account} onSuccess={loadData} />
                            </div>
                            <Link href={`/accounting/cash-bank/${account.id}`}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex justify-between items-start text-lg">
                                        <span className="group-hover:text-emerald-600 transition-colors">{account.name}</span>
                                        <Wallet className="w-5 h-5 text-muted-foreground group-hover:text-emerald-600" />
                                    </CardTitle>
                                    <CardDescription>{account.currency === 'LYD' ? 'دينار ليبي' : 'دولار أمريكي'}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold font-mono text-emerald-600">
                                        {account.balance.toLocaleString()}
                                        <span className="text-sm font-normal text-muted-foreground ml-1">{account.currency}</span>
                                    </div>
                                </CardContent>
                            </Link>
                        </Card>
                    ))}

                    {cashAccounts.length === 0 && (
                        <div className="col-span-full text-center py-8 bg-white dark:bg-white/5 rounded-xl border border-dashed">
                            <p className="text-muted-foreground">لا توجد خزائن نقدية</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bank Accounts Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Landmark className="w-6 h-6 text-blue-600" />
                        الحسابات البنكية
                    </h2>
                    <AddBankAccountDialog onSuccess={loadData} />
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {bankAccounts.map((account) => (
                        <Card key={account.id} className="hover:border-blue-500/50 transition-colors group relative">
                            <div className="absolute top-3 left-3 flex gap-1 z-10">
                                <EditBankAccountDialog account={account} onSuccess={loadData} />
                                <DeleteAccountDialog account={account} onSuccess={loadData} />
                            </div>
                            <Link href={`/accounting/cash-bank/${account.id}`}>
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex justify-between items-start text-lg">
                                        <span className="group-hover:text-blue-600 transition-colors">{account.name}</span>
                                        <Landmark className="w-5 h-5 text-muted-foreground group-hover:text-blue-600" />
                                    </CardTitle>
                                    <CardDescription>
                                        {account.currency} | {account.accountNumber ? `رقم: ${account.accountNumber}` : '---'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold font-mono text-blue-600">
                                        {account.balance.toLocaleString()}
                                        <span className="text-sm font-normal text-muted-foreground ml-1">{account.currency}</span>
                                    </div>
                                </CardContent>
                            </Link>
                        </Card>
                    ))}

                    {bankAccounts.length === 0 && (
                        <div className="col-span-full text-center py-8 bg-white dark:bg-white/5 rounded-xl border border-dashed">
                            <p className="text-muted-foreground">لا توجد حسابات بنكية</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function EditBankAccountDialog({ account, onSuccess }: { account: Account; onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const parseBank = (desc: string) => desc?.match(/Bank:\s*([^-]+)/)?.[1]?.trim() || '';
    const parseAccountNumber = (desc: string) => desc?.match(/Account:\s*(\S+)/)?.[1] || '';

    const [formData, setFormData] = useState({
        name: account.name,
        currency: account.currency as 'LYD' | 'USD',
        bankName: parseBank(account.rawData.description),
        accountNumber: parseAccountNumber(account.rawData.description)
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await updateBankAccountV2(account.id, formData);
            if (res.success) {
                toast({ title: 'تم تحديث الحساب البنكي بنجاح' });
                setOpen(false);
                onSuccess();
            } else {
                toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 bg-white/80 hover:bg-white">
                    <Pencil className="w-4 h-4 text-blue-600" />
                </Button>
            </DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>تعديل حساب بنكي</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>اسم الحساب</Label>
                        <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>اسم البنك</Label>
                            <Input value={formData.bankName} onChange={e => setFormData({ ...formData, bankName: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>رقم الحساب</Label>
                            <Input value={formData.accountNumber} onChange={e => setFormData({ ...formData, accountNumber: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>العملة</Label>
                        <Select value={formData.currency} onValueChange={(v: any) => setFormData({ ...formData, currency: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LYD">دينار ليبي</SelectItem>
                                <SelectItem value="USD">دولار</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>حفظ التعديلات</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EditCashAccountDialog({ account, onSuccess }: { account: Account; onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        name: account.name,
        currency: account.currency as 'LYD' | 'USD',
        description: account.rawData.description || ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await updateCashAccountV2(account.id, formData);
            if (res.success) {
                toast({ title: 'تم تحديث الخزينة النقدية بنجاح' });
                setOpen(false);
                onSuccess();
            } else {
                toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 bg-white/80 hover:bg-white">
                    <Pencil className="w-4 h-4 text-emerald-600" />
                </Button>
            </DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>تعديل خزينة نقدية</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>اسم الخزينة</Label>
                        <Input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                        <Label>العملة</Label>
                        <Select value={formData.currency} onValueChange={(v: any) => setFormData({ ...formData, currency: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LYD">دينار ليبي</SelectItem>
                                <SelectItem value="USD">دولار</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>ملاحظات</Label>
                        <Input value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>حفظ التعديلات</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DeleteAccountDialog({ account, onSuccess }: { account: Account; onSuccess: () => void }) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleDelete = async () => {
        setLoading(true);
        try {
            const res = await deleteBankAccountV2(account.id);
            if (res.success) {
                toast({ title: `تم حذف ${account.type === 'bank' ? 'الحساب البنكي' : 'الخزينة النقدية'} بنجاح` });
                onSuccess();
            } else {
                toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 bg-white/80 hover:bg-white">
                    <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم حذف <strong>{account.name}</strong> نهائياً. لا يمكن التراجع عن هذا الإجراء.
                        <br /><br />
                        <strong>ملاحظة:</strong> لا يمكن حذف حساب مرتبط بحركات مالية أو سندات.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {loading ? 'جاري الحذف...' : 'حذف'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function AddBankAccountDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        name: '',
        currency: 'LYD' as 'LYD' | 'USD',
        bankName: '',
        accountNumber: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await createBankAccountV2(formData);
            if (res.success) {
                toast({ title: 'تم إضافة الحساب البنكي بنجاح' });
                setOpen(false);
                setFormData({ name: '', currency: 'LYD', bankName: '', accountNumber: '' });
                onSuccess();
            } else {
                toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4" />
                    إضافة حساب بنكي
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>إضافة حساب بنكي جديد</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>اسم الحساب</Label>
                        <Input
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="مثال: حساب بنك الجمهورية"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>اسم البنك</Label>
                            <Input
                                value={formData.bankName}
                                onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                                placeholder="بنك الجمهورية"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>رقم الحساب</Label>
                            <Input
                                value={formData.accountNumber}
                                onChange={e => setFormData({ ...formData, accountNumber: e.target.value })}
                                placeholder="123456789"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>العملة</Label>
                        <Select value={formData.currency} onValueChange={(v: any) => setFormData({ ...formData, currency: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LYD">دينار ليبي</SelectItem>
                                <SelectItem value="USD">دولار</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'جاري الحفظ...' : 'حفظ'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function AddCashAccountDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        name: '',
        currency: 'LYD' as 'LYD' | 'USD',
        description: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await createCashAccountV2(formData);
            if (res.success) {
                toast({ title: 'تم إضافة الخزينة النقدية بنجاح' });
                setOpen(false);
                setFormData({ name: '', currency: 'LYD', description: '' });
                onSuccess();
            } else {
                toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4" />
                    إضافة خزينة نقدية
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>إضافة خزينة نقدية جديدة</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>اسم الخزينة</Label>
                        <Input
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="مثال: الخزينة الرئيسية"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>العملة</Label>
                        <Select value={formData.currency} onValueChange={(v: any) => setFormData({ ...formData, currency: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LYD">دينار ليبي</SelectItem>
                                <SelectItem value="USD">دولار</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>ملاحظات (اختياري)</Label>
                        <Input
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            placeholder="ملاحظات إضافية"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'جاري الحفظ...' : 'حفظ'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
