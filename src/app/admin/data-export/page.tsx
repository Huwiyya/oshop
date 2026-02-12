
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Users, ShoppingCart, BarChart, Bike, Briefcase, HandCoins, TrendingDown, BookUser, Loader2, Users2, MessageSquare, Cog, Banknote, Upload } from "lucide-react";
import * as actions from '@/lib/actions';
import { useToast } from "@/components/ui/use-toast";

type DataType = 'users' | 'orders' | 'transactions' | 'representatives' | 'managers' | 'deposits' | 'expenses' | 'creditors' | 'tempOrders' | 'conversations' | 'externalDebts' | 'settings' | 'instantSales';

const DataExportPage = () => {
    const { toast } = useToast();
    const [loadingStates, setLoadingStates] = useState<Record<DataType, boolean>>({
        users: false,
        orders: false,
        transactions: false,
        representatives: false,
        managers: false,
        deposits: false,
        expenses: false,
        creditors: false,
        tempOrders: false,
        conversations: false,
        externalDebts: false,
        settings: false,
        instantSales: false,
    });

    const convertToCSV = (data: any[], headers: string[]): string => {
        const csvRows = [];
        csvRows.push(headers.join(','));

        for (const row of data) {
            const values = headers.map(header => {
                let value = row[header] ?? '';
                if (typeof value === 'object' && value !== null) {
                    value = JSON.stringify(value);
                }
                const valueStr = String(value);
                if (valueStr.includes(',') || valueStr.includes('"') || valueStr.includes('\n')) {
                    return `"${valueStr.replace(/"/g, '""')}"`;
                }
                return valueStr;
            });
            csvRows.push(values.join(','));
        }

        return csvRows.join('\n');
    };

    const downloadCSV = (csvString: string, filename: string) => {
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownload = async (type: DataType) => {
        setLoadingStates(prev => ({ ...prev, [type]: true }));
        try {
            let data: any;
            let headers: string[] = [];

            switch (type) {
                case 'users':
                    data = await actions.getUsers();
                    headers = ['id', 'name', 'username', 'phone', 'address', 'debt', 'orderCount', 'password'];
                    break;
                case 'orders':
                    data = await actions.getOrders();
                    headers = [
                        'id',
                        'invoiceNumber',
                        'trackingId',
                        'userId',
                        'customerName',
                        'operationDate',
                        'sellingPriceLYD',
                        'remainingAmount',
                        'status',
                        'productLinks',
                        'exchangeRate',
                        'purchasePriceUSD',
                        'downPaymentLYD',
                        'weightKG',
                        'pricePerKilo',
                        'pricePerKiloCurrency',
                        'customerWeightCost',
                        'customerWeightCostCurrency',
                        'addedCostUSD',
                        'addedCostNotes',
                        'store',
                        'paymentMethod',
                        'deliveryDate',
                        'itemDescription',
                        'shippingCostLYD',
                        'representativeId',
                        'representativeName',
                        'collectedAmount',
                        'customerWeightCostUSD',
                        'customerAddress',
                        'customerPhone',
                    ];
                    break;
                case 'transactions':
                    data = await actions.getTransactions();
                    headers = ['id', 'orderId', 'customerId', 'customerName', 'date', 'type', 'status', 'amount', 'description'];
                    break;
                case 'representatives':
                    data = await actions.getRepresentatives();
                    headers = ['id', 'name', 'username', 'phone', 'assignedOrders', 'password'];
                    break;
                case 'managers':
                    data = await actions.getManagers();
                    headers = ['id', 'name', 'username', 'phone', 'permissions'];
                    break;
                case 'deposits':
                    data = await actions.getDeposits();
                    headers = ['id', 'receiptNumber', 'customerName', 'customerPhone', 'amount', 'date', 'status', 'representativeName', 'collectedBy', 'collectedDate'];
                    break;
                case 'expenses':
                    data = await actions.getExpenses();
                    headers = ['id', 'description', 'amount', 'date'];
                    break;
                case 'creditors':
                    data = await actions.getCreditors();
                    headers = ['id', 'name', 'type', 'currency', 'totalDebt', 'contactInfo'];
                    break;
                case 'tempOrders':
                    data = await actions.getTempOrders();
                    headers = ['id', 'parentInvoiceId', 'invoiceName', 'assignedUserId', 'assignedUserName', 'createdAt', 'totalAmount', 'remainingAmount', 'status'];
                    break;
                case 'conversations':
                    data = await actions.getAllConversations();
                    headers = ['id', 'userId', 'userName', 'lastMessage', 'lastMessageTime', 'unreadCount'];
                    break;
                case 'externalDebts':
                    data = await actions.getAllExternalDebts();
                    headers = ['id', 'creditorId', 'creditorName', 'amount', 'date', 'status', 'notes'];
                    break;
                case 'settings':
                    data = await actions.getRawAppSettings();
                    // Settings is an object, not an array, so handle it differently
                    if (data && typeof data === 'object' && !Array.isArray(data)) {
                        headers = Object.keys(data);
                        data = [data]; // convert to array of one for the CSV converter
                    }
                    break;
                case 'instantSales':
                    data = await actions.getInstantSales();
                    headers = ['id', 'productName', 'totalCostLYD', 'finalSalePriceLYD', 'netProfit', 'createdAt'];
                    break;
                default: throw new Error("Invalid data type");
            }

            if (!data || (Array.isArray(data) && data.length === 0)) {
                toast({ title: "لا توجد بيانات", description: `لا توجد بيانات لتصديرها في هذا القسم.`, variant: "default" });
                setLoadingStates(prev => ({ ...prev, [type]: false }));
                return;
            }

            const csvData = convertToCSV(Array.isArray(data) ? data : [data], headers);
            downloadCSV(csvData, type);
            toast({ title: "تم التصدير بنجاح", description: `تم تحميل ملف ${type}.csv بنجاح.` });

        } catch (error) {
            console.error(`Failed to export ${type}:`, error);
            toast({ title: "خطأ في التصدير", description: `فشل تصدير بيانات ${type}.`, variant: "destructive" });
        } finally {
            setLoadingStates(prev => ({ ...prev, [type]: false }));
        }
    };

    const exportItems = [
        { type: 'users', label: 'المستخدمين', icon: <Users className="w-6 h-6 text-primary" /> },
        { type: 'orders', label: 'الطلبات', icon: <ShoppingCart className="w-6 h-6 text-primary" /> },
        { type: 'transactions', label: 'المعاملات المالية', icon: <BarChart className="w-6 h-6 text-primary" /> },
        { type: 'representatives', label: 'المندوبين', icon: <Bike className="w-6 h-6 text-primary" /> },
        { type: 'managers', label: 'المدراء', icon: <Briefcase className="w-6 h-6 text-primary" /> },
        { type: 'deposits', label: 'العربون', icon: <HandCoins className="w-6 h-6 text-primary" /> },
        { type: 'expenses', label: 'المصروفات', icon: <TrendingDown className="w-6 h-6 text-primary" /> },
        { type: 'creditors', label: 'الذمم (الدائنون)', icon: <BookUser className="w-6 h-6 text-primary" /> },
        { type: 'tempOrders', label: 'الفواتير المجمعة', icon: <Users2 className="w-6 h-6 text-primary" /> },
        { type: 'conversations', label: 'المحادثات', icon: <MessageSquare className="w-6 h-6 text-primary" /> },
        { type: 'externalDebts', label: 'الديون الخارجية', icon: <Banknote className="w-6 h-6 text-primary" /> },
        { type: 'instantSales', label: 'المبيعات الفورية', icon: <Banknote className="w-6 h-6 text-primary" /> },
        { type: 'settings', label: 'إعدادات النظام', icon: <Cog className="w-6 h-6 text-primary" /> },
    ] as const;


    // --- Import Logic ---
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [importType, setImportType] = useState<DataType>('users');
    const [isImporting, setIsImporting] = useState(false);

    const handleImport = async () => {
        if (!fileInputRef.current?.files?.[0]) {
            toast({ title: "خطأ", description: "الرجاء اختيار ملف للاستيراد", variant: "destructive" });
            return;
        }

        const file = fileInputRef.current.files[0];
        setIsImporting(true);

        try {
            const text = await file.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                toast({ title: "خطأ في الملف", description: "فشل قراءة ملف JSON. تأكد من صحة التنسيق.", variant: "destructive" });
                return;
            }

            if (!Array.isArray(data)) {
                // Try to handle single object import wrapped in array for consistent handling if needed, 
                // but for bulk import we expect array. 
                // If user exports 'settings' it comes as array of 1, so it should be fine.
                if (typeof data === 'object' && data !== null) {
                    data = [data];
                } else {
                    toast({ title: "نسق غير مدعوم", description: "يجب أن يكون الملف مصفوفة JSON (Array).", variant: "destructive" });
                    return;
                }
            }

            const result = await actions.bulkImport(importType, data);

            if (result.success) {
                toast({ title: "تم الاستيراد بنجاح", description: `تم استيراد ${result.count} سجل بنجاح.` });
                if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
            } else {
                toast({ title: "فشل الاستيراد", description: result.error || "حدث خطأ غير معروف", variant: "destructive" });
            }

        } catch (error) {
            console.error("Import error:", error);
            toast({ title: "خطأ", description: "حدث خطأ أثناء الاستيراد.", variant: "destructive" });
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="p-4 sm:p-6" dir="rtl">
            <h1 className="text-2xl font-bold mb-6">إدارة البيانات (تصدير / استيراد)</h1>

            <div className="space-y-8">
                {/* Export Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>تصدير بيانات النظام</CardTitle>
                        <CardDescription>
                            قم بتصدير أقسام مختلفة من بيانات النظام بصيغة CSV للأرشفة أو التحليل الخارجي.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {exportItems.map(item => (
                            <Card key={item.type} className="flex flex-col items-center justify-center p-6 text-center gap-4 bg-secondary">
                                {item.icon}
                                <h3 className="font-semibold">{item.label}</h3>
                                <Button
                                    className="w-full"
                                    onClick={() => handleDownload(item.type)}
                                    disabled={loadingStates[item.type]}
                                >
                                    {loadingStates[item.type] ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Download className="w-4 h-4 mr-2" />
                                    )}
                                    تنزيل CSV
                                </Button>
                            </Card>
                        ))}
                    </CardContent>
                </Card>

                {/* Import Section */}
                <Card className="border-primary/20">
                    <CardHeader>
                        <CardTitle>استيراد بيانات النظام</CardTitle>
                        <CardDescription>
                            استيراد بيانات من ملفات JSON. سيقوم النظام بتحديث البيانات الموجودة إذا تطابقت المعرفات (ID).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="w-full md:w-1/3 space-y-2">
                                <label className="text-sm font-medium">نوع البيانات</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={importType}
                                    onChange={(e) => setImportType(e.target.value as DataType)}
                                >
                                    {exportItems.map(item => (
                                        <option key={item.type} value={item.type}>{item.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-full md:w-1/3 space-y-2">
                                <label className="text-sm font-medium">ملف البيانات (JSON)</label>
                                <input
                                    type="file"
                                    accept=".json"
                                    ref={fileInputRef}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>
                            <div className="w-full md:w-1/3">
                                <Button className="w-full" onClick={handleImport} disabled={isImporting}>
                                    {isImporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                                    استيراد البيانات
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default DataExportPage;
