"use client";

import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, TooltipProps } from 'recharts';
import { cn } from '@/lib/utils';

interface PremiumDonutChartProps {
    data: { name: string; value: number; color: string }[];
    height?: number;
    className?: string;
    innerRadius?: number | string;
    outerRadius?: number | string;
}

const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="glass-card !bg-slate-900/90 !border-white/20 p-4 rounded-xl shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-3 mb-1">
                    <div
                        className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]"
                        style={{ backgroundColor: data.fill || data.color, color: data.fill || data.color }}
                    />
                    <p className="font-bold text-gray-200">{data.name}</p>
                </div>
                <p className="text-2xl font-mono font-bold text-white ml-6">
                    {typeof data.value === 'number' ? data.value.toLocaleString() : data.value}
                    <span className="text-sm font-sans text-gray-400 font-normal ml-1">د.ل</span>
                </p>
            </div>
        );
    }
    return null;
};

export const PremiumDonutChart = ({
    data,
    height = 300,
    className,
    innerRadius = "60%",
    outerRadius = "80%"
}: PremiumDonutChartProps) => {

    // Calculate total for percentage if needed, or just let pie handle it.
    // We can add a center label for total if desired, but for now simple donut.

    return (
        <div className={cn("w-full h-full min-h-[300px] relative", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={innerRadius}
                        outerRadius={outerRadius}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        animationDuration={1500}
                        animationBegin={200}
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                                className="drop-shadow-[0_0_10px_rgba(0,0,0,0.3)] transition-all duration-300 hover:opacity-80"
                                stroke="rgba(255,255,255,0.05)"
                                strokeWidth={2}
                            />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                </PieChart>
            </ResponsiveContainer>

            {/* Optional Center Text/Icon could go here absolutley positioned */}
        </div>
    );
};
