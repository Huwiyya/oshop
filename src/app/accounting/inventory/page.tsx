
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package, Search, Plus, CreditCard, Box, ArrowRight, Layers, Trash, ArrowRightLeft } from 'lucide-react';
import { getInventoryItems, createInventoryItem, deleteInventoryItem } from '@/lib/inventory-actions';
import { getAllAccounts } from '@/lib/accounting-actions';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function InventoryPage() {
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const router = useRouter();

    const fetchItems = async () => {
        setIsLoading(true);
        const data = await getInventoryItems();
        setItems(data || []);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const filteredItems = items.filter(item => {
        const matchesSearch = item.name_ar.includes(search) || item.item_code.includes(search);
        if (activeTab === 'all') return matchesSearch;
        if (activeTab === 'cards') return matchesSearch && item.is_shein_card;
        if (activeTab === 'products') return matchesSearch && !item.is_shein_card;
        return matchesSearch;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">إدارة المخزون</h1>
                    <p className="text-slate-500">تتبع الأصناف، البطاقات، وحركات المخزون</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="gap-2 border-blue-200 hover:bg-blue-50 text-blue-700"
                        onClick={() => router.push('/accounting/inventory/transfer')}
                    >
                        <ArrowRightLeft className="w-4 h-4" />
                        التحويل بين الأصناف
                    </Button>
                    <AddItemDialog onSuccess={fetchItems} />
                </div>
            </div>

            <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="all">الكل</TabsTrigger>
                    <TabsTrigger value="products">منتجات عادية</TabsTrigger>
                    <TabsTrigger value="cards">بطاقات (شي ان)</TabsTrigger>
                </TabsList>

                <div className="mt-4 flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm max-w-md">
                    <Search className="w-5 h-5 text-slate-400" />
                    <Input
                        placeholder="بحث عن صنف..."
                        className="border-none shadow-none focus-visible:ring-0"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <TabsContent value="all" className="mt-6">
                    <ItemsGrid items={filteredItems} isLoading={isLoading} onRefresh={fetchItems} />
                </TabsContent>
                <TabsContent value="products" className="mt-6">
                    <ItemsGrid items={filteredItems} isLoading={isLoading} onRefresh={fetchItems} />
                </TabsContent>
                <TabsContent value="cards" className="mt-6">
                    <ItemsGrid items={filteredItems} isLoading={isLoading} onRefresh={fetchItems} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function ItemsGrid({ items, isLoading, onRefresh }: { items: any[], isLoading: boolean, onRefresh: () => void }) {
    const router = useRouter();

    if (isLoading) return <div className="text-center py-20 text-slate-500">جاري التحميل...</div>;

    if (items.length === 0) {
        return (
            <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed">
                <Box className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="tex-lg font-medium">لا توجد أصناف</h3>
                <p className="text-slate-500">قم بإضافة أصناف جديدة للمخزون</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => (
                <div key={item.id} className="relative group/card">
                    <Card
                        className="hover:shadow-md transition-shadow cursor-pointer group border-slate-200 overflow-hidden"
                        onClick={() => router.push(`/accounting/inventory/${item.id}`)}
                    >
                        <div className={`h-2 w-full ${item.is_shein_card ? 'bg-purple-500' : 'bg-blue-500'}`} />
                        <CardContent className="p-5">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.is_shein_card ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {item.is_shein_card ? <CreditCard className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900">{item.name_ar}</h3>
                                        <p className="text-xs text-slate-500 font-mono">{item.item_code}</p>
                                    </div>
                                </div>
                                {item.is_shein_card && <Badge variant="secondary" className="bg-purple-100 text-purple-700">بطاقات</Badge>}
                            </div>

                            <div className="grid grid-cols-2 gap-4 my-4">
                                <div>
                                    <p className="text-xs text-slate-500">الكمية المتوفرة</p>
                                    <p className="text-xl font-bold text-slate-900 font-mono">
                                        {item.quantity_on_hand || 0}
                                        <span className="text-xs font-normal text-slate-400 mr-1">
                                            {item.unit === 'card' ? 'بطاقة' : 'قطعة'}
                                        </span>
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">متوسط التكلفة</p>
                                    <p className="text-lg font-bold text-slate-900 font-mono">
                                        {formatCurrency(item.average_cost || 0)}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4 border-t flex items-center justify-between text-sm text-slate-500 group-hover:text-primary transition-colors">
                                <span>{item.is_shein_card ? 'عرض البطاقات' : 'عرض التفاصيل'}</span>
                                <ArrowRight className="w-4 h-4" />
                            </div>
                        </CardContent>
                    </Card>
                    <div className="absolute top-4 left-4 z-50 opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 transition-opacity">
                        <DeleteItemDialog item={item} onSuccess={onRefresh} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function DeleteItemDialog({ item, onSuccess }: { item: any, onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setLoading(true);
        try {
            await deleteInventoryItem(item.id);
            toast({ title: 'تم الحذف بنجاح' });
            setOpen(false);
            onSuccess();
        } catch (err: any) {
            toast({ title: 'خطأ', description: err.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/80 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-full shadow-sm" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
                    <Trash className="w-4 h-4" />
                </Button>
            </DialogTrigger>
            <DialogContent onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                    <DialogTitle>حذف الصنف</DialogTitle>
                    <DialogDescription>
                        هل أنت متأكد من حذف "{item.name_ar}"؟ لا يمكن التراجع عن هذا الإجراء.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={(e) => { e.stopPropagation(); setOpen(false); }}>إلغاء</Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={loading}>{loading ? 'جاري الحذف...' : 'حذف'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

import { AccountSelector } from '@/components/accounting/AccountSelector';


import { getChartOfAccountsTree } from '@/lib/chart-of-accounts-actions';

function AddItemDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const [allAccounts, setAllAccounts] = useState<any[]>([]);

    useEffect(() => {
        if (open) {
            getChartOfAccountsTree().then(res => {
                if (res.success) {
                    setAllAccounts(res.flatAccounts || []);
                }
            });
        }
    }, [open]);

    // V2 Logic: Use 'code' and 'is_group'
    const revenueAccounts = allAccounts.filter(a => a.code.toString().startsWith('4') && !a.is_group);
    const expenseAccounts = allAccounts.filter(a => a.code.toString().startsWith('5') && !a.is_group);
    const assetAccounts = allAccounts.filter(a => a.code.toString().startsWith('1') && !a.is_group);

    const [formData, setFormData] = useState<{
        item_code: string;
        name_ar: string;
        name_en: string;
        category: string;
        type: 'product' | 'service';
        description: string;
        inventory_account_id: string;
        sales_account_id: string;
        cogs_account_id: string;
        expense_account_id: string;
        revenue_account_id: string;
    }>({
        item_code: '',
        name_ar: '',
        name_en: '',
        category: 'general',
        type: 'product',
        description: '',
        inventory_account_id: '',
        sales_account_id: '',
        cogs_account_id: '',
        expense_account_id: '',
        revenue_account_id: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await createInventoryItem(formData);
            toast({ title: 'تمت الإضافة بنجاح' });
            setOpen(false);
            setFormData({ item_code: '', name_ar: '', name_en: '', category: 'general', type: 'product', description: '', inventory_account_id: '', sales_account_id: '', cogs_account_id: '', expense_account_id: '', revenue_account_id: '' });
            onSuccess();
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4" />
                    إضافة صنف جديد
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>إضافة صنف مخزني جديد</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>كود الصنف</Label>
                            <Input
                                required
                                value={formData.item_code}
                                onChange={e => setFormData({ ...formData, item_code: e.target.value })}
                                placeholder="مثال: SH001"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>نوع الصنف</Label>
                            <Select
                                value={formData.category}
                                onValueChange={(v) => setFormData({ ...formData, category: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="general">منتج عام (قطعة)</SelectItem>
                                    <SelectItem value="cards">بطاقات (مثل شي ان)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>نوع البند</Label>
                        <Select
                            value={formData.type} // Default to product
                            onValueChange={(v) => setFormData({ ...formData, type: v as 'product' | 'service' })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="product">منتج (مخزون)</SelectItem>
                                <SelectItem value="service">خدمة (بدون مخزون)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>اسم الصنف (تجميعي)</Label>
                        <Input
                            required
                            value={formData.name_ar}
                            onChange={e => setFormData({ ...formData, name_ar: e.target.value })}
                            placeholder={formData.category === 'cards' ? 'مثال: رصيد بطاقات شي ان' : 'مثال: تيشيرت قطن'}
                        />
                        {formData.category === 'cards' && (
                            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                                هذا سيكون البند الرئيسي الذي يحتوي على جميع البطاقات داخله.
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {formData.type === 'product' && (
                            <div className="space-y-2">
                                <Label>حساب المخزون (Asset)</Label>
                                <AccountSelector
                                    accounts={assetAccounts}
                                    value={formData.inventory_account_id}
                                    onChange={(v) => setFormData({ ...formData, inventory_account_id: v })}
                                    placeholder="الافتراضي (1130 - بضاعة)"
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
                                placeholder="الافتراضي (4100 - مبيعات/إيراد)"
                            />
                        </div>

                        {formData.type === 'product' && (
                            <div className="space-y-2">
                                <Label>حساب تكلفة المبيعات (COGS)</Label>
                                <AccountSelector
                                    accounts={expenseAccounts}
                                    value={formData.cogs_account_id}
                                    onChange={(v) => setFormData({ ...formData, cogs_account_id: v })}
                                    placeholder="الافتراضي (5101 - تكلفة البضاعة المباعة)"
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

                    <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                        * {formData.type === 'product' ? 'سيتم تتبع المخزون لهذا الصنف.' : 'لن يتم التأثير على المخزون للأصناف الخدمية.'}
                    </p>

                    <DialogFooter>
                        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                            {isLoading ? 'جاري الحفظ...' : 'حفظ الصنف'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
