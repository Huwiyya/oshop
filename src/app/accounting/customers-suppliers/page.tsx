
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, Search, Users, Truck, ArrowRight, Wallet } from 'lucide-react';
import { getEntities, createEntity } from '@/lib/accounting-actions';
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
        const data = await getEntities(activeTab);
        setEntities(data || []);
        setIsLoading(false);
    };

    useEffect(() => {
        refreshData();
    }, [activeTab]);

    const filteredEntities = entities.filter(e =>
        e.name_ar.includes(searchTerm) ||
        (e.name_en && e.name_en.toLowerCase().includes(searchTerm.toLowerCase())) ||
        e.account_code.includes(searchTerm)
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
                    <EntitiesList entities={filteredEntities} isLoading={isLoading} type="customer" />
                </TabsContent>

                <TabsContent value="supplier" className="mt-6">
                    <EntitiesList entities={filteredEntities} isLoading={isLoading} type="supplier" />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function EntitiesList({ entities, isLoading, type }: { entities: any[], isLoading: boolean, type: 'customer' | 'supplier' }) {
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entities.map((entity) => (
                <Card
                    key={entity.id}
                    className="hover:shadow-md transition-shadow cursor-pointer group border-slate-200"
                    onClick={() => router.push(`/accounting/customers-suppliers/${entity.id}`)}
                >
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${type === 'customer' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                    {type === 'customer' ? <Users className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 line-clamp-1">{entity.name_ar}</h3>
                                    <p className="text-xs text-slate-500 font-mono">{entity.account_code}</p>
                                </div>
                            </div>
                            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded font-medium">
                                {entity.currency}
                            </span>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs text-slate-500">الرصيد الحالي</p>
                            <div className={`text-xl font-bold flex items-center gap-1 ${Number(entity.current_balance) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                {formatCurrency(Math.abs(Number(entity.current_balance)))}
                                <span className="text-xs font-normal text-slate-400">
                                    {Number(entity.current_balance) >= 0 ? 'له' : 'عليه'}
                                </span>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-slate-500 group-hover:text-blue-600 transition-colors">
                            <span>عرض كشف الحساب</span>
                            <ArrowRight className="w-4 h-4" />
                        </div>
                    </CardContent>
                </Card>
            ))}
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
            await createEntity({
                ...formData,
                type
            });
            toast({
                title: "تمت العملية بنجاح",
                description: `تم إضافة ${type === 'customer' ? 'العميل' : 'المورد'} بنجاح`,
            });
            setOpen(false);
            setFormData({ name_ar: '', name_en: '', currency: 'LYD', phone: '' });
            onSuccess();
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
