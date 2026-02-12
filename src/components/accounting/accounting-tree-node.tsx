'use client';

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, Wallet, Landmark, TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AccountingNode } from '@/lib/financial-actions';

interface AccountingTreeNodeProps {
    node: AccountingNode;
    level?: number;
}

const formatCurrency = (amount: number, currency: 'LYD' | 'USD') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 2,
    }).format(amount);
};

const getNodeIcon = (node: AccountingNode): LucideIcon => {
    switch (node.type) {
        case 'asset': return Wallet;
        case 'liability': return Landmark;
        case 'income': return TrendingUp;
        case 'expense': return TrendingDown;
        default: return Folder;
    }
};

export const AccountingTreeNode: React.FC<AccountingTreeNodeProps> = ({ node, level = 0 }) => {
    const [isOpen, setIsOpen] = useState(true);
    const hasChildren = node.children && node.children.length > 0;
    const Icon = getNodeIcon(node);

    return (
        <div className="select-none">
            <div
                className={cn(
                    "flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer border-b border-gray-100 dark:border-white/5",
                    level === 0 ? "bg-white/50 dark:bg-white/5 mb-1 border border-gray-200 dark:border-white/10" : ""
                )}
                style={{ paddingRight: `${level * 1.5 + 0.75}rem` }} // RTL padding
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    {hasChildren ? (
                        isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400 left-0" /> // RTL needs left arrow logic usually, but ChevronRight points right which is "inwards" in LTR. In RTL flip might be needed? Usually ChevronLeft is "closed" in RTL. Let's stick to simple logic or verify.
                        // Lucide ChevronRight points >. In RTL > points against flow.
                        // Let's assume standard behavior for now.
                    ) : (
                        <div className="w-4 h-4" />
                    )}

                    <div className={cn(
                        "p-2 rounded-lg",
                        node.type === 'asset' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" :
                            node.type === 'liability' ? "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400" :
                                node.type === 'income' ? "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400" :
                                    "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400"
                    )}>
                        <Icon className="w-4 h-4" />
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-between">
                    <span className={cn("font-medium", level === 0 ? "text-lg" : "text-sm")}>{node.label}</span>
                    <div className="flex flex-col items-end gap-0.5 text-right">
                        {node.valueLYD !== 0 && (
                            <span className={cn(
                                "font-mono font-bold",
                                node.type === 'expense' || node.type === 'liability' ? "text-rose-500" : "text-emerald-500"
                            )}>
                                {formatCurrency(node.valueLYD, 'LYD')}
                            </span>
                        )}
                        {node.valueUSD !== 0 && (
                            <span className="text-xs text-muted-foreground font-mono">
                                {formatCurrency(node.valueUSD, 'USD')}
                            </span>
                        )}
                        {node.valueLYD === 0 && node.valueUSD === 0 && (
                            <span className="text-gray-300 dark:text-gray-600">-</span>
                        )}
                    </div>
                </div>
            </div>

            {hasChildren && isOpen && (
                <div className="overflow-hidden animate-in slide-in-from-top-2 fade-in duration-300">
                    {node.children!.map((child) => (
                        <AccountingTreeNode key={child.id} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};
