'use client';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Loader2, PackageCheck, PackageX, Truck, MapPin, DollarSign, CreditCard, Building, Package, Plane, CheckCircle, Clock, User, Phone, Copy, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from "react";
import { getOrderByTrackingId, getRepresentativeById } from "@/lib/actions";
import { Order, OrderStatus, Representative } from "@/lib/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";

// Helper to determine step progress based on status
const getStepIndex = (status: string): number => {
    switch (status) {
        case 'pending': return 0;
        case 'processed': return 1;
        case 'ready': return 1;
        case 'shipped': return 2;
        case 'arrived_misrata': return 3;
        case 'arrived_dubai': return 3;
        case 'arrived_benghazi': return 3;
        case 'arrived_tobruk': return 3;
        case 'out_for_delivery': return 4;
        case 'delivered': return 5;
        case 'cancelled': return -1;
        case 'returned': return -1;
        case 'paid': return 5; // Assuming paid happens after/at delivery for COD scenarios or just marked complete
        default: return 0;
    }
};

const timelineSteps = [
    { label: 'تم الاستلام', icon: <Clock size={16} /> },
    { label: 'تجهيز الطلب', icon: <Package size={16} /> },
    { label: 'تم الشحن', icon: <Plane size={16} /> },
    { label: 'وصول للمخزن', icon: <Building size={16} /> },
    { label: 'خرج للتوصيل', icon: <Truck size={16} /> },
    { label: 'تم التسليم', icon: <PackageCheck size={16} /> },
];

