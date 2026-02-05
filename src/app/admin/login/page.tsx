
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import Link from "next/link";
import logo from "@/app/assets/logo.png";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { getManagerByUsername, ensureDefaultAdminExists } from "@/lib/actions";
import { Loader2, BarChart3, Calculator, ArrowRight } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { motion, AnimatePresence } from "framer-motion";

const Logo = () => (
  <div className="flex items-center justify-center mb-8">
    <Image src={logo} alt="Logo" width={100} height={100} className="mx-auto" />
  </div>
);

export default function AdminLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showDashboardSelection, setShowDashboardSelection] = useState(false);
  const [managerData, setManagerData] = useState<any>(null);
  const { setLightMode } = useTheme();

  useEffect(() => {
    setLightMode();
  }, [setLightMode]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast({
        title: "خطأ في الإدخال",
        description: "الرجاء إدخال اسم المستخدم وكلمة المرور.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      // Ensure the default admin exists before attempting to log in
      await ensureDefaultAdminExists();
      const manager = await getManagerByUsername(username);

      if (manager && manager.password === password) {
        toast({
          title: "تم تسجيل الدخول بنجاح",
          description: `مرحباً بك، ${manager.name}`,
        });
        localStorage.setItem('loggedInUser', JSON.stringify({ id: manager.id, type: 'admin' }));
        setManagerData(manager);
        setShowDashboardSelection(true);
      } else {
        toast({
          title: "فشل تسجيل الدخول",
          description: "اسم المستخدم أو كلمة المرور غير صحيحة.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "خطأ في الخادم",
        description: "حدث خطأ أثناء محاولة تسجيل الدخول. الرجاء المحاولة مرة أخرى.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDashboardSelection = (dashboardType: 'operations' | 'accounting') => {
    if (dashboardType === 'operations') {
      router.push("/admin/dashboard");
    } else {
      router.push("/accounting/dashboard");
    }
  };

  return (
    <div
      className="flex flex-col min-h-screen items-center justify-center bg-gradient-to-br from-secondary via-background to-secondary p-4"
      dir="rtl"
    >
      <main className="w-full max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {!showDashboardSelection ? (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-card/60 backdrop-blur-lg rounded-2xl border shadow-lg p-8 text-center"
            >
              <Logo />

              <div className="mb-6">
                <h1 className="text-4xl font-bold mb-2 text-foreground">
                  لوحة تحكم المدير
                </h1>
                <p className="text-muted-foreground">سجل الدخول للمتابعة</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4 mb-6 text-right">
                <Input
                  dir="ltr"
                  type="text"
                  placeholder="اسم المستخدم"
                  className="h-12 text-center bg-transparent"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                />
                <Input
                  dir="rtl"
                  type="password"
                  placeholder="كلمة السر"
                  className="h-12 text-center bg-transparent"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 text-lg font-semibold rounded-lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                      <>
                          <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                          جاري التحقق...
                      </>
                  ) : 'تسجيل الدخول'}
                </Button>
              </form>

              <div className="mt-6">
                <Link href="/" passHref>
                  <Button variant="link">العودة إلى صفحة المستخدم</Button>
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dashboard-selection"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card/60 backdrop-blur-lg rounded-2xl border shadow-lg p-8"
            >
              <Logo />

              <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold mb-2 text-foreground">
                  اختر لوحة التحكم
                </h1>
                <p className="text-muted-foreground">
                  مرحباً {managerData?.name}، اختر اللوحة التي تريد الدخول إليها
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* لوحة العمليات */}
                <motion.button
                  whileHover={{ scale: 1.02, y: -5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDashboardSelection('operations')}
                  className="group relative overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-8 text-right transition-all hover:border-primary/40 hover:shadow-xl"
                >
                  <div className="absolute top-4 left-4">
                    <BarChart3 className="h-16 w-16 text-primary/20 group-hover:text-primary/30 transition-colors" />
                  </div>
                  
                  <div className="relative z-10">
                    <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                      <BarChart3 className="h-7 w-7 text-primary" />
                    </div>
                    
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      لوحة التحكم
                    </h3>
                    
                    <p className="text-muted-foreground mb-4 text-sm">
                      إدارة الشحنات، العملاء، الطلبات، والعمليات اليومية
                    </p>
                    
                    <div className="flex items-center justify-between text-primary font-semibold">
                      <span>دخول</span>
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </motion.button>

                {/* لوحة المحاسبة */}
                <motion.button
                  whileHover={{ scale: 1.02, y: -5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleDashboardSelection('accounting')}
                  className="group relative overflow-hidden rounded-xl border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 p-8 text-right transition-all hover:border-emerald-500/40 hover:shadow-xl"
                >
                  <div className="absolute top-4 left-4">
                    <Calculator className="h-16 w-16 text-emerald-500/20 group-hover:text-emerald-500/30 transition-colors" />
                  </div>
                  
                  <div className="relative z-10">
                    <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                      <Calculator className="h-7 w-7 text-emerald-600" />
                    </div>
                    
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      لوحة المحاسبة
                    </h3>
                    
                    <p className="text-muted-foreground mb-4 text-sm">
                      دليل الحسابات، القيود، الفواتير، والتقارير المالية
                    </p>
                    
                    <div className="flex items-center justify-between text-emerald-600 font-semibold">
                      <span>دخول</span>
                      <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </motion.button>
              </div>

              <div className="mt-8 text-center">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setShowDashboardSelection(false);
                    setUsername("");
                    setPassword("");
                    localStorage.removeItem('loggedInUser');
                  }}
                >
                  تسجيل خروج
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
