
'use client';
import { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { ArrowLeft, FileText, Plus, Save, Trash2, History, ExternalLink, CheckCircle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AccountSelector } from '@/components/accounting/AccountSelector';
import { getEmployeesV2, upsertPayslipV2, getPayslipV2, deletePayslipV2, postPayslipV2, type PayslipLineV2 } from '@/lib/payroll-actions-v2';
import { getChartOfAccountsV2 } from '@/lib/accounting-v2-actions'; // Use V2 actions

function PayrollContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const slipId = searchParams.get('id');
    // If view=true or slip is posted, we treat as view-only (except for deletion which might be restricted)
    const isViewMode = searchParams.get('view') === 'true';

    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [slipStatus, setSlipStatus] = useState<string>('draft');
    const [journalId, setJournalId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        employeeId: '',
        month: new Date().toISOString().slice(0, 7),
        paymentDate: new Date().toISOString().split('T')[0],
        lines: [
            { id: Math.random().toString(), accountId: '', description: 'راتب أساسي', amount: 0, type: 'earning' as const }
        ] as PayslipLineV2[]
    });

    useEffect(() => {
        Promise.all([
            getEmployeesV2(),
            getChartOfAccountsV2(), // V2
            slipId ? getPayslipV2(slipId) : Promise.resolve(null)
        ]).then(([emps, accsRes, existingSlip]) => { // accsRes is { success, data }
            setEmployees(emps || []);
            console.log('PayrollPage: Fetched accounts:', accsRes.data?.length);
            if (accsRes.data && accsRes.data.length > 0) {
                console.log('PayrollPage: Sample account:', accsRes.data[0]);
            }
            setAccounts(accsRes.data || []); // Extract data from V2 response

            if (existingSlip) {
                setSlipStatus(existingSlip.status);
                setJournalId(existingSlip.journal_entry_id);
                setFormData({
                    employeeId: existingSlip.employee_id,
                    month: `${existingSlip.period_year}-${existingSlip.period_month.toString().padStart(2, '0')}`,
                    paymentDate: existingSlip.payment_date || new Date().toISOString().split('T')[0],
                    lines: existingSlip.lines.map((l: any) => ({
                        id: l.id,
                        accountId: l.account_id,
                        description: l.description,
                        amount: Number(l.amount),
                        type: l.type as 'earning' | 'deduction'
                    }))
                });
            }
        });
    }, [slipId]);

    const isReadOnly = isViewMode || slipStatus !== 'draft';

    const totalEarnings = formData.lines.filter(l => l.type === 'earning').reduce((sum, l) => sum + l.amount, 0);
    const totalDeductions = formData.lines.filter(l => l.type === 'deduction').reduce((sum, l) => sum + l.amount, 0);
    const netSalary = totalEarnings - totalDeductions;

    const addLine = (type: 'earning' | 'deduction') => {
        setFormData({
            ...formData,
            lines: [...formData.lines, { id: Math.random().toString(), accountId: '', description: '', amount: 0, type }]
        });
    };

    const removeLine = (id: string) => {
        setFormData({ ...formData, lines: formData.lines.filter(l => l.id !== id) });
    };

    const updateLine = (id: string, updates: Partial<PayslipLineV2>) => {
        setFormData({
            ...formData,
            lines: formData.lines.map(l => l.id === id ? { ...l, ...updates } : l)
        });
    };

    const handleSave = async (action: 'draft' | 'post') => {
        if (!formData.employeeId) return toast({ title: 'خطأ', description: 'يجب اختيار موظف', variant: 'destructive' });
        if (formData.lines.some(l => !l.accountId || l.amount <= 0)) return toast({ title: 'خطأ', description: 'يجب ملء كافة الحسابات والمبالغ', variant: 'destructive' });

        setLoading(true);
        try {
            const employee = employees.find(e => e.id === formData.employeeId);
            const [year, month] = formData.month.split('-').map(Number);

            // 1. Upsert Draft
            const result = await upsertPayslipV2({
                id: slipId || undefined,
                employeeId: formData.employeeId,
                employeeName: employee?.name_ar || 'Unknown',
                year,
                month,
                paymentDate: formData.paymentDate,
                lines: formData.lines
            });

            if (action === 'draft') {
                toast({ title: 'تم حفظ المسودة بنجاح' });
                if (!slipId) router.replace(`/accounting/payroll?id=${result.id}`);
                else router.refresh();
            } else {
                // 2. Post if requested
                await postPayslipV2(result.id!);
                toast({ title: 'تم ترحيل قسيمة الراتب بنجاح' });
                router.push('/accounting/payroll/history');
            }

        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!slipId) return;
        if (!window.confirm('هل أنت متأكد من حذف هذه المسودة؟')) return;

        setLoading(true);
        try {
            await deletePayslipV2(slipId);
            toast({ title: 'تم الحذف بنجاح' });
            router.push('/accounting/payroll/history');
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">إعداد الرواتب (Payroll V2)</h1>
                        <p className="text-slate-500">
                            {slipStatus === 'draft' ? 'مسودة قسيمة راتب' : 'قسيمة راتب مرحلة'}
                        </p>
                    </div>
                </div>
                <Button variant="outline" className="gap-2" onClick={() => router.push('/accounting/payroll/history')}>
                    <History className="w-4 h-4" />
                    تاريخ القسائم
                </Button>
            </div>

            <Card className="border-t-4 border-t-blue-500">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-500" />
                            بيانات القسيمة
                        </div>
                        {slipStatus === 'posted' && (
                            <span className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full flex items-center gap-1">
                                <CheckCircle className="w-4 h-4" /> مرحلة (Posted)
                            </span>
                        )}
                        {slipStatus === 'draft' && (
                            <span className="text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">
                                مسودة (Draft)
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>الموظف</Label>
                            <AccountSelector
                                accounts={employees}
                                value={formData.employeeId}
                                onChange={(v) => setFormData({ ...formData, employeeId: v })}
                                placeholder="اختر الموظف..."
                                className={isReadOnly ? "bg-slate-50 opacity-100" : ""}
                                disabled={isReadOnly}
                                showAllLevels={true}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>عن شهر (الفترة)</Label>
                            <Input
                                type="month"
                                value={formData.month}
                                onChange={e => setFormData({ ...formData, month: e.target.value })}
                                disabled={isReadOnly}
                                className={isReadOnly ? "bg-slate-50" : ""}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>تاريخ القيد</Label>
                            <Input
                                type="date"
                                value={formData.paymentDate}
                                onChange={e => setFormData({ ...formData, paymentDate: e.target.value })}
                                disabled={isReadOnly}
                                className={isReadOnly ? "bg-slate-50" : ""}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded">
                            <h3 className="font-bold text-slate-700">بنود الراتب</h3>
                            {!isReadOnly && (
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200" onClick={() => addLine('earning')}>
                                        <Plus className="w-3 h-3 mr-1" /> إضافة استحقاق
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => addLine('deduction')}>
                                        <Plus className="w-3 h-3 mr-1" /> إضافة استقطاع
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="px-4 py-2 text-right">النوع</th>
                                        <th className="px-4 py-2 text-right">الحساب</th>
                                        <th className="px-4 py-2 text-right">البيان</th>
                                        <th className="px-4 py-2 text-right">المبلغ</th>
                                        <th className="px-4 py-2"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.lines.map((line) => (
                                        <tr key={line.id} className="border-b last:border-0 hover:bg-slate-50/50">
                                            <td className="px-4 py-2 w-32">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                                    line.type === 'earning' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                                                )}>
                                                    {line.type === 'earning' ? 'استحقاق (+)' : 'استقطاع (-)'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 w-64">
                                                <AccountSelector
                                                    accounts={accounts}
                                                    value={line.accountId}
                                                    onChange={(v) => line.id && updateLine(line.id, { accountId: v })}
                                                    className={cn("h-9 py-1", isReadOnly && "bg-transparent border-none opacity-100 px-0")} // Cleaner logic for read-only
                                                    disabled={isReadOnly}
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <Input
                                                    value={line.description}
                                                    onChange={e => line.id && updateLine(line.id, { description: e.target.value })}
                                                    className={cn("h-9", isReadOnly && "border-none bg-transparent px-0")}
                                                    placeholder="وصف البند..."
                                                    disabled={isReadOnly}
                                                />
                                            </td>
                                            <td className="px-4 py-2 w-32">
                                                <Input
                                                    type="number"
                                                    value={line.amount || ''}
                                                    onChange={e => line.id && updateLine(line.id, { amount: Number(e.target.value) })}
                                                    className={cn("h-9 font-mono font-bold text-slate-700", isReadOnly && "border-none bg-transparent px-0")}
                                                    placeholder="0.00"
                                                    disabled={isReadOnly}
                                                />
                                            </td>
                                            <td className="px-2 py-2 w-10">
                                                {!isReadOnly && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => line.id && removeLine(line.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {formData.lines.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8 text-slate-400">
                                                لا توجد بنود. أضف استحقاقات أو استقطاعات.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="pt-6 border-t">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                            <div className="p-3 bg-emerald-50 rounded border border-emerald-100 text-center">
                                <div className="text-xs text-emerald-600 mb-1">إجمالي الاستحقاقات</div>
                                <div className="font-bold text-lg font-mono text-emerald-700">{formatCurrency(totalEarnings)}</div>
                            </div>
                            <div className="p-3 bg-red-50 rounded border border-red-100 text-center">
                                <div className="text-xs text-red-600 mb-1">إجمالي الاستقطاعات</div>
                                <div className="font-bold text-lg font-mono text-red-700">{formatCurrency(totalDeductions)}</div>
                            </div>
                            <div className="p-3 bg-blue-50 rounded border border-blue-100 text-center md:col-span-1 col-span-2">
                                <div className="text-xs text-blue-600 mb-1">صافي الراتب المستحق</div>
                                <div className="font-bold text-xl font-mono text-blue-800">{formatCurrency(netSalary)}</div>
                            </div>
                        </div>

                        {journalId && (
                            <div className="mt-4 p-3 bg-slate-50 border rounded-lg flex items-center justify-between">
                                <span className="text-sm text-slate-600 font-medium">تم ترحيل هذه القسيمة إلى قيد يومية:</span>
                                <Button variant="link" className="text-blue-600 font-mono font-bold h-auto p-0" onClick={() => router.push(`/accounting/journal-entries/${journalId}`)}>
                                    عرض القيد <ExternalLink className="w-3 h-3 ml-1" />
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>

                <CardFooter className="flex gap-4">
                    {!isReadOnly ? (
                        <>
                            {slipId && (
                                <Button
                                    variant="outline"
                                    className="h-12 px-4 text-red-500 border-red-200 hover:bg-red-50"
                                    onClick={handleDelete}
                                    disabled={loading}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                className="flex-1 h-12 text-lg border-slate-300"
                                onClick={() => handleSave('draft')}
                                disabled={loading}
                            >
                                <Save className="w-4 h-4 mr-2" />
                                حفظ كمسودة
                            </Button>
                            <Button
                                className="flex-[2] h-12 text-lg bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
                                onClick={() => handleSave('post')}
                                disabled={loading}
                            >
                                {loading ? 'جاري التنفيذ...' : 'اعتماد وترحيل القيد المحاسبي'}
                            </Button>
                        </>
                    ) : (
                        <div className="w-full flex justify-between items-center">
                            <span className="text-slate-500 text-sm">هذا المستند للقراءة فقط لأنه مُرحل.</span>
                            <Button variant="outline" onClick={() => router.push('/accounting/payroll/history')}>
                                عودة للقائمة
                            </Button>
                        </div>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}

export default function PayrollPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center text-slate-400">جاري التحميل...</div>}>
            <PayrollContent />
        </Suspense>
    );
}
