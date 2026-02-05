
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Trash2, Edit, Building, User, Info, Loader2, MoreVertical, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { Creditor } from '@/lib/types';
import { getCreditors, addCreditor, updateCreditor, deleteCreditor } from '@/lib/actions';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';


const AdminCreditorsPage = () => {
    const { toast } = useToast();
    const router = useRouter();
    const [creditors, setCreditors] = useState<Creditor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [currentCreditor, setCurrentCreditor] = useState<Creditor | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchCreditors = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedCreditors = await getCreditors();
            setCreditors(fetchedCreditors.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            toast({
                title: "خطأ",
                description: "فشل تحميل قائمة الذمم.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchCreditors();
    }, [fetchCreditors]);

    const filteredCreditors = useMemo(() => {
        let filtered = creditors;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(c => c.name.toLowerCase().includes(query));
        }

        return filtered;
    }, [creditors, searchQuery]);

    const openDialog = (creditor: Creditor | null = null) => {
        setCurrentCreditor(creditor);
        setIsDialogOpen(true);
    };

    const openDeleteConfirm = (creditor: Creditor) => {
        setCurrentCreditor(creditor);
        setIsDeleteConfirmOpen(true);
    };

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string;

        if (!name) {
            toast({ title: "خطأ", description: "الرجاء إدخال اسم.", variant: 'destructive' });
            return;
        }

        const creditorData: Partial<Omit<Creditor, 'id' | 'totalDebt'>> = {
            name,
            type: formData.get('type') as 'company' | 'person',
            contactInfo: formData.get('contactInfo') as string,
            currency: formData.get('currency') as 'LYD' | 'USD',
        };

        const initialBalance = (formData.get('initialBalance') as string) === '' ? 0 : parseFloat(formData.get('initialBalance') as string);

        try {
            if (currentCreditor) {
                await updateCreditor(currentCreditor.id, creditorData);
                toast({ title: "تم تحديث الملف بنجاح" });
            } else {
                const fullCreditorData: Omit<Creditor, 'id' | 'totalDebt'> = {
                    ...creditorData,
                } as Omit<Creditor, 'id' | 'totalDebt'>;

                await addCreditor(fullCreditorData, initialBalance);
                toast({ title: "تمت إضافة الحساب بنجاح" });
            }
            setIsDialogOpen(false);
            fetchCreditors();
        } catch (error) {
            console.error("Error saving creditor:", error);
            toast({ title: "حدث خطأ", description: "فشل حفظ الملف.", variant: 'destructive' });
        }
    };

    const handleDelete = async () => {
        if (currentCreditor) {
            try {
                await deleteCreditor(currentCreditor.id);
                toast({ title: "تم حذف الحساب وجميع حركاته المالية" });
                fetchCreditors();
            } catch (error) {
                toast({ title: "حدث خطأ", description: "فشل حذف الحساب.", variant: 'destructive' });
            }
        }
        setIsDeleteConfirmOpen(false);
        setCurrentCreditor(null);
    };


    return (
        <div className="p-4 sm:p-6" dir="rtl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">إدارة الذمم المالية</h1>
                <Button size="sm" className="gap-1" onClick={() => openDialog()}>
                    <PlusCircle className="h-4 w-4" />
                    إضافة حساب جديد
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>قائمة الحسابات</CardTitle>
                            <CardDescription>عرض وإدارة ملفات تعريف الشركات والأشخاص الذين تتعامل معهم ماليًا.</CardDescription>
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Input
                                placeholder="ابحث بالاسم..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pr-10"
                            />
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                    ) : filteredCreditors.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredCreditors.map((creditor) => {
                                const totalDebt = creditor.totalDebt || 0;
                                const currencySymbol = creditor.currency === 'USD' ? '$' : 'د.ل';
                                const balanceColor = totalDebt > 0 ? 'text-destructive' : 'text-green-600';
                                const balanceText = totalDebt > 0 ? 'مبلغ عليه' : 'مبلغ له';

                                return (
                                    <Card key={creditor.id} className="hover:shadow-md transition-shadow relative">
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-lg font-bold">{creditor.name}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                {creditor.type === 'company' ? <Building className="h-4 w-4" /> : <User className="h-4 w-4" />}
                                                <span>{creditor.type === 'company' ? 'شركة' : 'شخص'}</span>
                                            </div>
                                            <div className="mt-4 pt-4 border-t">
                                                <p className="text-xs text-muted-foreground">{totalDebt === 0 ? 'الرصيد' : balanceText}</p>
                                                <p className={`text-2xl font-bold ${totalDebt === 0 ? '' : balanceColor}`}>
                                                    {Math.abs(totalDebt).toFixed(2)} {currencySymbol}
                                                </p>
                                            </div>
                                        </CardContent>
                                        <CardContent className="flex gap-2 pt-0">
                                            <Button asChild variant="secondary" className="flex-1">
                                                <Link href={`/admin/creditors/${creditor.id}`}>عرض التفاصيل</Link>
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => openDialog(creditor)}><Edit className="h-4 w-4" /></Button>
                                            <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => openDeleteConfirm(creditor)}><Trash2 className="h-4 w-4" /></Button>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            <p>لم يتم إضافة أي حسابات بعد.</p>
                            <p>انقر على "إضافة حساب جديد" للبدء.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if (!isOpen) setCurrentCreditor(null); }}>
                <DialogContent className="sm:max-w-md" dir='rtl'>
                    <form onSubmit={handleSave}>
                        <DialogHeader>
                            <DialogTitle>{currentCreditor ? 'تعديل ملف' : 'إضافة حساب جديد'}</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4 text-right">
                            <div className="space-y-2">
                                <Label htmlFor="name">الاسم (شخص/شركة)</Label>
                                <Input id="name" name="name" defaultValue={currentCreditor?.name} required />
                            </div>
                            <div className="space-y-2">
                                <Label>النوع</Label>
                                <RadioGroup name="type" defaultValue={currentCreditor?.type || 'person'} className="flex gap-4 pt-2">
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="person" id="person" />
                                        <Label htmlFor="person" className="font-normal">شخص</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="company" id="company" />
                                        <Label htmlFor="company" className="font-normal">شركة</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                            <div className="space-y-2">
                                <Label>عملة الحساب</Label>
                                <RadioGroup name="currency" defaultValue={currentCreditor?.currency || "LYD"} className="flex gap-4 pt-2">
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="LYD" id="lyd" />
                                        <Label htmlFor="lyd" className="font-normal">دينار ليبى (د.ل)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2 space-x-reverse">
                                        <RadioGroupItem value="USD" id="usd" />
                                        <Label htmlFor="usd" className="font-normal">دولار أمريكي ($)</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contactInfo">معلومات الاتصال (اختياري)</Label>
                                <Textarea id="contactInfo" name="contactInfo" defaultValue={currentCreditor?.contactInfo} placeholder="رقم هاتف، بريد إلكتروني، الخ..." />
                            </div>
                            {!currentCreditor && (
                                <div className="space-y-2 p-4 border rounded-md">
                                    <Label htmlFor="initialBalance">مبلغ الرصيد الافتتاحي (اختياري)</Label>
                                    <Input id="initialBalance" name="initialBalance" type="number" step="0.01" dir="ltr" placeholder="0.00" />
                                    <p className="text-xs text-muted-foreground">
                                        أدخل قيمة موجبة إذا كان الحساب مدينًا (عليه مبلغ)، وقيمة سالبة إذا كان دائنًا (له مبلغ).
                                    </p>
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button type="submit">حفظ</Button>
                            <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent dir='rtl'>
                    <DialogHeader>
                        <DialogTitle>تأكيد الحذف</DialogTitle>
                        <DialogDescription>
                            هل أنت متأكد من رغبتك في حذف ملف <span className="font-bold">{currentCreditor?.name}</span>؟
                            سيتم حذف جميع الحركات المالية المسجلة تحته بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="destructive" onClick={handleDelete}>حذف</Button>
                        <Button variant="outline" onClick={() => setIsDeleteConfirmOpen(false)}>إلغاء</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AdminCreditorsPage;
