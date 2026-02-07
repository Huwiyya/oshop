
'use client';

import React, { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Plus,
    Search,
    Edit,
    Trash2,
    Package,
    AlertTriangle,
    Loader2,
    DollarSign,
    Boxes,
    ArrowRightLeft
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Product } from '@/lib/types';
import {
    getProducts,
    addProduct,
    updateProduct,
    deleteProduct,
} from '@/lib/actions';
import { createInventoryAdjustment, AdjustmentType } from '@/lib/inventory-actions'; // Import new action
import { useToast } from '@/components/ui/use-toast';

export default function InventoryPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Product Dialog State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [currentProduct, setCurrentProduct] = useState<Product | null>(null);

    // Adjustment Dialog State
    const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
    const [adjustmentData, setAdjustmentData] = useState<{
        productId: string;
        productName: string;
        currentQty: number;
        type: AdjustmentType;
        quantity: number;
        cost?: number;
        notes: string;
    }>({
        productId: '',
        productName: '',
        currentQty: 0,
        type: 'in',
        quantity: 0,
        cost: 0,
        notes: ''
    });

    const { toast } = useToast();

    // Form State
    const [formData, setFormData] = useState<Partial<Product>>({
        name: '',
        sku: '',
        quantity: 0,
        minStockLevel: 5,
        costPriceUSD: 0,
        sellingPriceLYD: 0,
        sellingPriceUSD: 0,
        description: '',
        category: ''
    });

    const refreshData = async () => {
        setLoading(true);
        const data = await getProducts();
        setProducts(data);
        setLoading(false);
    };

    useEffect(() => {
        refreshData();
    }, []);

    const openDialog = (product: Product | null = null) => {
        setCurrentProduct(product);
        if (product) {
            setFormData({ ...product });
        } else {
            setFormData({
                name: '',
                sku: '',
                quantity: 0,
                minStockLevel: 5,
                costPriceUSD: 0,
                sellingPriceLYD: 0,
                sellingPriceUSD: 0,
                description: '',
                category: ''
            });
        }
        setIsDialogOpen(true);
    };

    const openAdjustmentDialog = (product: Product) => {
        setAdjustmentData({
            productId: product.id,
            productName: product.name,
            currentQty: product.quantity,
            type: 'in',
            quantity: 1,
            cost: product.costPriceUSD, // Default to current cost
            notes: ''
        });
        setIsAdjustmentOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name) {
            toast({ title: "خطأ", description: "اسم المنتج مطلوب", variant: "destructive" });
            return;
        }

        try {
            if (currentProduct) {
                // Prevent updating quantity directly
                const { quantity, ...dataToUpdate } = formData;
                await updateProduct(currentProduct.id, dataToUpdate);
                toast({ title: "تم التحديث", description: "تم تحديث بيانات المنتج بنجاح." });
            } else {
                await addProduct(formData as Omit<Product, 'id'>);
                toast({ title: "تم الإضافة", description: "تم إضافة المنتج الجديد بنجاح." });
            }
            setIsDialogOpen(false);
            refreshData();
        } catch (error) {
            console.error(error);
            toast({ title: "خطأ", description: "حدث خطأ أثناء الحفظ.", variant: "destructive" });
        }
    };

    const handleAdjustmentSave = async () => {
        if (adjustmentData.quantity <= 0) {
            toast({ title: "خطأ", description: "الكمية يجب أن تكون أكبر من صفر", variant: "destructive" });
            return;
        }

        // Signed quantity logic
        // If type is 'in' or 'opening' or 'gift' (inbound), qty is positive
        // If type is 'out' or 'damaged' (outbound), logic usually expects positive qty representing the CHANGE amount, 
        // but our action createInventoryAdjustment handles sign logic based on type IS_INCREASE check?
        // Let's check action: it checks `data.quantity > 0` for Increase.
        // So we must pass POSITIVE for Increase, NEGATIVE for Decrease.

        let finalQty = adjustmentData.quantity;
        if (['out', 'damaged'].includes(adjustmentData.type)) {
            finalQty = -finalQty;
        }

        try {
            await createInventoryAdjustment({
                itemId: adjustmentData.productId,
                quantity: finalQty,
                type: adjustmentData.type,
                unitCost: adjustmentData.cost,
                notes: adjustmentData.notes
            });

            toast({ title: "تمت التسوية", description: "تم تسجيل حركة المخزون والقيد المحاسبي بنجاح." });
            setIsAdjustmentOpen(false);
            refreshData();
        } catch (error: any) {
            console.error(error);
            toast({ title: "خطأ", description: error.message || "فشل إجراء التسوية", variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
            await deleteProduct(id);
            toast({ title: "تم الحذف", description: "تم حذف المنتج." });
            refreshData();
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Summary Calculations
    const totalInventoryValue = products.reduce((sum, p) => sum + (p.quantity * p.costPriceUSD), 0);
    const totalProducts = products.length;
    const lowStockCount = products.filter(p => p.quantity <= p.minStockLevel).length;

    return (
        <div className="space-y-6" dir="rtl">
            <h1 className="text-2xl font-bold">إدارة المخزون (الخزينة)</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">إجمالي قيمة المخزون</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalInventoryValue.toLocaleString()} $</div>
                        <p className="text-xs text-muted-foreground">التكلفة الإجمالية للمنتجات المتوفرة</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">عدد المنتجات</CardTitle>
                        <Boxes className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalProducts}</div>
                        <p className="text-xs text-muted-foreground">صنف مسجل في النظام</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">تنبيهات المخزون</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">{lowStockCount}</div>
                        <p className="text-xs text-muted-foreground">منتجات أوشكت على النفاذ</p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:w-72">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="بحث باسم المنتج أو الكود (SKU)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pr-10"
                    />
                </div>
                <Button onClick={() => openDialog(null)} className="w-full sm:w-auto gap-2">
                    <Plus className="h-4 w-4" />
                    إضافة صنف جديد
                </Button>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right">المنتج</TableHead>
                            <TableHead className="text-right">SKU</TableHead>
                            <TableHead className="text-center">الكمية المملوكة</TableHead>
                            <TableHead className="text-center">متوسط التكلفة ($)</TableHead>
                            <TableHead className="text-center">إجمالي التكلفة ($)</TableHead>
                            <TableHead className="text-center">سعر البيع</TableHead>
                            <TableHead className="text-center">الحالة</TableHead>
                            <TableHead className="text-left">إجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                    <div className="flex justify-center items-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        جري التحميل...
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : filteredProducts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                    لا توجد منتجات مسجلة.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredProducts.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{product.name}</span>
                                            {product.description && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{product.description}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell>{product.sku || '-'}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant={product.quantity <= product.minStockLevel ? "destructive" : "secondary"}>
                                            {product.quantity}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">{product.costPriceUSD.toFixed(2)} $</TableCell>
                                    <TableCell className="text-center font-bold text-blue-600">{(product.quantity * product.costPriceUSD).toFixed(2)} $</TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col text-xs">
                                            <span>{product.sellingPriceLYD.toFixed(2)} د.ل</span>
                                            {product.sellingPriceUSD && <span className="text-muted-foreground">{product.sellingPriceUSD.toFixed(2)} $</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {product.quantity === 0 ? (
                                            <Badge variant="destructive">نفذت الكمية</Badge>
                                        ) : product.quantity <= product.minStockLevel ? (
                                            <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20">منخفض</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-green-600 border-green-600/20 bg-green-500/5">متوفر</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-left">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="outline" size="sm" onClick={() => openAdjustmentDialog(product)} className="gap-1 h-8">
                                                <ArrowRightLeft className="h-3 w-3" /> تسوية
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => openDialog(product)}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(product.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Product Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{currentProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label>اسم المنتج *</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="مثال: ايفون 15 برو ماكس"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>رمز المنتج (SKU)</Label>
                            <Input
                                value={formData.sku}
                                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                placeholder="اختياري"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>الكمية الحالية</Label>
                            <Input
                                type="number"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                                disabled={!!currentProduct} // Disable editing quantity for existing products
                                className={currentProduct ? "bg-slate-100" : ""}
                            />
                            {currentProduct && <p className="text-xs text-muted-foreground">لتعديل الكمية يرجى استخدام زر "تسوية المخزون"</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>حد التنبيه (Low Stock)</Label>
                            <Input
                                type="number"
                                value={formData.minStockLevel}
                                onChange={(e) => setFormData({ ...formData, minStockLevel: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>التكلفة ($)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.costPriceUSD}
                                onChange={(e) => setFormData({ ...formData, costPriceUSD: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>سعر البيع (د.ل)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.sellingPriceLYD}
                                onChange={(e) => setFormData({ ...formData, sellingPriceLYD: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>سعر البيع ($) - اختياري</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.sellingPriceUSD}
                                onChange={(e) => setFormData({ ...formData, sellingPriceUSD: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>التصنيف</Label>
                            <Input
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                placeholder="مثال: هواتف"
                            />
                        </div>
                        <div className="col-span-1 md:col-span-2 space-y-2">
                            <Label>وصف المنتج</Label>
                            <Input
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="تفاصيل إضافية..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                        <Button onClick={handleSave}>{currentProduct ? 'حفظ التغييرات' : 'إضافة المنتج'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Adjustment Dialog */}
            <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
                <DialogContent className="max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>تسوية مخزون: {adjustmentData.productName}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className=" bg-slate-50 p-3 rounded text-sm text-slate-600 flex justify-between">
                            <span>الرصيد الحالي:</span>
                            <span className="font-bold">{adjustmentData.currentQty}</span>
                        </div>

                        <div className="space-y-2">
                            <Label>نوع التسوية</Label>
                            <Select
                                value={adjustmentData.type}
                                onValueChange={(val: AdjustmentType) => setAdjustmentData({ ...adjustmentData, type: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="in">إضافة / مشتريات (In)</SelectItem>
                                    <SelectItem value="out">صرف / مبيعات (Out)</SelectItem>
                                    <SelectItem value="damaged">تالف / عجز (Damaged)</SelectItem>
                                    <SelectItem value="gift">هدايا (Gift)</SelectItem>
                                    <SelectItem value="opening">رصيد افتتاحي (Opening)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>الكمية (الفرق)</Label>
                            <Input
                                type="number"
                                min="1"
                                value={adjustmentData.quantity}
                                onChange={(e) => setAdjustmentData({ ...adjustmentData, quantity: parseInt(e.target.value) || 0 })}
                            />
                            <p className="text-xs text-muted-foreground">
                                أدخل الكمية التي تريد إضافتها أو إنقاصها (رقم موجب دائماً).
                            </p>
                        </div>

                        {['in', 'opening'].includes(adjustmentData.type) && (
                            <div className="space-y-2">
                                <Label>تلكفة الوحدة ($)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={adjustmentData.cost}
                                    onChange={(e) => setAdjustmentData({ ...adjustmentData, cost: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>ملاحظات</Label>
                            <Input
                                value={adjustmentData.notes}
                                onChange={(e) => setAdjustmentData({ ...adjustmentData, notes: e.target.value })}
                                placeholder="سبب التسوية..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAdjustmentOpen(false)}>إلغاء</Button>
                        <Button onClick={handleAdjustmentSave}>تأكيد التسوية</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

