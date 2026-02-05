'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, CreditCard, Loader2, Search, DollarSign, FileText, Eye, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { SheinCard, TreasuryCard, TreasuryTransaction, SheinTransaction } from '@/lib/types';
import { getSheinCards, addSheinCard, updateSheinCard, deleteSheinCard, getTreasuryCards, getSheinCardTransactions } from '@/lib/actions';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useRouter } from 'next/navigation';

export default function SheinCardsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [cards, setCards] = useState<SheinCard[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'used' | 'expired'>('all');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Treasury Management State
    const [treasuryCards, setTreasuryCards] = useState<TreasuryCard[]>([]);
    const [selectedTreasuryCard, setSelectedTreasuryCard] = useState<TreasuryCard | null>(null);
    const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
    const [manageTab, setManageTab] = useState<'actions' | 'history'>('actions');
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [manageAmount, setManageAmount] = useState('');
    const [manageNote, setManageNote] = useState('');
    const [manageType, setManageType] = useState<'deposit' | 'withdrawal'>('deposit');
    const [isSaving, setIsSaving] = useState(false);

    // Form State
    const [currentCardId, setCurrentCardId] = useState<string | null>(null);
    const [code, setCode] = useState('');
    const [value, setValue] = useState('');
    const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState<'available' | 'used' | 'expired'>('available');

    // Shein History State
    const [viewHistoryCard, setViewHistoryCard] = useState<SheinCard | null>(null);
    const [sheinHistory, setSheinHistory] = useState<SheinTransaction[]>([]);
    const [sheinHistoryLoading, setSheinHistoryLoading] = useState(false);

    useEffect(() => {
        fetchCards();
    }, []);

    const fetchCards = async () => {
        setIsLoading(true);
        const [data, tCards] = await Promise.all([
            getSheinCards(),
            getTreasuryCards()
        ]);
        setCards(data);
        setTreasuryCards(tCards);
        setIsLoading(false);
    };

    const handleOpenDialog = (card?: SheinCard) => {
        if (card) {
            setCurrentCardId(card.id);
            setCode(card.code);
            setValue(card.value.toString());
            setPurchaseDate(card.purchaseDate.split('T')[0]);
            setNotes(card.notes || '');
            setStatus(card.status);
        } else {
            setCurrentCardId(null);
            setCode('');
            setValue('');
            setPurchaseDate(new Date().toISOString().split('T')[0]);
            setNotes('');
            setStatus('available');
        }
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!code || !value) {
            toast({ title: "خطأ", description: "الكود والقيمة مطلوبان", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        try {
            const cardData = {
                code,
                value: parseFloat(value),
                currency: 'USD' as const,
                purchaseDate: new Date(purchaseDate).toISOString(),
                notes,
                status
            };

            if (currentCardId) {
                await updateSheinCard(currentCardId, cardData);
                toast({ title: "تم التحديث", description: "تم تحديث البطاقة بنجاح" });
            } else {
                await addSheinCard(cardData);
                toast({ title: "تم الإضافة", description: "تم إضافة البطاقة بنجاح" });
            }
            setIsDialogOpen(false);
            fetchCards();
        } catch (error) {
            console.error(error);
            toast({ title: "خطأ", description: "حدث خطأ أثناء الحفظ", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm(`هل أنت متأكد من حذف هذه البطاقة؟`)) {
            try {
                await deleteSheinCard(id);
                toast({ title: "تم الحذف", description: "تم حذف البطاقة بنجاح" });
                fetchCards();
            } catch (error) {
                toast({ title: "خطأ", description: "فشل الحذف", variant: "destructive" });
            }
        }
    };

    const filteredCards = useMemo(() => {
        return cards.filter(card => {
            const matchesSearch = card.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                card.notes?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' || card.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [cards, searchQuery, statusFilter]);

    // Summary Stats
    const totalAvailableValue = cards.filter(c => c.status === 'available').reduce((sum, c) => sum + (c.remainingValue ?? c.value), 0);
    const totalCardsCount = cards.length;
    const availableCardsCount = cards.filter(c => c.status === 'available').length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <h1 className="text-3xl font-bold tracking-tight">إدارة البطاقات والخزينة</h1>
                <div className="flex gap-2">
                    <Button onClick={() => handleOpenDialog()}>
                        <Plus className="w-4 h-4 ml-2" />
                        إضافة بطاقة جديدة
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">إجمالي الرصيد المتاح</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalAvailableValue.toFixed(2)} $</div>
                        <p className="text-xs text-muted-foreground">قيمة البطاقات غير المستخدمة</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">عدد البطاقات المتاحة</CardTitle>
                        <CreditCard className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{availableCardsCount}</div>
                        <p className="text-xs text-muted-foreground">بطاقة جاهزة للاستخدام</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">إجمالي البطاقات</CardTitle>
                        <div className="h-4 w-4 text-muted-foreground">#</div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalCardsCount}</div>
                        <p className="text-xs text-muted-foreground">مجموع الكل (متاح + مستخدم)</p>
                    </CardContent>
                </Card>
            </div>

            {/* Treasury Cards Section */}
            <div className="mt-6">
                <h2 className="text-2xl font-bold mb-4">بطاقات الخزينة</h2>
                <div className="grid gap-4 md:grid-cols-3">
                    {treasuryCards.map(card => (
                        <Card key={card.id} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">{card.name}</CardTitle>
                                <DollarSign className="h-4 w-4 text-blue-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                                    {card.balance.toFixed(2)} {card.currency === 'LYD' ? 'د.ل' : '$'}
                                </div>
                                <p className="text-xs text-blue-600/80 dark:text-blue-400 mb-4">الرصيد الحالي</p>
                                <div className="flex flex-col gap-2 mt-4">
                                    <div className="flex gap-2">
                                        <Button
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedTreasuryCard(card);
                                                setManageTab('actions');
                                                setManageType('deposit');
                                                setIsManageDialogOpen(true);
                                                setManageAmount('');
                                                setManageNote('');
                                            }}
                                        >
                                            <TrendingUp className="w-3 h-3 ml-1" />
                                            إيداع
                                        </Button>
                                        <Button
                                            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedTreasuryCard(card);
                                                setManageTab('actions');
                                                setManageType('withdrawal');
                                                setIsManageDialogOpen(true);
                                                setManageAmount('');
                                                setManageNote('');
                                            }}
                                        >
                                            <TrendingDown className="w-3 h-3 ml-1" />
                                            سحب
                                        </Button>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        size="sm"
                                        onClick={() => router.push(`/admin/treasury/${card.id}`)}
                                    >
                                        <Eye className="w-3 h-3 ml-2" />
                                        عرض التفاصيل والسجل
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                        <div className="relative flex-1 max-w-sm w-full">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="بحث عن كود أو ملاحظة..."
                                className="pr-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="تصفية حسب الحالة" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="available">متاح</SelectItem>
                                <SelectItem value="used">مستخدم</SelectItem>
                                <SelectItem value="expired">منتهي الصلاحية</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-right">الكود</TableHead>
                                    <TableHead className="text-center">القيمة ($)</TableHead>
                                    <TableHead className="text-center">الحالة</TableHead>
                                    <TableHead className="text-center">تاريخ الشراء</TableHead>
                                    <TableHead className="text-right">ملاحظات</TableHead>
                                    <TableHead className="text-center">إجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            <div className="flex justify-center items-center">
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                <span className="mr-2">جاري التحميل...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredCards.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            لا توجد بطاقات مطابقة
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredCards.map((card) => (
                                        <TableRow key={card.id} className={card.status === 'used' ? 'bg-muted/30' : ''}>
                                            <TableCell className="font-mono font-medium dir-ltr text-right">{card.code}</TableCell>
                                            <TableCell className="text-center font-bold text-green-600 dir-ltr">
                                                {(card.remainingValue ?? card.value).toFixed(2)}
                                                {card.remainingValue !== undefined && card.remainingValue < card.value && (
                                                    <span className="text-xs text-muted-foreground block line-through decoration-red-500/50">
                                                        {card.value.toFixed(2)}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={card.status === 'available' ? 'default' : card.status === 'used' ? 'secondary' : 'destructive'}>
                                                    {card.status === 'available' ? 'متاح' : card.status === 'used' ? 'مستخدم' : 'منتهي'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-sm">
                                                {format(new Date(card.purchaseDate), 'yyyy-MM-dd')}
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate" title={card.notes}>
                                                {card.notes || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-center gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => router.push(`/admin/shein-cards/${card.id}`)} title="عرض التفاصيل والسجل">
                                                        <Eye className="w-4 h-4 text-primary" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(card)}>
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(card.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile Card List */}
                    {/* Mobile Card List - Premium Dark */}
                    <div className="md:hidden space-y-4 pb-24">
                        {isLoading ? (
                            <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
                        ) : filteredCards.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <CreditCard className="h-10 w-10 opacity-30 mb-4" />
                                <p className="text-center">لا توجد بطاقات مطابقة</p>
                            </div>
                        ) : (
                            filteredCards.map((card) => (
                                <div key={card.id} className="bg-[#1c1c1e] rounded-3xl border border-white/5 p-5 shadow-lg relative overflow-hidden group">
                                    {/* Status Indicator Strip */}
                                    <div className={`absolute top-0 right-0 w-1.5 h-full ${card.status === 'available' ? 'bg-green-500 shadow-[0_0_15px_#22c55e]' :
                                        card.status === 'used' ? 'bg-blue-500 shadow-[0_0_15px_#3b82f6]' :
                                            'bg-red-500 shadow-[0_0_15px_#ef4444]'
                                        }`} />

                                    <div className="pl-2">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <p className="text-xs text-white/40 mb-1">كود البطاقة</p>
                                                <p className="font-mono font-bold text-xl text-white dir-ltr tracking-wider">
                                                    {card.code.match(/.{1,4}/g)?.join(' ') || card.code}
                                                </p>
                                            </div>
                                            <Badge variant="outline" className={`
                                                ${card.status === 'available' ? 'border-green-500/30 text-green-400 bg-green-500/10' :
                                                    card.status === 'used' ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' :
                                                        'border-red-500/30 text-red-400 bg-red-500/10'}
                                            `}>
                                                {card.status === 'available' ? 'متاح' : card.status === 'used' ? 'مستخدم' : 'منتهي'}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                                                <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
                                                    <DollarSign className="w-3.5 h-3.5 text-green-500" />
                                                    <span>القيمة الحالية</span>
                                                </div>
                                                <div className="font-bold text-xl text-white dir-ltr">
                                                    {(card.remainingValue ?? card.value).toFixed(2)} <span className="text-sm text-green-500">$</span>
                                                </div>
                                            </div>
                                            <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                                                <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
                                                    <CreditCard className="w-3.5 h-3.5" />
                                                    <span>القيمة الأصلية</span>
                                                </div>
                                                <div className="font-bold text-lg text-white/60 dir-ltr line-through decoration-white/20">
                                                    {card.value.toFixed(2)} $
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center pt-3 border-t border-white/5">
                                            <p className="text-xs text-white/30 font-mono">
                                                {format(new Date(card.purchaseDate), 'yyyy-MM-dd')}
                                            </p>

                                            <div className="flex items-center gap-1">
                                                <Button size="icon" variant="ghost" className="h-9 w-9 text-white/60 hover:text-white hover:bg-white/10 rounded-xl" onClick={() => router.push(`/admin/shein-cards/${card.id}`)}>
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-9 w-9 text-white/60 hover:text-white hover:bg-white/10 rounded-xl" onClick={() => handleOpenDialog(card)}>
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-9 w-9 text-red-400/60 hover:text-red-400 hover:bg-red-500/10 rounded-xl" onClick={() => handleDelete(card.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Main Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{currentCardId ? 'تعديل بطاقة' : 'إضافة بطاقة جديدة'}</DialogTitle>
                        <DialogDescription>
                            أدخل تفاصيل بطاقة الهدايا.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>كود البطاقة</Label>
                            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="أدخل كود البطاقة" dir="ltr" />
                        </div>
                        <div className="space-y-2">
                            <Label>القيمة ($)</Label>
                            <Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" dir="ltr" />
                        </div>
                        <div className="space-y-2">
                            <Label>تاريخ الشراء</Label>
                            <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>الحالة</Label>
                            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="available">متاح</SelectItem>
                                    <SelectItem value="used">مستخدم</SelectItem>
                                    <SelectItem value="expired">منتهي الصلاحية</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>ملاحظات</Label>
                            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات إضافية..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            حفظ
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Treasury Management Dialog */}
            <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>إدارة {selectedTreasuryCard?.name}</DialogTitle>
                        <DialogDescription>
                            إدارة العمليات والسجل المالي للبطاقة.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex gap-2 border-b mb-4">
                        <Button
                            variant={manageTab === 'actions' ? 'default' : 'ghost'}
                            onClick={() => setManageTab('actions')}
                            className="rounded-b-none"
                        >
                            العمليات
                        </Button>
                        <Button
                            variant={manageTab === 'history' ? 'default' : 'ghost'}
                            onClick={async () => {
                                setManageTab('history');
                                if (selectedTreasuryCard) {
                                    setHistoryLoading(true);
                                    try {
                                        const actionsModule = await import('@/lib/actions');
                                        if (actionsModule.getTreasuryTransactions) {
                                            const data = await actionsModule.getTreasuryTransactions(selectedTreasuryCard.id);
                                            setHistory(data);
                                        } else {
                                            console.warn('getTreasuryTransactions is not available');
                                            setHistory([]);
                                        }
                                    } catch (e) {
                                        console.error('Error loading treasury transactions:', e);
                                        setHistory([]);
                                    }
                                    setHistoryLoading(false);
                                }
                            }}
                            className="rounded-b-none"
                        >
                            السجل
                        </Button>
                    </div>

                    {manageTab === 'actions' ? (
                        <div className="space-y-4 py-4">
                            <div className="flex gap-4">
                                <Button
                                    variant={manageType === 'deposit' ? 'default' : 'outline'}
                                    onClick={() => setManageType('deposit')}
                                    className={manageType === 'deposit' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                                >
                                    إيداع (+)
                                </Button>
                                <Button
                                    variant={manageType === 'withdrawal' ? 'default' : 'outline'}
                                    onClick={() => setManageType('withdrawal')}
                                    className={manageType === 'withdrawal' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                                >
                                    سحب (-)
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label>المبلغ ({selectedTreasuryCard?.currency === 'LYD' ? 'د.ل' : '$'})</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={manageAmount}
                                    onChange={(e) => setManageAmount(e.target.value)}
                                    placeholder="0.00"
                                    dir="ltr"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>ملاحظات</Label>
                                <Input
                                    value={manageNote}
                                    onChange={(e) => setManageNote(e.target.value)}
                                    placeholder="سبب العملية..."
                                />
                            </div>

                            <Button onClick={async () => {
                                if (!manageAmount || !selectedTreasuryCard) return;
                                setIsSaving(true);
                                try {
                                    const { addTreasuryTransaction } = await import('@/lib/actions');
                                    await addTreasuryTransaction({
                                        amount: parseFloat(manageAmount),
                                        type: manageType,
                                        description: manageNote || (manageType === 'deposit' ? 'إيداع يدوي' : 'سحب يدوي'),
                                        cardId: selectedTreasuryCard.id
                                    });
                                    toast({ title: "تم بنجاح", description: "تم تنفيذ العملية بنجاح" });
                                    setIsManageDialogOpen(false);
                                    fetchCards();
                                } catch (e) {
                                    toast({ title: "خطأ", description: "فشل تنفيذ العملية", variant: "destructive" });
                                } finally {
                                    setIsSaving(false);
                                }
                            }} disabled={isSaving} className="w-full">
                                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                تنفيذ {manageType === 'deposit' ? 'الإيداع' : 'السحب'}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[400px] overflow-y-auto">
                            {historyLoading ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                            ) : history.length === 0 ? (
                                <p className="text-center text-muted-foreground p-8">لا يوجد سجل عمليات</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-right">التاريخ</TableHead>
                                            <TableHead className="text-center">النوع</TableHead>
                                            <TableHead className="text-center">المبلغ</TableHead>
                                            <TableHead className="text-center">رقم الطلب</TableHead>
                                            <TableHead className="text-right">العميل</TableHead>
                                            <TableHead className="text-right">ملاحظات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {history.map((tx) => (
                                            <TableRow key={tx.id}>
                                                <TableCell>{format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm')}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={tx.type === 'deposit' ? 'default' : 'destructive'} className={tx.type === 'deposit' ? 'bg-green-600' : 'bg-red-600'}>
                                                        {tx.type === 'deposit' ? 'إيداع' : 'سحب'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center font-bold dir-ltr">
                                                    {tx.amount.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {tx.orderNumber ? <Badge variant="outline">{tx.orderNumber}</Badge> : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {tx.customerName ? (
                                                        <div className="flex flex-col text-xs">
                                                            <span className="font-medium">{tx.customerName}</span>
                                                            <span className="text-muted-foreground">{tx.customerPhone}</span>
                                                        </div>
                                                    ) : '-'}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{tx.description}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Shein History Dialog */}
            <Dialog open={!!viewHistoryCard} onOpenChange={(open) => !open && setViewHistoryCard(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>سجل معاملات البطاقة: {viewHistoryCard?.code}</DialogTitle>
                        <DialogDescription>
                            تفاصيل استخدام البطاقة والعمليات المرتبطة بها.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 max-h-[500px] overflow-y-auto">
                        {sheinHistoryLoading ? (
                            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                        ) : sheinHistory.length === 0 ? (
                            <p className="text-center text-muted-foreground p-8">لا يوجد سجل استخدام لهذه البطاقة (في النظام الجديد)</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-right">التاريخ</TableHead>
                                        <TableHead className="text-center">القيمة المخصومة</TableHead>
                                        <TableHead className="text-center">رقم الطلب</TableHead>
                                        <TableHead className="text-right">العميل</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sheinHistory.map((tx) => (
                                        <TableRow key={tx.id}>
                                            <TableCell>{format(new Date(tx.createdAt), 'yyyy-MM-dd HH:mm')}</TableCell>
                                            <TableCell className="text-center font-bold text-red-600 dir-ltr">
                                                -{tx.amount.toFixed(2)} $
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {tx.orderNumber ? <Badge variant="outline">{tx.orderNumber}</Badge> : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {tx.customerName ? (
                                                    <div className="flex flex-col text-xs">
                                                        <span className="font-medium">{tx.customerName}</span>
                                                        <span className="text-muted-foreground">{tx.customerPhone}</span>
                                                    </div>
                                                ) : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