const TrackContent = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [trackingId, setTrackingId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [order, setOrder] = useState<Order | null>(null);
    const [representative, setRepresentative] = useState<Representative | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const idFromUrl = searchParams.get('id');
        if (idFromUrl) {
            setTrackingId(idFromUrl);
            performSearch(idFromUrl);
        }
    }, [searchParams]);

    const performSearch = async (id: string) => {
        if (!id) return;
        setIsLoading(true);
        setError(null);
        setOrder(null);
        setRepresentative(null);
        try {
            const result = await getOrderByTrackingId(id.toUpperCase());
            if (result) {
                setOrder(result);
                if (result.representativeId) {
                    const rep = await getRepresentativeById(result.representativeId);
                    setRepresentative(rep);
                }
            } else {
                setError("لم يتم العثور على شحنة بهذا الرقم");
            }
        } catch (e) {
            setError("حدث خطأ في النظام");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = () => performSearch(trackingId);

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({
                title: "تم النسخ!",
                description: `تم نسخ ${label} إلى الحافظة.`,
            });
        });
    };

    const activeStep = order ? getStepIndex(order.status) : 0;
    const isCancelled = order?.status === 'cancelled' || order?.status === 'returned';

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans pb-10" dir="rtl">
            {/* Background Effects */}
            <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/20 via-background to-background" />
            <div className="fixed top-0 w-full h-96 bg-gradient-to-b from-orange-500/10 to-transparent -z-10" />

            {/* Header */}
            <header className="px-6 py-4 flex items-center justify-between sticky top-0 z-30 bg-background/60 backdrop-blur-xl border-b border-border/50">
                <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-secondary/80">
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <h1 className="text-lg font-bold">تتبع الشحنة</h1>
                <div className="w-10" />
            </header>

            <main className="flex-grow flex flex-col items-center max-w-lg mx-auto w-full p-6 space-y-8">

                {/* Search Section */}
                <div className="w-full space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center space-y-2"
                    >
                        <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                            أين شحنتك؟
                        </h2>
                        <p className="text-muted-foreground">أدخل رقم التتبع لمعرفة مسار شحنتك</p>
                    </motion.div>

                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/30 to-purple-500/30 rounded-2xl blur-xl opacity-30 group-hover:opacity-70 transition-all duration-500" />
                        <GlassCard className="relative p-2 flex items-center gap-2 rounded-2xl border-primary/20 bg-background/80 backdrop-blur-xl">
                            <Input
                                dir="ltr"
                                type="text"
                                placeholder="TRACK-ID..."
                                className="border-0 bg-transparent text-center text-xl font-mono tracking-wider h-14 focus-visible:ring-0 placeholder:text-muted-foreground/30 uppercase"
                                value={trackingId}
                                onChange={(e) => setTrackingId(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <Button
                                className="rounded-xl h-12 w-12 shrink-0 bg-gradient-to-br from-primary to-orange-600 text-white shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                                onClick={handleSearch}
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                            </Button>
                        </GlassCard>
                    </div>
                </div>

                {/* Results Section */}
                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="w-full"
                        >
                            <GlassCard className="p-6 bg-red-500/5 border-red-500/10 flex flex-col items-center text-center gap-3 rounded-3xl">
                                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                    <PackageX className="w-6 h-6 text-red-600" />
                                </div>
                                <h3 className="font-bold text-lg text-red-600">عذراً</h3>
                                <p className="text-muted-foreground">{error}</p>
                            </GlassCard>
                        </motion.div>
                    )}

                    {order && (
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full space-y-6"
                        >
                            {/* Tracking Timeline Card */}
                            <GlassCard className="p-0 rounded-[2.5rem] overflow-hidden border-orange-500/20">
                                <div className="bg-gradient-to-br from-orange-500/10 to-transparent p-6 text-center border-b border-orange-500/10">
                                    <p className="text-sm text-muted-foreground mb-1">رقم الشحنة</p>
                                    <h3 className="text-2xl font-black font-mono tracking-wider text-primary">{order.trackingId}</h3>
                                </div>

                                <div className="p-8 relative">
                                    {isCancelled ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-red-600 gap-4">
                                            <PackageX className="w-16 h-16" />
                                            <h3 className="text-xl font-bold">تم إلغاء الشحنة</h3>
                                            <p className="text-sm text-muted-foreground">يرجى التواصل مع خدمة العملاء للمزيد من التفاصيل</p>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            {/* Vertical Line */}
                                            <div className="absolute top-2 bottom-2 right-[19px] w-0.5 bg-secondary" />

                                            <div className="space-y-6">
                                                {timelineSteps.map((step, index) => {
                                                    const isCompleted = index <= activeStep;
                                                    const isCurrent = index === activeStep;

                                                    return (
                                                        <motion.div
                                                            key={index}
                                                            initial={{ opacity: 0, x: 20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: index * 0.1 }}
                                                            className={cn("relative flex items-center gap-6", !isCompleted && "opacity-40 grayscale")}
                                                        >
                                                            {/* Custom Dot/Icon */}
                                                            <div className={cn(
                                                                "relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-500",
                                                                isCompleted ? "bg-background border-primary text-primary shadow-lg shadow-primary/20" : "bg-secondary border-background text-muted-foreground",
                                                                isCurrent && "scale-110 ring-4 ring-primary/20"
                                                            )}>
                                                                {isCompleted ? <CheckCircle className="w-4 h-4" /> : step.icon}
                                                            </div>

                                                            <div className="flex-grow">
                                                                <h4 className={cn("font-bold text-base", isCurrent && "text-primary")}>{step.label}</h4>
                                                                {isCurrent && (
                                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                                        {new Date(order.operationDate).toLocaleDateString('ar-LY')}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </GlassCard>

                            {/* Customer Details */}
                            <GlassCard className="p-0 rounded-[2rem] overflow-hidden border-white/10">
                                <div className="p-4 bg-secondary/30 border-b border-border/50">
                                    <h3 className="font-bold flex items-center gap-2 text-sm">
                                        <User className="w-4 h-4 text-primary" />
                                        بيانات العميل
                                    </h3>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="flex justify-between items-center group">
                                        <span className="text-xs text-muted-foreground">الاسم</span>
                                        <span className="font-bold text-sm">{order.customerName}</span>
                                    </div>
                                    <Separator className="bg-border/50" />
                                    <div className="flex justify-between items-center group">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">الهاتف</span>
                                            {order.customerPhone && (
                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={() => copyToClipboard(order.customerPhone!, 'رقم الهاتف')}>
                                                    <Copy className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </div>
                                        <span className="font-bold text-sm font-mono tracking-wider">{order.customerPhone || 'غير متوفر'}</span>
                                    </div>
                                    <Separator className="bg-border/50" />
                                    <div className="flex justify-between items-center group">
                                        <span className="text-xs text-muted-foreground">الوجهة</span>
                                        <span className="font-bold text-sm">{order.customerAddress || order.store || 'غير محدد'}</span>
                                    </div>
                                </div>
                            </GlassCard>

                            {/* Representative Info (If assigned) */}
                            {representative && (
                                <GlassCard className="p-0 rounded-[2rem] overflow-hidden border-primary/20 bg-gradient-to-br from-background/80 to-primary/5">
                                    <div className="p-4 bg-primary/10 border-b border-primary/10">
                                        <h3 className="font-bold flex items-center gap-2 text-sm text-primary">
                                            <ShieldCheck className="w-4 h-4" />
                                            مندوب التوصيل
                                        </h3>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="flex justify-between items-center group">
                                            <span className="text-xs text-muted-foreground">الاسم</span>
                                            <span className="font-bold text-sm">{representative.name}</span>
                                        </div>
                                        <Separator className="bg-primary/10" />
                                        <div className="flex justify-between items-center group">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground">الهاتف</span>
                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-primary hover:bg-primary/10" onClick={() => copyToClipboard(representative.phone, 'رقم المندوب')}>
                                                    <Copy className="w-3 h-3" />
                                                </Button>
                                            </div>
                                            <span className="font-bold text-sm font-mono tracking-wider">{representative.phone}</span>
                                        </div>
                                    </div>
                                </GlassCard>
                            )}

                        </motion.div>
                    )}
                </AnimatePresence>

            </main>
        </div>
    );
};

const TrackShipmentPage = () => (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
        <TrackContent />
    </Suspense>
);

export default TrackShipmentPage;
