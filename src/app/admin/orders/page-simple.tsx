'use client';

import React, { useState, useEffect } from 'react';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Package, PlusCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SimpleOrder {
    id: string;
    invoiceNumber: string;
    customerName: string;
    status: string;
    sellingPriceLYD: number;
    operationDate: string;
}

export default function SimpleOrdersPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [orders, setOrders] = useState<SimpleOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchOrders();
    }, []);

    async function fetchOrders() {
        setIsLoading(true);
        setError(null);

        try {
            console.log('🔵 Fetching orders from Supabase...');

            const { data, error: fetchError } = await supabaseAdmin
                .from('orders_v4')
                .select('*')
                .order('operationDate', { ascending: false })
                .limit(50);

            if (fetchError) {
                console.error('❌ Supabase error:', fetchError);
                throw fetchError;
            }

            console.log('✅ Fetched orders:', data?.length || 0);
            setOrders(data || []);

            if (!data || data.length === 0) {
                toast({
                    title: 'لا توجد طلبات',
                    description: 'قاعدة البيانات فارغة. جرب إضافة طلب جديد.',
                    variant: 'default'
                });
            }
        } catch (err: any) {
            console.error('❌ Error fetching orders:', err);
            setError(err.message || 'حدث خطأ غير معروف');
            toast({
                title: 'خطأ في تحميل الطلبات',
                description: err.message,
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="p-6" dir="rtl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">إدارة الطلبات (مبسط)</h1>
                <Button
                    onClick={() => router.push('/admin/orders/add')}
                    className="gap-2"
                >
                    <PlusCircle className="h-4 w-4" />
                    إضافة طلب جديد
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>قائمة الطلبات</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading && (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <span className="mr-2">جاري التحميل...</span>
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
                            <p className="font-semibold">خطأ:</p>
                            <p className="text-sm mt-1">{error}</p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchOrders}
                                className="mt-2"
                            >
                                إعادة المحاولة
                            </Button>
                        </div>
                    )}

                    {!isLoading && !error && orders.length === 0 && (
                        <div className="text-center p-8 text-muted-foreground">
                            <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-semibold">لا توجد طلبات</p>
                            <p className="text-sm mt-2">قاعدة البيانات فارغة. ابدأ بإضافة طلب جديد.</p>
                            <Button
                                onClick={() => router.push('/admin/orders/add')}
                                className="mt-4"
                            >
                                <PlusCircle className="h-4 w-4 ml-2" />
                                إضافة طلب
                            </Button>
                        </div>
                    )}

                    {!isLoading && !error && orders.length > 0 && (
                        <div className="space-y-2">
                            <div className="grid grid-cols-5 gap-4 p-3 bg-secondary/50 rounded-lg font-semibold">
                                <div>رقم الفاتورة</div>
                                <div>اسم العميل</div>
                                <div>الحالة</div>
                                <div>المبلغ</div>
                                <div>التاريخ</div>
                            </div>
                            {orders.map(order => (
                                <div
                                    key={order.id}
                                    className="grid grid-cols-5 gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                                    onClick={() => router.push(`/admin/orders/${order.id}`)}
                                >
                                    <div className="font-medium text-primary">{order.invoiceNumber}</div>
                                    <div>{order.customerName}</div>
                                    <div className="text-sm">{order.status}</div>
                                    <div>{order.sellingPriceLYD?.toFixed(2) || '0.00'} د.ل</div>
                                    <div className="text-sm text-muted-foreground">
                                        {new Date(order.operationDate).toLocaleDateString('ar-LY')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                    <strong>ملاحظة:</strong> هذه نسخة مبسطة لاختبار الاتصال بقاعدة البيانات.
                </p>
                <p className="text-sm text-blue-700 mt-1">
                    عدد الطلبات المعروضة: {orders.length}
                </p>
            </div>
        </div>
    );
}
