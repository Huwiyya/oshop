'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, TrendingUp, TrendingDown, DollarSign, Wallet, History } from "lucide-react";
import { TreasuryCard, TreasuryTransaction } from '@/lib/types';
import { getTreasuryCardById, getTreasuryTransactions, addTreasuryTransaction } from '@/lib/actions';
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Kept just in case, though unused in view

export default function TreasuryCardDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { toast } = useToast();
    const router = useRouter();
    const [card, setCard] = useState<TreasuryCard | null>(null);
    const [transactions, setTransactions] = useState<TreasuryTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [dialogType, setDialogType] = useState<'deposit' | 'withdrawal'>('deposit');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter State
    const [filterType, setFilterType] = useState<'all' | 'wallet' | 'orders' | 'arboon' | 'other'>('all');

    useEffect(() => {
        loadData();
    }, [id]);

    const loadData = async () => {
        setIsLoading(true);
        const [cardData, txData] = await Promise.all([
            getTreasuryCardById(id),
            getTreasuryTransactions(id)
        ]);
        setCard(cardData);
        setTransactions(txData);
        setIsLoading(false);
    };

    const handleTransaction = async () => {
        if (!card) return;
        if (!amount || parseFloat(amount) <= 0) {
            toast({ title: "خطأ", description: "يرجى إدخال مبلغ صحيح", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        try {
            await addTreasuryTransaction({
                cardId: card.id,
                amount: parseFloat(amount),
                type: dialogType,
                description: description || (dialogType === 'deposit' ? 'إيداع يدوي' : 'سحب يدوي'),
                channel: card.type === 'bank' ? 'bank' : 'cash'
            });

            toast({ title: "تمت العملية", description: "تم تسجيل المعاملة بنجاح" });
            setIsDialogOpen(false);
            setAmount('');
            setDescription('');
            loadData(); // Refresh
        } catch (error) {
            console.error("Transaction failed:", error);
            toast({ title: "خطأ", description: "فشل تنفيذ العملية", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const openDialog = (type: 'deposit' | 'withdrawal') => {
        setDialogType(type);
        setAmount('');
        setDescription('');
        setIsDialogOpen(true);
    };

    // Filter transactions based on selected type
    const filteredTransactions = React.useMemo(() => {
        if (filterType === 'all') return transactions;

        return transactions.filter(tx => {
            const desc = tx.description?.toLowerCase() || '';

            switch (filterType) {
                case 'wallet':
                    return desc.includes('إيداع محفظة') || desc.includes('wallet');
                case 'orders':
                    return tx.relatedOrderId || desc.includes('order') || desc.includes('فاتورة') || desc.includes('auto-deduction');
                case 'arboon':
                    return (desc.includes('عربون') || desc.includes('deposit')) && !desc.includes('محفظة');
                case 'other':
                    // Everything that doesn't match the above categories
                    const isWallet = desc.includes('إيداع محفظة') || desc.includes('wallet');
                    const isOrder = tx.relatedOrderId || desc.includes('order') || desc.includes('فاتورة') || desc.includes('auto-deduction');
                    const isArboon = (desc.includes('عربون') || desc.includes('deposit')) && !desc.includes('محفظة');
                    return !isWallet && !isOrder && !isArboon;
                default:
                    return true;
            }
        });
    }, [transactions, filterType]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    if (!card) {
        return <div className="text-center p-8">البطاقة غير موجودة</div>;
    }

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Wallet className="w-6 h-6 text-primary" />
                            {card.name}
                        </h1>
                        <p className="text-muted-foreground text-sm">إدارة وتفاصيل الخزينة</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {/* Buttons are direct as requested */}
                    <Button
                        onClick={() => openDialog('deposit')}
                        className="bg-green-600 hover:bg-green-700 text-white gap-2"
                    >
                        <TrendingUp className="w-4 h-4" />
                        إيداع أموال
                    </Button>
                    <Button
                        onClick={() => openDialog('withdrawal')}
                        variant="destructive"
                        className="gap-2"
                    >
                        <TrendingDown className="w-4 h-4" />
                        سحب أموال
                    </Button>
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-white shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">الرصيد الحالي</CardTitle>
                        <DollarSign className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">
                            {card.balance.toFixed(2)} <span className="text-lg text-muted-foreground font-normal">{card.currency}</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">النوع</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-semibold">
                            {card.type === 'cash_libyan' ? 'كاش (دينار)' : card.type === 'cash_dollar' ? 'دولار (كاش)' : 'حساب مصرفي'}
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">عدد المعاملات</CardTitle>
                        <History className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-semibold">
                            {transactions.length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Transactions Table */}
            <Card className="shadow-lg border-t-4 border-t-primary">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>سجل المعاملات المالية</CardTitle>
                            <CardDescription>كشف حساب تفصيلي لجميع العمليات الصادرة والواردة</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label htmlFor="filter-select" className="text-sm text-muted-foreground">تصفية حسب:</Label>
                            <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                                <SelectTrigger id="filter-select" className="w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">جميع المعاملات</SelectItem>
                                    <SelectItem value="wallet">محافظ المستخدمين</SelectItem>
                                    <SelectItem value="orders">الطلبات</SelectItem>
                                    <SelectItem value="arboon">العرابين</SelectItem>
                                    <SelectItem value="other">أخرى</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-right">التاريخ</TableHead>
                                <TableHead className="text-right">النوع</TableHead>
                                <TableHead className="text-right">المبلغ</TableHead>
                                <TableHead className="text-right">الوصف / البيان</TableHead>
                                <TableHead className="text-right">رقم الطلب</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTransactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        لا توجد معاملات مسجلة
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredTransactions.map((tx) => (
                                    <TableRow key={tx.id}>
                                        <TableCell className="font-mono text-muted-foreground">
                                            {new Date(tx.createdAt).toLocaleDateString('ar-LY')} {new Date(tx.createdAt).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tx.type === 'deposit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {tx.type === 'deposit' ? 'إيداع' : 'سحب'}
                                            </span>
                                        </TableCell>
                                        <TableCell className={`font-bold ${tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'}`}>
                                            {tx.type === 'deposit' ? '+' : '-'}{tx.amount.toFixed(2)}
                                        </TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell>
                                            {tx.relatedOrderId ? ( // Fixed from orderNumber check logic if needed, accessing directly
                                                tx.relatedOrderId !== 'undefined' ?
                                                    <a href={`/admin/orders/${tx.relatedOrderId}`} className="text-primary hover:underline">
                                                        #{tx.relatedOrderId.slice(0, 8)}
                                                    </a> : '-'
                                            ) : '-'}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Action Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{dialogType === 'deposit' ? 'إيداع أموال' : 'سحب أموال'}</DialogTitle>
                        <DialogDescription>
                            {card.name} - الرصيد الحالي: {card.balance} {card.currency}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">المبلغ</Label>
                            <Input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="col-span-3"
                                placeholder="0.00"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right">البيان/الوصف</Label>
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="col-span-3"
                                placeholder="مثال: إيداع نقدي من المبيعات"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                        <Button
                            onClick={handleTransaction}
                            disabled={isSubmitting}
                            variant={dialogType === 'deposit' ? 'default' : 'destructive'}
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                            تأكيد {dialogType === 'deposit' ? 'الإيداع' : 'السحب'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
