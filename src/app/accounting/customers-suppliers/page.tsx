
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Search, Users, Truck, ArrowRight, Wallet, Pencil, Trash2 } from 'lucide-react';
import { getEntitiesV2, createEntityV2, updateEntityV2, deleteEntityV2 } from '@/lib/accounting-v2-actions';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

export default function CustomersSuppliersPage() {
    const [activeTab, setActiveTab] = useState<'customer' | 'supplier'>('customer');
    const [searchTerm, setSearchTerm] = useState('');
    const [entities, setEntities] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const { toast } = useToast();

    // Fetch data
    const refreshData = async () => {
        setIsLoading(true);
        const res = await getEntitiesV2(activeTab);
        if (res.success) {
            setEntities(res.data || []);
        } else {
            toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            setEntities([]);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        refreshData();
    }, [activeTab]);

    const filteredEntities = entities.filter(e =>
        e.name_ar.includes(searchTerm) ||
        (e.name_en && e.name_en.toLowerCase().includes(searchTerm.toLowerCase())) ||
        e.code.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">العملاء والموردين</h1>
                    <p className="text-slate-500">إدارة حسابات الزبائن والموردين وعرض الأرصدة</p>
                </div>
                <AddEntityDialog type={activeTab} onSuccess={refreshData} />
            </div>

            <Tabs defaultValue="customer" className="w-full" onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="customer" className="gap-2">
                        <Users className="w-4 h-4" />
                        العملاء (الزبائن)
                    </TabsTrigger>
                    <TabsTrigger value="supplier" className="gap-2">
                        <Truck className="w-4 h-4" />
                        الموردين
                    </TabsTrigger>
                </TabsList>

                <div className="mt-6 flex items-center gap-4 bg-white p-2 rounded-lg border shadow-sm max-w-md">
                    <Search className="w-5 h-5 text-slate-400" />
                    <Input
                        placeholder="بحث بالاسم أو الكود..."
                        className="border-none shadow-none focus-visible:ring-0"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <TabsContent value="customer" className="mt-6">
                    <EntitiesList entities={filteredEntities} isLoading={isLoading} type="customer" onRefresh={refreshData} />
                </TabsContent>

                <TabsContent value="supplier" className="mt-6">
                    <EntitiesList entities={filteredEntities} isLoading={isLoading} type="supplier" onRefresh={refreshData} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function EntitiesList({ entities, isLoading, type, onRefresh }: { entities: any[], isLoading: boolean, type: 'customer' | 'supplier', onRefresh: () => void }) {
    const router = useRouter();

    if (isLoading) {
        return <div className="text-center py-20 text-slate-500">جاري التحميل...</div>;
    }

    if (entities.length === 0) {
        return (
            <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed">
                <div className="mx-auto w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                    {type === 'customer' ? <Users className="w-6 h-6 text-slate-400" /> : <Truck className="w-6 h-6 text-slate-400" />}
                </div>
                <h3 className="text-lg font-medium text-slate-900">لا يوجد بيانات</h3>
                <p className="text-slate-500">قم بإضافة {type === 'customer' ? 'عميل' : 'مورد'} جديد للبدء</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b">
                        <tr>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">الاسم</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">رقم الحساب</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">العملة</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">الرصيد الحالي</th>
                            <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {entities.map((entity) => (
                            <tr
                                key={entity.id}
                                className="hover:bg-slate-50 transition-colors cursor-pointer group"
                                onClick={() => router.push(`/accounting/customers-suppliers/${entity.id}`)}
                            >
                                <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${type === 'customer' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                            {type === 'customer' ? <Users className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-slate-900">{entity.name_ar}</h3>
                                            {entity.name_en && (
                                                <p className="text-sm text-slate-500 truncate">{entity.name_en}</p>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-4">
                                    <span className="font-mono text-sm text-slate-600">{entity.code}</span>
                                </td>
                                <td className="px-4 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                                        {entity.currency}
                                    </span>
                                </td>
                                <td className="px-4 py-4">
                                    <div className="flex flex-col">
                                        <span className={`text-lg font-bold ${Number(entity.current_balance) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {formatCurrency(Math.abs(Number(entity.current_balance)))}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {Number(entity.current_balance) >= 0 ? 'له' : 'عليه'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-center gap-1">
                                        <EditEntityDialog entity={entity} type={type} onSuccess={onRefresh} />
                                        <DeleteEntityDialog entity={entity} type={type} onSuccess={onRefresh} />
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-3 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                            onClick={() => router.push(`/accounting/customers-suppliers/${entity.id}`)}
                                        >
                                            <Wallet className="w-4 h-4 ml-1" />
                                            كشف الحساب
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function AddEntityDialog({ type, onSuccess }: { type: 'customer' | 'supplier', onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const [formData, setFormData] = useState({
        name_ar: '',
        name_en: '',
        currency: 'LYD' as 'LYD' | 'USD',
        phone: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await createEntityV2({
                ...formData,
                type
            });

            if (res.success) {
                toast({
                    title: "تمت العملية بنجاح",
                    description: `تم إضافة ${type === 'customer' ? 'العميل' : 'المورد'} بنجاح`,
                });
                setOpen(false);
                setFormData({ name_ar: '', name_en: '', currency: 'LYD', phone: '' });
                onSuccess();
            } else {
                throw new Error(res.error);
            }
        } catch (error: any) {
            toast({
                title: "خطأ",
                description: error.message || "حدث خطأ أثناء الحفظ",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4" />
                    إضافة {type === 'customer' ? 'عميل' : 'مورد'}
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>إضافة {type === 'customer' ? 'عميل جديد' : 'مورد جديد'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>الاسم بالعربية</Label>
                        <Input
                            required
                            value={formData.name_ar}
                            onChange={e => setFormData({ ...formData, name_ar: e.target.value })}
                            placeholder="مثال: شركة الأفق"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>الاسم بالانجليزية (اختياري)</Label>
                        <Input
                            value={formData.name_en}
                            onChange={e => setFormData({ ...formData, name_en: e.target.value })}
                            placeholder="Example: Horizon Co."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>العملة</Label>
                            <Select
                                value={formData.currency}
                                onValueChange={(v: any) => setFormData({ ...formData, currency: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LYD">دينار ليبي (LYD)</SelectItem>
                                    <SelectItem value="USD">دولار (USD)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>رقم الهاتف</Label>
                            <Input
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="09xxxxxxxx"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EditEntityDialog({ entity, type, onSuccess }: { entity: any, type: 'customer' | 'supplier', onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    // Extract phone from description
    const parsePhone = (desc: string) => {
        const phoneMatch = desc?.match(/Phone:\s*([^\s-]+)/);
        return phoneMatch ? phoneMatch[1] : '';
    };

    const [formData, setFormData] = useState({
        name_ar: entity.name_ar,
        name_en: entity.name_en || '',
        currency: entity.currency || 'LYD',
        phone: parsePhone(entity.description)
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await updateEntityV2(entity.id, formData);
            if (res.success) {
                toast({ title: `تم تحديث بيانات ${type === 'customer' ? 'العميل' : 'المورد'} بنجاح` });
                setOpen(false);
                onSuccess();
            } else {
                toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-blue-50">
                    <Pencil className="w-4 h-4 text-blue-600" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>تعديل بيانات {type === 'customer' ? 'العميل' : 'المورد'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>الاسم بالعربية</Label>
                        <Input
                            required
                            value={formData.name_ar}
                            onChange={e => setFormData({ ...formData, name_ar: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>الاسم بالانجليزية</Label>
                        <Input
                            value={formData.name_en}
                            onChange={e => setFormData({ ...formData, name_en: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>العملة</Label>
                            <Select
                                value={formData.currency}
                                onValueChange={(v: any) => setFormData({ ...formData, currency: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LYD">دينار ليبي (LYD)</SelectItem>
                                    <SelectItem value="USD">دولار (USD)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>رقم الهاتف</Label>
                            <Input
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
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

function DeleteEntityDialog({ entity, type, onSuccess }: { entity: any, type: 'customer' | 'supplier', onSuccess: () => void }) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleDelete = async () => {
        setLoading(true);
        try {
            const res = await deleteEntityV2(entity.id, type);
            if (res.success) {
                toast({ title: `تم حذف ${type === 'customer' ? 'العميل' : 'المورد'} بنجاح` });
                onSuccess();
            } else {
                toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>هل أنت متأكد من حذف {type === 'customer' ? 'هذا العميل' : 'هذا المورد'}؟</AlertDialogTitle>
                    <AlertDialogDescription>
                        سيتم حذف <strong>{entity.name_ar}</strong> نهائياً.
                        لا يمكن التراجع عن هذا الإجراء.
                        <br /><br />
                        <strong>ملاحظة:</strong> لا يمكن حذف {type === 'customer' ? 'عميل' : 'مورد'} مرتبط بفواتير أو سندات أو قيود محاسبية.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleDelete}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        {loading ? 'جاري الحذف...' : 'حذف'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
