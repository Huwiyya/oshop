
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash, Save, CreditCard, ArrowLeft } from 'lucide-react';
import { createEntityV2, getEntitiesV2, getChartOfAccountsV2 } from '@/lib/accounting-v2-actions';
import { getInventoryItems } from '@/lib/inventory-actions';
import { createPurchaseInvoice, type CreateInvoiceData, type PurchaseInvoiceItem } from '@/lib/purchase-actions';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AccountSelector } from '@/components/accounting/AccountSelector';

export default function CreatePurchaseInvoice() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Data Sources
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);

    // Form State
    const [formData, setFormData] = useState<CreateInvoiceData>({
        supplierId: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        items: [],
        currency: 'LYD',
        exchangeRate: 1.0,
        paidAmount: 0,
        paymentAccountId: '',
        paymentMethod: 'cash',
        notes: ''
    });

    // Helper to calculate total
    const calculateTotal = () => formData.items.reduce((sum, item) => sum + item.total, 0);
    const totalAmount = calculateTotal();

    useEffect(() => {
        // Load Suppliers, Items, and Accounts
        const loadData = async () => {
            const [supRes, itemsData, accRes] = await Promise.all([
                getEntitiesV2('supplier'),
                getInventoryItems(),
                getChartOfAccountsV2()
            ]);

            if (supRes.success) setSuppliers(supRes.data || []);
            else setSuppliers([]);

            setInventoryItems(itemsData || []);

            if (accRes.success) setAccounts(accRes.data || []);
            else setAccounts([]);
        };
        loadData();
    }, []);

    // Handle Supplier Change -> Update Currency
    const handleSupplierChange = (supplierId: string) => {
        const supplier = suppliers.find(s => s.id === supplierId);
        if (supplier) {
            setFormData(prev => ({
                ...prev,
                supplierId,
                currency: supplier.currency as any
            }));
        }
    };

    // Quick Create Supplier Handler
    const handleCreateSupplier = async (name: string) => {
        try {
            const res = await createEntityV2({ name_ar: name, type: 'supplier' });
            if (res.success && (res as any).data) {
                const newData = (res as any).data;
                toast({ title: 'تم الإنشاء', description: `تم إنشاء المورد "${name}" بنجاح` });
                // Refresh list
                const newSuppliersRes = await getEntitiesV2('supplier');
                if (newSuppliersRes.success) {
                    setSuppliers(newSuppliersRes.data || []);
                    // Select new supplier
                    handleSupplierChange(newData.id);
                }
            } else {
                toast({ title: 'خطأ', description: res.error || 'فشل إنشاء المورد', variant: 'destructive' });
            }
        } catch (error) {
            console.error(error);
            toast({ title: 'خطأ', description: 'حدث خطأ أثناء الإنشاء', variant: 'destructive' });
        }
    };

    const handleAddItem = (item: PurchaseInvoiceItem) => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, item]
        }));
    };

    const handleRemoveItem = (index: number) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async () => {
        if (!formData.supplierId || formData.items.length === 0) {
            toast({ title: 'خطأ', description: 'الرجاء اختيار مورد وإضافة أصناف', variant: 'destructive' });
            return;
        }

        if (formData.paidAmount > 0 && !formData.paymentAccountId) {
            toast({ title: 'خطأ', description: 'الرجاء اختيار حساب الخزينة/البنك لدفع الفاتورة', variant: 'destructive' });
            return;
        }

        setIsLoading(true);
        try {
            await createPurchaseInvoice(formData);
            toast({ title: 'تم الحفظ', description: 'تم إنشاء فاتورة الشراء بنجاح' });
            router.push('/accounting/purchase-invoices');
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="container mx-auto py-6 space-y-6" dir="rtl">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4 ml-2" />
                        عودة
                    </Button>
                    <h1 className="text-3xl font-bold tracking-tight">فاتورة شراء جديدة</h1>
                </div>
                <Button onClick={handleSubmit} disabled={isLoading}>
                    <Save className="ml-2 h-4 w-4" />
                    {isLoading ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Info */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>بيانات الفاتورة</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>المورد</Label>
                            <AccountSelector
                                accounts={suppliers}
                                value={formData.supplierId}
                                onChange={(val) => handleSupplierChange(val)}
                                category="supplier"
                                onCreate={handleCreateSupplier}
                                placeholder="اختر المورد..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>تاريخ الفاتورة</Label>
                            <Input
                                type="date"
                                value={formData.invoiceDate}
                                onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>العملة</Label>
                                <div className="font-bold p-2 bg-slate-100 rounded border text-center">
                                    {formData.currency === 'LYD' ? 'دينار ليبي' : 'دولار أمريكي'}
                                </div>
                            </div>
                            {formData.currency === 'USD' && (
                                <div className="space-y-2">
                                    <Label>سعر الصرف</Label>
                                    <Input
                                        type="number" step="0.0001"
                                        placeholder="0.00"
                                        value={formData.exchangeRate || ''}
                                        onChange={e => setFormData({ ...formData, exchangeRate: Number(e.target.value) })}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Items Section */}
                        <div className="border rounded-lg p-4 bg-slate-50">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold">الأصناف</h3>
                                <AddItemDialog
                                    inventoryItems={inventoryItems}
                                    onAdd={handleAddItem}
                                    currency={formData.currency}
                                />
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>الصنف</TableHead>
                                        <TableHead>الكمية</TableHead>
                                        <TableHead>السعر</TableHead>
                                        <TableHead>الإجمالي</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {formData.items.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-6 text-slate-500">
                                                لا توجد أصناف مضافة
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        formData.items.map((item, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span>{item.description}</span>
                                                        {item.cardNumbers && item.cardNumbers.length > 0 && (
                                                            <span className="text-xs text-purple-600">
                                                                {item.cardNumbers.length} بطاقات
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{item.quantity}</TableCell>
                                                <TableCell>{item.unitPrice}</TableCell>
                                                <TableCell>{item.total}</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleRemoveItem(idx)}>
                                                        <Trash className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="space-y-2">
                            <Label>ملاحظات</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="أي ملاحظات إضافية..."
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Right Column: Payment & Summary */}
                <Card className="h-fit">
                    <CardHeader>
                        <CardTitle>الدفع والملخص</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-lg font-bold">
                                <span>الإجمالي</span>
                                <span>{totalAmount.toFixed(2)} {formData.currency}</span>
                            </div>

                            <hr />

                            <div className="space-y-2">
                                <Label>المبلغ المدفوع</Label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={formData.paidAmount || ''}
                                    onChange={e => setFormData({ ...formData, paidAmount: Number(e.target.value) })}
                                />
                            </div>

                            {formData.paidAmount > 0 && (
                                <div className="space-y-2">
                                    <Label>حساب الخزينة/البنك (دفع)</Label>
                                    <Select
                                        value={formData.paymentAccountId}
                                        onValueChange={(v) => setFormData({ ...formData, paymentAccountId: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر الحساب الدافع..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {accounts
                                                .filter(a => a.code.startsWith('111') || a.code.startsWith('1'))
                                                .map(acc => (
                                                    <SelectItem key={acc.id} value={acc.id}>
                                                        {acc.name_ar}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>طريقة الدفع</Label>
                                <Select
                                    value={formData.paymentMethod}
                                    onValueChange={(v: any) => setFormData({ ...formData, paymentMethod: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cash">نقداً (خزينة)</SelectItem>
                                        <SelectItem value="bank">تحويل بنكي</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {(totalAmount - formData.paidAmount) > 0 && (
                                <p className="text-sm text-red-600 bg-red-50 p-2 rounded text-center">
                                    المتبقي {formatCurrency(totalAmount - formData.paidAmount)} سيتم تسجيله كدين على المؤسسة.
                                </p>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full h-12 text-lg bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmit} disabled={isLoading}>
                            {isLoading ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div >
    );
}

function AddItemDialog({ inventoryItems, onAdd, currency }: { inventoryItems: any[], onAdd: (item: PurchaseInvoiceItem) => void, currency: string }) {
    const [open, setOpen] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState('');

    // Use string | number to allow empty input without forcing 0
    const [quantity, setQuantity] = useState<string | number>(1);
    const [price, setPrice] = useState<string | number>('');
    const [cardsText, setCardsText] = useState('');

    const selectedItem = inventoryItems.find(i => i.id === selectedItemId);

    const handleAdd = () => {
        if (!selectedItem) return;

        // Convert to numbers safely
        const finalQty = Number(quantity) || 0;
        const finalPrice = Number(price) || 0;

        if (finalQty <= 0) return; // Prevent zero quantity

        let cardNumbers: string[] = [];
        if (selectedItem.is_shein_card) {
            cardNumbers = cardsText.split('\n').map(s => s.trim()).filter(s => s !== '');
        }

        onAdd({
            itemId: selectedItemId,
            description: selectedItem.name_ar,
            quantity: finalQty,
            unitPrice: finalPrice,
            total: finalQty * finalPrice,
            cardNumbers: selectedItem.is_shein_card ? cardNumbers : undefined
        });
        setOpen(false);
        // Reset
        setSelectedItemId('');
        setQuantity(1);
        setPrice('');
        setCardsText('');
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4" />
                إضافة صنف
            </Button>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>إضافة صنف للفاتورة</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>الصنف</Label>
                        <Select onValueChange={setSelectedItemId} value={selectedItemId}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر الصنف..." />
                            </SelectTrigger>
                            <SelectContent>
                                {inventoryItems.map(item => (
                                    <SelectItem key={item.id} value={item.id}>
                                        {item.name_ar}
                                        {item.is_shein_card ? ' (بطاقات)' : item.type === 'service' ? ' (خدمة)' : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>الكمية</Label>
                            {/* Input now handles value as is, allowing empty string */}
                            <Input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={e => setQuantity(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>سعر الشراء ({currency})</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={price}
                                onChange={e => setPrice(e.target.value)}
                            />
                        </div>
                    </div>

                    {selectedItem?.is_shein_card && (
                        <div className="space-y-2 border-t pt-2">
                            <Label className="flex justify-between">
                                <span>أرقام البطاقات (كل رقم في سطر)</span>
                                <span className="text-xs text-slate-500">{cardsText ? cardsText.split('\n').length : 0} أرقام مدخلة</span>
                            </Label>
                            <Textarea
                                placeholder="الصق أرقام البطاقات هنا..."
                                className="h-32 font-mono text-sm"
                                value={cardsText}
                                onChange={e => setCardsText(e.target.value)}
                            />
                            {cardsText.split('\n').filter(x => x.trim()).length !== Number(quantity) && (
                                <p className="text-xs text-red-500">
                                    تنبيه: عدد الأرقام المدخلة ({cardsText.split('\n').filter(x => x.trim()).length}) لا يطابق الكمية ({Number(quantity)}).
                                </p>
                            )}
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={handleAdd} disabled={!selectedItemId}>إضافة</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
