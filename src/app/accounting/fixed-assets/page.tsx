
'use client';
// Force rebuild

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Car, HardDrive, Plus, Calculator, Settings, Pencil, Trash2 } from 'lucide-react';
import { getFixedAssetsV2, getAssetCategories, createFixedAssetV2, createAssetCategory, calculateMonthlyDepreciationV2, updateFixedAsset, deleteFixedAsset } from '@/lib/fixed-assets-actions-v2';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';

export default function FixedAssetsPage() {
    const [assets, setAssets] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshData = async () => {
        setLoading(true);
        try {
            const [assetsData, catsData] = await Promise.all([
                getFixedAssetsV2(),
                getAssetCategories()
            ]);
            setAssets(assetsData || []);
            setCategories(catsData || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const [searchTerm, setSearchTerm] = useState('');
    const [filteredAssets, setFilteredAssets] = useState<any[]>([]);

    useEffect(() => {
        refreshData();
    }, []);

    useEffect(() => {
        setFilteredAssets(
            assets.filter(asset =>
                asset.name_ar.toLowerCase().includes(searchTerm.toLowerCase()) ||
                asset.asset_number.toLowerCase().includes(searchTerm.toLowerCase())
            )
        );
    }, [searchTerm, assets]);

    const totalCost = assets.reduce((s, a) => s + Number(a.cost), 0);
    const totalAccumulated = assets.reduce((s, a) => s + Number(a.accumulated_depreciation), 0);
    const totalNet = assets.reduce((s, a) => s + Number(a.book_value), 0);

    return (
        <div className="space-y-6">
            {/* Enhanced Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">الأصول الثابتة</h1>
                    <p className="text-slate-600 mt-1">إدارة شاملة للأصول الثابتة والإهلاكات</p>
                </div>
                <div className="flex gap-2">
                    <RunDepreciationDialog onSuccess={refreshData} />
                    <AddCategoryDialog onSuccess={refreshData} />
                    <AddAssetDialog categories={categories} onSuccess={refreshData} />
                </div>
            </div>

            {/* Enhanced Stats Cards with Icons */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">إجمالي الأصول</CardTitle>
                        <div className="p-2 rounded-lg bg-blue-50">
                            <Building2 className="h-5 w-5 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{assets.length}</div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">التكلفة التاريخية</CardTitle>
                        <div className="p-2 rounded-lg bg-emerald-50">
                            <Plus className="h-5 w-5 text-emerald-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalCost)}</div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">مجمع الإهلاك</CardTitle>
                        <div className="p-2 rounded-lg bg-red-50">
                            <Calculator className="h-5 w-5 text-red-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{formatCurrency(totalAccumulated)}</div>
                    </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">القيمة الدفترية</CardTitle>
                        <div className="p-2 rounded-lg bg-violet-50">
                            <HardDrive className="h-5 w-5 text-violet-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-violet-600">{formatCurrency(totalNet)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Assets Table */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>سجل الأصول</CardTitle>
                        <div className="w-1/3">
                            <Input
                                placeholder="بحث باسم الأصل أو الكود..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>كود الأصل</TableHead>
                                <TableHead>اسم الأصل</TableHead>
                                <TableHead>التصنيف</TableHead>
                                <TableHead>تاريخ الشراء</TableHead>
                                <TableHead>التكلفة</TableHead>
                                <TableHead>مجمع الإهلاك</TableHead>
                                <TableHead>صافي القيمة</TableHead>
                                <TableHead>العمر</TableHead>
                                <TableHead>إجراءات</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAssets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-10 text-slate-500">
                                        لا توجد أصول مسجلة
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredAssets.map((asset) => (
                                    <TableRow key={asset.id} className="hover:bg-slate-50">
                                        <TableCell className="font-mono text-xs">{asset.asset_number}</TableCell>
                                        <TableCell className="font-medium flex items-center gap-2">
                                            {getCategoryIcon(asset.asset_category)}
                                            {asset.name_ar}
                                        </TableCell>
                                        <TableCell>
                                            <span className="bg-slate-100 px-2 py-1 rounded text-xs">{getCategoryName(categories, asset.asset_category)}</span>
                                        </TableCell>
                                        <TableCell className="text-xs">{asset.acquisition_date}</TableCell>
                                        <TableCell className="font-bold">{formatCurrency(asset.cost)}</TableCell>
                                        <TableCell className="text-red-500">{formatCurrency(asset.accumulated_depreciation)}</TableCell>
                                        <TableCell className="text-emerald-600 font-bold">{formatCurrency(asset.book_value)}</TableCell>
                                        <TableCell>{asset.useful_life_years}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <EditAssetDialog asset={asset} categories={categories} onSuccess={refreshData} />
                                                <DeleteAssetDialog asset={asset} onSuccess={refreshData} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function getCategoryName(categories: any[], id: string) {
    // If ID is a UUID, find name. If it is a string (legacy), return it.
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name_ar : id;
}

function getCategoryIcon(name: string) {
    if (!name) return <HardDrive className="w-4 h-4 text-slate-400" />;
    return <HardDrive className="w-4 h-4 text-slate-400" />;
}

function AddCategoryDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const [nameAr, setNameAr] = useState('');
    const [nameEn, setNameEn] = useState('');
    const [parent, setParent] = useState('121'); // Default Tangible

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createAssetCategory(nameAr, nameEn, parent);
            toast({ title: 'تم إضافة التصنيف بنجاح' });
            setOpen(false);
            setNameAr('');
            setNameEn('');
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
                <Button variant="outline" className="gap-2">
                    <Settings className="w-4 h-4" />
                    تصنيف جديد
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>إضافة تصنيف أصول جديد</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>نوع الأصل الرئيسي</Label>
                        <Select value={parent} onValueChange={setParent}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="121">أصول ملموسة (Fixed Assets)</SelectItem>
                                <SelectItem value="122">أصول غير ملموسة (Intangible)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>اسم التصنيف (عربي)</Label>
                        <Input required value={nameAr} onChange={e => setNameAr(e.target.value)} placeholder="مثال: شاحنات ثقيلة" />
                    </div>
                    <div className="space-y-2">
                        <Label>اسم التصنيف (إنجليزي - اختياري)</Label>
                        <Input value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="e.g. Heavy Trucks" />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>حفظ</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function AddAssetDialog({ categories, onSuccess }: { categories: any[], onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        name_ar: '',
        asset_category: '',
        acquisition_date: new Date().toISOString().split('T')[0],
        cost: 0,
        useful_life_years: 5,
        location: '',
        serial_number: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createFixedAssetV2({
                ...formData,
                cost: Number(formData.cost),
                useful_life_years: Number(formData.useful_life_years)
            });
            toast({ title: 'تمت إضافة الأصل بنجاح' });
            setOpen(false);
            setFormData({
                name_ar: '', asset_category: '',
                acquisition_date: new Date().toISOString().split('T')[0],
                cost: 0, useful_life_years: 5,
                location: '', serial_number: ''
            });
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
                    إضافة أصل
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>إضافة أصل ثابت جديد</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>اسم الأصل</Label>
                            <Input required value={formData.name_ar} onChange={e => setFormData({ ...formData, name_ar: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>التصنيف (الحساب الرئيسي)</Label>
                            <Select value={formData.asset_category} onValueChange={v => setFormData({ ...formData, asset_category: v })}>
                                <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                                <SelectContent>
                                    {categories.map(c => <SelectItem key={c.id} value={c.code}>{c.name_ar} ({c.code})</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>تاريخ الشراء</Label>
                            <Input type="date" required value={formData.acquisition_date} onChange={e => setFormData({ ...formData, acquisition_date: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>تكلفة الشراء</Label>
                            <Input type="number" required value={formData.cost} onChange={e => setFormData({ ...formData, cost: Number(e.target.value) })} />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>العمر الافتراضي (سنوات)</Label>
                            <Input type="number" required value={formData.useful_life_years} onChange={e => setFormData({ ...formData, useful_life_years: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                            <Label>الرقم التسلسلي</Label>
                            <Input value={formData.serial_number} onChange={e => setFormData({ ...formData, serial_number: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>الموقع</Label>
                            <Input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={loading}>حفظ</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function RunDepreciationDialog({ onSuccess }: { onSuccess: () => void }) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleRun = async () => {
        if (!confirm('هل أنت متأكد من تسجيل قيد الإهلاك لهذه الفترة؟')) return;
        setLoading(true);
        try {
            const result = await calculateMonthlyDepreciationV2(new Date().toISOString().split('T')[0]);
            if (result && result.count && result.count > 0) {
                toast({ title: 'تم تسجيل الإهلاك', description: `تم عمل قيد إهلاك لـ ${result.count} أصل` });
                onSuccess();
            } else {
                toast({ title: 'تنبيه', description: 'لا توجد أصول تستحق الإهلاك حالياً' });
            }
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button variant="outline" className="gap-2 border-amber-200 hover:bg-amber-50 text-amber-900" onClick={handleRun} disabled={loading}>
            <Calculator className="w-4 h-4" />
            {loading ? 'جاري الحساب...' : 'تسجيل الإهلاك الدوري'}
        </Button>
    );
}

function EditAssetDialog({ asset, categories, onSuccess }: { asset: any, categories: any[], onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        name_ar: asset.name_ar,
        asset_category: asset.asset_category,
        acquisition_date: asset.acquisition_date,
        cost: asset.cost,
        useful_life_years: asset.useful_life_years,
        location: asset.location || '',
        serial_number: asset.serial_number || ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateFixedAsset(asset.id, {
                ...formData,
                cost: Number(formData.cost),
                useful_life_years: Number(formData.useful_life_years)
            });
            toast({ title: 'تم تعديل الأصل بنجاح' });
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
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600">
                    <Pencil className="w-4 h-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>تعديل بيانات الأصل</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>اسم الأصل</Label>
                            <Input required value={formData.name_ar} onChange={e => setFormData({ ...formData, name_ar: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>التصنيف</Label>
                            <Select value={formData.asset_category} onValueChange={v => setFormData({ ...formData, asset_category: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>تاريخ الشراء</Label>
                            <Input type="date" required value={formData.acquisition_date} onChange={e => setFormData({ ...formData, acquisition_date: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>تكلفة الشراء</Label>
                            <Input type="number" required value={formData.cost} onChange={e => setFormData({ ...formData, cost: Number(e.target.value) })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>العمر الافتراضي</Label>
                            <Input type="number" required value={formData.useful_life_years} onChange={e => setFormData({ ...formData, useful_life_years: Number(e.target.value) })} />
                        </div>
                        <div className="space-y-2">
                            <Label>الرقم التسلسلي</Label>
                            <Input value={formData.serial_number} onChange={e => setFormData({ ...formData, serial_number: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>الموقع</Label>
                            <Input value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>حفظ التعديلات</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function DeleteAssetDialog({ asset, onSuccess }: { asset: any, onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleDelete = async () => {
        setLoading(true);
        try {
            await deleteFixedAsset(asset.id);
            toast({ title: 'تم حذف الأصل بنجاح' });
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
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>حذف الأصل</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <p>هل أنت متأكد من رغبتك في حذف الأصل <strong>{asset.name_ar}</strong>؟</p>
                    <p className="text-sm text-slate-500 mt-2">لا يمكن التراجع عن هذا الإجراء.</p>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={loading}>حذف</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
