
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, History, CreditCard, Tag, Trash } from 'lucide-react';
import { getInventoryItemById, getItemLayers, addInventoryStock, getItemTransactions, deleteInventoryTransaction, updateInventoryItem } from '@/lib/inventory-actions';
import { getAllAccounts } from '@/lib/accounting-actions';
import { AccountSelector } from '@/components/accounting/AccountSelector';
import { formatCurrency } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Edit2 } from 'lucide-react';

export default function InventoryItemDetails() {
    const { id } = useParams();
    const router = useRouter();
    const [item, setItem] = useState<any>(null);
    const [layers, setLayers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refreshData = async () => {
        if (!id) return;
        setIsLoading(true);
        const [itemData, layersData] = await Promise.all([
            getInventoryItemById(id as string),
            getItemLayers(id as string)
        ]);
        setItem(itemData);
        setLayers(layersData || []);
        setIsLoading(false);
    };

    useEffect(() => {
        refreshData();
    }, [id]);

    if (isLoading) return <div className="p-8"><Skeleton className="h-40 w-full" /></div>;
    if (!item) return <div className="p-8 text-center text-red-500">الصنف غير موجود</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                {item.name_ar}
                                {item.is_shein_card && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">بطاقات</span>}
                            </h1>
                            <EditItemDialog item={item} onSuccess={refreshData} />
                        </div>
                        <p className="text-slate-500 font-mono">{item.item_code}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <AddStockDialog item={item} onSuccess={refreshData} />
                    {/* Placeholder for Adjustment logic */}
                    <Button variant="outline">تسوية مخزنية (قيد)</Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">الكمية المتوفرة</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{item.quantity_on_hand} {item.unit === 'card' ? 'بطاقة' : 'قطعة'}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">متوسط التكلفة</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(item.average_cost)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">إجمالي القيمة</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">
                            {formatCurrency(item.quantity_on_hand * item.average_cost)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Cards List (Layers) */}
            {item.is_shein_card && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5" />
                            البطاقات المتوفرة (الرصيد)
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>تاريخ الإضافة (الشراء)</TableHead>
                                    <TableHead>رقم البطاقة</TableHead>
                                    <TableHead>الرصيد المتبقي</TableHead>
                                    <TableHead>تكلفة الوحدة</TableHead>
                                    <TableHead>الحالة</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {layers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                            لا توجد بطاقات متوفرة حالياً
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    layers.map((layer) => (
                                        <TableRow key={layer.id}>
                                            <TableCell className="font-mono text-xs text-slate-500">{layer.purchase_date}</TableCell>
                                            <TableCell className="font-bold">{layer.card_number || '-'}</TableCell>
                                            <TableCell>
                                                <span className="font-bold text-emerald-700">{layer.remaining_quantity}</span>
                                            </TableCell>
                                            <TableCell className="font-mono">{formatCurrency(layer.unit_cost)}</TableCell>
                                            <TableCell>
                                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs">نشط</span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Transactions History Table */}
            <InventoryTransactionsTable itemId={item.id} onRefresh={refreshData} />
        </div>
    );
}

function InventoryTransactionsTable({ itemId, onRefresh }: { itemId: string, onRefresh: () => void }) {
    const [transactions, setTransactions] = useState<any[]>([]);
    const { toast } = useToast();

    const loadTransactions = () => {
        getItemTransactions(itemId).then(data => {
            if (!data) return;
            // Calculate running balance
            // Sort by date ASC first
            const sorted = [...data].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

            let balance = 0;
            const withBalance = sorted.map(trx => {
                // Determine direction based on type
                // Incoming (+): purchase, adjustment_in, sale_return, transfer_in
                // Outgoing (-): sale, adjustment_out, purchase_return, transfer_out
                const incomingTypes = ['purchase', 'adjustment_in', 'sale_return', 'transfer_in'];
                const outgoingTypes = ['sale', 'adjustment_out', 'purchase_return', 'transfer_out'];

                const isIn = incomingTypes.includes(trx.transaction_type);
                const isOut = outgoingTypes.includes(trx.transaction_type);

                const qty = Number(trx.quantity) || 0;
                if (isIn) balance += qty;
                else if (isOut) balance -= qty;

                return { ...trx, balance, isIn, isOut };
            });

            // Set transactions to display (DESC)
            setTransactions(withBalance.reverse());
        });
    };

    useEffect(() => {
        loadTransactions();
    }, [itemId]);

    const handleDelete = async (id: string, type: string) => {
        if (type === 'sale') {
            toast({ title: 'تنبيه', description: 'حذف حركات البيع غير متاح. يرجى استخدام مرتجع المبيعات.', variant: 'destructive' });
            return;
        }

        if (!confirm('هل أنت متأكد من حذف هذه الحركة؟ سيتم عكس تأثيرها على المخزون (إن أمكن).')) return;

        try {
            await deleteInventoryTransaction(id);
            toast({ title: 'تم الحذف بنجاح' });
            loadTransactions();
            onRefresh();
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    سجل حركة الصنف (كارت الصنف)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-auto border rounded-xl">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>نوع الحركة</TableHead>
                                <TableHead>المرجع</TableHead>
                                <TableHead className="text-emerald-600">وارد</TableHead>
                                <TableHead className="text-red-600">صادر</TableHead>
                                <TableHead className="bg-slate-100 font-bold text-slate-700">الرصيد</TableHead>
                                <TableHead>التكلفة</TableHead>
                                <TableHead>الإجمالي</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                                        لا توجد حركات مسجلة
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.map((trx) => (
                                    <TableRow key={trx.id}>
                                        <TableCell className="font-mono text-xs text-nowrap">{trx.transaction_date}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={
                                                trx.transaction_type === 'purchase' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    trx.transaction_type === 'sale' ? 'bg-red-50 text-red-700 border-red-200' :
                                                        'bg-slate-50'
                                            }>
                                                {getTransactionTypeLabel(trx.transaction_type)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs">
                                            <div className="flex flex-col">
                                                <span>
                                                    {trx.reference_type === 'purchase_invoice' ? 'فاتورة شراء' :
                                                        trx.reference_type === 'sales_invoice' ? 'فاتورة مبيعات' : trx.reference_type || '-'}
                                                </span>
                                                {trx.reference_id && <span className="text-slate-400 font-mono text-[10px]">#{trx.reference_id.substring(0, 6)}</span>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-bold text-emerald-600 bg-emerald-50/30">
                                            {trx.isIn ? trx.quantity : '-'}
                                        </TableCell>
                                        <TableCell className="font-bold text-red-600 bg-red-50/30">
                                            {trx.isOut ? trx.quantity : '-'}
                                        </TableCell>
                                        <TableCell className="font-bold font-mono bg-slate-50">
                                            {trx.balance}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {formatCurrency(trx.unit_cost)}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-slate-500">
                                            {formatCurrency(trx.total_cost)}
                                        </TableCell>
                                        <TableCell>
                                            {trx.transaction_type === 'purchase' && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-600" onClick={() => handleDelete(trx.id, trx.transaction_type)}>
                                                    <Trash className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

function getTransactionTypeLabel(type: string) {
    const types: any = {
        'purchase': 'شراء',
        'sale': 'بيع',
        'adjustment': 'تسوية',
        'adjustment_in': 'تسوية(+) وارد',
        'adjustment_out': 'تسوية(-) صادر',
        'sale_return': 'مرتجع مبعيات',
        'purchase_return': 'مرتجع مشتريات',
        'transfer': 'نقل',
        'transfer_in': 'تحويل وارد',
        'transfer_out': 'تحويل صادر'
    };
    return types[type] || type;
}

function AddStockDialog({ item, onSuccess }: { item: any, onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        quantity: 1,
        unitCost: 0,
        cardNumber: '',
        purchaseDate: new Date().toISOString().split('T')[0]
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await addInventoryStock({
                itemId: item.id,
                quantity: Number(formData.quantity),
                unitCost: Number(formData.unitCost),
                purchaseDate: formData.purchaseDate,
                cardNumber: item.is_shein_card ? formData.cardNumber : undefined
            });
            toast({ title: 'تمت إضافة الرصيد بنجاح' });
            setOpen(false);
            setFormData({ quantity: 1, unitCost: 0, cardNumber: '', purchaseDate: new Date().toISOString().split('T')[0] });
            onSuccess();
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
                    إضافة {item.is_shein_card ? 'بطاقة / رصيد' : 'كمية'}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>إضافة رصيد إلى {item.name_ar}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>تاريخ الشراء / الإضافة</Label>
                            <Input
                                type="date"
                                required
                                value={formData.purchaseDate}
                                onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>تلكفة {item.unit === 'card' ? 'البطاقة' : 'القطعة'}</Label>
                            <Input
                                type="number" step="0.01" min="0"
                                required
                                value={formData.unitCost}
                                onChange={e => setFormData({ ...formData, unitCost: Number(e.target.value) })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>الكمية / الرصيد</Label>
                            <Input
                                type="number" step="0.01" min="0" required
                                value={formData.quantity}
                                onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                            />
                        </div>
                        {item.is_shein_card && (
                            <div className="space-y-2">
                                <Label>رقم البطاقة</Label>
                                <Input
                                    required
                                    placeholder="مثال: CARD-12345"
                                    value={formData.cardNumber}
                                    onChange={e => setFormData({ ...formData, cardNumber: e.target.value })}
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'جاري الحفظ...' : 'تأكيد الإضافة'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EditItemDialog({ item, onSuccess }: { item: any, onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const [allAccounts, setAllAccounts] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            getAllAccounts().then(data => setAllAccounts(data || []));
        }
    }, [open]);

    const revenueAccounts = allAccounts.filter(a => a.account_code.toString().startsWith('4') && !a.is_parent);
    const expenseAccounts = allAccounts.filter(a => a.account_code.toString().startsWith('5') && !a.is_parent);
    const assetAccounts = allAccounts.filter(a => a.account_code.toString().startsWith('1') && !a.is_parent);

    const [formData, setFormData] = useState({
        name_ar: item.name_ar,
        item_code: item.item_code,
        description: item.description || '',
        inventory_account_id: item.inventory_account_id || '',
        sales_account_id: item.sales_account_id || '',
        cogs_account_id: item.cogs_account_id || '',
        type: item.type || 'product', // Assuming item has type now
        revenue_account_id: item.revenue_account_id || '',
        expense_account_id: item.expense_account_id || ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateInventoryItem(item.id, formData);
            toast({ title: 'تم التحديث بنجاح' });
            setOpen(false);
            onSuccess();
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
                    <Edit2 className="w-4 h-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>تعديل بيانات الصنف: {item.name_ar}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>كود الصنف</Label>
                            <Input
                                required
                                value={formData.item_code}
                                onChange={e => setFormData({ ...formData, item_code: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>الاسم (عربي)</Label>
                            <Input
                                required
                                value={formData.name_ar}
                                onChange={e => setFormData({ ...formData, name_ar: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {formData.type === 'product' && (
                            <div className="space-y-2">
                                <Label>حساب المخزون (Asset)</Label>
                                <AccountSelector
                                    accounts={assetAccounts}
                                    value={formData.inventory_account_id}
                                    onChange={(v) => setFormData({ ...formData, inventory_account_id: v })}
                                    placeholder="اختر حساب المخزون..."
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>{formData.type === 'service' ? 'حساب الإيراد (Revenue)' : 'حساب المبيعات (Revenue)'}</Label>
                            <AccountSelector
                                accounts={revenueAccounts}
                                value={formData.type === 'service' ? formData.revenue_account_id : formData.sales_account_id}
                                onChange={(v) => {
                                    if (formData.type === 'service') {
                                        setFormData({ ...formData, revenue_account_id: v });
                                    } else {
                                        setFormData({ ...formData, sales_account_id: v });
                                    }
                                }}
                                placeholder="اختر حساب المبيعات/الإيراد..."
                            />
                        </div>
                        {formData.type === 'product' && (
                            <div className="space-y-2">
                                <Label>حساب تكلفة المبيعات (COGS)</Label>
                                <AccountSelector
                                    accounts={expenseAccounts}
                                    value={formData.cogs_account_id}
                                    onChange={(v) => setFormData({ ...formData, cogs_account_id: v })}
                                    placeholder="اختر حساب التكلفة..."
                                />
                            </div>
                        )}
                        {formData.type === 'service' && (
                            <div className="space-y-2">
                                <Label>حساب المصروف (Expense) - عند الشراء</Label>
                                <AccountSelector
                                    accounts={expenseAccounts}
                                    value={formData.expense_account_id}
                                    onChange={(v) => setFormData({ ...formData, expense_account_id: v })}
                                    placeholder="الافتراضي (5xxx - مصروف خدمات)"
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                            {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
