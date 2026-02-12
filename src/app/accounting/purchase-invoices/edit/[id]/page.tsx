
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash, Save, CreditCard, ArrowLeft, Pencil } from 'lucide-react';
import { getEntities } from '@/lib/accounting-actions';
import { getInventoryItems } from '@/lib/inventory-actions';
import { updatePurchaseInvoice, type CreateInvoiceData, type PurchaseInvoiceItem } from '@/lib/purchase-actions';
import { getPurchaseInvoiceV2 } from '@/lib/invoices-v2-actions';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function EditPurchaseInvoice() {
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

    // Data Sources
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);

    // Form State
    const [formData, setFormData] = useState<CreateInvoiceData>({
        supplierId: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        items: [],
        currency: 'LYD',
        exchangeRate: 1.0,
        paidAmount: 0,
        paymentMethod: 'cash',
        notes: ''
    });

    // Helper to calculate total
    const calculateTotal = () => formData.items.reduce((sum, item) => sum + item.total, 0);
    const totalAmount = calculateTotal();

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                // Load Suppliers and Items
                const [supData, itemsData] = await Promise.all([
                    getEntities('supplier'),
                    getInventoryItems()
                ]);
                setSuppliers(supData || []);
                setInventoryItems(itemsData || []);

                // Load Invoice Data
                if (params.id) {
                    const invoiceResult = await getPurchaseInvoiceV2(params.id as string);
                    if (invoiceResult.success && invoiceResult.data) {
                        const inv = invoiceResult.data;

                        // Map V2 lines to form items
                        const items = (inv.lines || []).map((line: any) => ({
                            itemId: line.product_id || '',
                            description: line.description || '',
                            quantity: line.quantity,
                            unitPrice: line.unit_price,
                            total: line.quantity * line.unit_price,
                            cardNumbers: line.card_number ? [line.card_number] : []
                        }));

                        setFormData({
                            supplierId: inv.supplier_account_id || '',
                            invoiceDate: inv.date.split('T')[0],
                            items: items,
                            currency: 'LYD', // Assuming default for now
                            exchangeRate: 1.0,
                            paidAmount: 0, // V2 doesn't return paid amount directly
                            paymentMethod: 'cash',
                            notes: inv.description || ''
                        });
                    } else {
                        toast({ title: 'خطأ', description: 'لم يتم العثور على الفاتورة', variant: 'destructive' });
                    }
                }
            } catch (error) {
                console.error("Failed to load data:", error);
                toast({ title: 'خطأ', description: 'فشل تحميل البيانات', variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [params.id]);

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

    const handleSaveItem = (item: PurchaseInvoiceItem) => {
        if (editingItemIndex !== null) {
            // Update existing item
            setFormData(prev => {
                const newItems = [...prev.items];
                newItems[editingItemIndex] = item;
                return { ...prev, items: newItems };
            });
            setEditingItemIndex(null);
        } else {
            // Add new item
            setFormData(prev => ({
                ...prev,
                items: [...prev.items, item]
            }));
        }
        setDialogOpen(false);
    };

    const handleEditItem = (index: number) => {
        setEditingItemIndex(index);
        setDialogOpen(true);
    };

    const handleAddItem = (item: PurchaseInvoiceItem) => {
        // Legacy, preserved but diverted to handleSaveItem logic if needed
        handleSaveItem(item);
    };

    const handleAddNew = () => {
        setEditingItemIndex(null);
        setDialogOpen(true);
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

        setIsLoading(true);
        try {
            await updatePurchaseInvoice(params.id as string, formData);
            toast({ title: 'تم الحفظ', description: 'تم تعديل فاتورة الشراء بنجاح' });
            router.push('/accounting/purchase-invoices');
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <div className="p-8 text-center text-slate-500">جاري تحميل البيانات...</div>;
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">تعديل فاتورة شراء</h1>
                    <p className="text-slate-500">تعديل بيانات الفاتورة رقم #{params.id?.toString().slice(0, 8)}</p>
                </div>
            </div>

            {/* Main Form */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Invoice Details */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>بيانات الفاتورة والأصناف</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>المورد</Label>
                                <Select onValueChange={handleSupplierChange} value={formData.supplierId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر المورد" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name_ar}</SelectItem>
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
                                <Button variant="outline" size="sm" className="gap-2" onClick={handleAddNew}>
                                    <Plus className="w-4 h-4" />
                                    إضافة صنف
                                </Button>
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
                                                    <div className="flex items-center gap-2">
                                                        <Button variant="ghost" size="sm" onClick={() => handleEditItem(idx)}>
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleRemoveItem(idx)}>
                                                            <Trash className="w-4 h-4" />
                                                        </Button>
                                                    </div>
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
                            {isLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            <AddItemDialog
                isOpen={dialogOpen}
                onOpenChange={setDialogOpen}
                inventoryItems={inventoryItems}
                onSave={handleSaveItem}
                currency={formData.currency}
                initialItem={editingItemIndex !== null ? formData.items[editingItemIndex] : undefined}
            />
        </div>
    );
}

function AddItemDialog({
    isOpen,
    onOpenChange,
    inventoryItems,
    onSave,
    currency,
    initialItem
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    inventoryItems: any[];
    onSave: (item: PurchaseInvoiceItem) => void;
    currency: string;
    initialItem?: PurchaseInvoiceItem;
}) {
    const [selectedItemId, setSelectedItemId] = useState('');
    const [quantity, setQuantity] = useState<string | number>(1);
    const [price, setPrice] = useState<string | number>('');
    const [cardsText, setCardsText] = useState('');

    const selectedItem = inventoryItems.find(i => i.id === selectedItemId);

    useEffect(() => {
        if (isOpen) {
            if (initialItem) {
                setSelectedItemId(initialItem.itemId);
                setQuantity(initialItem.quantity);
                setPrice(initialItem.unitPrice);
                setCardsText(initialItem.cardNumbers?.join('\n') || '');
            } else {
                // Reset for new item
                setSelectedItemId('');
                setQuantity(1);
                setPrice('');
                setCardsText('');
            }
        }
    }, [isOpen, initialItem]);

    const handleSave = () => {
        if (!selectedItem) return;

        // Convert to numbers safely
        const finalQty = Number(quantity) || 0;
        const finalPrice = Number(price) || 0;

        if (finalQty <= 0) return; // Prevent zero quantity

        let cardNumbers: string[] = [];
        if (selectedItem.is_shein_card) {
            cardNumbers = cardsText.split('\n').map(s => s.trim()).filter(s => s !== '');
        }

        onSave({
            itemId: selectedItemId,
            description: selectedItem.name_ar,
            quantity: finalQty,
            unitPrice: finalPrice,
            total: finalQty * finalPrice,
            cardNumbers: selectedItem.is_shein_card ? cardNumbers : undefined
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{initialItem ? 'تعديل صنف' : 'إضافة صنف للفاتورة'}</DialogTitle>
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
                    <Button onClick={handleSave} disabled={!selectedItemId}>{initialItem ? 'حفظ التعديلات' : 'إضافة'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
