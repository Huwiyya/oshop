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
    Filter,
    Download,
    ChevronRight,
    ChevronDown,
    Edit,
    Trash2,
    Eye,
    Calculator,
    ArrowLeft,
    Loader2,
    EyeOff
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { getAllAccounts, updateAccount, deleteAccount, toggleAccountStatus, createAccount, getAccountChildren } from '@/lib/accounting-actions';
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

const AccountRow = ({ account, expanded, onToggle, onEdit, onDelete, onToggleStatus, level = 1, loadingChildren = {} }: AccountTreeProps) => {
    const paddingRight = `${(level - 1) * 2}rem`;
    const isExpanded = expanded[account.id];
    const isInactive = account.is_active === false;
    const isLoading = loadingChildren[account.id];

    // Determine type name strictly from account_type relation or fallback (handling mock data transition)
    const typeName = account.account_type?.name_ar || account.type || 'غير محدد';

    const getCategoryColor = (type: string) => {
        if (type.includes('أصول') || type === 'Assets') return 'bg-blue-100 text-blue-700 border-blue-200';
        if (type.includes('التزامات') || type === 'Liabilities') return 'bg-red-100 text-red-700 border-red-200';
        if (type.includes('حقوق') || type === 'Equity') return 'bg-purple-100 text-purple-700 border-purple-200';
        if (type.includes('إيراد') || type === 'Revenue') return 'bg-green-100 text-green-700 border-green-200';
        if (type.includes('مصروف') || type === 'Expenses') return 'bg-orange-100 text-orange-700 border-orange-200';
        return 'bg-gray-100 text-gray-700 border-gray-200';
    };

    // Show expand button if it has children OR it is a parent (implies lazy load might be needed)
    const hasChildren = account.children && account.children.length > 0;
    const canExpand = hasChildren || account.is_parent;

    return (
        <>
            <TableRow className={`hover:bg-slate-50 transition-colors group ${isInactive ? 'bg-slate-50 opacity-60 grayscale' : ''}`}>
                <TableCell style={{ paddingRight }}>
                    <div className="flex items-center gap-2">
                        {canExpand ? (
                            <button
                                onClick={() => onToggle(account)}
                                className="hover:bg-slate-200 rounded p-1 transition-colors"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                ) : isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                ) : (
                                    <ChevronRight className="h-4 w-4" />
                                )}
                            </button>
                        ) : (
                            <div className="w-6" />
                        )}
                        <span className={`font-${level === 1 ? 'bold' : level === 2 ? 'semibold' : 'medium'} ${isInactive ? 'line-through decoration-slate-400' : ''}`}>
                            {account.name_ar}
                        </span>
                        {account.is_parent && (
                            <Badge variant="outline" className="text-xs">
                                رئيسي
                            </Badge>
                        )}
                        {isInactive && (
                            <Badge variant="secondary" className="text-xs bg-slate-200 text-slate-600">
                                غير نشط
                            </Badge>
                        )}
                    </div>
                </TableCell>
                <TableCell className="font-mono font-semibold">{account.account_code}</TableCell>
                <TableCell>
                    <Badge className={getCategoryColor(typeName)} variant="outline">
                        {typeName}
                    </Badge>
                </TableCell>
                <TableCell className="text-left font-semibold">
                    {Number(account.current_balance || 0).toLocaleString()} د.ل
                </TableCell>
                <TableCell>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800"
                            onClick={() => onToggleStatus(account.id, account.is_active !== false)}
                            title={isInactive ? "تنشيط الحساب" : "إيقاف الحساب"}
                        >
                            {isInactive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit(account)}>
                            <Edit className="h-4 w-4 text-blue-600" />
                        </Button>
                        {!account.is_parent && (
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700" onClick={() => onDelete(account)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </TableCell>
            </TableRow>
            {isExpanded && account.children?.map((child: any) => (
                <AccountRow
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
    const [flatAccounts, setFlatAccounts] = useState<any[]>([]); // To calculate logic, minimal set initially
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});
    const [loadingChildren, setLoadingChildren] = useState<{ [key: string]: boolean }>({});
    const [showInactive, setShowInactive] = useState(false);

    // Edit State
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any>(null);
    const [editForm, setEditForm] = useState({ name_ar: '', name_en: '', description: '' });
    const [saving, setSaving] = useState(false);

    // Create State
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newAccountForm, setNewAccountForm] = useState({ name_ar: '', name_en: '', description: '', parent_id: '', is_active: true });

    // Delete State
    const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState<any>(null);

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            // Lazy load: Fetch only up to level 3 initially
            const data = await getAllAccounts(3);
            if (data) {
                setFlatAccounts(data);

                // Build Tree
                const accountMap: any = {};
                const tree: any[] = [];

                data.forEach((acc: any) => {
                    accountMap[acc.id] = { ...acc, children: [] };
                });

                data.forEach((acc: any) => {
                    if (acc.parent_id && accountMap[acc.parent_id]) {
                        accountMap[acc.parent_id].children.push(accountMap[acc.id]);
                    } else if (!acc.parent_id) { // Root nodes
                        tree.push(accountMap[acc.id]);
                    } else {
                        // Orphan nodes or parents not in initial fetch (shouldn't happen with level logic unless broken data)
                        // Treat as root for safety if level 1
                        if (acc.level === 1) tree.push(accountMap[acc.id]);
                    }
                });

                setAccounts(tree);

                // Expand first level by default
                const firstLevel: { [key: string]: boolean } = {};
                tree.forEach(acc => firstLevel[acc.id] = true);
                setExpanded(firstLevel);
            }
        } catch (error) {
            console.error(error);
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

        // Lazy Load Logic
        if (isExpanding && account.is_parent && (!account.children || account.children.length === 0)) {
            setLoadingChildren(prev => ({ ...prev, [account.id]: true }));
            try {
                const children = await getAccountChildren(account.id);
                if (children && children.length > 0) {
                    // Update tree with new children
                    const updateTreeRecursively = (nodes: any[]): any[] => {
                        return nodes.map(node => {
                            if (node.id === account.id) {
                                return { ...node, children: children };
                            }
                            if (node.children) {
                                return { ...node, children: updateTreeRecursively(node.children) };
                            }
                            return node;
                        });
                    };
                    setAccounts(prev => updateTreeRecursively(prev));

                    // Also update flatAccounts for search/dropdowns if needed, though incomplete list
                    setFlatAccounts(prev => [...prev, ...children]);
                } else {
                    toast({ description: 'لا يوجد حسابات فرعية', duration: 2000 });
                }
            } catch (err) {
                toast({ title: 'خطأ', description: 'فشل تحميل الحسابات الفرعية', variant: 'destructive' });
            } finally {
                setLoadingChildren(prev => ({ ...prev, [account.id]: false }));
            }
        }
    };

    const expandAll = () => {
        // Only expands what is currently loaded
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

    // --- Actions ---

    const handleCreateClick = () => {
        setNewAccountForm({
            name_ar: '',
            name_en: '',
            description: '',
            parent_id: '',
            is_active: true
        });
        setCreateDialogOpen(true);
    };

    const handleConfirmCreate = async () => {
        if (!newAccountForm.name_ar || !newAccountForm.parent_id) {
            toast({ title: 'خطأ', description: 'يرجى ملء الحقول الإلزامية (الاسم والحساب الرئيسي)', variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            const res = await createAccount(newAccountForm);
            if (res.success) {
                toast({ title: 'تم الحفظ', description: 'تم إنشاء الحساب بنجاح' });
                setCreateDialogOpen(false);
                fetchAccounts();
            } else {
                toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            }
        } catch (error) {
            console.error(error);
            toast({ title: 'خطأ', description: 'حدث خطأ غير متوقع', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActiveStatus = async (id: string, newStatus: boolean) => {
        // Optimistic update could be done here, but full fetch is safer for tree
        setSaving(true);
        try {
            const res = await toggleAccountStatus(id, newStatus);
            if (res.success) {
                toast({ title: newStatus ? 'تم تنشيط الحساب' : 'تم إيقاف الحساب' });
                fetchAccounts();
            } else {
                toast({ title: 'خطأ', description: res.error, variant: 'destructive' });
            }
        } catch (error) {
            console.error(error);
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
            description: account.description || ''
        });
        setEditDialogOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingAccount) return;
        setSaving(true);
        try {
            const res = await updateAccount(editingAccount.id, editForm);
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

    const handleDeleteClick = (account: any) => {
        // Double check children locally before server check
        if (account.children && account.children.length > 0) {
            toast({ title: 'تنبيه', description: 'لا يمكن حذف حساب رئيسي يحتوي على حسابات فرعية', variant: 'destructive' });
            return;
        }
        setDeletingAccount(account);
        setDeleteAlertOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deletingAccount) return;
        setSaving(true);
        try {
            const res = await deleteAccount(deletingAccount.id);
            if (res.success) {
                toast({ title: 'تم الحذف بنجاح' });
                setDeleteAlertOpen(false);
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

    // --- Search Filter Logic ---
    // A simplified recursive filter for the tree
    const filterNodes = (nodes: any[]): any[] => {
        // If query is empty and showInactive is true, show all.
        // If query is empty and showInactive is false, filter by active logic.

        return nodes.reduce((filtered: any[], node) => {
            // 1. Filter by Active/Inactive
            if (!showInactive && node.is_active === false) {
                return filtered;
            }

            // 2. Filter by Search Query
            // Note: If a child matches, we must show parent even if parent doesn't match query
            // BUT parent must respect showInactive unless it has matching children?

            const isMatch = !searchQuery ||
                node.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
                node.account_code.includes(searchQuery);

            const filteredChildren = node.children ? filterNodes(node.children) : [];

            if (isMatch || filteredChildren.length > 0) {
                filtered.push({ ...node, children: filteredChildren });
                if (searchQuery && !expanded[node.id]) {
                    // Auto expand on search
                    // Careful with direct mutation in render, but usually ok for shallow expand obj
                    // Better to handle in useEffect but keeping simple
                }
            }
            return filtered;
        }, []);
    };

    const displayedAccounts = filterNodes(accounts);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100" dir="rtl">
            {/* Header */}
            <div className="bg-white border-b shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button
                                onClick={() => router.push('/accounting/dashboard')}
                                variant="outline"
                                size="sm"
                                className="gap-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                رجوع
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                                    <BookOpen className="h-8 w-8 text-blue-600" />
                                    دليل الحسابات
                                </h1>
                                <p className="text-slate-600 mt-1">إدارة شجرة الحسابات المالية (إصدار كامل)</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={handleCreateClick}
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                            >
                                <Plus className="h-4 w-4" />
                                حساب جديد
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Search and Filters */}
                <Card className="mb-6">
                    <CardContent className="p-6">
                        <div className="flex gap-4 flex-wrap">
                            <div className="flex-1 min-w-[300px]">
                                <div className="relative">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <Input
                                        placeholder="البحث برقم الحساب أو الاسم..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pr-10"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center space-x-2 rtl:space-x-reverse bg-slate-50 px-3 py-2 rounded border">
                                <Checkbox
                                    id="show-inactive"
                                    checked={showInactive}
                                    onCheckedChange={(checked) => setShowInactive(checked as boolean)}
                                />
                                <Label htmlFor="show-inactive" className="text-sm cursor-pointer select-none">
                                    عرض الحسابات غير النشطة
                                </Label>
                            </div>
                            <Button variant="outline" className="gap-2" onClick={expandAll}>توسيع الكل</Button>
                            <Button variant="outline" className="gap-2" onClick={collapseAll}>طي الكل</Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Accounts Tree Table */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calculator className="h-5 w-5" />
                            شجرة الحسابات
                        </CardTitle>
                        <CardDescription>
                            يمكنك الآن تعديل وحذف الحسابات (مع مراعاة القيود المحاسبية)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex justify-center py-10">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            </div>
                        ) : (
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead className="font-bold w-[400px]">اسم الحساب</TableHead>
                                            <TableHead className="font-bold">رقم الحساب</TableHead>
                                            <TableHead className="font-bold">النوع</TableHead>
                                            <TableHead className="font-bold text-left">الرصيد المحاسبي</TableHead>
                                            <TableHead className="font-bold w-[100px]">إجراءات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayedAccounts.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-10 text-slate-500">
                                                    لا توجد حسابات مطابقة للبحث
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            displayedAccounts.map((account) => (
                                                <AccountRow
                                                    key={account.id}
                                                    account={account}
                                                    expanded={expanded}
                                                    onToggle={toggleExpand}
                                                    onEdit={handleEditClick}
                                                    onDelete={handleDeleteClick}
                                                    onToggleStatus={handleToggleActiveStatus}
                                                />
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Create Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>إضافة حساب جديد</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>الحساب الرئيسي (الأب)</Label>
                            <Select
                                value={newAccountForm.parent_id}
                                onValueChange={(val) => setNewAccountForm({ ...newAccountForm, parent_id: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر الحساب الرئيسي..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                    {flatAccounts.map((acc) => (
                                        <SelectItem key={acc.id} value={acc.id}>
                                            <span className="font-mono text-slate-500 ml-2">{acc.account_code}</span>
                                            {acc.name_ar}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>اسم الحساب (عربي)</Label>
                            <Input
                                value={newAccountForm.name_ar}
                                onChange={e => setNewAccountForm({ ...newAccountForm, name_ar: e.target.value })}
                                placeholder="مثلاً: مصروفات نثرية"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>اسم الحساب (إنجليزي) - اختياري</Label>
                            <Input
                                value={newAccountForm.name_en}
                                onChange={e => setNewAccountForm({ ...newAccountForm, name_en: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>الوصف</Label>
                            <Input
                                value={newAccountForm.description}
                                onChange={e => setNewAccountForm({ ...newAccountForm, description: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center space-x-2 rtl:space-x-reverse pt-2">
                            <Checkbox
                                id="new-account-active"
                                checked={newAccountForm.is_active}
                                onCheckedChange={(checked) => setNewAccountForm({ ...newAccountForm, is_active: checked as boolean })}
                            />
                            <Label htmlFor="new-account-active" className="cursor-pointer">
                                حساب نشط (يظهر في القوائم والملخصات)
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>إلغاء</Button>
                        <Button onClick={handleConfirmCreate} disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إنشاء الحساب'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>تعديل حساب: {editingAccount?.name_ar}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>اسم الحساب (عربي)</Label>
                            <Input
                                value={editForm.name_ar}
                                onChange={e => setEditForm({ ...editForm, name_ar: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>اسم الحساب (إنجليزي)</Label>
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
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>إلغاء</Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التغييرات'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>هل أنت متأكد من حذف هذا الحساب؟</AlertDialogTitle>
                        <AlertDialogDescription>
                            سيتم حذف حساب "{deletingAccount?.name_ar}" نهائياً. لا يمكن التراجع عن هذا الإجراء.
                            <br />
                            <span className="text-red-500 text-xs font-bold mt-2 block">
                                ملاحظة: لا يمكن حذف حساب إذا كان يحتوي على حركات مالية مسجلة.
                            </span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إلغاء</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={saving}
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'نعم، احذف الحساب'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
