'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, Sparkles, Construction, TrendingDown, Eye, EyeOff } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { getFixedAssetsV2, type FixedAssetV2, type AssetCategory } from '@/lib/fixed-assets-actions-v2';
import { useToast } from '@/components/ui/use-toast';
import Link from 'next/link';

export default function FixedAssetsPage() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<AssetCategory>('tangible');
    const [showDisposed, setShowDisposed] = useState(false);
    const [assets, setAssets] = useState<FixedAssetV2[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAssets();
    }, [activeTab, showDisposed]);

    const loadAssets = async () => {
        setLoading(true);
        try {
            const data = await getFixedAssetsV2(activeTab, showDisposed);
            setAssets(data);
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">الأصول الثابتة</h1>
                    <p className="text-slate-500">إدارة الأصول الملموسة وغير الملموسة والمشاريع</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant={showDisposed ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowDisposed(!showDisposed)}
                        className="gap-2"
                    >
                        {showDisposed ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        {showDisposed ? 'إخفاء المُباع' : 'عرض المُباع'}
                    </Button>
                    <Link href="/accounting/fixed-assets-v2/new">
                        <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                            <Plus className="w-4 h-4" />
                            إضافة أصل
                        </Button>
                    </Link>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                <TabsList className="grid w-full max-w-2xl grid-cols-3">
                    <TabsTrigger value="tangible" className="gap-2">
                        <Building2 className="w-4 h-4" />
                        أصول ملموسة
                    </TabsTrigger>
                    <TabsTrigger value="intangible" className="gap-2">
                        <Sparkles className="w-4 h-4" />
                        أصول غير ملموسة
                    </TabsTrigger>
                    <TabsTrigger value="wip" className="gap-2">
                        <Construction className="w-4 h-4" />
                        مشاريع تحت التنفيذ
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="tangible" className="mt-6">
                    <AssetsList category="tangible" assets={assets} loading={loading} showDisposed={showDisposed} />
                </TabsContent>

                <TabsContent value="intangible" className="mt-6">
                    <AssetsList category="intangible" assets={assets} loading={loading} showDisposed={showDisposed} />
                </TabsContent>

                <TabsContent value="wip" className="mt-6">
                    <AssetsList category="wip" assets={assets} loading={loading} showDisposed={showDisposed} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function AssetsList({ category, assets, loading, showDisposed }: any) {
    if (loading) {
        return <div className="text-center py-20 text-slate-500">جاري التحميل...</div>;
    }

    if (assets.length === 0) {
        return (
            <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed">
                <div className="mx-auto w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                    {category === 'tangible' ? <Building2 className="w-6 h-6 text-slate-400" /> :
                        category === 'intangible' ? <Sparkles className="w-6 h-6 text-slate-400" /> :
                            <Construction className="w-6 h-6 text-slate-400" />}
                </div>
                <h3 className="text-lg font-medium text-slate-900">لا يوجد أصول</h3>
                <p className="text-slate-500">قم بإضافة أصل جديد للبدء</p>
            </div>
        );
    }

    const subcategoryIcons: Record<string, any> = {
        land: '🏞️',
        building: '🏢',
        machinery: '⚙️',
        furniture: '🪑',
        computer: '💻',
        vehicle: '🚗',
        software: '💿',
        trademark: '™️',
        patent: '📜',
        copyright: '©️'
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((asset: any) => (
                <Card key={asset.id} className="hover:shadow-md transition-shadow border-slate-200">
                    <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                                    {subcategoryIcons[asset.asset_subcategory] || '📦'}
                                </div>
                                <div>
                                    <CardTitle className="text-base">{asset.name_ar}</CardTitle>
                                    <p className="text-xs text-slate-500 font-mono">{asset.asset_code}</p>
                                </div>
                            </div>
                            {asset.status === 'disposed' && (
                                <Badge variant="destructive" className="text-xs">مُباع</Badge>
                            )}
                            {asset.status === 'inactive' && (
                                <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">غير نشط</Badge>
                            )}
                            {asset.status === 'under_maintenance' && (
                                <Badge variant="secondary" className="text-xs">صيانة</Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">تاريخ الشراء</span>
                            <span className="font-medium">{formatDate(asset.acquisition_date)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">التكلفة</span>
                            <span className="font-medium">{formatCurrency(asset.acquisition_cost)}</span>
                        </div>
                        {asset.depreciation_method !== 'none' && (
                            <>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500 flex items-center gap-1">
                                        <TrendingDown className="w-3 h-3" />
                                        الاستهلاك المتراكم
                                    </span>
                                    <span className="text-red-600 font-medium">
                                        {formatCurrency(asset.accumulated_depreciation)}
                                    </span>
                                </div>
                                <div className="pt-2 border-t">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-semibold text-slate-700">القيمة الدفترية</span>
                                        <span className="text-lg font-bold text-emerald-600">
                                            {formatCurrency(asset.acquisition_cost - asset.accumulated_depreciation)}
                                        </span>
                                    </div>
                                </div>
                            </>
                        )}
                        <Link href={`/accounting/fixed-assets-v2/${asset.id}`}>
                            <Button variant="outline" size="sm" className="w-full mt-2">
                                عرض التفاصيل
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
