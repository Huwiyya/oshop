
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
import { getEntities } from '@/lib/accounting-actions';
import { getInventoryItems } from '@/lib/inventory-actions';
import { createSalesInvoice, type CreateSalesInvoiceData, type SalesInvoiceItem, getAvailableCardLayers } from '@/lib/sales-actions';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

export default function CreateSalesInvoice() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    // Data Sources
    const [customers, setCustomers] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);

    // Form State
    const [formData, setFormData] = useState<CreateSalesInvoiceData>({
        customerId: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        items: [],
        currency: 'LYD',
        exchangeRate: 1.0,
        paidAmount: 0,
        paymentMethod: 'cash',
        notes: ''
    });

    const calculateTotal = () => formData.items.reduce((sum, item) => sum + item.total, 0);
    const totalAmount = calculateTotal();

    useEffect(() => {
        Promise.all([
            getEntities('customer'),
            getInventoryItems()
        ]).then(([custData, itemsData]) => {
            setCustomers(custData || []);
            setInventoryItems(itemsData || []);
        });
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
                                <Select onValueChange={handleCustomerChange}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر العميل" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customers.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                                        value={formData.exchangeRate}
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
                                    value={formData.paidAmount}
                                    onChange={e => setFormData({ ...formData, paidAmount: Number(e.target.value) })}
                                />
                            </div>
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
    const [quantity, setQuantity] = useState(1);
    const [price, setPrice] = useState(0);

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

    // Update quantity based on selected cards if it's a card item
    useEffect(() => {
        if (selectedItem?.is_shein_card) {
            setQuantity(selectedCardIds.length);
        }
    }, [selectedCardIds]);

    const handleAdd = () => {
        if (!selectedItem) return;

        if (selectedItem.is_shein_card && selectedCardIds.length === 0) {
            // Must select cards
            // Could add validation here but button is disabled if q=0
        }

        onAdd({
            itemId: selectedItemId,
            description: selectedItem.name_ar,
            quantity: quantity,
            unitPrice: price,
            total: quantity * price, // Sales Total
            selectedLayerIds: selectedItem.is_shein_card ? selectedCardIds : undefined
        });
        setOpen(false);
        // Reset
        setSelectedItemId('');
        setQuantity(1);
        setPrice(0);
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
                                        {item.name_ar} {item.is_shein_card ? '(بطاقات)' : ''}
                                        <span className="text-xs text-slate-400 mr-2">
                                            (متوفر: {item.quantity_on_hand})
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedItem?.is_shein_card ? (
                        <div className="space-y-2 border p-3 rounded bg-slate-50">
                            <Label>اختر البطاقات المراد بيعها:</Label>
                            {loadingCards ? (
                                <p className="text-sm text-slate-500">جاري جلب البطاقات...</p>
                            ) : availableCards.length === 0 ? (
                                <p className="text-sm text-red-500">لا توجد بطاقات متوفرة في المخزون!</p>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {availableCards.map(card => (
                                        <div key={card.id} className="flex items-center space-x-2 space-x-reverse bg-white p-2 border rounded hover:bg-emerald-50 cursor-pointer" onClick={() => toggleCardSelection(card.id)}>
                                            <Checkbox
                                                checked={selectedCardIds.includes(card.id)}
                                                onCheckedChange={() => toggleCardSelection(card.id)}
                                            />
                                            <div className="flex-1 text-sm font-mono flex justify-between">
                                                <span>{card.card_number}</span>
                                                <span className="text-slate-400 text-xs">شراء: {card.purchase_date}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-emerald-700 font-bold mt-2">
                                تم تحديد: {selectedCardIds.length} بطاقات
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label>الكمية</Label>
                            <Input
                                type="number" min="1"
                                max={selectedItem?.quantity_on_hand || 1000}
                                value={quantity}
                                onChange={e => setQuantity(Number(e.target.value))}
                            />
                            {selectedItem && (
                                <p className="text-xs text-slate-500">المتوفر: {selectedItem.quantity_on_hand}</p>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>سعر البيع ({currency})</Label>
                        <Input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(Number(e.target.value))} />
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
