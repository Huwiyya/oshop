'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
    ArrowLeft
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

// Mock data - سيتم استبدالها بالبيانات الفعلية من قاعدة البيانات
const mockAccounts = [
    {
        id: '1',
        code: '1000',
        name: 'الأصول',
        type: 'الأصول',
        level: 1,
        balance: 150000,
        isParent: true,
        children: [
            {
                id: '2',
                code: '1100',
                name: 'الأصول المتداولة',
                type: 'الأصول',
                level: 2,
                balance: 100000,
                isParent: true,
                children: [
                    {
                        id: '3',
                        code: '1110',
                        name: 'النقدية والبنوك',
                        type: 'الأصول',
                        level: 3,
                        balance: 50000,
                        isParent: true,
                        children: [
                            { id: '4', code: '1111', name: 'كاش ليبي', type: 'الأصول', level: 4, balance: 25000, isParent: false },
                            { id: '5', code: '1112', name: 'مصرف الجمهورية', type: 'الأصول', level: 4, balance: 15000, isParent: false },
                            { id: '6', code: '1113', name: 'دولار كاش', type: 'الأصول', level: 4, balance: 10000, isParent: false },
                        ]
                    },
                    {
                        id: '7',
                        code: '1120',
                        name: 'الذمم المدينة',
                        type: 'الأصول',
                        level: 3,
                        balance: 30000,
                        isParent: false,
                    },
                    {
                        id: '8',
                        code: '1130',
                        name: 'المخزون',
                        type: 'الأصول',
                        level: 3,
                        balance: 20000,
                        isParent: false,
                    },
                ]
            },
        ]
    },
    {
        id: '9',
        code: '2000',
        name: 'الالتزامات',
        type: 'الالتزامات',
        level: 1,
        balance: 50000,
        isParent: true,
        children: [
            {
                id: '10',
                code: '2100',
                name: 'الالتزامات المتداولة',
                type: 'الالتزامات',
                level: 2,
                balance: 50000,
                isParent: true,
                children: [
                    { id: '11', code: '2110', name: 'الذمم الدائنة', type: 'الالتزامات', level: 3, balance: 30000, isParent: false },
                    { id: '12', code: '2120', name: 'رواتب مستحقة', type: 'الالتزامات', level: 3, balance: 20000, isParent: false },
                ]
            },
        ]
    },
    {
        id: '13',
        code: '4000',
        name: 'الإيرادات',
        type: 'الإيرادات',
        level: 1,
        balance: 200000,
        isParent: true,
        children: [
            { id: '14', code: '4100', name: 'إيرادات المبيعات', type: 'الإيرادات', level: 2, balance: 200000, isParent: false },
        ]
    },
    {
        id: '15',
        code: '5000',
        name: 'المصروفات',
        type: 'المصروفات',
        level: 1,
        balance: 80000,
        isParent: true,
        children: [
            { id: '16', code: '5100', name: 'تكلفة البضاعة المباعة', type: 'المصروفات', level: 2, balance: 50000, isParent: false },
            { id: '17', code: '5200', name: 'مصروف الرواتب', type: 'المصروفات', level: 2, balance: 20000, isParent: false },
            { id: '18', code: '5300', name: 'مصروفات عمومية', type: 'المصروفات', level: 2, balance: 10000, isParent: false },
        ]
    },
];

interface AccountTreeProps {
    account: any;
    expanded: { [key: string]: boolean };
    onToggle: (id: string) => void;
}

