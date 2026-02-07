
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
import { formatCurrency, cn } from '@/lib/utils';
import { ArrowLeft, Wallet, Calculator, FileText, Plus, Check, ChevronsUpDown, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

// --- Reusable Combobox Component ---
interface ComboboxProps {
    items: { id: string; name_ar: string; account_code?: string }[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    disabled?: boolean;
}

function AccountCombobox({ items, value, onChange, placeholder = "اختر حساب...", searchPlaceholder = "بحث...", disabled = false }: ComboboxProps) {
    const [open, setOpen] = useState(false);

    const selectedItem = items.find(item => item.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                    disabled={disabled}
                >
                    {selectedItem ? (
                        <span className="truncate flex items-center gap-2">
                            {selectedItem.account_code && <span className="text-slate-400 font-mono text-xs">{selectedItem.account_code}</span>}
                            {selectedItem.name_ar}
                        </span>
                    ) : (
                        <span className="text-slate-500">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>لم يتم العثور على نتائج.</CommandEmpty>
                        <CommandGroup>
                            {items.map((item) => (
                                <CommandItem
                                    key={item.id}
                                    value={item.name_ar}
                                    onSelect={() => {
                                        onChange(item.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === item.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex flex-col">
                                        <span className="font-medium">{item.name_ar}</span>
                                        {item.account_code && <span className="text-xs text-slate-400">{item.account_code}</span>}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

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
        absenceAccountId: '',

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
        });
    }, []);

    // Set default salary account when loading
    useEffect(() => {
        if (expenseAccounts.length > 0 && !formData.basicSalaryAccountId) {
            const salariesAcc = expenseAccounts.find(a => a.name_ar.includes('رواتب') || a.account_code === '5100');
            if (salariesAcc) setFormData(prev => ({ ...prev, basicSalaryAccountId: salariesAcc.id }));
        }
    }, [expenseAccounts]);

    const handleSubmit = async (isDraft: boolean) => {
        if (!formData.employeeId) {
            toast({ title: 'خطأ', description: 'يجب اختيار موظف', variant: 'destructive' });
            return;
        }

        // Validation for Post
        if (!isDraft) {
            if (!formData.basicSalaryAccountId) {
                toast({ title: 'خطأ', description: 'يجب اختيار حساب الراتب الأساسي', variant: 'destructive' });
                return;
            }
            if (formData.absence > 0 && (!formData.absenceAccountId || formData.absenceAccountId === 'none')) {
                toast({ title: 'خطأ', description: 'يجب اختيار حساب لخصم الغياب لضمان توازن القيد', variant: 'destructive' });
                return;
            }
            if (formData.advances > 0 && !formData.advancesAccountId) {
                toast({ title: 'خطأ', description: 'يجب اختيار حساب السلف', variant: 'destructive' });
                return;
            }
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
            }, isDraft);

            toast({
                title: isDraft ? 'تم الحفظ' : 'تم الاعتماد',
                description: isDraft ? 'تم حفظ مسودة القسيمة بنجاح' : 'تم اعتماد القسيمة وترحيل القيد بنجاح'
            });

            // Reset crucial fields
            setFormData(prev => ({
                ...prev,
                overtime: 0, absence: 0, advances: 0, otherDeductions: 0,
            }));

        } catch (error: any) {
            console.error(error);
            toast({ title: 'خطأ', description: error.message || 'حدث خطأ ما', variant: 'destructive' });
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
                            <AccountCombobox
                                items={employees}
                                value={formData.employeeId}
                                onChange={(v) => setFormData({ ...formData, employeeId: v })}
                                placeholder="اختر الموظف..."
                                searchPlaceholder="بحث عن موظف..."
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
                                    <div className="w-[200px]">
                                        <AccountCombobox
                                            items={expenseAccounts}
                                            value={formData.basicSalaryAccountId}
                                            onChange={v => setFormData({ ...formData, basicSalaryAccountId: v })}
                                            placeholder="حساب المصروف"
                                        />
                                    </div>
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
                                    <div className="w-[200px]">
                                        <AccountCombobox
                                            items={expenseAccounts}
                                            value={formData.overtimeAccountId}
                                            onChange={v => setFormData({ ...formData, overtimeAccountId: v })}
                                            placeholder="حساب المصروف"
                                        />
                                    </div>
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
                                    <div className="w-[200px]">
                                        <AccountCombobox
                                            items={expenseAccounts} // Usually same as salary expense to reverse it
                                            value={formData.absenceAccountId}
                                            onChange={v => setFormData({ ...formData, absenceAccountId: v })}
                                            placeholder="حساب الخصم"
                                        />
                                    </div>
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
                                    <div className="w-[200px]">
                                        <AccountCombobox
                                            items={assetAccounts}
                                            value={formData.advancesAccountId}
                                            onChange={v => setFormData({ ...formData, advancesAccountId: v })}
                                            placeholder="حساب السلف"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs text-slate-500">أخرى (يجب اختيار حساب غياب لها حالياً)</Label>
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
                <CardFooter className="flex gap-4">
                    <Button
                        variant="outline"
                        className="flex-1 h-12 text-lg border-slate-300"
                        onClick={() => handleSubmit(true)}
                        disabled={loading}
                    >
                        <Save className="w-4 h-4 mr-2" />
                        حفظ مسودة
                    </Button>
                    <Button
                        className="flex-[2] h-12 text-lg"
                        onClick={() => handleSubmit(false)}
                        disabled={loading}
                    >
                        {loading ? 'جاري التنفيذ...' : 'اعتماد وترحيل القيد'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
