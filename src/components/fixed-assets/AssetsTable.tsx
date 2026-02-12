'use client';

import React from 'react';
import { Eye, Trash2, Edit, MoreVertical } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface AssetsTableProps {
    assets: any[];
    loading: boolean;
    onViewDetails: (asset: any) => void;
    onDispose: (asset: any) => void;
    onRefresh: () => void;
}

export function AssetsTable({ assets, loading, onViewDetails, onDispose }: AssetsTableProps) {
    const getStatusBadge = (status: string) => {
        const variants: Record<string, { variant: any; label: string }> = {
            active: { variant: 'default', label: 'نشط' },
            disposed: { variant: 'destructive', label: 'متخلص منه' },
            under_maintenance: { variant: 'secondary', label: 'تحت الصيانة' },
        };

        const config = variants[status] || variants.active;
        return <Badge variant={config.variant as any}>{config.label}</Badge>;
    };

    const getDepreciationPercentage = (accumulated: number, cost: number) => {
        if (cost === 0) return '0';
        return ((accumulated / cost) * 100).toFixed(1);
    };

    if (loading) {
        return (
            <Card className="p-8">
                <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
                </div>
            </Card>
        );
    }

    if (assets.length === 0) {
        return (
            <Card className="p-8">
                <div className="text-center text-slate-500">
                    <p className="text-lg">لا توجد أصول مطابقة للفلاتر</p>
                </div>
            </Card>
        );
    }

    return (
        <Card>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-right">رقم الأصل</TableHead>
                            <TableHead className="text-right">الاسم</TableHead>
                            <TableHead className="text-right">التصنيف</TableHead>
                            <TableHead className="text-right">تاريخ الشراء</TableHead>
                            <TableHead className="text-right">التكلفة</TableHead>
                            <TableHead className="text-right">مجمع الإهلاك</TableHead>
                            <TableHead className="text-right">القيمة الدفترية</TableHead>
                            <TableHead className="text-right">نسبة الإهلاك</TableHead>
                            <TableHead className="text-right">الحالة</TableHead>
                            <TableHead className="text-right">الإجراءات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {assets.map((asset) => {
                            const bookValue = Number(asset.cost) - Number(asset.accumulated_depreciation || 0);
                            const depreciationPct = getDepreciationPercentage(
                                Number(asset.accumulated_depreciation || 0),
                                Number(asset.cost)
                            );

                            return (
                                <TableRow key={asset.id} className="hover:bg-slate-50">
                                    <TableCell className="font-medium">
                                        {asset.asset_number}
                                    </TableCell>
                                    <TableCell>
                                        <div>
                                            <div className="font-medium">{asset.name_ar}</div>
                                            {asset.name_en && (
                                                <div className="text-sm text-slate-500">{asset.name_en}</div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-slate-600">
                                        {asset.asset_category}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {new Date(asset.acquisition_date).toLocaleDateString('ar-LY')}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {formatCurrency(asset.cost)}
                                    </TableCell>
                                    <TableCell className="text-red-600 font-medium">
                                        {formatCurrency(asset.accumulated_depreciation || 0)}
                                    </TableCell>
                                    <TableCell className="text-emerald-600 font-bold">
                                        {formatCurrency(bookValue)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-slate-200 rounded-full h-2">
                                                <div
                                                    className="bg-red-500 h-2 rounded-full transition-all"
                                                    style={{ width: `${Math.min(parseFloat(depreciationPct), 100)}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-sm font-medium">{depreciationPct}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(asset.status)}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => onViewDetails(asset)}>
                                                    <Eye className="h-4 w-4 ml-2" />
                                                    عرض التفاصيل
                                                </DropdownMenuItem>
                                                {asset.status === 'active' && (
                                                    <DropdownMenuItem onClick={() => onDispose(asset)}>
                                                        <Trash2 className="h-4 w-4 ml-2" />
                                                        التخلص من الأصل
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
}
