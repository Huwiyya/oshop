
'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign, CreditCard, MoreHorizontal, Edit, Trash2, TrendingUp, RefreshCcw, TrendingDown, Calendar as CalendarIcon, Loader2, Search, ArrowUpDown } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { getTransactions, deleteOrder, getOrders, getAppSettings, performFactoryReset, getExpenses, getCreditors, getManagers, getAllWalletTransactions, getDeposits, getAllExternalDebts, getInstantSales, getTreasuryTransactions, getUsers, deleteExpense, deleteWalletTransaction, deleteDeposit, deleteTreasuryTransaction } from '@/lib/actions';
import { Transaction, Order, AppSettings, Expense, OrderStatus, Creditor, Manager, WalletTransaction, Deposit, ExternalDebt, InstantSale, TreasuryTransaction } from '@/lib/types';
import { useRouter } from 'next/navigation';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from "@/components/ui/calendar";
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusConfig: Record<string, { text: string; className: string }> = {
    pending: { text: 'قيد التجهيز', className: 'bg-yellow-100 text-yellow-700' },
    processed: { text: 'تم التنفيذ', className: 'bg-cyan-100 text-cyan-700' },
    ready: { text: 'تم التجهيز', className: 'bg-indigo-100 text-indigo-700' },
    shipped: { text: 'تم الشحن', className: 'bg-blue-100 text-blue-700' },
    arrived_misrata: { text: 'وصلت إلى مصراتة', className: 'bg-teal-100 text-teal-700' },
    out_for_delivery: { text: 'مع المندوب', className: 'bg-lime-100 text-lime-700' },
    delivered: { text: 'تم التسليم', className: 'bg-green-100 text-green-700' },
    cancelled: { text: 'ملغي', className: 'bg-red-100 text-red-700' },
    paid: { text: 'مدفوع', className: 'bg-green-100 text-green-700' },
    returned: { text: 'راجع', className: 'bg-red-100 text-red-700' },
    // Legacy
    arrived_dubai: { text: 'وصلت إلى دبي', className: 'bg-orange-100 text-orange-700' },
    arrived_benghazi: { text: 'وصلت إلى بنغازي', className: 'bg-teal-100 text-teal-700' },
    arrived_tobruk: { text: 'وصلت إلى طبرق', className: 'bg-purple-100 text-purple-700' },
};

type SortableKeys = 'customerName' | 'date' | 'status' | 'amount';
type ChartDataPoint = {
    date: string;
    revenue: number;
    expenses: number;
    profit: number;
};

// Unified Transaction Type for the Master Log
type UnifiedTransaction = {
    id: string;
    date: string; // ISO String
    type: 'order' | 'payment' | 'expense' | 'deposit' | 'withdrawal' | 'debt_external' | 'instant_sale' | 'treasury_log' | 'wallet_log' | 'arboon';
    amount: number;
    description: string;
    source: string; // e.g. "Customer: Ahmed", "Manager: Sarah", "Creditor: China Office"
    status: string; // standardized status
    referenceId?: string; // orderId, userId, etc.
    details?: any; // Extra payload
    direction: 'in' | 'out' | 'neutral';
};

