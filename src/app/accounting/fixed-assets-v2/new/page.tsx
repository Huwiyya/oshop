'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { createFixedAssetV2, type CreateAssetDataV2, type AssetCategory } from '@/lib/fixed-assets-actions-v2';
import Link from 'next/link';

const assetCategories = {
    tangible: {
        name_ar: 'أصول ثابتة ملموسة', subcategories: {
            land: 'أراضي',
            building: 'مباني',
            machinery: 'آلات ومعدات',
            furniture: 'أثاث ومعدات مكتبية',
            computer: 'حواسيب وأجهزة إلكترونية',
            vehicle: 'سيارات ووسائل نقل'
        }
    },
    intangible: {
        name_ar: 'أصول غير ملموسة', subcategories: {
            software: 'برامج وتراخيص',
            trademark: 'علامات تجارية',
            patent: 'براءات اختراع',
            copyright: 'حقوق نشر'
        }
    },
    wip: { name_ar: 'مشاريع تحت التنفيذ', subcategories: {} }
};

const depreciationMethods = {
    straight_line: 'القسط الثابت',
    declining_balance: 'القسط المتناقص',
    none: 'بدون استهلاك'
};

export default function NewAssetPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name_ar: '',
        name_en: '',
        asset_category: 'tangible' as AssetCategory,
        asset_subcategory: '',
        description: '',
        acquisition_date: new Date().toISOString().split('T')[0],
        acquisition_cost: '',
        useful_life_years: '',
        residual_value: '0',
        depreciation_method: 'straight_line' as 'straight_line' | 'declining_balance' | 'none',
        location: '',
        responsible_person: '',
        serial_number: '',
        warranty_expiry: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name_ar || !formData.acquisition_cost || !formData.asset_subcategory) {
            toast({
                title: 'خطأ',
                description: 'يجب ملء جميع الحقول المطلوبة',
                variant: 'destructive'
            });
            return;
        }

        setLoading(true);
        try {
            const result = await createFixedAssetV2({
                ...formData,
                acquisition_cost: parseFloat(formData.acquisition_cost) || 0,
                useful_life_years: formData.useful_life_years ? parseInt(formData.useful_life_years) : undefined,
                residual_value: parseFloat(formData.residual_value) || 0
            });

            if (result.success) {
                toast({
                    title: 'تم بنجاح',
                    description: 'تم إضافة الأصل بنجاح'
                });

                router.push('/accounting/fixed-assets-v2');
                router.refresh();
            } else {
                throw new Error(result.error);
            }
        } catch (error: any) {
            toast({
                title: 'خطأ',
                description: error.message,
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    const selectedCategory = assetCategories[formData.asset_category];
    const hasSubcategories = Object.keys(selectedCategory.subcategories).length > 0;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/accounting/fixed-assets-v2">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">إضافة أصل ثابت</h1>
                    <p className="text-slate-500">ملء بيانات الأصل الجديد</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle>بيانات الأصل</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* التصنيف */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>التصنيف الرئيسي <span className="text-red-500">*</span></Label>
                                <Select
                                    value={formData.asset_category}
                                    onValueChange={(v) => {
                                        setFormData({ ...formData, asset_category: v as any, asset_subcategory: '' });
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(assetCategories).map(([key, val]) => (
                                            <SelectItem key={key} value={key}>{val.name_ar}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {hasSubcategories && (
                                <div className="space-y-2">
                                    <Label>الفئة <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={formData.asset_subcategory}
                                        onValueChange={(v) => setFormData({ ...formData, asset_subcategory: v })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="اختر الفئة" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(selectedCategory.subcategories).map(([key, val]) => (
                                                <SelectItem key={key} value={key}>{val}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {/* الأسماء */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>الاسم بالعربية <span className="text-red-500">*</span></Label>
                                <Input
                                    required
                                    value={formData.name_ar}
                                    onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                                    placeholder="مثال: حاسوب محاسبة رقم 1"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>الاسم بالإنجليزية</Label>
                                <Input
                                    value={formData.name_en}
                                    onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                                    placeholder="Example: Accounting PC #1"
                                />
                            </div>
                        </div>

                        {/* الوصف */}
                        <div className="space-y-2">
                            <Label>الوصف</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="تفاصيل إضافية عن الأصل..."
                                rows={3}
                            />
                        </div>

                        {/* معلومات الشراء */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>تاريخ الشراء <span className="text-red-500">*</span></Label>
                                <Input
                                    type="date"
                                    required
                                    value={formData.acquisition_date}
                                    onChange={(e) => setFormData({ ...formData, acquisition_date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>تكلفة الشراء (د.ل) <span className="text-red-500">*</span></Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={formData.acquisition_cost}
                                    onChange={(e) => setFormData({ ...formData, acquisition_cost: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>القيمة المتبقية (د.ل)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.residual_value}
                                    onChange={(e) => setFormData({ ...formData, residual_value: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* الاستهلاك */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>طريقة الاستهلاك</Label>
                                <Select
                                    value={formData.depreciation_method}
                                    onValueChange={(v) => setFormData({ ...formData, depreciation_method: v as 'straight_line' | 'declining_balance' | 'none' })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(depreciationMethods).map(([key, val]) => (
                                            <SelectItem key={key} value={key}>{val}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.depreciation_method !== 'none' && (
                                <div className="space-y-2">
                                    <Label>العمر الافتراضي (بالسنوات)</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={formData.useful_life_years}
                                        onChange={(e) => setFormData({ ...formData, useful_life_years: e.target.value })}
                                        placeholder="5"
                                    />
                                </div>
                            )}
                        </div>

                        {/* معلومات إضافية */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>الموقع</Label>
                                <Input
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    placeholder="مثال: المخزن الرئيسي"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>الشخص المسؤول</Label>
                                <Input
                                    value={formData.responsible_person}
                                    onChange={(e) => setFormData({ ...formData, responsible_person: e.target.value })}
                                    placeholder="مثال: أحمد محمد"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>الرقم التسلسلي</Label>
                                <Input
                                    value={formData.serial_number}
                                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                                    placeholder="SN-12345"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>تاريخ انتهاء الضمان</Label>
                                <Input
                                    type="date"
                                    value={formData.warranty_expiry}
                                    onChange={(e) => setFormData({ ...formData, warranty_expiry: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                            <Button type="submit" disabled={loading} className="gap-2">
                                <Save className="w-4 h-4" />
                                {loading ? 'جاري الحفظ...' : 'حفظ الأصل'}
                            </Button>
                            <Link href="/accounting/fixed-assets-v2">
                                <Button type="button" variant="outline">إلغاء</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
