'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { MoreHorizontal, Trash2, Loader2, ArrowLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { InstantSale } from '@/lib/types';
import { getInstantSales, deleteInstantSale } from '@/lib/actions';
import { format } from "date-fns";
import { useRouter } from 'next/navigation';

const InstantSalesHistoryPage = () => {
  const { toast } = useToast();
  const router = useRouter();
  const [salesHistory, setSalesHistory] = useState<InstantSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentSale, setCurrentSale] = useState<InstantSale | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const history = await getInstantSales();
      setSalesHistory(history);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل تحميل سجل المبيعات.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const openDeleteDialog = (sale: InstantSale) => {
    setCurrentSale(sale);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (currentSale) {
      try {
        await deleteInstantSale(currentSale.id);
        toast({ title: "تم حذف السجل بنجاح" });
        fetchHistory();
      } catch (error) {
        toast({ title: "حدث خطأ", description: "فشل حذف السجل.", variant: 'destructive' });
      }
    }
    setIsDeleteDialogOpen(false);
    setCurrentSale(null);
  };

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-2xl font-bold">سجل المبيعات الفورية</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قائمة العمليات المحفوظة</CardTitle>
          <CardDescription>هنا يمكنك عرض جميع عمليات التسعير التي قمت بحفظها.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='text-right'>تاريخ الحفظ</TableHead>
                <TableHead className='text-right'>اسم المنتج</TableHead>
                <TableHead className='text-right text-destructive'>التكلفة (د.ل)</TableHead>
                <TableHead className='text-right text-green-600'>البيع (د.ل)</TableHead>
                <TableHead className='text-right text-primary'>صافي الربح</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : salesHistory.length > 0 ? salesHistory.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>{format(new Date(sale.createdAt), "yyyy/MM/dd")}</TableCell>
                  <TableCell className="font-medium">{sale.productName || 'منتج غير مسمى'}</TableCell>
                  <TableCell className="text-destructive font-semibold">{sale.totalCostLYD.toFixed(2)} د.ل</TableCell>
                  <TableCell className="text-green-600 font-semibold">{sale.finalSalePriceLYD.toFixed(2)} د.ل</TableCell>
                  <TableCell className="text-primary font-bold">{sale.netProfit.toFixed(2)} د.ل</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-haspopup="true" size="icon" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Toggle menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => openDeleteDialog(sale)} className="text-destructive focus:bg-destructive/30 focus:text-destructive-foreground">
                          <Trash2 className="ml-2 h-4 w-4" />
                          حذف
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="text-center py-10">لم يتم حفظ أي عمليات بعد.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent dir='rtl'>
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من رغبتك في حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDelete}>حذف</Button>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstantSalesHistoryPage;
