
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoreHorizontal, PlusCircle, Trash2, Loader2, TrendingDown, Search, Calendar as CalendarIcon, Filter, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { Expense } from '@/lib/types';
import { getExpenses, addExpense, deleteExpense } from '@/lib/actions';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';


const AdminExpensesPage = () => {
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [currentExpense, setCurrentExpense] = useState<Expense | null>(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();


  const fetchExpenses = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedExpenses = await getExpenses();
      setExpenses(fetchedExpenses);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل تحميل قائمة المصروفات.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const filteredExpenses = useMemo(() => {
    let dateFilteredExpenses = expenses;
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    const now = new Date();

    switch (filterType) {
      case 'daily': startDate = startOfDay(now); endDate = endOfDay(now); break;
      case 'weekly': startDate = startOfWeek(now, { locale: ar }); endDate = endOfWeek(now, { locale: ar }); break;
      case 'monthly': startDate = startOfMonth(now); endDate = endOfMonth(now); break;
      case 'custom':
        if (dateRange?.from) startDate = startOfDay(dateRange.from);
        if (dateRange?.to) endDate = endOfDay(dateRange.to);
        else if (dateRange?.from) endDate = endOfDay(dateRange.from);
        break;
    }

    if (startDate && endDate) {
      dateFilteredExpenses = expenses.filter(d => {
        const dDate = parseISO(d.date);
        return dDate >= startDate! && dDate <= endDate!;
      });
    }

    if (!searchQuery) return dateFilteredExpenses;

    return dateFilteredExpenses.filter(expense =>
      expense.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [expenses, searchQuery, filterType, dateRange]);


  const openDialog = () => {
    setDescription('');
    setAmount(0);
    setIsDialogOpen(true);
  };

  const openDeleteConfirm = (expense: Expense) => {
    setCurrentExpense(expense);
    setIsDeleteConfirmOpen(true);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!description || amount <= 0) {
      toast({ title: "خطأ", description: "الرجاء إدخال وصف ومبلغ صحيح.", variant: 'destructive' });
      return;
    }

    try {
      const newExpenseData: Omit<Expense, 'id'> = {
        description,
        amount,
        date: new Date().toISOString(),
      };
      const newExpense = await addExpense(newExpenseData);
      if (newExpense) {
        setExpenses(prev => [newExpense, ...prev]);
        toast({ title: "تم إضافة المصروف بنجاح" });
      } else {
        throw new Error("Failed to create expense");
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: "حدث خطأ", description: "فشل حفظ المصروف.", variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (currentExpense) {
      try {
        await deleteExpense(currentExpense.id);
        setExpenses(expenses.filter(e => e.id !== currentExpense.id));
        toast({ title: "تم حذف المصروف" });
      } catch (error) {
        toast({ title: "حدث خطأ", description: "فشل حذف المصروف.", variant: 'destructive' });
      }
    }
    setIsDeleteConfirmOpen(false);
    setCurrentExpense(null);
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

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">إدارة المصروفات</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" onClick={openDialog}>
              <PlusCircle className="h-4 w-4" />
              إضافة مصروف
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]" dir='rtl'>
            <form onSubmit={handleSave}>
              <DialogHeader>
                <DialogTitle>إضافة مصروف جديد</DialogTitle>
                <DialogDescription>
                  املأ المعلومات أدناه لتسجيل مصروف جديد في النظام.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 text-right">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">الوصف</Label>
                  <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="amount" className="text-right">المبلغ (د.ل)</Label>
                  <Input id="amount" type="number" value={amount || ''} onChange={(e) => setAmount(e.target.value === '' ? 0 : parseFloat(e.target.value))} className="col-span-3" dir="ltr" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">حفظ</Button>
                <Button type="button" variant="secondary" onClick={() => setIsDialogOpen(false)}>إلغاء</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm font-medium">إجمالي المصروفات</CardTitle>
            <CardDescription className="text-xs">{getFilterLabel()}</CardDescription>
          </div>
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{totalExpenses.toFixed(2)} د.ل</div>
          <p className="text-xs text-muted-foreground">مجموع المصروفات المسجلة في الفترة المحددة</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>قائمة المصروفات</CardTitle>
              <CardDescription>هنا يمكنك عرض وإدارة جميع المصروفات المسجلة.</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Input
                placeholder="ابحث بالوصف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-4">
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
                <TableHead className='text-right'>الوصف</TableHead>
                <TableHead className='text-right'>التاريخ</TableHead>
                <TableHead className='text-right'>المبلغ</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : filteredExpenses.length > 0 ? filteredExpenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{expense.description}</TableCell>
                  <TableCell>{format(new Date(expense.date), "yyyy/MM/dd - hh:mm a")}</TableCell>
                  <TableCell className="font-semibold text-destructive">{expense.amount.toFixed(2)} د.ل</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => openDeleteConfirm(expense)} className="text-destructive focus:bg-destructive/30 focus:text-destructive-foreground">
                          <Trash2 className="ml-2 h-4 w-4" />
                          حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={4} className="text-center py-10">لم يتم تسجيل أي مصروفات في هذه الفترة.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent dir='rtl'>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من رغبتك في حذف هذا المصروف؟ لا يمكن التراجع عن هذا الإجراء.
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

export default AdminExpensesPage;
