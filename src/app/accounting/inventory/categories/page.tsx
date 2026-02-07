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
import { Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getCategories, createCategory, updateCategory, deleteCategory, InventoryCategory } from '@/lib/category-actions';
import { getAllAccounts } from '@/lib/accounting-actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

export default function CategoriesPage() {
    const [categories, setCategories] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [currentCategory, setCurrentCategory] = useState<InventoryCategory | null>(null);
    const [formData, setFormData] = useState<Partial<InventoryCategory>>({});

    const { toast } = useToast();
    const router = useRouter();

    const refreshData = async () => {
        setLoading(true);
        const [cats, accs] = await Promise.all([
            getCategories(),
            getAllAccounts()
        ]);
        setCategories(cats || []);
        setAccounts(accs || []);
        setLoading(false);
    };

    useEffect(() => {
        refreshData();
    }, []);

    const openDialog = (category: InventoryCategory | null = null) => {
        setCurrentCategory(category);
        setFormData(category || {
            name_ar: '',
            name_en: '',
            description: '',
            revenue_account_id: '',
            cogs_account_id: '',
            inventory_account_id: ''
        });
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name_ar) {
            toast({ title: "خطأ", description: "الاسم العربي مطلوب", variant: "destructive" });
            return;
        }

        try {
            if (currentCategory) {
                await updateCategory(currentCategory.id, formData);
                toast({ title: "تم التحديث", description: "تم تحديث القسم بنجاح." });
            } else {
                await createCategory(formData);
                toast({ title: "تم الإضافة", description: "تم إضافة القسم الجديد." });
            }
            setIsDialogOpen(false);
            refreshData();
        } catch (error: any) {
            toast({ title: "خطأ", description: error.message, variant: "destructive" });
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('هل أنت متأكد من حذف هذا القسم؟')) {
            try {
                await deleteCategory(id);
                toast({ title: "تم الحذف", description: "تم حذف القسم." });
                refreshData();
            } catch (error: any) {
                toast({ title: "خطأ", description: "لا يمكن حذف قسم مرتبط بمنتجات.", variant: "destructive" });
            }
        }
    };

    // Filter accounts by type for easier selection
    const revenueAccounts = accounts.filter(a => a.account_code.startsWith('4'));
    const expenseAccounts = accounts.filter(a => a.account_code.startsWith('5'));
    const assetAccounts = accounts.filter(a => a.account_code.startsWith('1'));

    return (
        <div className="space-y-6 p-6 pb-20 max-w-6xl mx-auto" dir="rtl">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/accounting/inventory')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">أقسام المخزون</h1>
                        <p className="text-slate-500">إدارة التصنيفات والربط المحاسبي</p>
                    </div>
                </div>
                <Button onClick={() => openDialog(null)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="h-4 w-4" /> إضافة قسم
                </Button>
            </div>

            <div className="bg-white rounded-lg border shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right">الاسم</TableHead>
                            <TableHead className="text-right">حساب الإيراد (بيع)</TableHead>
                            <TableHead className="text-right">حساب التكلفة (شراء)</TableHead>
                            <TableHead className="text-right">حساب المخزون (أصل)</TableHead>
                            <TableHead className="text-left w-[100px]">إجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">جاري التحميل...</TableCell>
                            </TableRow>
                        ) : categories.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">لا توجد أقسام مضافة</TableCell>
                            </TableRow>
                        ) : (
                            categories.map((cat) => (
                                <TableRow key={cat.id}>
                                    <TableCell className="font-medium">{cat.name_ar}</TableCell>
                                    <TableCell className="text-sm text-slate-600">
                                        {cat.revenue_account?.name_ar || '-'}
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">
                                        {cat.cogs_account?.name_ar || '-'}
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">
                                        {cat.inventory_account?.name_ar || '-'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" onClick={() => openDialog(cat)}>
                                                <Edit className="h-4 w-4 text-blue-600" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}>
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle>{currentCategory ? 'تعديل القسم' : 'إضافة قسم جديد'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="col-span-2 md:col-span-1 space-y-2">
                            <Label>الاسم العربي *</Label>
                            <Input
                                value={formData.name_ar}
                                onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                            />
                        </div>
                        <div className="col-span-2 md:col-span-1 space-y-2">
                            <Label>الاسم الإنجليزي</Label>
                            <Input
                                value={formData.name_en || ''}
                                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                            />
                        </div>

                        <div className="col-span-2 border-t my-2"></div>
                        <p className="col-span-2 text-sm font-semibold text-slate-700 mb-2">الربط المحاسبي (اختياري)</p>

                        <div className="space-y-2">
                            <Label>حساب الإيراد (عند البيع)</Label>
                            <Select
                                value={formData.revenue_account_id || 'default'}
                                onValueChange={(val) => setFormData({ ...formData, revenue_account_id: val === 'default' ? undefined : val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="الافتراضي (مبيعات)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">الافتراضي (حساب المبيعات العام)</SelectItem>
                                    {revenueAccounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>{acc.name_ar} ({acc.account_code})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>حساب التكلفة (Cost of Goods Sold)</Label>
                            <Select
                                value={formData.cogs_account_id || 'default'}
                                onValueChange={(val) => setFormData({ ...formData, cogs_account_id: val === 'default' ? undefined : val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="الافتراضي (ت.ب.م)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">الافتراضي (تكلفة بضاعة مباعة)</SelectItem>
                                    {expenseAccounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>{acc.name_ar} ({acc.account_code})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="col-span-2 space-y-2">
                            <Label>حساب المخزون (Inventory Asset)</Label>
                            <Select
                                value={formData.inventory_account_id || 'default'}
                                onValueChange={(val) => setFormData({ ...formData, inventory_account_id: val === 'default' ? undefined : val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="الافتراضي (مخزون بضاعة)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">الافتراضي (حساب المخزون العام)</SelectItem>
                                    {assetAccounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>{acc.name_ar} ({acc.account_code})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500">يستخدم عند الشراء لإثبات زيادة المخزون في الحساب الصحيح.</p>
                        </div>

                        <div className="col-span-2 space-y-2">
                            <Label>وصف</Label>
                            <Input
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                        <Button onClick={handleSave}>حفظ</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
