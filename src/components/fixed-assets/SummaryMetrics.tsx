'use client';

import React from 'react';
import { TrendingUp, DollarSign, Package, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';

interface SummaryMetricsProps {
    totalCount: number;
    totalCost: number;
    totalDepreciation: number;
    netBookValue: number;
}

export function SummaryMetrics({ totalCount, totalCost, totalDepreciation, netBookValue }: SummaryMetricsProps) {
    const metrics = [
        {
            title: 'إجمالي الأصول',
            value: totalCount.toString(),
            icon: Package,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
        },
        {
            title: 'التكلفة التاريخية',
            value: formatCurrency(totalCost),
            icon: DollarSign,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50',
        },
        {
            title: 'مجمع الإهلاك',
            value: formatCurrency(totalDepreciation),
            icon: TrendingDown,
            color: 'text-red-600',
            bgColor: 'bg-red-50',
        },
        {
            title: 'القيمة الدفترية',
            value: formatCurrency(netBookValue),
            icon: TrendingUp,
            color: 'text-violet-600',
            bgColor: 'bg-violet-50',
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {metrics.map((metric, index) => (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">
                            {metric.title}
                        </CardTitle>
                        <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                            <metric.icon className={`h-5 w-5 ${metric.color}`} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${metric.color}`}>
                            {metric.value}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
