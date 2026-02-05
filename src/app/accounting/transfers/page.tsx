
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRightLeft, CreditCard, Coins, CheckCircle2 } from 'lucide-react';
import { getInventoryItems, addInventoryStock } from '@/lib/inventory-actions';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';

export default function TransfersPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">التحويلات والعمليات الخاصة</h1>
                <p className="text-slate-500">تحويل USDT، تسويات مخزنية، ونقل أصناف</p>
            </div>

            <Tabs defaultValue="usdt-to-card" className="w-full">
                <TabsList className="grid w-full max-w-lg grid-cols-2">
                    <TabsTrigger value="usdt-to-card" className="gap-2">
                        <Coins className="w-4 h-4 text-amber-500" />
                        شراء بـ USDT
                    </TabsTrigger>
                    <TabsTrigger value="stock-transfer" className="gap-2">
                        <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                        نقل بين الأصناف
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="usdt-to-card" className="mt-6">
                    <USDTConversionForm />
                </TabsContent>

                <TabsContent value="stock-transfer" className="mt-6">
                    <StockTransferForm />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function USDTConversionForm() {
    const { toast } = useToast();
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        itemId: '',
        usdtRate: 1, // سعر الـ USDT مقابل العملة المحلية أو كم يكلف
        usdtAmount: 0, // المبلغ المدفوع بالـ USDT
        cardsText: '', // أرقام البطاقات التي تم شراؤها
        quantity: 1,
        notes: ''
    });

    useEffect(() => {
        // Fetch only Items (specifically cards preferably)
        getInventoryItems().then(data => setItems(data || []));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // 1. Process Cards Parsing
            const cardNumbers = formData.cardsText.split('\n').map(s => s.trim()).filter(s => s);

            if (formData.quantity !== cardNumbers.length && formData.cardsText) {
                // Warning or Adjustment could happen here. Assuming strictly matching for now.
            }

            const item = items.find(i => i.id === formData.itemId);
            if (!item) throw new Error("اختر الصنف");

            // 2. Add Stock (Purchase)
            // We treat 'usdtAmount' as the Cost. 
            // Unit Cost = Total USDT Amount / Quantity (Simple Avg)
            const unitCost = formData.usdtAmount / formData.quantity;

            if (item.is_shein_card && cardNumbers.length > 0) {
                for (const cardNum of cardNumbers) {
                    await addInventoryStock({
                        itemId: formData.itemId,
                        quantity: 1,
                        unitCost: unitCost, // Cost in USDT value (or converted if base is LYD)
                        // Ideally we should record the currency too. For now we assume base currency ledger.
                        // If system base is LYD, we might need exchange rate.
                        // Let's assume input is in Base Currency Value for simplicity unless specified.
                        // But user said "Transform USDT". Usually implies paying with USDT asset.
                        // We will record the cost as entered.
                        purchaseDate: new Date().toISOString().split('T')[0],
                        cardNumber: cardNum,
                        notes: `شراء عبر USDT - ${formData.notes}`
                    });
                }
            } else {
                await addInventoryStock({
                    itemId: formData.itemId,
                    quantity: formData.quantity,
                    unitCost: unitCost,
                    purchaseDate: new Date().toISOString().split('T')[0],
                    notes: `شراء عبر USDT - ${formData.notes}`
                });
            }

            // 3. Journal Entry (Future)
            // Dr. Inventory
            //   Cr. USDT Wallet (Asset)

            toast({ title: "تمت العملية بنجاح", description: "تم تحويل الرصيد وإضافة البطاقات" });
            setFormData({ itemId: '', usdtRate: 1, usdtAmount: 0, cardsText: '', quantity: 1, notes: '' });
        } catch (error: any) {
            toast({ title: "خطأ", description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="max-w-2xl">
            <CardHeader>
                <CardTitle>تحويل USDT إلى رصيد (شراء)</CardTitle>
                <CardDescription>استخدم رصيد USDT لشراء وتعبئة بطاقات جديدة</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>الصنف (البطاقة المطلوبة)</Label>
                            <Select
                                value={formData.itemId}
                                onValueChange={(v) => setFormData({ ...formData, itemId: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر الصنف..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {items.filter(i => i.is_shein_card).map(item => (
                                        <SelectItem key={item.id} value={item.id}>{item.name_ar}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>قيمة شراء الـ USDT (التكلفة الإجمالية)</Label>
                            <div className="relative">
                                <Coins className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                                <Input
                                    className="pl-9"
                                    type="number" step="0.01"
                                    placeholder="0.00"
                                    required
                                    value={formData.usdtAmount}
                                    onChange={e => setFormData({ ...formData, usdtAmount: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>أرقام البطاقات (كل رقم في سطر)</Label>
                        <Textarea
                            placeholder="أدخل أرقام البطاقات هنا..."
                            className="font-mono h-32"
                            value={formData.cardsText}
                            onChange={(e) => {
                                const txt = e.target.value;
                                setFormData({
                                    ...formData,
                                    cardsText: txt,
                                    quantity: txt.split('\n').filter(s => s.trim()).length || 1
                                });
                            }}
                        />
                        <p className="text-xs text-slate-500">سيتم حساب الكمية تلقائياً بناءً على عدد الأسطر: {formData.quantity}</p>
                    </div>

                    <div className="space-y-2">
                        <Label>ملاحظات</Label>
                        <Input
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>

                    <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                        {loading ? 'جاري التنفيذ...' : 'إتمام عملية التحويل'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

function StockTransferForm() {
    return (
        <Card className="max-w-2xl">
            <CardHeader>
                <CardTitle>نقل بين الأصناف</CardTitle>
                <CardDescription>تحويل كمية من صنف إلى آخر (قيد التطوير)</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-10 text-slate-500">
                هذه الميزة ستتيح تحويل المخزون (مثلاً تفكيك مجموعة إلى قطع)
                <br />
                سيتم تفعيلها قريباً
            </CardContent>
        </Card>
    );
}
