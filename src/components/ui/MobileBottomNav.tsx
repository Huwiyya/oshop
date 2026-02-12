'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface BottomNavItem {
    label: string;
    icon: React.ElementType;
    href: string;
    exact?: boolean;
}

interface MobileBottomNavProps {
    items: BottomNavItem[];
}

export const MobileBottomNav = ({ items }: MobileBottomNavProps) => {
    const pathname = usePathname();

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6 pointer-events-none flex justify-center no-print">
            <div className="glass-premium pointer-events-auto rounded-full px-2 py-2 flex items-center gap-1 shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] border border-white/20 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
                {items.map((item) => {
                    const isActive = item.exact
                        ? pathname === item.href
                        : pathname.startsWith(item.href);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="relative px-4 py-2 flex flex-col items-center justify-center min-w-[4rem]"
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="nav-pill"
                                    className="absolute inset-0 bg-primary/10 dark:bg-primary/20 rounded-full"
                                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                />
                            )}
                            <div className={cn(
                                "relative z-10 transition-colors duration-200 flex flex-col items-center gap-1",
                                isActive ? "text-primary dark:text-primary" : "text-muted-foreground hover:text-foreground"
                            )}>
                                <item.icon className={cn("w-6 h-6", isActive && "fill-current")} strokeWidth={isActive ? 2.5 : 2} />
                                {isActive && (
                                    <motion.span
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="text-[10px] font-bold"
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};
