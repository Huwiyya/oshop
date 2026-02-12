'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    BookOpen,
    Plus,
    Search,
    ChevronRight,
    ChevronDown,
    Edit,
    ArrowLeft,
    Loader2,
    EyeOff,
    GripVertical,
    Trash2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getChartOfAccountsTree } from '@/lib/chart-of-accounts-actions';
import { createAccountV2, getAccountTypesV2, updateAccountV2, deleteAccountV2, toggleAccountStatusV2 } from '@/lib/accounting-v2-actions';
import { useToast } from '@/components/ui/use-toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

interface AccountTreeProps {
    account: any;
    expanded: { [key: string]: boolean };
    onToggle: (account: any) => void;
    onEdit: (account: any) => void;
    onDelete: (account: any) => void;
    onToggleStatus: (id: string, currentStatus: boolean) => void;
    level?: number;
    loadingChildren?: { [key: string]: boolean };
}

// Legacy-style Row Component
const LegacyAccountRow = ({ account, expanded, onToggle, onEdit, onDelete, onToggleStatus, level = 1, loadingChildren = {} }: AccountTreeProps) => {
    const isExpanded = expanded[account.id];
    const isInactive = account.is_active === false;
    const isLoading = loadingChildren[account.id];

    // Legacy styling: Level 1 & 2 are bold headers
    const isHeader = level <= 2;
    const paddingRight = `${(level - 1) * 1.5}rem`;

    const hasChildren = account.children && account.children.length > 0;
    const canExpand = hasChildren || account.is_parent;

    return (
        <>
            <div
                className={cn(
                    "group flex items-center justify-between py-2 px-2 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0",
                    isInactive && "opacity-60 grayscale bg-slate-50"
                )}
            >
                <div className="flex items-center gap-2 flex-1" style={{ paddingRight }}>
                    {/* Drag Handle (Visual Only for now) */}
                    <GripVertical className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 cursor-grab" />

                    {/* Expand/Collapse */}
                    <div className="w-5 flex justify-center">
                        {canExpand && (
                            <button
                                onClick={() => onToggle(account)}
                                className="hover:bg-slate-200 rounded p-0.5 transition-colors"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
                                ) : isExpanded ? (
                                    <ChevronDown className="h-4 w-4 text-slate-500" />
                                ) : (
                                    <ChevronRight className="h-4 w-4 text-slate-500" />
                                )}
                            </button>
                        )}
                    </div>

                    {/* Account Name */}
                    <div className="flex flex-col">
                        <span
                            className={cn(
                                "text-slate-800",
                                isHeader ? "font-bold text-base" : "font-medium text-sm",
                                isInactive && "line-through decoration-slate-400"
                            )}
                        >
                            {account.name_ar}
                        </span>
                        {/* Show code subtly if needed, or hide to match legacy cleaner look */}
                        {level > 2 && <span className="text-[10px] text-slate-400 font-mono">{account.code}</span>}
                    </div>

                    {/* Badges for inactive/type (Subtle) */}
                    {isInactive && (
                        <Badge variant="secondary" className="text-[10px] h-4 bg-slate-100 text-slate-500 px-1">
                            موقوف
                        </Badge>
                    )}
                </div>

                {/* Account Balance & Actions */}
                <div className="flex items-center gap-4">
                    {/* Only show balance for non-headers or headers with balance */}
                    <span
                        className={cn(
                            "font-mono dir-ltr text-left min-w-[80px]",
                            isHeader ? "font-bold text-slate-900" : "text-slate-600 text-sm",
                            account.current_balance < 0 ? "text-red-600" : ""
                        )}
                    >
                        {Number(account.current_balance || 0).toLocaleString()}
                    </span>

                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onEdit(account)}
                        title="تعديل"
                    >
                        <Edit className="h-3.5 w-3.5" />
                    </Button>

                    {level > 1 && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => onDelete(account)}
                            title="حذف"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Recursion */}
            {isExpanded && account.children?.map((child: any) => (
                <LegacyAccountRow
                    key={child.id}
                    account={child}
                    expanded={expanded}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleStatus={onToggleStatus}
                    level={level + 1}
                    loadingChildren={loadingChildren}
                />
            ))}
        </>
    );
};