const FinancialReportsPage = () => {
    const router = useRouter();
    const { toast } = useToast();
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [allOrders, setAllOrders] = useState<Order[]>([]);
    const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
    const [allCreditors, setAllCreditors] = useState<Creditor[]>([]);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
    const [managers, setManagers] = useState<Manager[]>([]);
    const [selectedManagerId, setSelectedManagerId] = useState<string>('all');

    const [allWalletTransactions, setAllWalletTransactions] = useState<WalletTransaction[]>([]);
    const [allDeposits, setAllDeposits] = useState<Deposit[]>([]);
    const [allExternalDebts, setAllExternalDebts] = useState<ExternalDebt[]>([]);
    const [allInstantSales, setAllInstantSales] = useState<InstantSale[]>([]);
    const [allTreasuryTransactions, setAllTreasuryTransactions] = useState<TreasuryTransaction[]>([]);

    // Unified List
    const [unifiedTransactions, setUnifiedTransactions] = useState<UnifiedTransaction[]>([]);

    const [filterType, setFilterType] = useState<string>('monthly');
    const [transactionTypeFilter, setTransactionTypeFilter] = useState<string>('all'); // New Filter
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: SortableKeys; direction: 'ascending' | 'descending' } | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [
                fetchedTransactions,
                fetchedOrders,
                fetchedSettings,
                fetchedExpenses,
                fetchedCreditors,
                fetchedManagers,
                fetchedWalletTransactions,
                fetchedDeposits,
                fetchedExternalDebts,
                fetchedInstantSales,
                fetchedTreasuryTransactions,
                fetchedUsers
            ] = await Promise.all([
                getTransactions(),
                getOrders(),
                getAppSettings(),
                getExpenses(),
                getCreditors(),
                getManagers(),
                getAllWalletTransactions(),
                getDeposits(),
                getAllExternalDebts(),
                getInstantSales(),
                getTreasuryTransactions(),
                getUsers()
            ]);

            setAllTransactions(fetchedTransactions);
            setAllOrders(fetchedOrders);
            setSettings(fetchedSettings);
            setAllExpenses(fetchedExpenses);
            setAllCreditors(fetchedCreditors);
            setManagers(fetchedManagers);
            setAllWalletTransactions(fetchedWalletTransactions);
            setAllDeposits(fetchedDeposits);
            setAllExternalDebts(fetchedExternalDebts);
            setAllInstantSales(fetchedInstantSales);
            setAllTreasuryTransactions(fetchedTreasuryTransactions);

            // --- Normalize and Merge ---
            const unified: UnifiedTransaction[] = [];

            // 1. Orders & Payments (from getTransactions)
            fetchedTransactions.forEach(t => {
                if (t.customerId.startsWith('TEMP-')) return; // Skip temp if needed, or include with distinct label
                unified.push({
                    id: t.id,
                    date: t.date,
                    type: t.type === 'order' ? 'order' : 'payment',
                    amount: t.amount,
                    description: t.description || (t.type === 'order' ? 'فاتورة طلب' : 'دفعة مالية'),
                    source: `عميل: ${t.customerName}`,
                    status: t.status,
                    referenceId: t.orderId || undefined,
                    direction: t.type === 'order' ? 'in' : 'in', // Technically Order isn't cash flow yet, but 'payment' is IN. 
                    // Wait, 'order' transaction usually represents "User OWES us" (Debit) or "User PAID us"?
                    // In Manager.io logic: Invoice = Revenue (Credit Sales) -> Positive? 
                    // Let's assume Order = Revenue (In), Payment = Cash In (In).
                    // Actually, if we track flow: Payment is Real Cash. Order is Accrual. 
                    // For "Log", we just show them.
                });
            });

            // 1b. All Orders from orders_v4 (includes orders not yet in transactions)
            fetchedOrders.forEach(order => {
                // Check if this order isn't already in unified via transactions
                const existsInTransactions = unified.some(u => u.referenceId === order.id);
                if (!existsInTransactions) {
                    unified.push({
                        id: order.id,
                        date: order.operationDate,
                        type: 'order',
                        amount: order.sellingPriceLYD,
                        description: `فاتورة ${order.invoiceNumber}: ${order.itemDescription || 'طلب'}`,
                        source: `عميل: ${order.customerName}`,
                        status: order.status,
                        referenceId: order.id,
                        direction: 'in'
                    });
                }
            });


            // 2. Expenses
            fetchedExpenses.forEach(e => {
                const manager = fetchedManagers.find(m => m.id === e.managerId);
                unified.push({
                    id: e.id,
                    date: e.date,
                    type: 'expense',
                    amount: e.amount,
                    description: e.description,
                    source: manager ? `موظف: ${manager.name}` : 'مصروفات عامة',
                    status: 'completed',
                    direction: 'out'
                });
            });

            // 3. Wallet Transactions
            fetchedWalletTransactions.forEach(w => {
                const user = fetchedUsers.find(u => u.id === w.userId);
                const userName = user?.name || user?.username || 'غير معروف';
                unified.push({
                    id: w.id || '',
                    date: w.createdAt || '',
                    type: 'wallet_log',
                    amount: w.amount,
                    description: w.description,
                    source: `شحن محفظة: ${userName}`,
                    status: w.type === 'deposit' ? 'completed' : 'completed',
                    direction: w.type === 'deposit' ? 'in' : 'out', // From User Perspective? Or System?
                    // Wallet Deposit = User GIVES money to System (Revenue/Liability). So System IN.
                    // Wallet Withdrawal = User TAKES money (or pays order). System OUT?
                    // Let's stick to: Deposit (Green) = +Money for System (usually).
                    // Actually, if User Deposits into Wallet -> Cash enters Treasury.
                });
            });

            // 4. Deposits (Arboon)
            fetchedDeposits.forEach(d => {
                unified.push({
                    id: d.id,
                    date: d.collectedDate || d.date, // Use collected date if available
                    type: 'arboon',
                    amount: d.amount,
                    description: `عربون: ${d.description || ''}`,
                    source: `المندوب: ${d.representativeName || d.representativeId || 'غير محدد'}`,
                    status: d.status,
                    direction: 'in'
                });
            });

            // 5. External Debts (Creditors)
            fetchedExternalDebts.forEach(d => {
                unified.push({
                    id: d.id,
                    date: d.date,
                    type: 'debt_external',
                    amount: d.amount,
                    description: d.notes,
                    source: `دائن: ${d.creditorName}`,
                    status: d.status,
                    direction: 'out' // Usually we pay them? Or they give us loan?
                    // If it's debt we OWE -> It's a liability. 
                    // If we PAY it -> Out. 
                    // Need to check ExternalDebt model. Usually tracks "We owe".
                });
            });

            // 6. Instant Sales
            fetchedInstantSales.forEach(s => {
                unified.push({
                    id: s.id,
                    date: s.createdAt,
                    type: 'instant_sale',
                    amount: s.finalSalePriceLYD,
                    description: `بيع فوري: ${s.productName}`,
                    source: 'زبون نقدي',
                    status: 'completed',
                    direction: 'in'
                });
            });

            // 7. Treasury Logs (Central Cash Flow)
            fetchedTreasuryTransactions.forEach(t => {
                unified.push({
                    id: t.id,
                    date: t.createdAt,
                    type: 'treasury_log',
                    amount: t.amount,
                    description: t.description,
                    source: 'الخزينة',
                    status: 'completed',
                    direction: t.type === 'deposit' ? 'in' : 'out'
                });
            });

            // Sort by Date Descending
            unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setUnifiedTransactions(unified);

        } catch (error) {
            console.error("Failed to fetch financial data", error);
            toast({ title: "خطأ", description: "فشل تحميل البيانات المالية", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
    }, []);

    const { filteredTransactions, filteredUnifiedTransactions, chartData, dateFilteredOrders } = useMemo(() => {
        const regularTransactions = allTransactions.filter(t => !t.customerId.startsWith('TEMP-'));
        const regularOrders = allOrders.filter(o => !o.userId.startsWith('TEMP-'));

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
            case 'yearly':
                startDate = startOfYear(now);
                endDate = endOfYear(now);
                break;
            case 'custom':
                if (dateRange?.from) startDate = startOfDay(dateRange.from);
                if (dateRange?.to) endDate = endOfDay(dateRange.to);
                else if (dateRange?.from) endDate = endOfDay(dateRange.from);
                break;
        }

        let dateFilteredTransactions = regularTransactions;
        let dateFilteredExpenses = allExpenses;
        let dateFilteredOrders = regularOrders;
        let dateFilteredWalletTransactions = allWalletTransactions; // Added

        // Filter by Manager (Wallet transactions also have managerId)
        if (selectedManagerId !== 'all') {
            dateFilteredTransactions = dateFilteredTransactions.filter(t => t.managerId === selectedManagerId);
            dateFilteredExpenses = dateFilteredExpenses.filter(e => e.managerId === selectedManagerId);
            dateFilteredOrders = dateFilteredOrders.filter(o => o.managerId === selectedManagerId);
            dateFilteredWalletTransactions = dateFilteredWalletTransactions.filter(t => t.managerId === selectedManagerId); // Added
        }

        if (startDate && endDate) {
            const start = startDate!;
            const end = endDate!;

            dateFilteredTransactions = regularTransactions.filter(t => {
                const tDate = parseISO(t.date);
                return tDate >= start && tDate <= end;
            });
            dateFilteredExpenses = allExpenses.filter(e => {
                const eDate = parseISO(e.date);
                return eDate >= start && eDate <= end;
            });
            dateFilteredOrders = regularOrders.filter(o => {
                const oDate = parseISO(o.operationDate);
                return oDate >= start && oDate <= end;
            });
            dateFilteredWalletTransactions = allWalletTransactions.filter(t => {
                const tDate = parseISO(t.createdAt);
                return tDate >= start && tDate <= end;
            });
        }

        let searchedTransactions = dateFilteredTransactions;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            searchedTransactions = dateFilteredTransactions.filter(t => {
                const order = regularOrders.find(o => o.id === t.orderId);
                return (
                    t.customerName.toLowerCase().includes(query) ||
                    t.customerId.toLowerCase().includes(query) ||
                    (order && (
                        order.invoiceNumber.toLowerCase().includes(query) ||
                        order.customerPhone?.toLowerCase().includes(query)
                    )) ||
                    t.description.toLowerCase().includes(query)
                );
            });
        }

        let sortedTransactions = [...searchedTransactions];
        if (sortConfig !== null) {
            sortedTransactions.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }

        // --- Chart Data Processing ---
        const dataMap: { [key: string]: { revenue: number; expenses: number; profit: number } } = {};
        const isLongRange = (endDate?.getTime() ?? 0) - (startDate?.getTime() ?? 0) > 31 * 24 * 60 * 60 * 1000;
        const dateFormat = isLongRange ? 'yyyy-MM' : 'yyyy-MM-dd';

        // Process payments for revenue
        dateFilteredTransactions.filter(t => t.type === 'payment').forEach(t => {
            const key = format(parseISO(t.date), dateFormat);
            if (!dataMap[key]) dataMap[key] = { revenue: 0, expenses: 0, profit: 0 };
            dataMap[key].revenue += t.amount;
        });

        // Process WALLET DEPOSITS for revenue (Added)
        dateFilteredWalletTransactions.filter(t => t.type === 'deposit').forEach(t => {
            const key = format(parseISO(t.createdAt), dateFormat);
            if (!dataMap[key]) dataMap[key] = { revenue: 0, expenses: 0, profit: 0 };
            dataMap[key].revenue += t.amount;
        });

        // Process expenses
        dateFilteredExpenses.forEach(e => {
            const key = format(parseISO(e.date), dateFormat);
            if (!dataMap[key]) dataMap[key] = { revenue: 0, expenses: 0, profit: 0 };
            dataMap[key].expenses += e.amount;
        });

        // Process orders for profit
        dateFilteredOrders.filter(o => o.status !== 'cancelled').forEach(order => {
            const key = format(parseISO(order.operationDate), dateFormat);
            if (!dataMap[key]) dataMap[key] = { revenue: 0, expenses: 0, profit: 0 };
            const purchasePriceUSD = order.purchasePriceUSD || 0;
            const shippingCostLYD = order.shippingCostLYD || 0;
            const exchangeRate = order.exchangeRate || settings?.exchangeRate || 1;
            const purchaseCostLYD = purchasePriceUSD * exchangeRate;
            const netProfitForOrder = order.sellingPriceLYD - purchaseCostLYD - shippingCostLYD;
            dataMap[key].profit += netProfitForOrder;
        });

        const finalChartData = Object.keys(dataMap).map(key => ({
            date: key,
            revenue: dataMap[key].revenue,
            expenses: dataMap[key].expenses,
            profit: dataMap[key].profit,
        })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // Filter Unified List
        let filteredUnified = unifiedTransactions;

        if (startDate && endDate) {
            const start = startDate!;
            const end = endDate!;
            filteredUnified = filteredUnified.filter(t => {
                const dates = t.date ? parseISO(t.date) : new Date();
                return dates >= start && dates <= end;
            });
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filteredUnified = filteredUnified.filter(t =>
                t.description.toLowerCase().includes(q) ||
                t.source.toLowerCase().includes(q) ||
                (t.amount.toString().includes(q))
            );
        }

        if (transactionTypeFilter !== 'all') {
            filteredUnified = filteredUnified.filter(t => t.type === transactionTypeFilter);
        }

        return {
            filteredTransactions: sortedTransactions, // Keep legacy for charts if needed
            filteredUnifiedTransactions: filteredUnified, // New Master List
            chartData: finalChartData, // Keep charts based on legacy logic for now, or update? User asked for "Log" primarily.
            dateFilteredOrders: dateFilteredOrders
        };

    }, [filterType, dateRange, allTransactions, allOrders, allExpenses, searchQuery, sortConfig, settings, allWalletTransactions, unifiedTransactions, transactionTypeFilter]);

    const handleDeleteUnifiedTransaction = async (tx: UnifiedTransaction) => {
        const confirmMessage = `هل أنت متأكد من حذف هذه المعاملة؟`;
        if (!confirm(confirmMessage)) return;

        try {
            let success = false;

            switch (tx.type) {
                case 'order':
                    if (tx.referenceId) {
                        success = await deleteOrder(tx.referenceId);
                    }
                    break;
                case 'expense':
                    success = await deleteExpense(tx.id);
                    break;
                case 'wallet_log':
                    success = await deleteWalletTransaction(tx.id);
                    break;
                case 'arboon':
                    success = await deleteDeposit(tx.id);
                    break;
                case 'treasury_log':
                    success = await deleteTreasuryTransaction(tx.id);
                    break;
                default:
                    toast({ title: "خطأ", description: `لا يمكن حذف هذا النوع من المعاملات: ${tx.type}`, variant: "destructive" });
                    return;
            }

            if (success) {
                toast({ title: "تمت العملية", description: "تم حذف المعاملة بنجاح" });
                await fetchData(); // Refresh data
            } else {
                toast({ title: "خطأ", description: "فشل حذف المعاملة", variant: "destructive" });
            }
        } catch (error) {
            console.error("Delete transaction error:", error);
            toast({ title: "خطأ", description: "حدث خطأ أثناء الحذف", variant: "destructive" });
        }
    };

    const requestSort = (key: SortableKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: SortableKeys) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <ArrowUpDown className="w-4 h-4 ml-2 text-muted-foreground" />;
        }
        return sortConfig.direction === 'ascending' ? '▲' : '▼';
    };


    const openDeleteDialog = (transaction: Transaction) => {
        if (transaction.type === 'order' && transaction.orderId) {
            setTransactionToDelete(transaction);
            setIsDeleteDialogOpen(true);
        } else {
            toast({
                title: "لا يمكن الحذف",
                description: "يمكن فقط حذف المعاملات من نوع 'طلب'. لحذف دفعة، يرجى تعديل الطلب الأصلي.",
                variant: "destructive",
            });
        }
    };

    const handleDelete = async () => {
        if (transactionToDelete && transactionToDelete.orderId) {
            const success = await deleteOrder(transactionToDelete.orderId);
            if (success) {
                toast({ title: "تم حذف الطلب بنجاح" });
                fetchData();
            } else {
                toast({ title: "خطأ", description: "فشل حذف الطلب.", variant: "destructive" });
            }
        }
        setIsDeleteDialogOpen(false);
        setTransactionToDelete(null);
    };

    const [resetPassword, setResetPassword] = useState('');

    const handleResetReports = async () => {
        console.log("handleResetReports called");

        if (!resetPassword) {
            console.log("No password provided");
            toast({ title: "خطأ", description: "يرجى إدخال كلمة المرور", variant: "destructive" });
            return;
        }

        try {
            const userStr = localStorage.getItem('loggedInUser');
            console.log("User from localStorage:", userStr);

            if (!userStr) {
                toast({ title: "خطأ", description: "لم يتم العثور على بيانات المستخدم", variant: "destructive" });
                return;
            }
            const user = JSON.parse(userStr);
            console.log("Calling performFactoryReset with userId:", user.id);

            const result = await performFactoryReset(resetPassword, user.id);
            console.log("Factory reset result:", result);

            if (result.success) {
                toast({ title: "تم تصفير التقارير بنجاح" });
                await fetchData();
                setIsResetDialogOpen(false);
                setResetPassword('');
            } else {
                toast({ title: "خطأ", description: result.message || "فشل تصفير التقارير.", variant: "destructive" });
            }
        } catch (error) {
            console.error("Error in handleResetReports:", error);
            toast({ title: "خطأ", description: "حدث خطأ أثناء تصفير النظام", variant: "destructive" });
        }
    }
    const { totalRevenue, totalDebt, totalExpenses, netProfit, totalUSDCost, totalCreditorDebtLYD, totalCreditorDebtUSD } = useMemo(() => {
        const revenue = chartData.reduce((sum, item) => sum + item.revenue, 0);
        const expenses = chartData.reduce((sum, item) => sum + item.expenses, 0);
        const profit = chartData.reduce((sum, item) => sum + item.profit, 0);

        // Calculate Total USD Cost corresponding to the filtered orders
        const usdCost = dateFilteredOrders
            .filter(o => o.status !== 'cancelled')
            .reduce((sum, order) => sum + (order.companyWeightCostUSD || 0), 0);

        // Correct way to calculate debt for the selected period
        const debt = dateFilteredOrders
            .filter(o => o.status !== 'cancelled')
            .reduce((sum, order) => sum + order.remainingAmount, 0);

        // Calculate Creditor Balances (Note: These are global balances, not necessarily filtered by date effectively unless we tracked history)
        // For now, we show current snapshot balance.
        const credDebtLYD = allCreditors.filter(c => c.currency === 'LYD').reduce((sum, c) => sum + c.totalDebt, 0);
        const credDebtUSD = allCreditors.filter(c => c.currency === 'USD').reduce((sum, c) => sum + c.totalDebt, 0);

        return {
            totalRevenue: revenue,
            totalDebt: debt,
            totalExpenses: expenses,
            netProfit: profit - expenses,
            totalUSDCost: usdCost,
            totalCreditorDebtLYD: credDebtLYD,
            totalCreditorDebtUSD: credDebtUSD
        };
    }, [chartData, dateFilteredOrders, allCreditors]);


    const summaryCards = [
        { title: 'الخزينة (دينار)', value: `${(totalRevenue - totalExpenses).toFixed(2)} د.ل`, icon: <DollarSign className="w-6 h-6" />, color: (totalRevenue - totalExpenses) >= 0 ? 'text-green-600' : 'text-destructive', description: "السيولة النقدية (إيرادات - مصروفات)" },
        { title: 'التكلفة (دولار)', value: `${totalUSDCost.toFixed(2)} $`, icon: <DollarSign className="w-6 h-6" />, color: 'text-blue-600', description: "إجمالي تكلفة الشحن بالدولار" },
        { title: 'ديون العملاء', value: `${totalDebt.toFixed(2)} د.ل`, icon: <CreditCard className="w-6 h-6" />, color: 'text-destructive', description: "الديون المتبقية عند العملاء" },
        { title: 'ديون خارجية (LYD)', value: `${totalCreditorDebtLYD.toFixed(2)} د.ل`, icon: <TrendingDown className="w-6 h-6" />, color: totalCreditorDebtLYD > 0 ? 'text-destructive' : 'text-green-600', description: "إجمالي الذمم بالدينار" },
        { title: 'ديون خارجية (USD)', value: `${totalCreditorDebtUSD.toFixed(2)} $`, icon: <TrendingDown className="w-6 h-6" />, color: totalCreditorDebtUSD > 0 ? 'text-destructive' : 'text-green-600', description: "إجمالي الذمم بالدولار" },
        { title: 'صافي الربح', value: `${netProfit.toFixed(2)} د.ل`, icon: <TrendingUp className="w-6 h-6" />, color: netProfit >= 0 ? 'text-primary' : 'text-destructive', description: "الأرباح المحققة" },
    ];

    const handleFilterChange = (type: string) => {
        setFilterType(type);
        const now = new Date();
        if (type === 'daily') setDateRange({ from: startOfDay(now), to: endOfDay(now) });
        else if (type === 'weekly') setDateRange({ from: startOfWeek(now, { locale: ar }), to: endOfWeek(now, { locale: ar }) });
        else if (type === 'monthly') setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        else if (type === 'yearly') setDateRange({ from: startOfYear(now), to: endOfYear(now) });
        else if (type === 'all') setDateRange(undefined);
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
            case 'yearly': return 'هذه السنة';
            case 'custom':
                if (dateRange?.from && dateRange?.to) {
                    return `${format(dateRange.from, 'd MMM', { locale: ar })} - ${format(dateRange.to, 'd MMM yyyy', { locale: ar })}`;
                }
                if (dateRange?.from) return `تاريخ: ${format(dateRange.from, 'd MMMM yyyy', { locale: ar })}`;
                return 'فترة مخصصة';
            default: return 'عرض كل التقارير';
        }
    }

    return (
        <div className="p-4 sm:p-6" dir="rtl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <h1 className="text-2xl font-bold">التقارير المالية</h1>
                <div className="flex items-center gap-2">
                    <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="تصفية حسب الموظف" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الموظفين</SelectItem>
                            {managers.map(manager => (
                                <SelectItem key={manager.id} value={manager.id}>{manager.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={() => setIsResetDialogOpen(true)} variant="destructive" className="gap-2">
                        <RefreshCcw className="w-4 h-4" />
                        تصفير
                    </Button>
                </div>
            </div>

            <main className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {summaryCards.map((card, index) => (
                        <Card key={index} className="shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                                <div className={`text-primary ${card.color}`}>{card.icon}</div>
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>الأداء المالي خلال الفترة</CardTitle>
                        <CardDescription>{getFilterLabel()}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center items-center h-80"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                        ) : (
                            <div className="h-80">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip
                                            formatter={(value: number) => `${value.toFixed(2)} د.ل`}
                                            labelFormatter={(label) => `التاريخ: ${label}`}
                                            contentStyle={{
                                                backgroundColor: 'hsl(var(--background))',
                                                border: '1px solid hsl(var(--border))',
                                                borderRadius: 'var(--radius)',
                                                direction: 'rtl'
                                            }}
                                        />
                                        <Legend wrapperStyle={{ fontSize: "14px" }} />
                                        <Bar dataKey="revenue" fill="var(--color-green-600, #16a34a)" name="الإيرادات" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="expenses" fill="var(--color-destructive, #dc2626)" name="المصروفات" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="profit" fill="var(--color-primary, #f7941d)" name="صافي الربح" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <CardTitle>سجل المعاملات</CardTitle>
                                <p className="text-sm text-muted-foreground pt-1">{getFilterLabel()}</p>
                            </div>
                            <div className="relative w-full sm:w-72">
                                <Input
                                    placeholder="ابحث بالهاتف، الاسم، الفاتورة..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pr-10"
                                />
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-4">
                            <Button variant={filterType === 'all' ? 'default' : 'outline'} size="sm" onClick={() => handleFilterChange('all')}>الكل</Button>
                            <Button variant={filterType === 'daily' ? 'default' : 'outline'} size="sm" onClick={() => handleFilterChange('daily')}>اليوم</Button>
                            <Button variant={filterType === 'weekly' ? 'default' : 'outline'} size="sm" onClick={() => handleFilterChange('weekly')}>أسبوعي</Button>
                            <Button variant={filterType === 'monthly' ? 'default' : 'outline'} size="sm" onClick={() => handleFilterChange('monthly')}>شهري</Button>
                            <Button variant={filterType === 'yearly' ? 'default' : 'outline'} size="sm" onClick={() => handleFilterChange('yearly')}>سنوي</Button>
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
                                                <>
                                                    {format(dateRange.from, "LLL dd, y")} -{" "}
                                                    {format(dateRange.to, "LLL dd, y")}
                                                </>
                                            ) : (
                                                format(dateRange.from, "LLL dd, y")
                                            )
                                        ) : (
                                            <span>اختر فترة</span>
                                        )}
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
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className='text-right whitespace-nowrap'>رقم الفاتورة</TableHead>
                                    <TableHead className='text-right whitespace-nowrap cursor-pointer' onClick={() => requestSort('customerName')}>
                                        <div className='flex items-center'>العميل {getSortIndicator('customerName')}</div>
                                    </TableHead>
                                    <TableHead className='text-right whitespace-nowrap cursor-pointer' onClick={() => requestSort('date')}>
                                        <div className='flex items-center'>التاريخ {getSortIndicator('date')}</div>
                                    </TableHead>
                                    <TableHead className='text-right whitespace-nowrap'>النوع</TableHead>
                                    <TableHead className='text-right whitespace-nowrap cursor-pointer' onClick={() => requestSort('status')}>
                                        <div className='flex items-center'>الحالة {getSortIndicator('status')}</div>
                                    </TableHead>
                                    <TableHead className='text-right whitespace-nowrap cursor-pointer' onClick={() => requestSort('amount')}>
                                        <div className='flex items-center'>المبلغ {getSortIndicator('amount')}</div>
                                    </TableHead>
                                    <TableHead className='text-right'>إجراءات</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                                ) : filteredUnifiedTransactions.length > 0 ? (
                                    filteredUnifiedTransactions.map((tx) => {
                                        const typeLabel = tx.type === 'order' ? 'طلب' :
                                            tx.type === 'payment' ? 'دفعة' :
                                                tx.type === 'expense' ? 'مصروف' :
                                                    tx.type === 'wallet_log' ? 'محفظة' :
                                                        tx.type === 'arboon' ? 'عربون' : tx.type;

                                        return (
                                            <TableRow key={tx.id}>
                                                <TableCell className="font-medium">
                                                    {tx.referenceId && tx.type === 'order' ? (
                                                        <Link href={`/admin/orders/${tx.referenceId}`} className="hover:underline text-primary">
                                                            {tx.description.split(':')[0]}
                                                        </Link>
                                                    ) : (
                                                        tx.description
                                                    )}
                                                </TableCell>
                                                <TableCell>{tx.source}</TableCell>
                                                <TableCell>{new Date(tx.date).toLocaleDateString('ar-LY')}</TableCell>
                                                <TableCell>{typeLabel}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={`font-normal ${statusConfig[tx.status as keyof typeof statusConfig]?.className}`}>
                                                        {statusConfig[tx.status as keyof typeof statusConfig]?.text || tx.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className={`${tx.direction === 'in' ? "text-green-600" : "text-destructive"}`}>
                                                    {tx.direction === 'in' ? '+' : '-'}{tx.amount.toFixed(2)} د.ل
                                                </TableCell>
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
                                                            {tx.type === 'order' && tx.referenceId && (
                                                                <DropdownMenuItem onSelect={() => router.push(`/admin/orders/${tx.referenceId}`)}>
                                                                    <Edit className="ml-2 h-4 w-4" /> عرض
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem
                                                                onSelect={() => handleDeleteUnifiedTransaction(tx)}
                                                                className="text-destructive focus:text-destructive-foreground focus:bg-destructive/90"
                                                            >
                                                                <Trash2 className="ml-2 h-4 w-4" /> حذف
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                ) : (
                                    <TableRow><TableCell colSpan={7} className="text-center">لا توجد معاملات تطابق معايير البحث.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </main>
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent dir="rtl">
                    <DialogHeader>
                        <DialogTitle>تأكيد الحذف</DialogTitle>
                        <DialogDescription>
                            هل أنت متأكد من رغبتك في حذف الطلب رقم #{transactionToDelete?.orderId?.slice(-6)}؟
                            سيتم حذف الطلب وجميع معاملاته المالية المرتبطة به. لا يمكن التراجع عن هذا الإجراء.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="destructive" onClick={handleDelete}>نعم، قم بالحذف</Button>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>إلغاء</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                <DialogContent dir="rtl">
                    <DialogHeader>
                        <DialogTitle>تأكيد تصفير التقارير</DialogTitle>
                        <DialogDescription>
                            هل أنت متأكد تمامًا من رغبتك في تصفير التقارير المالية؟
                            سيتم حذف <span className="font-bold text-destructive">جميع المعاملات المالية والمصروفات</span> بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <p className="text-sm text-muted-foreground">للتأكيد، يرجى إدخال كلمة مرور المسؤول:</p>
                        <Input
                            type="password"
                            placeholder="كلمة مرور المسؤول"
                            value={resetPassword}
                            onChange={(e) => setResetPassword(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="destructive" onClick={handleResetReports}>نعم، قم بالتصفير</Button>
                        <Button variant="outline" onClick={() => { setIsResetDialogOpen(false); setResetPassword(''); }}>إلغاء</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default FinancialReportsPage;

