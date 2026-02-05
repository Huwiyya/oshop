"use client";

import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, TooltipProps } from 'recharts';
import { cn } from '@/lib/utils';

interface PremiumChartProps {
    data: any[];
    dataKeys: { key: string; color: string; name?: string }[];
    xAxisKey?: string;
    height?: number;
    className?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
        return (
            <div className="glass-card !bg-slate-900/90 !border-white/20 p-4 rounded-xl shadow-2xl">
                <p className="font-bold text-gray-200 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                        <div
                            className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]"
                            style={{ backgroundColor: entry.color, color: entry.color }}
                        />
                        <span className="text-gray-400">{entry.name}:</span>
                        <span className="font-mono font-bold text-gray-100">
                            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export const PremiumChart = ({ data, dataKeys, xAxisKey = "name", height = 300, className }: PremiumChartProps) => {
    return (
        <div className={cn("w-full h-full min-h-[300px]", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        {dataKeys.map((k, i) => (
                            <linearGradient key={k.key} id={`color${k.key}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={k.color} stopOpacity={0.4} />
                                <stop offset="95%" stopColor={k.color} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                        dataKey={xAxisKey}
                        stroke="rgba(255,255,255,0.3)"
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        stroke="rgba(255,255,255,0.3)"
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} />
                    {dataKeys.map((k) => (
                        <Area
                            key={k.key}
                            type="monotone"
                            dataKey={k.key}
                            name={k.name || k.key}
                            stroke={k.color}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill={`url(#color${k.key})`}
                            animationDuration={1500}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};
