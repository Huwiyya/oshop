// This file was created by the AI to enable the feature.
// It can be removed if it's not needed.
'use client';

import React, { useState } from 'react';
import { Creditor, ExternalDebt } from '@/lib/types';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ArrowLeft,
  DollarSign,
  PlusCircle,
  Trash2,
  FileDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from "@/components/ui/use-toast";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { addExternalDebt, deleteExternalDebt } from '@/lib/actions';
import Link from 'next/link';

interface CreditorDetailsProps {
    initialCreditor: Creditor;
    initialDebts: ExternalDebt[];
}

export function CreditorDetails({ initialCreditor, initialDebts }: CreditorDetailsProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [creditor, setCreditor] = useState(initialCreditor);
    const [debts, setDebts] = useState(initialDebts);
    const [isDebtDialogOpen, setIsDebtDialogOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [currentDebt, setCurrentDebt] = useState<ExternalDebt | null>(null);

    const openDebtDialog = (debt: ExternalDebt | null = null) => {
        setCurrentDebt(debt);
        setIsDebtDialogOpen(true);
    };

    const openDeleteConfirm = (debt: ExternalDebt) => {
        setCurrentDebt(debt);
        setIsDeleteConfirmOpen(true);
    };
    
    const handleSaveDebt = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const amount = parseFloat(formData.get('amount') as string);
        const type = formData.get('type') as 'debit' | 'credit';

        if (isNaN(amount) || amount <= 0) {
            toast({ title: "خطأ", description: "الرجاء إدخال مبلغ صحيح.", variant: 'destructive' });
            return;
        }
        
        // debit means the entity owes us more (positive amount)
        // credit means we owe the entity more, or they paid us (negative amount)
        const finalAmount = type === 'debit' ? amount : -amount;

        const debtData: Omit<ExternalDebt, 'id'> = {
            creditorId: creditor.id,
            creditorName: creditor.name,
            amount: finalAmount,
            date: new Date().toISOString(),
            status: 'pending',
            notes: formData.get('notes') as string,
        };

        try {
            const newDebt = await addExternalDebt(debtData);
            if (newDebt) {
                setDebts(prev => [newDebt, ...prev]);
                // Refetch creditor to get updated totalDebt
                const updatedCreditor = { ...creditor, totalDebt: creditor.totalDebt + newDebt.amount };
                setCreditor(updatedCreditor);
                toast({ title: "تمت إضافة الحركة المالية بنجاح" });
            }
            setIsDebtDialogOpen(false);
            setCurrentDebt(null);
        } catch (error) {
            console.error("Failed to save debt:", error);
            toast({ title: "خطأ", description: "فشل حفظ الحركة المالية.", variant: 'destructive' });
        }
    };
    
    const handleDeleteDebt = async () => {
        if (currentDebt) {
            const success = await deleteExternalDebt(currentDebt.id);
            if(success) {
                setDebts(debts.filter(d => d.id !== currentDebt.id));
                const updatedCreditor = { ...creditor, totalDebt: creditor.totalDebt - currentDebt.amount };
                setCreditor(updatedCreditor);
                toast({ title: "تم حذف الحركة المالية" });
            } else {
                toast({ title: "خطأ", description: "فشل حذف الحركة.", variant: 'destructive' });
            }
        }
        setIsDeleteConfirmOpen(false);
        setCurrentDebt(null);
    }
    
    const currencySymbol = creditor.currency === 'USD' ? '$' : 'د.ل';
    const totalDebt = creditor.totalDebt || 0;
    const balanceText = totalDebt >= 0 ? 'المبلغ المستحق عليه' : 'المبلغ المستحق له';
    const balanceColor = totalDebt >= 0 ? 'text-destructive' : 'text-green-600';


    return (
        <>
            <div className="flex justify-between items-center mb-6">
                 <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">{creditor.name}</h1>
                        <p className="text-sm text-muted-foreground">{creditor.type === 'company' ? 'شركة' : 'شخص'}</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-2">
                     <Button asChild variant="outline">
                        <Link href={`/admin/creditors/print/${creditor.id}`} target="_blank">
                             <FileDown className="ml-2 h-4 w-4" />
                             تنزيل كشف حساب
                        </Link>
                    </Button>
                 </div>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>الملخص المالي</CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-sm text-muted-foreground">{totalDebt === 0 ? "الرصيد الحالي" : balanceText}</p>
                    <p className={`text-4xl font-bold ${totalDebt === 0 ? '' : balanceColor}`}>
                        {Math.abs(totalDebt).toFixed(2)} {currencySymbol}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle>كشف الحساب</CardTitle>
                     <Button size="sm" className="gap-1" onClick={() => openDebtDialog()}>
                        <PlusCircle className="h-4 w-4" />
                        إضافة حركة مالية
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>التاريخ</TableHead>
                                <TableHead>البيان</TableHead>
                                <TableHead>مدين (عليه)</TableHead>
                                <TableHead>دائن (له)</TableHead>
                                <TableHead><span className="sr-only">Actions</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {debts.length > 0 ? debts.map(debt => {
                                const isDebit = debt.amount > 0;
                                return (
                                    <TableRow key={debt.id}>
                                        <TableCell>{format(new Date(debt.date), 'yyyy/MM/dd')}</TableCell>
                                        <TableCell>{debt.notes}</TableCell>
                                        <TableCell className="text-destructive font-semibold">
                                            {isDebit ? `${Math.abs(debt.amount).toFixed(2)} ${currencySymbol}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-green-600 font-semibold">
                                            {!isDebit ? `${Math.abs(debt.amount).toFixed(2)} ${currencySymbol}` : '-'}
                                        </TableCell>
                                        <TableCell>
                                             <Button variant="ghost" size="icon" onClick={() => openDeleteConfirm(debt)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground h-24">
                                        لا توجد حركات مالية مسجلة.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            
            {/* Debt Dialog */}
             <Dialog open={isDebtDialogOpen} onOpenChange={(isOpen) => { setIsDebtDialogOpen(isOpen); if (!isOpen) setCurrentDebt(null); }}>
                <DialogContent dir="rtl">
                    <form onSubmit={handleSaveDebt}>
                        <DialogHeader>
                            <DialogTitle>إضافة حركة مالية جديدة</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4 text-right">
                             <div className="space-y-2">
                                <Label>نوع الحركة</Label>
                                <RadioGroup name="type" defaultValue="debit" className="flex gap-4 pt-2">
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="debit" id="debit" />
                                        <Label htmlFor="debit" className="font-normal">مدين (زيادة الدين عليه)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="credit" id="credit" />
                                        <Label htmlFor="credit" className="font-normal">دائن (سداد أو زيادة الدين له)</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount">المبلغ</Label>
                                <Input id="amount" name="amount" type="number" step="0.01" dir="ltr" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="notes">البيان / ملاحظات</Label>
                                <Textarea id="notes" name="notes" required />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit">حفظ الحركة</Button>
                            <Button type="button" variant="secondary" onClick={() => setIsDebtDialogOpen(false)}>إلغاء</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Debt Confirmation */}
             <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent dir='rtl'>
                    <DialogHeader>
                        <DialogTitle>تأكيد الحذف</DialogTitle>
                        <DialogDescription>
                            هل أنت متأكد من رغبتك في حذف هذه الحركة المالية؟ سيتم تحديث رصيد الحساب. لا يمكن التراجع عن هذا الإجراء.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="destructive" onClick={handleDeleteDebt}>حذف</Button>
                        <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>إلغاء</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