const AccountRow = ({ account, expanded, onToggle }: AccountTreeProps) => {
    const paddingRight = `${(account.level - 1) * 2}rem`;
    const isExpanded = expanded[account.id];

    const getCategoryColor = (type: string) => {
        switch (type) {
            case 'الأصول': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'الالتزامات': return 'bg-red-100 text-red-700 border-red-200';
            case 'حقوق الملكية': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'الإيرادات': return 'bg-green-100 text-green-700 border-green-200';
            case 'المصروفات': return 'bg-orange-100 text-orange-700 border-orange-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <>
            <TableRow className="hover:bg-slate-50 transition-colors">
                <TableCell style={{ paddingRight }}>
                    <div className="flex items-center gap-2">
                        {account.isParent && (
                            <button
                                onClick={() => onToggle(account.id)}
                                className="hover:bg-slate-200 rounded p-1 transition-colors"
                            >
                                {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                ) : (
                                    <ChevronRight className="h-4 w-4" />
                                )}
                            </button>
                        )}
                        {!account.isParent && <div className="w-6" />}
                        <span className={`font-${account.level === 1 ? 'bold' : account.level === 2 ? 'semibold' : 'medium'}`}>
                            {account.name}
                        </span>
                        {account.isParent && (
                            <Badge variant="outline" className="text-xs">
                                رئيسي
                            </Badge>
                        )}
                    </div>
                </TableCell>
                <TableCell className="font-mono font-semibold">{account.code}</TableCell>
                <TableCell>
                    <Badge className={getCategoryColor(account.type)} variant="outline">
                        {account.type}
                    </Badge>
                </TableCell>
                <TableCell className="text-left font-semibold">
                    {account.balance.toLocaleString()} د.ل
                </TableCell>
                <TableCell>
                    <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <Edit className="h-4 w-4" />
                        </Button>
                        {!account.isParent && (
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </TableCell>
            </TableRow>
            {account.isParent && isExpanded && account.children?.map((child: any) => (
                <AccountRow key={child.id} account={child} expanded={expanded} onToggle={onToggle} />
            ))}
        </>
    );
};

export default function ChartOfAccountsPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        // Expand first level by default
        const firstLevel: { [key: string]: boolean } = {};
        mockAccounts.forEach(acc => {
            firstLevel[acc.id] = true;
        });
        setExpanded(firstLevel);
    }, []);

    const toggleExpand = (id: string) => {
        setExpanded(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const expandAll = () => {
        const allExpanded: { [key: string]: boolean } = {};
        const expandRecursive = (accounts: any[]) => {
            accounts.forEach(acc => {
                if (acc.isParent) {
                    allExpanded[acc.id] = true;
                    if (acc.children) expandRecursive(acc.children);
                }
            });
        };
        expandRecursive(mockAccounts);
        setExpanded(allExpanded);
    };

    const collapseAll = () => {
        setExpanded({});
    };

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
                                <p className="text-slate-600 mt-1">إدارة شجرة الحسابات المالية</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => alert('قريباً: إضافة حساب جديد')}
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
                {/* Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    {[
                        { label: 'الأصول', value: '150,000 د.ل', color: 'bg-blue-500' },
                        { label: 'الالتزامات', value: '50,000 د.ل', color: 'bg-red-500' },
                        { label: 'الإيرادات', value: '200,000 د.ل', color: 'bg-green-500' },
                        { label: 'المصروفات', value: '80,000 د.ل', color: 'bg-orange-500' },
                    ].map((stat, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                        >
                            <Card>
                                <CardContent className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-3 h-12 rounded ${stat.color}`} />
                                        <div>
                                            <p className="text-sm text-slate-600">{stat.label}</p>
                                            <p className="text-2xl font-bold">{stat.value}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

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
                            <Button variant="outline" className="gap-2">
                                <Filter className="h-4 w-4" />
                                تصفية
                            </Button>
                            <Button variant="outline" className="gap-2" onClick={expandAll}>
                                توسيع الكل
                            </Button>
                            <Button variant="outline" className="gap-2" onClick={collapseAll}>
                                طي الكل
                            </Button>
                            <Button variant="outline" className="gap-2">
                                <Download className="h-4 w-4" />
                                تصدير
                            </Button>
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
                            تتبع عرض هرمي وتفصيلي لجميع حسابات المنشأة
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50">
                                        <TableHead className="font-bold">اسم الحساب</TableHead>
                                        <TableHead className="font-bold">رقم الحساب</TableHead>
                                        <TableHead className="font-bold">النوع</TableHead>
                                        <TableHead className="font-bold text-left">الرصيد</TableHead>
                                        <TableHead className="font-bold">إجراءات</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {mockAccounts.map((account) => (
                                        <AccountRow
                                            key={account.id}
                                            account={account}
                                            expanded={expanded}
                                            onToggle={toggleExpand}
                                        />
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Info Note */}
                <Card className="mt-6 border-blue-200 bg-blue-50">
                    <CardContent className="p-4">
                        <p className="text-sm text-blue-900">
                            💡 <strong>ملاحظة:</strong> هذه بيانات تجريبية. سيتم ربطها بقاعدة البيانات قريباً لعرض الحسابات الفعلية.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
