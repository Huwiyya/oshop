
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRightLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ItemSelector } from '@/components/accounting/ItemSelector';
import { transferInventory } from '@/lib/inventory-actions';

export default function InventoryTransferPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        sourceItemId: '',
        targetItemId: '',
        quantity: 0,
        date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.sourceItemId === formData.targetItemId) {
            toast({ title: 'خطأ', description: 'لا يمكن التحويل لنفس الصنف', variant: 'destructive' });
            return;
        }
        if (formData.quantity <= 0) {
            toast({ title: 'خطأ', description: 'يجب أن تكون الكمية أكبر من صفر', variant: 'destructive' });
            return;
        }

        setIsLoading(true);
        try {
            await transferInventory(formData);
            toast({ title: 'تم التحويل بنجاح' });
            router.push('/accounting/inventory');
        } catch (error: any) {
            toast({ title: 'خطأ في التحويل', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">تحويل بين الأصناف</h1>
                    <p className="text-slate-500">نقل الكميات من صنف إلى آخر (مثلاً للفرز أو إعادة التعبئة)</p>
                </div>
            </div>

            <form onSubmit={handleTransfer}>
                <Card className="border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                            تفاصيل التحويل المخزني
                        </CardTitle>
                        <CardDescription>سيتم نقل الكمية والتكلفة المرتبطة بها (FIFO) إلى الصنف الهدف.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center relative">
                            {/* Source Item */}
                            <div className="space-y-3">
                                <Label className="text-slate-600 font-bold">الصنف المصدر (سحب من)</Label>
                                <ItemSelector
                                    value={formData.sourceItemId}
                                    onChange={(val) => setFormData({ ...formData, sourceItemId: val })}
                                    placeholder="اختر الصنف الذي سيتم السحب منه..."
                                />
                                <div className="text-[10px] text-slate-400">سيتم استهلاك الطبقات الأقدم أولاً.</div>
                            </div>

                            {/* visual arrow */}
                            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-white border rounded-full items-center justify-center shadow-sm">
                                <ArrowRightLeft className="w-4 h-4 text-slate-400" />
                            </div>

                            {/* Target Item */}
                            <div className="space-y-3">
                                <Label className="text-slate-600 font-bold">الصنف الهدف (إضافة إلى)</Label>
                                <ItemSelector
                                    value={formData.targetItemId}
                                    onChange={(val) => setFormData({ ...formData, targetItemId: val })}
                                    placeholder="اختر الصنف الذي سيتم الإضافة إليه..."
                                    excludeId={formData.sourceItemId}
                                />
                                <div className="text-[10px] text-slate-400">سيتم إنشاء طبقة جديدة بمتوسط التكلفة المسحوبة.</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                            <div className="space-y-2">
                                <Label>الكمية المحولة</Label>
                                <Input
                                    type="number"
                                    step="0.001"
                                    min="0.001"
                                    required
                                    value={formData.quantity || ''}
                                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                                    className="text-lg font-mono"
                                    placeholder="0.000"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>تاريخ التحويل</Label>
                                <Input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>ملاحظات</Label>
                            <Textarea
                                placeholder="سبب التحويل أو تفاصيل إضافية..."
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="min-h-[100px]"
                            />
                        </div>

                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 text-blue-800 text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p>هذا الإجراء سيقوم بتعديل أرصدة الصنفين فوراً. يتم حساب التكلفة المنقولة بناءً على نظام FIFO (الأقدم أولاً) من الصنف المصدر.</p>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-slate-50/50 border-t p-6 flex justify-end gap-3">
                        <Button variant="outline" type="button" onClick={() => router.back()}>إلغاء</Button>
                        <Button
                            className="bg-blue-600 hover:bg-blue-700 font-bold px-8"
                            disabled={isLoading || !formData.sourceItemId || !formData.targetItemId || !formData.quantity}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    جاري المعالجة...
                                </>
                            ) : (
                                'تأكيد عملية التحويل'
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
    );
}
