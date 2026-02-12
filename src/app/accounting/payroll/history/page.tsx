'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getPayslips, deletePayslip } from '@/lib/payroll-actions';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, FileText, ExternalLink, Calendar, User, DollarSign, Tag, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

export default function PayrollHistoryPage() {
    const router = useRouter();
    const [payslips, setPayslips] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const loadPayslips = () => {
        setLoading(true);
        getPayslips().then(data => {
            setPayslips(data || []);
            setLoading(false);
        });
    };

    useEffect(() => {
        loadPayslips();
    }, []);

    const handleDelete = async (id: string, number: string) => {
        if (!window.confirm(`هل أنت متأكد من حذف القسيمة ${number}؟ لا يمكن التراجع عن هذه العملية.`)) return;

        try {
            await deletePayslip(id);
            toast({ title: 'تم الحذف بنجاح' });
            loadPayslips();
        } catch (error: any) {
            toast({ title: 'خطأ في الحذف', description: error.message, variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/accounting/payroll')}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">تاريخ الرواتب</h1>
                        <p className="text-slate-500">سجل القسائم المعتمدة والمسودات</p>
                    </div>
                </div>
                <Button onClick={() => router.push('/accounting/payroll')} className="gap-2">
                    <FileText className="w-4 h-4" />
                    إنشاء قسيمة جديدة
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    <div className="text-center py-20 text-slate-400">جاري التحميل...</div>
                ) : payslips.length === 0 ? (
                    <div className="text-center py-20 bg-slate-50 border-2 border-dashed rounded-xl text-slate-400">
                        لا توجد قسائم رواتب مسجلة حتى الآن.
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b text-slate-600 font-semibold">
                                <tr>
                                    <th className="px-6 py-4 text-right">رقم القسيمة</th>
                                    <th className="px-6 py-4 text-right">الموظف</th>
                                    <th className="px-6 py-4 text-center">الفترة</th>
                                    <th className="px-6 py-4 text-right">الصافي</th>
                                    <th className="px-6 py-4 text-center">الحالة</th>
                                    <th className="px-6 py-4 text-center">التاريخ</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {payslips.map((slip) => (
                                    <tr key={slip.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-mono font-bold text-blue-600">
                                            {slip.slip_number}
                                        </td>
                                        <td className="px-6 py-4 font-medium">
                                            {slip.employee_name}
                                        </td>
                                        <td className="px-6 py-4 text-center text-slate-500">
                                            {slip.period_month}/{slip.period_year}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold">
                                            {formatCurrency(slip.net_salary)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {slip.is_draft ? (
                                                <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 gap-1 font-normal">
                                                    <Clock className="w-3 h-3" /> مسودة
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 gap-1 font-normal">
                                                    <CheckCircle2 className="w-3 h-3" /> معتمد
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center text-slate-400">
                                            {formatDate(slip.created_at)}
                                        </td>
                                        <td className="px-6 py-4 text-left">
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="gap-2 text-blue-500 hover:bg-blue-50"
                                                    onClick={() => router.push(`/accounting/payroll?id=${slip.id}&view=true`)}
                                                >
                                                    عرض <ExternalLink className="w-3 h-3" />
                                                </Button>

                                                {slip.is_draft && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                        onClick={() => router.push(`/accounting/payroll?id=${slip.id}`)}
                                                    >
                                                        تعديل <FileText className="w-3 h-3" />
                                                    </Button>
                                                )}

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="gap-2 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                    onClick={() => handleDelete(slip.id, slip.slip_number)}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
