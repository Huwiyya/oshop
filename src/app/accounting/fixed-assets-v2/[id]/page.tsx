'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, TrendingDown, Calendar, DollarSign, MapPin, User, Hash, Shield, Edit, Trash2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';

export default function AssetDetailsPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const { toast } = useToast();
    const [asset, setAsset] = useState<any>(null);
    const [depreciationLog, setDepreciationLog] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [disposeDialogOpen, setDisposeDialogOpen] = useState(false);

    useEffect(() => {
        // Load asset details - placeholder
        setLoading(false);
        // Mock data
        setAsset({
            id: params.id,
            asset_code: 'CMP-0001',
            name_ar: 'حاسوب محاسبة رقم 1',
            name_en: 'Accounting PC #1',
            asset_category: 'tangible',
            asset_subcategory: 'computer',
            description: 'حاسوب مكتبي للمحاسبة',
            acquisition_date: '2024-01-15',
            acquisition_cost: 5000,
            useful_life_years: 5,
            residual_value: 500,
            depreciation_method: 'straight_line',
            accumulated_depreciation: 450,
            status: 'active',
            location: 'قسم المحاسبة',
            responsible_person: 'أحمد محمد',
            serial_number: 'SN-12345',
            warranty_expiry: '2025-01-15'
        });
    }, [params.id]);

    if (loading) {
        return <div className="text-center py-20">جاري التحميل...</div>;
    }

    if (!asset) {
        return <div className="text-center py-20">الأصل غير موجود</div>;
    }

    const bookValue = asset.acquisition_cost - asset.accumulated_depreciation;
    const depreciationPercentage = (asset.accumulated_depreciation / asset.acquisition_cost * 100).toFixed(1);

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/accounting/fixed-assets-v2">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">{asset.name_ar}</h1>
                        <p className="text-slate-500">{asset.asset_code}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Badge variant={asset.status === 'active' ? 'default' : 'destructive'}>
                        {asset.status === 'active' ? 'نشط' : asset.status === 'disposed' ? 'مُباع' : 'صيانة'}
                    </Badge>
                    {asset.status === 'active' && (
                        <>
                            <Button variant="outline" size="sm" className="gap-2">
                                <Edit className="w-4 h-4" />
                                تعديل
                            </Button>
                            <DisposalDialog asset={asset} open={disposeDialogOpen} onOpenChange={setDisposeDialogOpen} />
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500">تكلفة الشراء</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{formatCurrency(asset.acquisition_cost)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-slate-500">الاستهلاك المتراكم</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(asset.accumulated_depreciation)}</p>
                        <p className="text-xs text-slate-500 mt-1">{depreciationPercentage}% من التكلفة</p>
                    </CardContent>
                </Card>
                <Card className="border-emerald-200 bg-emerald-50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-emerald-700">القيمة الدفترية</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold text-emerald-700">{formatCurrency(bookValue)}</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="details" className="w-full">
                <TabsList>
                    <TabsTrigger value="details">التفاصيل</TabsTrigger>
                    <TabsTrigger value="depreciation">سجل الاستهلاك</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>معلومات الأصل</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <InfoRow icon={Calendar} label="تاريخ الشراء" value={formatDate(asset.acquisition_date)} />
                                <InfoRow icon={DollarSign} label="القيمة المتبقية" value={formatCurrency(asset.residual_value)} />
                                <InfoRow icon={TrendingDown} label="طريقة الاستهلاك" value={
                                    asset.depreciation_method === 'straight_line' ? 'القسط الثابت' :
                                        asset.depreciation_method === 'declining_balance' ? 'القسط المتناقص' : 'بدون'
                                } />
                                <InfoRow icon={Calendar} label="العمر الافتراضي" value={`${asset.useful_life_years} سنوات`} />
                                {asset.location && <InfoRow icon={MapPin} label="الموقع" value={asset.location} />}
                                {asset.responsible_person && <InfoRow icon={User} label="المسؤول" value={asset.responsible_person} />}
                                {asset.serial_number && <InfoRow icon={Hash} label="الرقم التسلسلي" value={asset.serial_number} />}
                                {asset.warranty_expiry && <InfoRow icon={Shield} label="انتهاء الضمان" value={formatDate(asset.warranty_expiry)} />}
                            </div>
                            {asset.description && (
                                <div className="pt-4 border-t">
                                    <Label className="text-sm text-slate-500">الوصف</Label>
                                    <p className="mt-2 text-slate-700">{asset.description}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="depreciation" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>سجل الاستهلاك الشهري</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {depreciationLog.length === 0 ? (
                                <p className="text-center py-10 text-slate-500">لا يوجد سجل استهلاك حتى الآن</p>
                            ) : (
                                <div className="space-y-2">
                                    {depreciationLog.map((log: any) => (
                                        <div key={log.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                            <span className="text-sm font-medium">{formatDate(log.period_date)}</span>
                                            <span className="text-sm text-red-600 font-bold">{formatCurrency(log.depreciation_amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function InfoRow({ icon: Icon, label, value }: any) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                <Icon className="w-5 h-5 text-slate-600" />
            </div>
            <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="font-medium">{value}</p>
            </div>
        </div>
    );
}

function DisposalDialog({ asset, open, onOpenChange }: any) {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        disposal_date: new Date().toISOString().split('T')[0],
        disposal_amount: '',
        disposal_notes: ''
    });

    const handleDispose = async () => {
        if (!formData.disposal_amount) {
            toast({ title: 'خطأ', description: 'يجب إدخال سعر البيع', variant: 'destructive' });
            return;
        }

        setLoading(true);
        try {
            // TODO: Call disposeAsset API
            toast({ title: 'تم بنجاح', description: 'تم تسجيل التخلص من الأصل' });
            onOpenChange(false);
            router.refresh();
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                    <Trash2 className="w-4 h-4" />
                    التخلص من الأصل
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>التخلص من الأصل: {asset.name_ar}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>تاريخ البيع/التخلص</Label>
                        <Input
                            type="date"
                            value={formData.disposal_date}
                            onChange={(e) => setFormData({ ...formData, disposal_date: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>سعر البيع (د.ل)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={formData.disposal_amount}
                            onChange={(e) => setFormData({ ...formData, disposal_amount: e.target.value })}
                            placeholder="0.00"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>ملاحظات</Label>
                        <Textarea
                            value={formData.disposal_notes}
                            onChange={(e) => setFormData({ ...formData, disposal_notes: e.target.value })}
                            placeholder="أسباب التخلص، معلومات إضافية..."
                            rows={3}
                        />
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                            <strong>ملاحظة:</strong> سيتم إنشاء قيد محاسبي تلقائياً لتسجيل التخلص من الأصل وحساب الربح/الخسارة.
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
                    <Button variant="destructive" onClick={handleDispose} disabled={loading}>
                        {loading ? 'جاري الحفظ...' : 'تأكيد التخلص'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
