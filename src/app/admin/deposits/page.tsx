
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
import { MoreHorizontal, PlusCircle, Trash2, Loader2, HandCoins, CheckCircle, Clock, XCircle, Search, Calendar as CalendarIcon, Edit, Filter, X, Printer, Check, ChevronsUpDown } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { Badge } from '@/components/ui/badge';
import { Deposit, DepositStatus, Representative, User } from '@/lib/types';
import { getDeposits, addDeposit, deleteDeposit, getRepresentatives, updateDeposit, getUsers } from '@/lib/actions';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ar } from 'date-fns/locale';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";

const statusConfig: { [key in DepositStatus]: { text: string; icon: React.ReactNode; className: string } } = {
    pending: { text: 'قيد الانتظار', icon: <Clock className="w-4 h-4" />, className: 'bg-yellow-100 text-yellow-700' },
    collected: { text: 'تم التحصيل', icon: <CheckCircle className="w-4 h-4" />, className: 'bg-green-100 text-green-700' },
    cancelled: { text: 'ملغي', icon: <XCircle className="w-4 h-4" />, className: 'bg-red-100 text-red-700' },
};


const AdminDepositsPage = () => {
    const { toast } = useToast();
    const router = useRouter();
    const [allDeposits, setAllDeposits] = useState<Deposit[]>([]);
    const [representatives, setRepresentatives] = useState<Representative[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [currentDeposit, setCurrentDeposit] = useState<Deposit | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    // Combobox state
    const [openCombobox, setOpenCombobox] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');


    const fetchInitialData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [fetchedDeposits, fetchedReps, fetchedUsers] = await Promise.all([
                getDeposits(),
                getRepresentatives(),
                getUsers()
            ]);
            setAllDeposits(fetchedDeposits);
            setRepresentatives(fetchedReps);
            setUsers(fetchedUsers);
        } catch (error) {
            toast({ title: "خطأ", description: "فشل تحميل البيانات.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);


    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const filteredDeposits = useMemo(() => {
        let dateFilteredDeposits = allDeposits;
        let startDate: Date | null = null;
        let endDate: Date | null = null;
        const now = new Date();

        switch (filterType) {
            case 'daily':
                startDate = startOfDay(now);
                endDate = endOfDay(now);
                break;
            case 'weekly':
                startDate = startOfWeek(now, { locale: ar });
                endDate = endOfWeek(now, { locale: ar });
                break;
            case 'monthly':
                startDate = startOfMonth(now);
                endDate = endOfMonth(now);
                break;
            case 'custom':
                if (dateRange?.from) startDate = startOfDay(dateRange.from);
                if (dateRange?.to) endDate = endOfDay(dateRange.to);
                else if (dateRange?.from) endDate = endOfDay(dateRange.from);
                break;
        }

        if (startDate && endDate) {
            dateFilteredDeposits = allDeposits.filter(d => {
                const dDate = parseISO(d.date);
                return dDate >= startDate! && dDate <= endDate!;
            });
        }

        if (!searchQuery) return dateFilteredDeposits;

        return dateFilteredDeposits.filter(deposit => {
            const query = searchQuery.toLowerCase();
            return (
                deposit.customerName.toLowerCase().includes(query) ||
                deposit.customerPhone.toLowerCase().includes(query) ||
                deposit.receiptNumber.toLowerCase().includes(query)
            );
        });
    }, [allDeposits, searchQuery, filterType, dateRange]);


    const openDialog = (deposit: Deposit | null = null) => {
        setCurrentDeposit(deposit);
        if (deposit) {
            setCustomerName(deposit.customerName);
            setCustomerPhone(deposit.customerPhone);
            // Try to find matching user? Maybe too complex to auto-match back to user ID since we don't store user ID in deposit.
            // Just set text fields.
            setSelectedUser(null);
        } else {
            setCustomerName('');
            setCustomerPhone('');
            setSelectedUser(null);
        }
        setIsDialogOpen(true);
    };

    const openDeleteConfirm = (deposit: Deposit) => {
        setCurrentDeposit(deposit);
        setIsDeleteConfirmOpen(true);
    };

    const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const repValue = formData.get('representativeId') as string | null;
        const repId = (repValue === 'none' || !repValue) ? null : repValue;
        const selectedRep = representatives.find(r => r.id === repId);

        const depositData: Partial<Deposit> = {
            customerName: formData.get('customerName') as string,
            customerPhone: formData.get('customerPhone') as string,
            amount: (formData.get('amount') as string) === '' ? 0 : parseFloat(formData.get('amount') as string),
            description: formData.get('description') as string,
            representativeId: repId,
            representativeName: selectedRep?.name || null,
        };

        if (currentDeposit) {
            // Update logic
            const success = await updateDeposit(currentDeposit.id, depositData);
            if (success) {
                toast({ title: "تم تحديث العربون بنجاح" });
                fetchInitialData();
                setIsDialogOpen(false);
            } else {
                toast({ title: "حدث خطأ", description: "فشل تحديث العربون.", variant: 'destructive' });
            }
        } else {
            // Add logic
            const newDepositData: Omit<Deposit, 'id' | 'receiptNumber' | 'collectedDate'> = {
                ...(depositData as any),
                date: new Date().toISOString(),
                status: 'pending',
                collectedBy: repId ? 'representative' : 'admin',
            };
            const result = await addDeposit(newDepositData);
            if (result) {
                toast({ title: "تم إضافة العربون بنجاح" });
                fetchInitialData();
                setIsDialogOpen(false);
            } else {
                toast({ title: "حدث خطأ", description: "فشل حفظ العربون.", variant: 'destructive' });
            }
        }
    };

    const handleDelete = async () => {
        if (currentDeposit) {
            const success = await deleteDeposit(currentDeposit.id);
            if (success) {
                toast({ title: "تم حذف العربون" });
                fetchInitialData();
            } else {
                toast({ title: "حدث خطأ", description: "فشل حذف العربون.", variant: 'destructive' });
            }
        }
        setIsDeleteConfirmOpen(false);
        setCurrentDeposit(null);
    };

    const handleFilterChange = (type: string) => {
        setFilterType(type);
        if (type !== 'custom') {
            setDateRange(undefined);
        }
    }

    const handleDateRangeSelect = (range: DateRange | undefined) => {
        setDateRange(range);
        setFilterType('custom');
    }

    const handlePrint = (depositId: string) => {
        const printUrl = `/admin/deposits/print/${depositId}`;
        window.open(printUrl, '_blank', 'height=842,width=595,resizable=yes,scrollbars=yes');
    };

    const getFilterLabel = () => {
        switch (filterType) {
            case 'daily': return `اليوم: ${format(new Date(), 'd MMMM yyyy', { locale: ar })}`;
            case 'weekly': return 'هذا الأسبوع';
            case 'monthly': return 'هذا الشهر';
            case 'custom':
                if (dateRange?.from && dateRange?.to) {
                    return `${format(dateRange.from, 'd MMM', { locale: ar })} - ${format(dateRange.to, 'd MMM yyyy', { locale: ar })}`;
                }
                if (dateRange?.from) return `تاريخ: ${format(dateRange.from, 'd MMMM yyyy', { locale: ar })}`;
                return 'فترة مخصصة';
            default: return 'عرض كل السجلات';
        }
    }

    const totalCollected = filteredDeposits.filter(d => d.status === 'collected').reduce((sum, d) => sum + d.amount, 0);

    return (
        <div className="p-4 sm:p-6" dir="rtl">
            <div className="flex items-center justify-between mb-6 print:hidden">
                <h1 className="text-2xl font-bold">سجل العربون</h1>
                <Button size="sm" className="gap-1" onClick={() => openDialog()}>
                    <PlusCircle className="h-4 w-4" />
                    إضافة عربون
                </Button>
            </div>

            <Card className="mb-6 print-section">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                        <CardTitle className="text-sm font-medium">إجمالي العربون المحصّل</CardTitle>
                        <CardDescription className="text-xs">{getFilterLabel()}</CardDescription>
                    </div>
                    <HandCoins className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-primary">{totalCollected.toFixed(2)} د.ل</div>
                    <p className="text-xs text-muted-foreground">لا يتم إدراج هذا المبلغ في التقارير المالية العامة</p>
                </CardContent>
            </Card>

            <Card className="print-section">
                <CardHeader className="print:hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>قائمة العربون</CardTitle>
                            <CardDescription>هنا يمكنك عرض وإدارة جميع سجلات العربون.</CardDescription>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-72">
                                <Input
                                    placeholder="ابحث بالاسم، الهاتف، أو الرقم..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pr-10"
                                />
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-4 print:hidden">
                        <Filter className="w-5 h-5 text-muted-foreground" />
                        <Button variant={filterType === 'all' ? 'default' : 'outline'} size="sm" onClick={() => handleFilterChange('all')}>الكل</Button>
                        <Button variant={filterType === 'daily' ? 'default' : 'outline'} size="sm" onClick={() => handleFilterChange('daily')}>اليوم</Button>
                        <Button variant={filterType === 'weekly' ? 'default' : 'outline'} size="sm" onClick={() => handleFilterChange('weekly')}>أسبوعي</Button>
                        <Button variant={filterType === 'monthly' ? 'default' : 'outline'} size="sm" onClick={() => handleFilterChange('monthly')}>شهري</Button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant={"outline"}
                                    size="sm"
                                    className={cn("w-[240px] justify-start text-right font-normal", filterType === 'custom' && "border-primary")}
                                >
                                    <CalendarIcon className="ml-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>{format(dateRange.from, "d MMM", { locale: ar })} - {format(dateRange.to, "d MMM yyyy", { locale: ar })}</>
                                        ) : (format(dateRange.from, "d MMMM yyyy", { locale: ar }))
                                    ) : (<span>فترة مخصصة</span>)}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={handleDateRangeSelect}
                                    numberOfMonths={2}
                                    locale={ar}
                                />
                            </PopoverContent>
                        </Popover>
                        {dateRange && (
                            <Button variant="ghost" size="icon" onClick={() => { setDateRange(undefined); setFilterType('all'); }}>
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className='text-right'>الرقم الاشاري</TableHead>
                                <TableHead className='text-right'>العميل</TableHead>
                                <TableHead className='text-right'>التاريخ</TableHead>
                                <TableHead className='text-right'>المبلغ</TableHead>
                                <TableHead className='text-right'>المندوب</TableHead>
                                <TableHead className='text-right'>الحالة</TableHead>
                                <TableHead className="print:hidden"><span className="sr-only">Actions</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : filteredDeposits.length > 0 ? filteredDeposits.map((deposit) => (
                                <TableRow key={deposit.id}>
                                    <TableCell className="font-mono">#{deposit.receiptNumber}</TableCell>
                                    <TableCell className="font-medium">{deposit.customerName}</TableCell>
                                    <TableCell>{format(new Date(deposit.date), "yyyy/MM/dd")}</TableCell>
                                    <TableCell className="font-semibold">{deposit.amount.toFixed(2)} د.ل</TableCell>
                                    <TableCell>{deposit.representativeName || 'إدارة'}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`font-normal ${statusConfig[deposit.status].className}`}>
                                            {statusConfig[deposit.status].icon}
                                            <span className="mr-1">{statusConfig[deposit.status].text}</span>
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="print:hidden">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                    <span className="sr-only">Toggle menu</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                                                <DropdownMenuItem
                                                    onSelect={() => openDialog(deposit)}
                                                    disabled={deposit.status === 'collected'}
                                                >
                                                    <Edit className="ml-2 h-4 w-4" />
                                                    تعديل
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handlePrint(deposit.id)}>
                                                    <Printer className="ml-2 h-4 w-4" />
                                                    طباعة الإيصال
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onSelect={() => openDeleteConfirm(deposit)}
                                                    className="text-destructive focus:bg-destructive/30 focus:text-destructive-foreground"
                                                    disabled={deposit.status === 'collected'}
                                                >
                                                    <Trash2 className="ml-2 h-4 w-4" />
                                                    حذف
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={7} className="text-center py-10">لم يتم تسجيل أي عربون في هذه الفترة.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if (!isOpen) setCurrentDeposit(null); }}>
                <DialogContent className="sm:max-w-md" dir='rtl'>
                    <form onSubmit={handleSave}>
                        <DialogHeader>
                            <DialogTitle>{currentDeposit ? 'تعديل عربون' : 'إضافة عربون جديد'}</DialogTitle>
                            <DialogDescription>
                                املأ المعلومات أدناه. يمكنك إسناده إلى مندوب أو تسجيله كتحصيل إداري.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4 text-right">
                            {/* User Search Combobox */}
                            <div className="space-y-2">
                                <Label>بحث عن عميل (اختياري)</Label>
                                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={openCombobox}
                                            className="w-full justify-between"
                                        >
                                            {selectedUser ? selectedUser.name : "اختر عميلاً..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-full p-0">
                                        <Command>
                                            <CommandInput placeholder="بحث عن عميل..." />
                                            <CommandList>
                                                <CommandEmpty>لم يتم العثور على عميل.</CommandEmpty>
                                                <CommandGroup>
                                                    {users.map((user) => (
                                                        <CommandItem
                                                            key={user.id}
                                                            value={`${user.name} ${user.phone}`}
                                                            onSelect={() => {
                                                                setSelectedUser(user);
                                                                setCustomerName(user.name);
                                                                setCustomerPhone(user.phone);
                                                                setOpenCombobox(false);
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedUser?.id === user.id ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            {user.name} ({user.phone})
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="customerName">اسم العميل</Label>
                                <Input
                                    id="customerName"
                                    name="customerName"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="customerPhone">رقم هاتف العميل</Label>
                                <Input
                                    id="customerPhone"
                                    name="customerPhone"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount">المبلغ (د.ل)</Label>
                                <Input id="amount" name="amount" type="number" step="0.01" dir="ltr" defaultValue={currentDeposit?.amount} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">الوصف</Label>
                                <Textarea id="description" name="description" placeholder="وصف موجز لسبب العربون..." defaultValue={currentDeposit?.description} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="representativeId">إسناد إلى مندوب (اختياري)</Label>
                                <Select name="representativeId" defaultValue={currentDeposit?.representativeId || 'none'}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر مندوبًا أو اتركه فارغًا" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">لا يوجد (تحصيل إداري)</SelectItem>
                                        {representatives.map(rep => (
                                            <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit">حفظ</Button>
                            <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <DialogContent dir='rtl'>
                    <DialogHeader>
                        <DialogTitle>تأكيد الحذف</DialogTitle>
                        <DialogDescription>
                            هل أنت متأكد من رغبتك في حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.
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

export default AdminDepositsPage;

