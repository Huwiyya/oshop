
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, UserPlus, Wallet } from 'lucide-react';
import { getEmployees, createEmployee } from '@/lib/payroll-actions';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { useRouter } from 'next/navigation';

export default function EmployeesPage() {
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchEmployees = async () => {
        setLoading(true);
        const data = await getEmployees();
        setEmployees(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">الموظفين</h1>
                    <p className="text-slate-500">إدارة حسابات الموظفين ومستحقاتهم</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.push('/accounting/payroll')}>
                        <Wallet className="w-4 h-4 mr-2" />
                        الرواتب (Payroll)
                    </Button>
                    <AddEmployeeDialog onSuccess={fetchEmployees} />
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>الاسم</TableHead>
                                <TableHead>كود الحساب</TableHead>
                                <TableHead>ملاحظات (الراتب/الهاتف)</TableHead>
                                <TableHead>الرصيد المستحق (له)</TableHead>
                                <TableHead>الحالة</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {employees.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-10 text-slate-500">
                                        لا يوجد موظفين مسجلين
                                    </TableCell>
                                </TableRow>
                            ) : (
                                employees.map((emp) => (
                                    <TableRow key={emp.id} className="hover:bg-slate-50">
                                        <TableCell className="font-medium flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                <Users className="w-4 h-4" />
                                            </div>
                                            {emp.name_ar}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{emp.account_code}</TableCell>
                                        <TableCell className="text-sm text-slate-500">{emp.description}</TableCell>
                                        <TableCell className={`font-bold font-mono ${Number(emp.current_balance) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                            {formatCurrency(Math.abs(Number(emp.current_balance)))}
                                            <span className="text-xs font-normal text-slate-400 mr-1">
                                                {Number(emp.current_balance) >= 0 ? 'له' : 'عليه'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs">نشط</span>
                                        </TableCell>
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

function AddEmployeeDialog({ onSuccess }: { onSuccess: () => void }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const [formData, setFormData] = useState({ name: '', phone: '', salary: '' });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createEmployee({
                name_ar: formData.name,
                phone: formData.phone,
                salary: Number(formData.salary)
            });
            toast({ title: 'تمت إضافة الموظف بنجاح' });
            setOpen(false);
            setFormData({ name: '', phone: '', salary: '' });
            onSuccess();
        } catch (error: any) {
            toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                    <UserPlus className="w-4 h-4" />
                    موظف جديد
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>إضافة موظف جديد</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>اسم الموظف</Label>
                        <Input
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>رقم الهاتف</Label>
                        <Input
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>الراتب الأساسي (للمعلومات)</Label>
                        <Input
                            type="number"
                            value={formData.salary}
                            onChange={e => setFormData({ ...formData, salary: e.target.value })}
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>حفظ</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
