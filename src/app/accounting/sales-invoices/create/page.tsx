
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash, ArrowLeft, Plus } from 'lucide-react';
import { createEntityV2, getEntitiesV2, getChartOfAccountsV2 } from '@/lib/accounting-v2-actions';
import { getInventoryItems } from '@/lib/inventory-actions';
import { createSalesInvoice, type CreateSalesInvoiceData, type SalesInvoiceItem, getAvailableCardLayers } from '@/lib/sales-actions';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { AccountSelector } from '@/components/accounting/AccountSelector'; // Import AccountSelector

export default function CreateSalesInvoice() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Data Sources
    const [customers, setCustomers] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);

    // Form State
    const [formData, setFormData] = useState<CreateSalesInvoiceData>({
        customerId: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        items: [],
        currency: 'LYD',
        exchangeRate: 1.0,
        paidAmount: 0,
        paymentAccountId: '',
        paymentMethod: 'cash',
        notes: ''
    });

    const calculateTotal = () => formData.items.reduce((sum, item) => sum + item.total, 0);
    const totalAmount = calculateTotal();

    useEffect(() => {
        // Dynamic import to avoid server/client issues if any, though import at top is fine usually
        const loadData = async () => {
            const [custRes, itemsData, accRes] = await Promise.all([
                getEntitiesV2('customer'),
                getInventoryItems(),
                getChartOfAccountsV2()
            ]);

            if (custRes.success) setCustomers(custRes.data || []);
            else setCustomers([]);

            setInventoryItems(itemsData || []);

            if (accRes.success) setAccounts(accRes.data || []);
            else setAccounts([]);
        };
        loadData();
    }, []);

    const handleCustomerChange = (customerId: string) => {
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
            setFormData(prev => ({
                ...prev,
                customerId,
                currency: customer.currency as any
            }));
        }
    };

    // Quick Create Customer Handler
    const handleCreateCustomer = async (name: string) => {
        try {
            const res = await createEntityV2({ name_ar: name, type: 'customer' });
            if (res.success && (res as any).data) { // Cast to any to access data
                const newData = (res as any).data;
                toast({ title: 'تم الإنشاء', description: `تم إنشاء العميل "${name}" بنجاح` });
                // Refresh list
                const newCustomersRes = await getEntitiesV2('customer');
                if (newCustomersRes.success) {
                    setCustomers(newCustomersRes.data || []);
                    // Select new customer
                    handleCustomerChange(newData.id);
                }
            } else {
                toast({ title: 'خطأ', description: res.error || 'فشل إنشاء العميل', variant: 'destructive' });
            }
        } catch (error) {
            console.error(error);
            toast({ title: 'خطأ', description: 'حدث خطأ أثناء الإنشاء', variant: 'destructive' });
        }
    };

    const handleAddItem = (item: SalesInvoiceItem) => {
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
        if (!formData.customerId || formData.items.length === 0) {
            toast({ title: 'خطأ', description: 'الرجاء اختيار عميل وإضافة أصناف', variant: 'destructive' });
            return;
        }

        if (formData.paidAmount > 0 && !formData.paymentAccountId) {
            toast({ title: 'خطأ', description: 'الرجاء اختيار حساب الخزينة/البنك لاستلام الدفعة', variant: 'destructive' });
            return;
        }

        setIsLoading(true);
        try {
            await createSalesInvoice(formData);
            toast({ title: 'تم الحفظ', description: 'تم إنشاء فاتورة البيع بنجاح' });
            router.push('/accounting/sales-invoices');
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">فاتورة بيع جديدة</h1>
                    <p className="text-slate-500">إخراج بضاعة من المخزون وتسجيل إيراد</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>بيانات الفاتورة والأصناف</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>العميل</Label>
                                <AccountSelector
                                    accounts={customers}
                                    value={formData.customerId}
                                    onChange={(val) => handleCustomerChange(val)}
                                    category="customer"
                                    onCreate={handleCreateCustomer}
                                    placeholder="اختر العميل..."
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

                        {/* Items */}
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
                                        <TableHead>سعر البيع</TableHead>
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
                                                        {item.selectedLayerIds && item.selectedLayerIds.length > 0 && (
                                                            <span className="text-xs text-purple-600">
                                                                تم تحديد {item.selectedLayerIds.length} بطاقات
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
                            />
                        </div>
                    </CardContent>
                </Card>

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
                                <Label>المبلغ المستلم (المدفوع)</Label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={formData.paidAmount || ''}
                                    onChange={e => setFormData({ ...formData, paidAmount: Number(e.target.value) })}
                                />
                            </div>

                            {formData.paidAmount > 0 && (
                                <div className="space-y-2">
                                    <Label>حساب الخزينة/البنك (استلام)</Label>
                                    <Select
                                        value={formData.paymentAccountId}
                                        onValueChange={(v) => setFormData({ ...formData, paymentAccountId: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر الحساب المستلم..." />
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
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button className="w-full h-12 text-lg bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmit} disabled={isLoading}>
                            {isLoading ? 'جاري الحفظ...' : 'حفظ الفوترة'}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}

function AddItemDialog({ inventoryItems, onAdd, currency }: { inventoryItems: any[], onAdd: (item: SalesInvoiceItem) => void, currency: string }) {
    const [open, setOpen] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState('');

    // Use string | number for better UX
    const [quantity, setQuantity] = useState<string | number>(1);
    const [price, setPrice] = useState<string | number>('');

    // For Cards
    const [availableCards, setAvailableCards] = useState<any[]>([]);
    const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
    const [loadingCards, setLoadingCards] = useState(false);

    const selectedItem = inventoryItems.find(i => i.id === selectedItemId);

    useEffect(() => {
        if (selectedItem?.is_shein_card) {
            setLoadingCards(true);
            getAvailableCardLayers(selectedItem.id).then(cards => {
                setAvailableCards(cards || []);
                setLoadingCards(false);
            });
        } else {
            setAvailableCards([]);
            setSelectedCardIds([]);
        }
    }, [selectedItemId]);

    // Initialize quantity based on selected cards, but allow manual override for value-based cards
    useEffect(() => {
        if (selectedItem?.is_shein_card) {
            // Default to 1 per card, but user can edit for partial value transaction
            if (Number(quantity) < selectedCardIds.length) {
                setQuantity(selectedCardIds.length);
            }
        }
    }, [selectedCardIds]);

    const handleAdd = () => {
        if (!selectedItem) return;

        // Validation: Must select at least one card source if it's a card item
        if (selectedItem.is_shein_card && selectedCardIds.length === 0) {
            // We could block, or allow if they know what they are doing (FIFO). 
            // Let's block to ensure they picked a source visually.
            // Actually, for value sales, maybe they just want FIFO. 
            // But let's keep the requirement to pick a card to "verify" availability.
            // For now, allow proceed if quantity > 0.
        }

        const finalQty = Number(quantity) || 0;
        const finalPrice = Number(price) || 0;

        if (finalQty <= 0) return;

        onAdd({
            itemId: selectedItemId,
            description: selectedItem.name_ar,
            quantity: finalQty,
            unitPrice: finalPrice,
            total: finalQty * finalPrice,
            selectedLayerIds: selectedItem.is_shein_card ? selectedCardIds : undefined
        });
        setOpen(false);
        // Reset
        setSelectedItemId('');
        setQuantity(1);
        setPrice('');
        setSelectedCardIds([]);
    };

    const toggleCardSelection = (cardId: string) => {
        if (selectedCardIds.includes(cardId)) {
            setSelectedCardIds(prev => prev.filter(id => id !== cardId));
        } else {
            setSelectedCardIds(prev => [...prev, cardId]);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4" />
                إضافة صنف
            </Button>
            <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
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
                                        {item.type !== 'service' && (
                                            <span className="text-xs text-slate-400 mr-2">
                                                (متوفر: {item.quantity_on_hand})
                                            </span>
                                        )}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedItem?.is_shein_card && (
                        <div className="space-y-2 border p-3 rounded bg-slate-50">
                            <Label>اختر البطاقات (المصدر):</Label>
                            {loadingCards ? (
                                <p className="text-sm text-slate-500">جاري جلب البطاقات...</p>
                            ) : availableCards.length === 0 ? (
                                <p className="text-sm text-red-500">لا توجد بطاقات متوفرة في المخزون!</p>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {availableCards.map(card => (
                                        <div key={card.id} className="flex items-center space-x-2 space-x-reverse bg-white p-2 border rounded hover:bg-emerald-50">
                                            <Checkbox
                                                checked={selectedCardIds.includes(card.id)}
                                                onCheckedChange={() => toggleCardSelection(card.id)}
                                            />
                                            <div className="flex-1 text-sm font-mono flex justify-between cursor-pointer" onClick={() => toggleCardSelection(card.id)}>
                                                <span>{card.card_number || 'بدون رقم (قديم)'}</span>
                                                <div className="text-right">
                                                    <div className="text-xs text-slate-500">الرصيد: {card.remaining_quantity}</div>
                                                    <span className="text-slate-400 text-[10px]">{card.purchase_date}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-emerald-700 font-bold mt-2">
                                تم تحديد مصدر: {selectedCardIds.length} بطاقات
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>
                            {selectedItem?.is_shein_card ? 'القيمة / الرصيد المراد بيعه' : 'الكمية'}
                        </Label>
                        <Input
                            type="number" min="0.01" step="0.01"
                            max={selectedItem?.type === 'service' ? 1000000 : (selectedItem?.quantity_on_hand || 1000)}
                            value={quantity}
                            onChange={e => setQuantity(e.target.value)}
                        />
                        {selectedItem?.is_shein_card && (
                            <p className="text-xs text-slate-500">
                                أدخل القيمة المراد خصمها من البطاقات المحددة.
                                (مثلاً: بيع 111 من بطاقة رصيدها 1000)
                            </p>
                        )}
                        {selectedItem && selectedItem.type !== 'service' && !selectedItem.is_shein_card && (
                            <p className="text-xs text-slate-500">المتوفر: {selectedItem.quantity_on_hand}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>سعر البيع ({currency})</Label>
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
                <DialogFooter>
                    <Button onClick={handleAdd} disabled={!selectedItemId || (selectedItem?.is_shein_card && selectedCardIds.length === 0)}>
                        إضافة
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
