'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, CreditCard, History, Copy, Calendar } from "lucide-react";
import { SheinCard, SheinTransaction } from '@/lib/types';
import { getSheinCardById, getSheinCardTransactions } from '@/lib/actions';
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";

export default function SheinCardDetailsPage({ params }: { params: { id: string } }) {
    const { toast } = useToast();
    const router = useRouter();
    const [card, setCard] = useState<SheinCard | null>(null);
    const [transactions, setTransactions] = useState<SheinTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [params.id]);

    const loadData = async () => {
        setIsLoading(true);
        const [cardData, txData] = await Promise.all([
            getSheinCardById(params.id),
            getSheinCardTransactions(params.id)
        ]);
        setCard(cardData);
        setTransactions(txData);
        setIsLoading(false);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: "تم النسخ", description: "تم نسخ النص إلى الحافظة" });
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    if (!card) {
        return <div className="text-center p-8">البطاقة غير موجودة</div>;
    }

    const isAvailable = card.remainingValue ? card.remainingValue > 0 : card.value > 0;
    // Basic status logic if not explicitly set
    const displayStatus = card.status === 'available' ? 'متاحة' : card.status === 'used' ? 'مستنفذة' : 'منتهية';

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <CreditCard className="w-6 h-6 text-purple-600" />
                            بطاقة شي إن
                        </h1>
                        <p className="text-muted-foreground text-sm">تفاصيل البطاقة وسجل الاستخدام</p>
                    </div>
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white shadow relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <CreditCard className="w-24 h-24" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">كود البطاقة</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <div className="text-xl font-mono font-bold tracking-wider">{card.code}</div>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(card.code)}>
                                <Copy className="w-3 h-3" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white shadow">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">الرصيد المتبقي</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-green-600">
                                ${(card.remainingValue ?? card.value).toFixed(2)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                                / ${card.value.toFixed(2)}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white shadow">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">الحالة</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge className={`text-base ${card.status === 'available' ? 'bg-green-100 text-green-800' :
                            card.status === 'used' ? 'bg-gray-100 text-gray-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {displayStatus}
                        </Badge>
                    </CardContent>
                </Card>

                <Card className="bg-white shadow">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">تاريخ الشراء</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2 text-lg">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {new Date(card.purchaseDate).toLocaleDateString('ar-LY')}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Transactions Table */}
            <Card className="shadow-lg border-t-4 border-t-purple-600">
                <CardHeader>
                    <CardTitle>سجل الاستخدام (الخصومات)</CardTitle>
                    <CardDescription>الطلبات التي تم خصم قيمتها من هذه البطاقة</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-right">التاريخ</TableHead>
                                <TableHead className="text-right">المبلغ المخصوم</TableHead>
                                <TableHead className="text-right">رقم الطلب</TableHead>
                                <TableHead className="text-right">العميل</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        لم يتم استخدام هذه البطاقة في أي طلبات بعد
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transactions.map((tx) => (
                                    <TableRow key={tx.id}>
                                        <TableCell className="font-mono text-muted-foreground">
                                            {new Date(tx.createdAt).toLocaleDateString('ar-LY')} {new Date(tx.createdAt).toLocaleTimeString('ar-LY')}
                                        </TableCell>
                                        <TableCell className="font-bold text-red-600">
                                            -${tx.amount.toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            {tx.orderNumber ? (
                                                <a href={`/admin/orders/${tx.orderId}`} className="text-primary hover:underline">
                                                    {tx.orderNumber}
                                                </a>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell>{tx.customerName || '-'}</TableCell>
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
