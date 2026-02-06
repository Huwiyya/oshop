'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Trash2, Database } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { formatAccountingData } from '@/lib/settings-actions';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function SettingsPage() {
    const { toast } = useToast();
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [isFormatting, setIsFormatting] = useState(false);

    const handleFormatClick = () => {
        setShowConfirmDialog(true);
        setConfirmText('');
    };

    const handleConfirmFormat = async () => {
        if (confirmText !== 'CONFIRM' && confirmText !== 'تأكيد') {
            toast({
                title: 'خطأ في التأكيد',
                description: 'يرجى كتابة "CONFIRM" أو "تأكيد" للمتابعة',
                variant: 'destructive'
            });
            return;
        }

        setIsFormatting(true);
        setShowConfirmDialog(false);

        try {
            const result = await formatAccountingData();

            if (result.success) {
                toast({
                    title: 'تم بنجاح',
                    description: result.message,
                    className: 'bg-green-50 border-green-200'
                });
                setConfirmText('');
            } else {
                toast({
                    title: 'فشلت العملية',
                    description: result.error,
                    variant: 'destructive'
                });
            }
        } catch (error) {
            toast({
                title: 'خطأ',
                description: 'حدث خطأ غير متوقع',
                variant: 'destructive'
            });
        } finally {
            setIsFormatting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">إعدادات النظام المحاسبي</h1>
                <p className="text-slate-500">إدارة وتهيئة بيانات النظام</p>
            </div>

            {/* Format Data Section */}
            <Card className="border-red-200 bg-red-50/50">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <Database className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <CardTitle className="text-red-900">تصفير البيانات (Format)</CardTitle>
                            <CardDescription className="text-red-700">
                                حذف جميع البيانات المحاسبية والعودة إلى حالة البداية
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Warning */}
                    <div className="bg-red-100 border-2 border-red-300 rounded-lg p-4">
                        <div className="flex gap-3">
                            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="space-y-2">
                                <h3 className="font-bold text-red-900">تحذير: هذا الإجراء خطير ولا يمكن التراجع عنه!</h3>
                                <p className="text-sm text-red-800">
                                    سيتم حذف جميع البيانات التشغيلية بشكل نهائي. تأكد من عمل نسخة احتياطية قبل المتابعة.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        {/* What will be deleted */}
                        <div className="bg-white rounded-lg p-4 border border-red-200">
                            <h4 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                                <Trash2 className="w-4 h-4" />
                                ما سيتم حذفه:
                            </h4>
                            <ul className="space-y-1.5 text-sm text-red-700">
                                <li>• جميع القيود اليومية</li>
                                <li>• جميع فواتير المبيعات والشراء</li>
                                <li>• جميع سندات القبض والصرف</li>
                                <li>• جميع المعاملات المخزنية</li>
                                <li>• جميع سجلات الرواتب</li>
                                <li>• جميع الأصول الثابتة</li>
                                <li>• أرصدة الحسابات النقدية</li>
                            </ul>
                        </div>

                        {/* What will be preserved */}
                        <div className="bg-white rounded-lg p-4 border border-emerald-200">
                            <h4 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                                <Database className="w-4 h-4" />
                                ما سيتم الحفاظ عليه:
                            </h4>
                            <ul className="space-y-1.5 text-sm text-emerald-700">
                                <li>• دليل الحسابات</li>
                                <li>• بيانات الأصناف (الكميات ستصفّر)</li>
                                <li>• بيانات العملاء والموردين</li>
                                <li>• بيانات الموظفين</li>
                                <li>• إعدادات النظام</li>
                            </ul>
                        </div>
                    </div>

                    {/* Format Button */}
                    <div className="pt-4 border-t border-red-200">
                        <Button
                            variant="destructive"
                            className="w-full md:w-auto bg-red-600 hover:bg-red-700"
                            onClick={handleFormatClick}
                            disabled={isFormatting}
                        >
                            <Trash2 className="w-4 h-4 ml-2" />
                            {isFormatting ? 'جاري التصفير...' : 'تصفير جميع البيانات'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Confirmation Dialog */}
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="w-5 h-5" />
                            تأكيد تصفير البيانات
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-4">
                            <p className="text-red-700 font-medium">
                                هذا الإجراء سيحذف جميع البيانات المحاسبية بشكل نهائي!
                            </p>
                            <p className="text-slate-600">
                                لن تتمكن من استعادة البيانات المحذوفة. تأكد من عمل نسخة احتياطية أولاً.
                            </p>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-text" className="text-slate-700">
                                    للمتابعة، اكتب <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded">CONFIRM</span> أو <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded">تأكيد</span>
                                </Label>
                                <Input
                                    id="confirm-text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder="اكتب CONFIRM أو تأكيد"
                                    className="font-mono"
                                    autoFocus
                                />
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setConfirmText('')}>
                            إلغاء
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmFormat}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={confirmText !== 'CONFIRM' && confirmText !== 'تأكيد'}
                        >
                            تأكيد الحذف النهائي
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
