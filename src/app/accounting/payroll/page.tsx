
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getEmployees, getExpenseAccounts, getAssetAccounts, createPayslip } from '@/lib/payroll-actions';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Wallet, Calculator, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PayrollPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    // Data lists
    const [employees, setEmployees] = useState<any[]>([]);
    const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
    const [assetAccounts, setAssetAccounts] = useState<any[]>([]);

    // Form Data
    const [formData, setFormData] = useState({
        employeeId: '',
        month: new Date().toISOString().slice(0, 7), // YYYY-MM
        paymentDate: new Date().toISOString().split('T')[0],

        basicSalary: 0,
        basicSalaryAccountId: '',

        overtime: 0,
        overtimeAccountId: '',

        absence: 0,
        absenceAccountId: '', // Optional deduction account

        advances: 0,
        advancesAccountId: '',

        otherDeductions: 0,
        notes: ''
    });

    const netSalary = (formData.basicSalary + formData.overtime) - (formData.absence + formData.advances + formData.otherDeductions);

    useEffect(() => {
        Promise.all([
            getEmployees(),
            getExpenseAccounts(),
            getAssetAccounts()
        ]).then(([emps, exps, assets]) => {
            setEmployees(emps || []);
            setExpenseAccounts(exps || []);
            setAssetAccounts(assets || []);

            // Set defaults if possible logic...
        });
    }, []);

    // Set default salary account when loading
    useEffect(() => {
        if (expenseAccounts.length > 0 && !formData.basicSalaryAccountId) {
            const salariesAcc = expenseAccounts.find(a => a.name_ar.includes('رواتب') || a.account_code === '5100'); // Example
            if (salariesAcc) setFormData(prev => ({ ...prev, basicSalaryAccountId: salariesAcc.id }));
        }
    }, [expenseAccounts]);

    const handleSubmit = async () => {
        if (!formData.employeeId) {
            toast({ title: 'خطأ', description: 'يجب اختيار موظف', variant: 'destructive' });
            return;
        }

        setLoading(true);
        try {
            await createPayslip({
                employeeId: formData.employeeId,
                period: formData.month,
                paymentDate: formData.paymentDate,

                basicSalary: formData.basicSalary,
                basicSalaryAccountId: formData.basicSalaryAccountId,

                overtime: formData.overtime,
                overtimeAccountId: formData.overtimeAccountId,

                absence: formData.absence,
                absenceAccountId: formData.absenceAccountId || undefined,

                advances: formData.advances,
                advancesAccountId: formData.advancesAccountId,

                otherDeductions: formData.otherDeductions,
                notes: formData.notes
            });
            toast({ title: 'تم الحفظ', description: 'تم إنشاء قسيمة الراتب والقيد بنجاح' });
            // Reset crucial fields
            setFormData(prev => ({
                ...prev,
                overtime: 0, absence: 0, advances: 0, otherDeductions: 0,
                // keep employee? or reset?
            }));
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">إعداد الرواتب (Payroll)</h1>
                    <p className="text-slate-500">إنشاء قسائم الرواتب الشهرية</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-500" />
                        بيانات القسيمة
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* الأساسيات */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>الموظف</Label>
                            <Select
                                value={formData.employeeId}
                                onValueChange={(v) => {
                                    setFormData({ ...formData, employeeId: v });
                                    // Could fetch default salary from description/db
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر الموظف" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name_ar}</SelectItem>)}
                                </SelectContent>
                            </Select>
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
                            <Label>تاريخ القيد</Label>
                            <Input
                                type="date"
                                value={formData.paymentDate}
                                onChange={e => setFormData({ ...formData, paymentDate: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* الاستحقاقات Earnings */}
                        <div className="space-y-4 border rounded-lg p-4 bg-emerald-50/50">
                            <h3 className="font-semibold text-emerald-700 flex items-center gap-2">
                                <Plus className="w-4 h-4" /> الاستحقاقات
                            </h3>

                            <div className="space-y-2">
                                <Label className="text-xs text-slate-500">الراتب الأساسي</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number" className="flex-1" placeholder="0.00"
                                        value={formData.basicSalary}
                                        onChange={e => setFormData({ ...formData, basicSalary: Number(e.target.value) })}
                                    />
                                    <Select
                                        value={formData.basicSalaryAccountId}
                                        onValueChange={v => setFormData({ ...formData, basicSalaryAccountId: v })}
                                    >
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="حساب المصروف" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {expenseAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name_ar}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs text-slate-500">الإضافي</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number" className="flex-1" placeholder="0.00"
                                        value={formData.overtime}
                                        onChange={e => setFormData({ ...formData, overtime: Number(e.target.value) })}
                                    />
                                    <Select
                                        value={formData.overtimeAccountId}
                                        onValueChange={v => setFormData({ ...formData, overtimeAccountId: v })}
                                    >
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="حساب المصروف" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {expenseAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name_ar}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* الاستقطاعات Deductions */}
                        <div className="space-y-4 border rounded-lg p-4 bg-red-50/50">
                            <h3 className="font-semibold text-red-700 flex items-center gap-2">
                                <Wallet className="w-4 h-4" /> الاستقطاعات
                            </h3>

                            <div className="space-y-2">
                                <Label className="text-xs text-slate-500">غياب / جزاءات</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number" className="flex-1" placeholder="0.00"
                                        value={formData.absence}
                                        onChange={e => setFormData({ ...formData, absence: Number(e.target.value) })}
                                    />
                                    <Select
                                        value={formData.absenceAccountId}
                                        onValueChange={v => setFormData({ ...formData, absenceAccountId: v })}
                                    >
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="حساب (اختياري)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">بدون (خصم مباشر)</SelectItem>
                                            {expenseAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name_ar}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs text-slate-500">سلف</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number" className="flex-1" placeholder="0.00"
                                        value={formData.advances}
                                        onChange={e => setFormData({ ...formData, advances: Number(e.target.value) })}
                                    />
                                    <Select
                                        value={formData.advancesAccountId}
                                        onValueChange={v => setFormData({ ...formData, advancesAccountId: v })}
                                    >
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="حساب السلف" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {assetAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name_ar}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs text-slate-500">أخرى</Label>
                                <Input
                                    type="number" placeholder="0.00"
                                    value={formData.otherDeductions}
                                    onChange={e => setFormData({ ...formData, otherDeductions: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t">
                        <div className="flex justify-between items-center p-4 bg-slate-100 rounded-lg">
                            <span className="font-semibold text-lg text-slate-700">صافي الراتب المستحق</span>
                            <span className="font-bold text-2xl text-slate-900 font-mono">
                                {formatCurrency(netSalary)}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            * سيتم ترحيل الصافي إلى حساب الموظف (أجور مستحقة).
                        </p>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button className="w-full h-12 text-lg" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'جاري التنفيذ...' : 'اعتماد وترحيل القسيمة'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
