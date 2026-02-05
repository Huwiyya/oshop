
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Car, HardDrive, Plus, Calculator, ArrowRight } from 'lucide-react';
import { getFixedAssets, getAssetCategories, createFixedAsset, runDepreciation } from '@/lib/fixed-assets-actions';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function FixedAssetsPage() {
    const [assets, setAssets] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const refreshData = async () => {
        setLoading(true);
        const [assetsData, catsData] = await Promise.all([
            getFixedAssets(),
            getAssetCategories()
        ]);
        setAssets(assetsData || []);

        // Auto-initialize categories if none exist
        if (!catsData || catsData.length === 0) {
            try {
                const response = await fetch('/api/accounting/init-categories', { method: 'POST' });
                const result = await response.json();
                if (result.success) {
                    const newCats = await getAssetCategories();
                    setCategories(newCats || []);
                } else {
                    setCategories([]);
                }
            } catch (error) {
                console.error('Error initializing categories:', error);
                setCategories([]);
            }
        } else {
            setCategories(catsData);
        }

        setLoading(false);
    };

    useEffect(() => {
        refreshData();
    }, []);

    const totalCost = assets.reduce((s, a) => s + Number(a.cost), 0);
    const totalAccumulated = assets.reduce((s, a) => s + Number(a.accumulated_depreciation), 0);
    const totalNet = assets.reduce((s, a) => s + Number(a.net_book_value), 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">الأصول الثابتة</h1>
                    <p className="text-slate-500">سجل الأصول، الإهلاكات، والقيمة الدفترية</p>
                </div>
                <div className="flex gap-2">
                    <RunDepreciationDialog onSuccess={refreshData} />
                    <AddAssetDialog categories={categories} onSuccess={refreshData} />
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">إجمالي التكلفة التاريخية</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">إجمالي مجمع الإهلاك</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{formatCurrency(totalAccumulated)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">صافي القيمة الدفترية</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalNet)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Assets Table */}
            <Card>
                <CardHeader>
                    <CardTitle>سجل الأصول</CardTitle>
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
                                <TableHead>العمر (سنوات)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {assets.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-10 text-slate-500">
                                        لا توجد أصول مسجلة
                                    </TableCell>
                                </TableRow>
                            ) : (
                                assets.map((asset) => (
                                    <TableRow key={asset.id} className="hover:bg-slate-50">
                                        <TableCell className="font-mono text-xs">{asset.asset_code}</TableCell>
                                        <TableCell className="font-medium flex items-center gap-2">
                                            {getCategoryIcon(asset.category?.name_ar)}
                                            {asset.name_ar}
                                        </TableCell>
                                        <TableCell>
                                            <span className="bg-slate-100 px-2 py-1 rounded text-xs">{asset.category?.name_ar}</span>
                                        </TableCell>
                                        <TableCell className="text-xs">{asset.purchase_date}</TableCell>
                                        <TableCell className="font-bold">{formatCurrency(asset.cost)}</TableCell>
                                        <TableCell className="text-red-500">{formatCurrency(asset.accumulated_depreciation)}</TableCell>
                                        <TableCell className="text-emerald-600 font-bold">{formatCurrency(asset.net_book_value)}</TableCell>
                                        <TableCell>{asset.useful_life_years}</TableCell>
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

function getCategoryIcon(name: string) {
    if (!name) return <HardDrive className="w-4 h-4 text-slate-400" />;
    if (name.includes('سيار') || name.includes('مركب')) return <Car className="w-4 h-4 text-blue-500" />;
    if (name.includes('مبان') || name.includes('عقار')) return <Building2 className="w-4 h-4 text-amber-500" />;
    if (name.includes('أجهز') || name.includes('حاسب')) return <HardDrive className="w-4 h-4 text-purple-500" />;
    return <HardDrive className="w-4 h-4 text-slate-400" />;
}

function AddAssetDialog({ categories, onSuccess }: { categories: any[], onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        name_ar: '', asset_code: '', category_id: '',
        purchase_date: new Date().toISOString().split('T')[0],
        cost: 0, useful_life_years: 5
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createFixedAsset({
                ...formData,
                cost: Number(formData.cost),
                useful_life_years: Number(formData.useful_life_years)
            });
            toast({ title: 'تمت إضافة الأصل بنجاح' });
            setOpen(false);
            setFormData({ name_ar: '', asset_code: '', category_id: '', purchase_date: new Date().toISOString().split('T')[0], cost: 0, useful_life_years: 5 });
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
            <DialogContent>
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
                            <Label>كود الأصل</Label>
                            <Input required value={formData.asset_code} onChange={e => setFormData({ ...formData, asset_code: e.target.value })} placeholder="مثال: AST-001" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>التصنيف (المجموعة)</Label>
                        <Select value={formData.category_id} onValueChange={v => setFormData({ ...formData, category_id: v })}>
                            <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                            <SelectContent>
                                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        {categories.length === 0 && <p className="text-xs text-red-500">يرجى إضافة تصنيفات الأصول أولاً في إعدادات النظام</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>تاريخ الشراء</Label>
                            <Input type="date" required value={formData.purchase_date} onChange={e => setFormData({ ...formData, purchase_date: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>تكلفة الشراء</Label>
                            <Input type="number" required value={formData.cost} onChange={e => setFormData({ ...formData, cost: Number(e.target.value) })} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>العمر الافتراضي (سنوات)</Label>
                        <Input type="number" required value={formData.useful_life_years} onChange={e => setFormData({ ...formData, useful_life_years: Number(e.target.value) })} />
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
            const result = await runDepreciation(new Date().toISOString().split('T')[0]);
            if (result && result.count > 0) {
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
