'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';

// Icons
import {
  Package, Search, PlusCircle, Filter, MoreHorizontal,
  Edit, Trash2, Printer, MapPin, CheckCircle, Clock,
  DollarSign, Truck, Building, Plane, UserPlus, UserX,
  Copy, Loader2, X, Sparkles, Users, RefreshCw, Scale
} from "lucide-react";

import { Order, OrderStatus, Representative, AppSettings } from '@/lib/types';
import {
  getOrders,
  deleteOrder,
  updateOrder,
  getRepresentatives,
  assignRepresentativeToOrder,
  unassignRepresentativeFromOrder,
  bulkAssignRepresentativeToOrder,
  saveOrderWeight
} from '@/lib/actions';

// --- CONFIGURATION ---
const statusConfig: Record<string, { text: string; icon: React.ReactNode; className: string }> = {
  pending: { text: 'قيد التجهيز', icon: <Clock className="w-4 h-4" />, className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  processed: { text: 'تم التنفيذ', icon: <CheckCircle className="w-4 h-4" />, className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  ready: { text: 'تم التجهيز', icon: <Package className="w-4 h-4" />, className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  shipped: { text: 'تم الشحن', icon: <Truck className="w-4 h-4" />, className: 'bg-blue-50 text-blue-700 border-blue-200' },
  arrived_misrata: { text: 'وصلت إلى مصراتة', icon: <Building className="w-4 h-4" />, className: 'bg-teal-50 text-teal-700 border-teal-200' },
  out_for_delivery: { text: 'مع المندوب', icon: <MapPin className="w-4 h-4" />, className: 'bg-lime-50 text-lime-700 border-lime-200' },
  delivered: { text: 'تم التسليم', icon: <CheckCircle className="w-4 h-4" />, className: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { text: 'ملغي', icon: <Trash2 className="w-4 h-4" />, className: 'bg-red-50 text-red-700 border-red-200' },
  paid: { text: 'مدفوع', icon: <DollarSign className="w-4 h-4" />, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  returned: { text: 'راجع', icon: <Package className="w-4 h-4" />, className: 'bg-rose-50 text-rose-700 border-rose-200' },
  // Legacy
  arrived_dubai: { text: 'وصلت إلى دبي', icon: <Plane className="w-4 h-4" />, className: 'bg-orange-50 text-orange-700 border-orange-200' },
  arrived_benghazi: { text: 'وصلت إلى بنغازي', icon: <Building className="w-4 h-4" />, className: 'bg-teal-50 text-teal-700 border-teal-200' },
  arrived_tobruk: { text: 'وصلت إلى طبرق', icon: <Building className="w-4 h-4" />, className: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const allStatuses = Object.keys(statusConfig) as OrderStatus[];

export default function AdminOrdersPage() {
  const router = useRouter();
  const { toast } = useToast();

  // -- State --
  const [orders, setOrders] = useState<Order[]>([]);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState('all');

  // Selection
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Dialogs
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [orderToQuickEdit, setOrderToQuickEdit] = useState<Order | null>(null);

  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [orderToAddWeight, setOrderToAddWeight] = useState<Order | null>(null);

  // Bulk Dialogs
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);

  const [selectedRepId, setSelectedRepId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);


  // -- Data Fetching --
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Parallel fetch for efficiency
      const [fetchedOrders, fetchedReps] = await Promise.all([
        getOrders(),
        getRepresentatives()
      ]);
      setOrders(fetchedOrders);
      setRepresentatives(fetchedReps);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      toast({ title: "خطأ", description: "فشل تحميل البيانات. يرجى المحاولة مرة أخرى.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -- Filtering --
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        order.customerName?.toLowerCase().includes(q) ||
        order.invoiceNumber?.toLowerCase().includes(q) ||
        order.trackingId?.toLowerCase().includes(q);

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  // -- Stats --
  const stats = useMemo(() => {
    const active = filteredOrders.filter(o => o.status !== 'cancelled');
    return {
      count: filteredOrders.length,
      totalValue: active.reduce((sum, o) => sum + (o.sellingPriceLYD || 0), 0),
      totalDebt: active.reduce((sum, o) => sum + (o.remainingAmount || 0), 0),
    };
  }, [filteredOrders]);

  // -- Handlers --
  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ title: "تم النسخ", description: `تم نسخ ${label}` });
  };

  const handleDeleteClick = (order: Order) => {
    setOrderToDelete(order);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!orderToDelete) return;
    const success = await deleteOrder(orderToDelete.id);
    if (success) {
      setOrders(prev => prev.filter(o => o.id !== orderToDelete.id));
      toast({ title: "تم الحذف", description: "تم حذف الطلب بنجاح" });
    } else {
      toast({ title: "خطأ", description: "فشل حذف الطلب", variant: "destructive" });
    }
    setDeleteConfirmOpen(false);
    setOrderToDelete(null);
  };

  const handleStatusUpdate = async (orderId: string, status: OrderStatus) => {
    const success = await updateOrder(orderId, { status });
    if (success) { // Note: updateOrder might return type boolean or object based on implementation details, usually it updates DB. 
      // Optimistic update
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      toast({ title: "تم التحديث", description: "تم تغيير حالة الطلب بنجاح" });
    } else {
      toast({ title: "خطأ", description: "فشل تحديث الحالة", variant: "destructive" });
    }
  };

  const handleQuickEditClick = (order: Order) => {
    setOrderToQuickEdit(order);
    setQuickEditOpen(true);
  };

  const handleQuickEditSave = async (orderId: string, updates: Partial<Order>) => {
    const success = await updateOrder(orderId, updates);
    if (success) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates } : o));
      toast({ title: "تم التحديث", description: "تم تعديل البيانات بنجاح" });
    } else {
      toast({ title: "خطأ", description: "فشل حفظ التعديلات", variant: "destructive" });
    }
  };

  const handleWeightClick = (order: Order) => {
    setOrderToAddWeight(order);
    setWeightDialogOpen(true);
  };

  const handleWeightSave = async (orderId: string, weightKG: number, costPrice: number, sellingPrice: number, costCurrency: 'LYD' | 'USD', sellingCurrency: 'LYD' | 'USD') => {

    // Use server action that handles financial transaction creation
    const result = await saveOrderWeight(orderId, weightKG, costPrice, sellingPrice, costCurrency, sellingCurrency);

    if (result.success) {
      setOrders(prev => prev.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            weightKG,
            companyWeightCost: costPrice,
            customerWeightCost: sellingPrice,
            companyWeightCostCurrency: costCurrency,
            customerWeightCostCurrency: sellingCurrency,
            // Legacy
            companyWeightCostUSD: costCurrency === 'USD' ? costPrice : o.companyWeightCostUSD,
            customerWeightCostUSD: sellingCurrency === 'USD' ? sellingPrice : o.customerWeightCostUSD,
            // Note: totalAmountLYD and debt in local state won't update perfectly without a refresh or return from server,
            // but visually we care about the weight inputs being saved.
          };
        }
        return o;
      }));
      toast({ title: "تم التحديث", description: "تم تحديث بيانات الوزن وإضافة المعاملة المالية بنجاح" });
    } else {
      toast({ title: "خطأ", description: "فشل حفظ البيانات: " + (result.message || ''), variant: "destructive" });
    }
  };

  const handleRowSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedRows);
    if (checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedRows(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(filteredOrders.map(o => o.id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  // --- Bulk Actions Handlers ---

  const handleBulkPrint = () => {
    const ids = Array.from(selectedRows).join(',');
    window.open(`/admin/orders/print_bulk?ids=${ids}`, '_blank');
  };

  const handleBulkDelete = async () => {
    setIsBulkProcessing(true);
    try {
      const ids = Array.from(selectedRows);
      // Wait for all deletions to complete
      await Promise.all(ids.map(id => deleteOrder(id)));

      setOrders(prev => prev.filter(o => !selectedRows.has(o.id)));
      setSelectedRows(new Set());
      setBulkDeleteOpen(false);
      toast({ title: "تم الحذف", description: `تم حذف ${ids.length} طلب بنجاح` });
    } catch (error) {
      console.error("Bulk delete failed", error);
      toast({ title: "خطأ", description: "فشل حذف بعض الطلبات", variant: "destructive" });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!selectedRepId) return;
    setIsBulkProcessing(true);
    try {
      const ids = Array.from(selectedRows);
      const rep = representatives.find(r => r.id === selectedRepId);

      if (!rep) throw new Error("Rep not found");

      await bulkAssignRepresentativeToOrder(ids, selectedRepId, rep.name);

      // Optimistic Update
      setOrders(prev => prev.map(o => selectedRows.has(o.id) ? {
        ...o,
        representativeId: selectedRepId,
        representativeName: rep.name,
        status: 'out_for_delivery'
      } : o));

      setBulkAssignOpen(false);
      setSelectedRepId('');
      setSelectedRows(new Set()); // Optional: keep selection or unclear? usually uncheck
      toast({ title: "تم الإسناد", description: `تم إسناد ${ids.length} طلب للمندوب ${rep.name}` });

    } catch (error) {
      console.error("Bulk assign failed", error);
      toast({ title: "خطأ", description: "فشل إسناد الطلبات", variant: "destructive" });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkStatus = async () => {
    if (!selectedStatus) return;
    setIsBulkProcessing(true);
    try {
      const ids = Array.from(selectedRows);

      // Using Promise.all for parallel updates
      await Promise.all(ids.map(id => updateOrder(id, { status: selectedStatus })));

      setOrders(prev => prev.map(o => selectedRows.has(o.id) ? { ...o, status: selectedStatus } : o));

      setBulkStatusOpen(false);
      setSelectedStatus('');
      setSelectedRows(new Set());
      toast({ title: "تم التحديث", description: `تم تحديث حالة ${ids.length} طلب` });

    } catch (error) {
      console.error("Bulk status update failed", error);
      toast({ title: "خطأ", description: "فشل تحديث الحالة للبعض", variant: "destructive" });
    } finally {
      setIsBulkProcessing(false);
    }
  };


  return (
    <div className="p-4 md:p-8 space-y-6 min-h-screen bg-gray-50/50 dark:bg-black pb-24" dir="rtl">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">إدارة الطلبات</h1>
          <p className="text-muted-foreground mt-1">تتبع وإدارة جميع الشحنات والطلبات</p>
        </div>
        <Button
          onClick={() => router.push('/admin/orders/add')}
          className="bg-primary hover:bg-primary/90 text-white shadow-lg hover:shadow-primary/20 transition-all gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          طلب جديد
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none shadow-md bg-white/60 dark:bg-[#1c1c1e] backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">عدد الطلبات</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.count}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white/60 dark:bg-[#1c1c1e] backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي القيمة</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.totalValue.toFixed(2)} د.ل</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md bg-white/60 dark:bg-[#1c1c1e] backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">الديون المتبقية</CardTitle>
            <DollarSign className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">{stats.totalDebt.toFixed(2)} د.ل</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">

            {/* Search */}
            <div className="relative w-full md:w-96">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث (اسم، تتبع، فاتورة)..."
                className="pr-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {allStatuses.map(s => (
                    <SelectItem key={s} value={s}>{statusConfig[s].text}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-md border-t">
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow>
                  <TableHead className="w-[40px] text-right">
                    <Checkbox
                      checked={filteredOrders.length > 0 && selectedRows.size === filteredOrders.length}
                      onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    />
                  </TableHead>
                  <TableHead className="text-right">الفاتورة / التتبع</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">المندوب</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">المالية</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Loader2 className="h-8 w-8 animate-spin mb-2" />
                        <p>جاري تحميل البيانات...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <Package className="h-10 w-10 mb-2 opacity-50" />
                        <p>لا توجد طلبات مطابقة</p>
                        <Button variant="link" onClick={() => router.push('/admin/orders/add')}>
                          + إضافة طلب جديد
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => {
                    const statusInfo = statusConfig[order.status] || { text: order.status, className: 'bg-gray-100', icon: null };
                    return (
                      <TableRow key={order.id} className="group hover:bg-gray-50/50 transition-colors">
                        <TableCell>
                          <Checkbox
                            checked={selectedRows.has(order.id)}
                            onCheckedChange={(c) => handleRowSelect(order.id, !!c)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Link href={`/admin/orders/${order.id}`} className="font-semibold text-primary hover:underline">
                              {order.invoiceNumber}
                            </Link>
                            {order.trackingId && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono bg-gray-100 px-1 py-0.5 rounded w-fit">
                                {order.trackingId}
                                <Copy
                                  className="h-3 w-3 cursor-pointer hover:text-primary"
                                  onClick={() => copyToClipboard(order.trackingId, 'كود التتبع')}
                                />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{order.customerName}</span>
                        </TableCell>
                        <TableCell>
                          {order.representativeName ? (
                            <Badge variant="outline" className="font-normal bg-white">
                              {order.representativeName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`font-medium border gap-1 py-1 ${statusInfo.className}`}>
                            {statusInfo.icon}
                            <span>{statusInfo.text}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span className="font-semibold">{order.sellingPriceLYD?.toFixed(2)} د.ل</span>
                            {order.remainingAmount > 0 && (
                              <span className="text-xs text-red-600 font-medium">
                                متبقي: {order.remainingAmount.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(order.operationDate), 'yy/MM/dd')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => router.push(`/admin/orders/add?id=${order.id}`)}>
                                <Edit className="h-4 w-4 ml-2" />
                                تعديل كامل
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleQuickEditClick(order)}>
                                <Sparkles className="h-4 w-4 ml-2" />
                                تعديل سريع
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleWeightClick(order)}>
                                <Scale className="h-4 w-4 ml-2" />
                                إضافة وزن
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.open(`/admin/orders/${order.id}/print`, '_blank')}>
                                <Printer className="h-4 w-4 ml-2" />
                                طباعة
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <Truck className="h-4 w-4 ml-2" />
                                  تحديث الحالة
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  {allStatuses.map(s => (
                                    <DropdownMenuItem key={s} onClick={() => handleStatusUpdate(order.id, s)}>
                                      {statusConfig[s].text}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                onClick={() => handleDeleteClick(order)}
                              >
                                <Trash2 className="h-4 w-4 ml-2" />
                                حذف الطلب
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          {/* Mobile Card View - Premium Dark Design */}
          <div className="md:hidden flex flex-col gap-4 pb-24">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground animate-pulse">جاري تحميل الطلبات...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center mb-6">
                  <Package className="h-10 w-10 opacity-50" />
                </div>
                <p className="text-lg font-medium text-foreground">لا توجد طلبات</p>
                <p className="text-sm opacity-60 mb-6">لم يتم العثور على نتائج مطابقة للبحث</p>
                <Button onClick={() => router.push('/admin/orders/add')} className="rounded-full px-8">
                  <PlusCircle className="mr-2 h-4 w-4" /> إضافة طلب
                </Button>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const statusInfo = statusConfig[order.status] || { text: order.status, className: '', icon: null };
                const isSelected = selectedRows.has(order.id);

                return (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`relative overflow-hidden rounded-3xl border transition-all duration-300 ${isSelected
                      ? 'bg-[#1c1c1e] border-primary/50 shadow-[0_0_30px_rgba(247,148,29,0.15)] ring-1 ring-primary'
                      : 'bg-[#1c1c1e] border-white/5 shadow-lg'
                      }`}
                    onClick={() => {
                      // Optional: Toggle selection on click if desired, currently strictly checkbox
                    }}
                  >
                    {/* Status Strip / Glow */}
                    <div className={`absolute top-0 right-0 w-1.5 h-full ${order.status === 'delivered' ? 'bg-green-500 shadow-[0_0_15px_#22c55e]' :
                      order.status === 'cancelled' ? 'bg-red-500 shadow-[0_0_15px_#ef4444]' :
                        'bg-primary shadow-[0_0_15px_#f7941d]'
                      }`} />

                    <div className="p-5 pl-4">
                      {/* Top Row: Invoice & Date */}
                      <div className="flex justify-between items-start mb-4 pr-3">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-xl font-black text-white tracking-tight font-mono">
                              {order.invoiceNumber}
                            </h3>
                            {order.trackingId && (
                              <span className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-white/50 font-mono">
                                {order.trackingId}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/40 font-medium flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {format(new Date(order.operationDate), 'EEEE d MMMM', { locale: (window as any).dateFnsLocaleAr })} • {format(new Date(order.operationDate), 'hh:mm a')}
                          </p>
                        </div>

                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(c) => handleRowSelect(order.id, !!c)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary border-white/20"
                        />
                      </div>

                      {/* Middle Row: Content Grid */}
                      <div className="grid grid-cols-2 gap-4 mb-4 pr-3">
                        {/* Customer */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/5 flex items-center justify-center">
                            <Users className="w-5 h-5 text-white/60" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-xs text-white/40 mb-0.5">العميل</p>
                            <p className="text-sm font-bold text-white truncate">{order.customerName}</p>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#f7941d]/10 to-transparent border border-[#f7941d]/20 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-[#f7941d]" />
                          </div>
                          <div>
                            <p className="text-xs text-white/40 mb-0.5">القيمة</p>
                            <div className="flex items-baseline gap-1">
                              <span className="text-lg font-black text-[#f7941d]">{order.sellingPriceLYD?.toFixed(0)}</span>
                              <span className="text-xs text-[#f7941d]/70">د.ل</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Row: Status & Actions */}
                      <div className="flex items-center justify-between pr-3 pt-4 border-t border-white/5">
                        <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${order.status === 'delivered' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                          order.status === 'cancelled' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                            'bg-primary/10 border-primary/20 text-primary'
                          }`}>
                          <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${order.status === 'delivered' ? 'bg-green-400' :
                            order.status === 'cancelled' ? 'bg-red-400' :
                              'bg-[#f7941d]'
                            }`} />
                          <span className="text-xs font-bold">{statusInfo.text}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-white/60 hover:text-white hover:bg-white/10" onClick={() => router.push(`/admin/orders/add?id=${order.id}`)}>
                            <Edit className="w-4 h-4" />
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-white/60 hover:text-white hover:bg-white/10">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 bg-[#1c1c1e] text-white border-white/10">
                              <DropdownMenuLabel>خيارات الطلب</DropdownMenuLabel>
                              <DropdownMenuItem className="focus:bg-white/10 focus:text-white cursor-pointer" onClick={() => handleQuickEditClick(order)}>
                                <Sparkles className="h-4 w-4 ml-2 text-primary" />
                                تعديل سريع
                              </DropdownMenuItem>
                              <DropdownMenuItem className="focus:bg-white/10 focus:text-white cursor-pointer" onClick={() => handleWeightClick(order)}>
                                <Scale className="h-4 w-4 ml-2" />
                                إضافة وزن
                              </DropdownMenuItem>
                              <DropdownMenuItem className="focus:bg-white/10 focus:text-white cursor-pointer" onClick={() => window.open(`/admin/orders/${order.id}/print`, '_blank')}>
                                <Printer className="h-4 w-4 ml-2" />
                                طباعة الفاتورة
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-white/10" />
                              <DropdownMenuItem className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer" onClick={() => handleDeleteClick(order)}>
                                <Trash2 className="h-4 w-4 ml-2" />
                                حذف الطلب
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Footer Info */}
      <div className="text-center text-xs text-muted-foreground mt-4">
        يتم عرض آخر {orders.length} طلب
      </div>

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedRows.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-50 max-w-[90vw] overflow-x-auto"
          >
            <span className="text-sm font-semibold whitespace-nowrap ml-2 border-l pl-4">
              تم تحديد {selectedRows.size}
            </span>

            <Button size="sm" variant="outline" className="gap-2 rounded-full h-8" onClick={handleBulkPrint}>
              <Printer className="w-3.5 h-3.5" />
              طباعة
            </Button>

            <Button size="sm" variant="outline" className="gap-2 rounded-full h-8" onClick={() => setBulkStatusOpen(true)}>
              <RefreshCw className="w-3.5 h-3.5" />
              تحديث الحالة
            </Button>

            <Button size="sm" variant="outline" className="gap-2 rounded-full h-8" onClick={() => setBulkAssignOpen(true)}>
              <Truck className="w-3.5 h-3.5" />
              إسناد
            </Button>

            <div className="w-px h-4 bg-gray-200 mx-1"></div>

            <Button size="sm" variant="destructive" className="gap-2 rounded-full h-8" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="w-3.5 h-3.5" />
              حذف
            </Button>

            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full ml-1" onClick={() => setSelectedRows(new Set())}>
              <X className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Delete Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من رغبتك في حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.
              {orderToDelete && (
                <span className="mt-2 p-2 bg-red-50 rounded text-red-700 font-mono text-sm block">
                  {orderToDelete.invoiceNumber} - {orderToDelete.customerName}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={confirmDelete}>حذف نهائي</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حذف جماعي</DialogTitle>
            <DialogDescription>
              أنت على وشك حذف {selectedRows.size} من الطلبات المحددة. هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isBulkProcessing}>
              {isBulkProcessing && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              حذف {selectedRows.size} طلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Status Update Dialog */}
      <Dialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تحديث الحالة جماعي</DialogTitle>
            <DialogDescription>
              تغيير حالة {selectedRows.size} طلب محدد
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">الحالة الجديدة</Label>
              <div className="col-span-3">
                <Select value={selectedStatus} onValueChange={(val) => setSelectedStatus(val as OrderStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الحالة..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allStatuses.map(s => (
                      <SelectItem key={s} value={s}>{statusConfig[s].text}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkStatusOpen(false)}>إلغاء</Button>
            <Button onClick={handleBulkStatus} disabled={!selectedStatus || isBulkProcessing}>
              {isBulkProcessing && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              تحديث
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إسناد لمندوب جماعي</DialogTitle>
            <DialogDescription>
              إسناد {selectedRows.size} طلب لمندوب محدد. (سيتم تغيير الحالة إلى "مع المندوب")
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">المندوب</Label>
              <div className="col-span-3">
                <Select value={selectedRepId} onValueChange={setSelectedRepId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المندوب..." />
                  </SelectTrigger>
                  <SelectContent>
                    {representatives.map(rep => (
                      <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>إلغاء</Button>
            <Button onClick={handleBulkAssign} disabled={!selectedRepId || isBulkProcessing}>
              {isBulkProcessing && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
              إسناد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weight Dialog */}
      <WeightDialog
        open={weightDialogOpen}
        onOpenChange={setWeightDialogOpen}
        order={orderToAddWeight}
        onSave={handleWeightSave}
      />

      {/* Quick Edit Dialog */}
      <QuickEditDialog
        open={quickEditOpen}
        onOpenChange={setQuickEditOpen}
        order={orderToQuickEdit}
        onSave={handleQuickEditSave}
      />

    </div>
  );
}

// --- Quick Edit Dialog Component ---
function QuickEditDialog({ open, onOpenChange, order, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onSave: (orderId: string, updates: Partial<Order>) => Promise<void>;
}) {
  const [purchasePriceUSD, setPurchasePriceUSD] = useState(0);
  const [trackingId, setTrackingId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setPurchasePriceUSD(order.purchasePriceUSD || 0);
      setTrackingId(order.trackingId || '');
    }
  }, [order]);

  const handleSave = async () => {
    if (!order) return;
    setIsSaving(true);
    await onSave(order.id, {
      purchasePriceUSD,
      trackingId
    });
    setIsSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>تعديل سريع</DialogTitle>
          <DialogDescription>
            تعديل بيانات {order?.invoiceNumber} المختصرة
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quick-price" className="text-right">سعر الشراء ($)</Label>
            <Input
              id="quick-price"
              type="number"
              value={purchasePriceUSD}
              onChange={(e) => setPurchasePriceUSD(e.target.value === '' ? 0 : parseFloat(e.target.value))}
              className="col-span-3 text-left"
              dir="ltr"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quick-tracking" className="text-right">كود التتبع</Label>
            <Input
              id="quick-tracking"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
              className="col-span-3 text-left"
              dir="ltr"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button type="submit" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            حفظ التعديلات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Weight Dialog Component ---
function WeightDialog({ open, onOpenChange, order, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order | null;
  onSave: (orderId: string, weightKG: number, costPrice: number, sellingPrice: number, costCurrency: 'LYD' | 'USD', sellingCurrency: 'LYD' | 'USD') => Promise<void>;
}) {
  const [weight, setWeight] = useState<string>('');
  const [costPrice, setCostPrice] = useState<string>('');
  const [sellingPrice, setSellingPrice] = useState<string>('');

  // Two independent currencies
  const [costCurrency, setCostCurrency] = useState<'LYD' | 'USD'>('USD');
  const [sellingCurrency, setSellingCurrency] = useState<'LYD' | 'USD'>('LYD');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setWeight(order.weightKG?.toString() || '');
      setCostPrice(order.companyWeightCost?.toString() || '');
      setSellingPrice(order.customerWeightCost?.toString() || '');

      // Initialize currencies independently
      setCostCurrency(order.companyWeightCostCurrency || 'USD');
      setSellingCurrency(order.customerWeightCostCurrency || 'LYD');
    } else {
      setWeight('');
      setCostPrice('');
      setSellingPrice('');
      setCostCurrency('USD');
      setSellingCurrency('LYD');
    }
  }, [order]);

  const handleSave = async () => {
    if (!order) return;
    const weightNum = parseFloat(weight);
    const costNum = parseFloat(costPrice);
    const sellingNum = parseFloat(sellingPrice);

    if (isNaN(weightNum) || weightNum < 0) return;

    setIsSaving(true);
    await onSave(order.id, weightNum || 0, costNum || 0, sellingNum || 0, costCurrency, sellingCurrency);
    setIsSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>تحديث بيانات الشحنة</DialogTitle>
          <DialogDescription>
            إدخال الوزن والتكاليف (التكلفة والبيع) لطلب {order?.invoiceNumber}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="weight" className="text-right font-bold">الوزن (كجم)</Label>
            <Input
              id="weight"
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="col-span-3 text-left font-mono"
              dir="ltr"
              placeholder="0.0"
            />
          </div>

          <div className="border-t pt-4">
            <Label className="mb-2 block font-bold text-blue-700">تكلة الشركة (Cost)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  className="pl-16 text-left font-mono"
                  dir="ltr"
                  placeholder="0.00"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">COST</span>
              </div>
              <Select value={costCurrency} onValueChange={(v) => setCostCurrency(v as 'LYD' | 'USD')}>
                <SelectTrigger dir="ltr" className="bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="LYD">LYD (د.ل)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="mb-2 block font-bold text-green-700">سعر البيع للزبون (Sell)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="pl-16 text-left font-mono"
                  dir="ltr"
                  placeholder="0.00"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-bold">SELL</span>
              </div>
              <Select value={sellingCurrency} onValueChange={(v) => setSellingCurrency(v as 'LYD' | 'USD')}>
                <SelectTrigger dir="ltr" className="bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="LYD">LYD (د.ل)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            حفظ التغييرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
