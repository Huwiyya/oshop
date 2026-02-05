import React from 'react';
import { cn } from '@/lib/utils';
import { motion, HTMLMotionProps } from 'framer-motion';

interface GlassCardProps extends HTMLMotionProps<"div"> {
    children: React.ReactNode;
    className?: string;
    variant?: 'default' | 'premium' | 'neon';
    hoverEffect?: boolean;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
    ({ children, className, variant = 'default', hoverEffect = true, ...props }, ref) => {

        const variants = {
            default: "glass-card bg-white/70 dark:bg-slate-900/40 border-black/5 dark:border-white/5",
            premium: "glass-premium border-black/5 dark:border-white/10",
            neon: "bg-white/90 dark:bg-slate-900/80 border border-primary/20 dark:border-primary/50 shadow-[0_0_15px_rgba(15,171,244,0.15)]",
        };

        const hoverStyles = hoverEffect ? "hover:scale-[1.02] hover:shadow-2xl hover:border-black/10 dark:hover:border-white/20 hover:bg-white/80 dark:hover:bg-slate-800/60" : "";

        return (
            <motion.div
                ref={ref}
                className={cn(
                    "relative overflow-hidden rounded-2xl p-6 transition-all duration-300",
                    variants[variant],
                    hoverStyles,
                    className
                )}
                {...props}
            >
                {/* Subtle sheen effect */}
                <div className="absolute inset-0 bg-gradient-to-tr from-black/5 dark:from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div className="relative z-10">
                    {children}
                </div>
            </motion.div>
        );
    }
);

GlassCard.displayName = 'GlassCard';

export { GlassCard };
