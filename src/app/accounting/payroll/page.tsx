
'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getEmployees, createPayslip, getPayslipById, type PayslipLine } from '@/lib/payroll-actions';
import { getAllAccounts } from '@/lib/accounting-actions';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency, cn } from '@/lib/utils';
import { ArrowLeft, Wallet, Calculator, FileText, Plus, Check, ChevronsUpDown, Save, Trash2, History } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AccountSelector } from '@/components/accounting/AccountSelector';

export default function PayrollPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const slipId = searchParams.get('id');
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        employeeId: '',
        month: new Date().toISOString().slice(0, 7),
        paymentDate: new Date().toISOString().split('T')[0],
        lines: [
            { id: Math.random().toString(), accountId: '', description: 'راتب أساسي', amount: 0, type: 'earning' as const }
        ] as (PayslipLine & { id: string })[]
    });

    useEffect(() => {
        Promise.all([
            getEmployees(),
            getAllAccounts(),
            slipId ? getPayslipById(slipId) : Promise.resolve(null)
        ]).then(([emps, accs, existingSlip]) => {
            setEmployees(emps || []);
            setAccounts(accs || []);

            if (existingSlip) {
                setFormData({
                    employeeId: existingSlip.employee_id,
                    month: `${existingSlip.period_year}-${existingSlip.period_month.toString().padStart(2, '0')}`,
                    paymentDate: existingSlip.payment_date || new Date().toISOString().split('T')[0],
                    lines: existingSlip.payroll_slip_lines.map((l: any) => ({
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

    const updateLine = (id: string, updates: Partial<PayslipLine>) => {
        setFormData({
            ...formData,
            lines: formData.lines.map(l => l.id === id ? { ...l, ...updates } : l)
        });
    };

    const handleSubmit = async (isDraft: boolean) => {
        if (!formData.employeeId) return toast({ title: 'خطأ', description: 'يجب اختيار موظف', variant: 'destructive' });
        if (formData.lines.some(l => !l.accountId || l.amount <= 0)) return toast({ title: 'خطأ', description: 'يجب ملء كافة الحسابات والمبالغ في الأسطر', variant: 'destructive' });

        setLoading(true);
        try {
            const employee = employees.find(e => e.id === formData.employeeId);
            await createPayslip({
                slipId: slipId || undefined,
                employeeId: formData.employeeId,
                employeeName: employee?.name_ar || 'Unknown',
                period: formData.month,
                paymentDate: formData.paymentDate,
                basicSalary: formData.lines.find(l => l.description.includes('أساسي'))?.amount || 0,
                netSalary,
                isDraft,
                lines: formData.lines.map(({ id, ...rest }) => rest)
            });

            toast({ title: isDraft ? 'تم الحفظ' : 'تم الاعتماد' });
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
                        <h1 className="text-2xl font-bold">إعداد الرواتب (Payroll)</h1>
                        <p className="text-slate-500">إنشاء قسائم الرواتب الشهرية</p>
                    </div>
                </div>
                <Button variant="outline" className="gap-2" onClick={() => router.push('/accounting/payroll/history')}>
                    <History className="w-4 h-4" />
                    تاريخ القسائم
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        بيانات القسيمة
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
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>عن شهر (الفترة)</Label>
                            <Input
                                type="month"
                                value={formData.month}
                                onChange={e => setFormData({ ...formData, month: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>تاريخ القيد (التحويل)</Label>
                            <Input
                                type="date"
                                value={formData.paymentDate}
                                onChange={e => setFormData({ ...formData, paymentDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded">
                            <h3 className="font-bold text-slate-700">بنود الراتب</h3>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-200" onClick={() => addLine('earning')}>
                                    <Plus className="w-3 h-3 mr-1" /> إضافة استحقاق
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={() => addLine('deduction')}>
                                    <Plus className="w-3 h-3 mr-1" /> إضافة استقطاع
                                </Button>
                            </div>
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
                                        <tr key={line.id} className="border-b last:border-0">
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
                                                    onChange={(v) => updateLine(line.id, { accountId: v })}
                                                    className="h-9 py-1"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <Input
                                                    value={line.description}
                                                    onChange={e => updateLine(line.id, { description: e.target.value })}
                                                    className="h-9"
                                                    placeholder="وصف البند..."
                                                />
                                            </td>
                                            <td className="px-4 py-2 w-32">
                                                <Input
                                                    type="number"
                                                    value={line.amount || ''}
                                                    onChange={e => updateLine(line.id, { amount: Number(e.target.value) })}
                                                    className="h-9 font-mono font-bold"
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td className="px-2 py-2 w-10">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => removeLine(line.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
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
                        <p className="text-xs text-slate-500">
                            * سيتم ترحيل الصافي إلى حساب الموظف المختار (دائن بالصافي).
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="flex gap-4">
                    <Button
                        variant="outline"
                        className="flex-1 h-12 text-lg border-slate-300"
                        onClick={() => handleSubmit(true)}
                        disabled={loading}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        حفظ كمسودة (لمراجعة لاحقاً)
                    </Button>
                    <Button
                        className="flex-[2] h-12 text-lg bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleSubmit(false)}
                        disabled={loading}
                    >
                        {loading ? 'جاري التنفيذ...' : 'اعتماد وترحيل القيد المحاسبي'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