export default function ChartOfAccountsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [flatAccounts, setFlatAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});
    const [loadingChildren, setLoadingChildren] = useState<{ [key: string]: boolean }>({});
    const [showInactive, setShowInactive] = useState(false);

    // Edit State
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any>(null);
    const [editForm, setEditForm] = useState<{
        name_ar: string;
        name_en: string;
        description: string;
        code: string;
        cash_flow_type?: 'operating' | 'investing' | 'financing';
    }>({
        name_ar: '',
        name_en: '',
        description: '',
        code: ''
    });
    const [saving, setSaving] = useState(false);

    // Create State
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newAccountForm, setNewAccountForm] = useState<{
        name_ar: string;
        name_en: string;
        description: string;
        parent_id: string;
        is_active: boolean;
        is_group: boolean;
        cash_flow_type?: 'operating' | 'investing' | 'financing';
    }>({
        name_ar: '',
        name_en: '',
        description: '',
        parent_id: '',
        is_active: true,
        is_group: false // New field for "New Group" vs "New Account" logic if needed
    });

    // Delete State
    const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState<any>(null);

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const result = await getChartOfAccountsTree();

            if (result.success) {
                setAccounts(result.data);
                setFlatAccounts(result.flatAccounts || result.data);

                // Expand Levels 1 & 2 by default (Groups)
                const defaultExpanded: { [key: string]: boolean } = {};
                (result.flatAccounts || result.data).forEach((acc: any) => {
                    if (acc.level <= 2) defaultExpanded[acc.id] = true;
                });
                setExpanded(defaultExpanded);

                console.log('[Chart Page] Successfully loaded accounts:', result.data.length);
            } else {
                console.error('[Chart Page] Failed to load accounts:', result.error);
                toast({
                    title: 'خطأ',
                    description: result.error || 'فشل تحميل الحسابات',
                    variant: 'destructive'
                });
            }
        } catch (error) {
            console.error('[Chart Page] Exception:', error);
            toast({ title: 'خطأ', description: 'فشل تحميل الحسابات', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const toggleExpand = async (account: any) => {
        const isExpanding = !expanded[account.id];
        setExpanded(prev => ({ ...prev, [account.id]: isExpanding }));
    };

    const expandAll = () => {
        const allExpanded: { [key: string]: boolean } = {};
        const expandRecursive = (nodes: any[]) => {
            nodes.forEach(node => {
                allExpanded[node.id] = true;
                if (node.children) expandRecursive(node.children);
            });
        };
        expandRecursive(accounts);
        setExpanded(allExpanded);
    };

    const collapseAll = () => setExpanded({});

    // Filtering Logic
    const filterNodes = (nodes: any[]): any[] => {
        return nodes.reduce((filtered: any[], node) => {
            if (!showInactive && node.is_active === false) return filtered;

            const isMatch = !searchQuery ||
                node.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
                node.code.includes(searchQuery);

            const filteredChildren = node.children ? filterNodes(node.children) : [];

            if (isMatch || filteredChildren.length > 0) {
                filtered.push({ ...node, children: filteredChildren });
            }
            return filtered;
        }, []);
    };

    const displayedAccounts = filterNodes(accounts);

    // DEBUG: Log what we have
    console.log('[Chart Page] Total accounts from tree:', accounts.length);
    console.log('[Chart Page] Account codes in tree:', accounts.map((a: any) => a.code).join(', '));
    console.log('[Chart Page] Total displayed accounts:', displayedAccounts.length);
    console.log('[Chart Page] Displayed codes:', displayedAccounts.map((a: any) => a.code).join(', '));

    // SPLIT: Balance Sheet vs Income Statement
    // Use account_type.category instead of code prefix
    const balanceSheetAccounts = displayedAccounts.filter((acc: any) =>
        acc.account_type && ['asset', 'liability', 'equity'].includes(acc.account_type.category)
    );
    const incomeStatementAccounts = displayedAccounts.filter((acc: any) =>
        acc.account_type && ['revenue', 'expense'].includes(acc.account_type.category)
    );

    console.log('[Chart Page] Balance Sheet count:', balanceSheetAccounts.length);
    console.log('[Chart Page] Income Statement count:', incomeStatementAccounts.length);

    // --- Actions ---

    const handleCreateClick = (isGroup: boolean = false) => {
        setNewAccountForm({
            name_ar: '',
            name_en: '',
            description: '',
            parent_id: '',
            is_active: true,
            is_group: isGroup
        });
        setCreateDialogOpen(true);
    };

    const handleConfirmCreate = async () => {
        if (!newAccountForm.name_ar || !newAccountForm.parent_id) {
            toast({ title: 'خطأ', description: 'يرجى ملء الحقول الإلزامية', variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            const res = await createAccountV2(newAccountForm);
            if (res.success) {
                toast({ title: 'تم الحفظ', description: 'تم إنشاء الحساب بنجاح' });
                setCreateDialogOpen(false);
                fetchAccounts();
            } else {
                toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            }
        } catch (error) {
            toast({ title: 'خطأ', description: 'حدث خطأ غير متوقع', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleEditClick = (account: any) => {
        setEditingAccount(account);
        setEditForm({
            name_ar: account.name_ar,
            name_en: account.name_en || '',
            description: account.description || '',
            code: account.code,
            cash_flow_type: account.cash_flow_type
        });
        setEditDialogOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingAccount) return;
        setSaving(true);
        try {
            const res = await updateAccountV2(editingAccount.id, editForm);
            if (res.success) {
                toast({ title: 'تم التحديث بنجاح' });
                setEditDialogOpen(false);
                fetchAccounts();
            } else {
                toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            }
        } catch (error) {
            toast({ title: 'خطأ', description: 'حدث خطأ غير متوقع', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActiveStatus = async (id: string, newStatus: boolean) => {
        setSaving(true);
        try {
            const res = await toggleAccountStatusV2(id, newStatus);
            if (res.success) {
                toast({ title: newStatus ? 'تم تنشيط الحساب' : 'تم إيقاف الحساب' });
                fetchAccounts();
            } else {
                toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            }
        } catch (error) {
            toast({ title: 'خطأ', description: 'حدث خطأ غير متوقع', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClick = (account: any) => {
        setDeletingAccount(account);
        setDeleteAlertOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deletingAccount) return;
        setSaving(true);
        try {
            const res = await deleteAccountV2(deletingAccount.id);
            if (res.success) {
                toast({ title: 'تم الحذف بنجاح' });
                setDeleteAlertOpen(false);
                setDeletingAccount(null);
                fetchAccounts();
            } else {
                toast({ title: 'خطأ', description: res.error || 'لا يمكن حذف الحساب', variant: 'destructive' });
                setDeleteAlertOpen(false);
            }
        } catch (error) {
            toast({ title: 'خطأ', description: 'حدث خطأ غير متوقع', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50" dir="rtl">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                onClick={() => router.push('/accounting/dashboard')}
                                variant="ghost" size="sm" className="gap-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                    <BookOpen className="h-6 w-6 text-blue-600" />
                                    دليل الحسابات
                                    {/* Debug Badge to verify Deployment */}
                                    <Badge variant="outline" className="mr-2 font-mono text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                                        v2.2 (Total: {accounts.length})
                                    </Badge>
                                </h1>
                                {loading && <span className="text-xs text-slate-400 mr-2">جاري التحميل...</span>}
                            </div>
                        </div>

                        {/* Search & Actions Bar */}
                        <div className="flex items-center gap-3">
                            <div className="relative w-64">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="بحث..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pr-9 h-9"
                                />
                            </div>

                            <div className="h-6 w-px bg-slate-200 mx-1"></div>

                            <Button onClick={() => handleCreateClick(true)} variant="outline" size="sm" className="gap-2">
                                <Plus className="h-4 w-4" />
                                مجموعة جديدة
                            </Button>
                            <Button onClick={() => handleCreateClick(false)} size="sm" className="bg-blue-600 hover:bg-blue-700 gap-2">
                                <Plus className="h-4 w-4" />
                                حساب جديد
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content - Split View */}
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">

                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Right Column: Balance Sheet */}
                        <Card className="border-t-4 border-t-blue-500 shadow-sm">
                            <CardHeader className="pb-3 border-b bg-slate-50/50">
                                <CardTitle className="text-lg font-bold text-slate-800">قائمة المركز المالي</CardTitle>
                                <CardDescription>الأصول، الالتزامات، حقوق الملكية</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-100">
                                    {balanceSheetAccounts.map(account => (
                                        <LegacyAccountRow
                                            key={account.id}
                                            account={account}
                                            expanded={expanded}
                                            onToggle={toggleExpand}
                                            onEdit={handleEditClick}
                                            onDelete={handleDeleteClick}
                                            onToggleStatus={handleToggleActiveStatus}
                                        />
                                    ))}
                                    {balanceSheetAccounts.length === 0 && (
                                        <div className="p-8 text-center text-slate-500 text-sm">لا توجد حسابات</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Left Column: Income Statement */}
                        <Card className="border-t-4 border-t-emerald-500 shadow-sm">
                            <CardHeader className="pb-3 border-b bg-slate-50/50">
                                <CardTitle className="text-lg font-bold text-slate-800">قائمة الدخل</CardTitle>
                                <CardDescription>الإيرادات، المصروفات</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-100">
                                    {incomeStatementAccounts.map(account => (
                                        <LegacyAccountRow
                                            key={account.id}
                                            account={account}
                                            expanded={expanded}
                                            onToggle={toggleExpand}
                                            onEdit={handleEditClick}
                                            onDelete={handleDeleteClick}
                                            onToggleStatus={handleToggleActiveStatus}
                                        />
                                    ))}
                                    {incomeStatementAccounts.length === 0 && (
                                        <div className="p-8 text-center text-slate-500 text-sm">لا توجد حسابات</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Create Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{newAccountForm.is_group ? 'إضافة مجموعة جديدة' : 'إضافة حساب جديد'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>يندرج تحت (الحساب الرئيسي)</Label>
                            <Select
                                value={newAccountForm.parent_id}
                                onValueChange={(val) => setNewAccountForm({ ...newAccountForm, parent_id: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر الحساب الرئيسي..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]" dir="rtl">
                                    {flatAccounts.filter(a => a.level < (newAccountForm.is_group ? 3 : 4)).map((acc) => (
                                        <SelectItem key={acc.id} value={acc.id}>
                                            <span className="font-mono text-slate-400 ml-2">{acc.code}</span>
                                            {acc.name_ar}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>الاسم (عربي)</Label>
                            <Input
                                value={newAccountForm.name_ar}
                                onChange={e => setNewAccountForm({ ...newAccountForm, name_ar: e.target.value })}
                                placeholder="مثلاً: مصروفات نثرية"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>الاسم (إنجليزي)</Label>
                            <Input
                                value={newAccountForm.name_en}
                                onChange={e => setNewAccountForm({ ...newAccountForm, name_en: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>تصنيف قائمة التدفقات النقدية (اختياري)</Label>
                            <Select
                                value={newAccountForm.cash_flow_type || undefined}
                                onValueChange={(val) => setNewAccountForm({ ...newAccountForm, cash_flow_type: val as any })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر التصنيف..." />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="operating">أنشطة تشغيلية (Operating)</SelectItem>
                                    <SelectItem value="investing">أنشطة استثمارية (Investing)</SelectItem>
                                    <SelectItem value="financing">أنشطة تمويلية (Financing)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>إلغاء</Button>
                        <Button onClick={handleConfirmCreate} disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>تعديل: {editingAccount?.name_ar}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>رقم الحساب</Label>
                                <Input disabled value={editForm.code} className="bg-slate-50 font-mono" />
                            </div>
                            <div className="space-y-2">
                                <Label>الاسم (عربي)</Label>
                                <Input
                                    value={editForm.name_ar}
                                    onChange={e => setEditForm({ ...editForm, name_ar: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>الاسم (إنجليزي)</Label>
                            <Input
                                value={editForm.name_en}
                                onChange={e => setEditForm({ ...editForm, name_en: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>الوصف</Label>
                            <Input
                                value={editForm.description}
                                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>تصنيف قائمة التدفقات النقدية</Label>
                            <Select
                                value={editForm.cash_flow_type || undefined}
                                onValueChange={(val) => setEditForm({ ...editForm, cash_flow_type: val as any })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر التصنيف..." />
                                </SelectTrigger>
                                <SelectContent dir="rtl">
                                    <SelectItem value="operating">أنشطة تشغيلية (Operating)</SelectItem>
                                    <SelectItem value="investing">أنشطة استثمارية (Investing)</SelectItem>
                                    <SelectItem value="financing">أنشطة تمويلية (Financing)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>إلغاء</Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التغييرات'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Alert */}
            <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد من حذف الحساب؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم حذف حساب "{deletingAccount?.name_ar}" نهائياً.
                            <br />
                            لا يمكن التراجع عن هذا الإجراء.
                            <br />
                            <span className="text-red-500 text-xs mt-2 block">
                                ملاحظة: لا يمكن حذف الحسابات التي تحتوي على عمليات مالية أو حسابات فرعية.
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmDelete}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                            disabled={saving}
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حذف'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
