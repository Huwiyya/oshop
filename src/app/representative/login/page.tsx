
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import Link from "next/link";
import logo from "@/app/assets/logo.png";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { getRepresentativeByUsername } from "@/lib/actions";
import { Bike, Loader2 } from "lucide-react";

const Logo = () => (
  <div className="flex items-center justify-center mb-8">
    <Image src={logo} alt="Logo" width={100} height={100} className="mx-auto" />
  </div>
);

export default function RepresentativeLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }, []);

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
      const representative = await getRepresentativeByUsername(username);

      if (representative && representative.password === password) {
        toast({
          title: "تم تسجيل الدخول بنجاح",
          description: `مرحباً بك أيها المندوب، ${representative.name}`,
        });
        localStorage.setItem('loggedInUser', JSON.stringify({ id: representative.id, type: 'representative' }));
        router.push("/representative/dashboard");
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

  return (
    <div
      className="flex flex-col min-h-screen items-center justify-center bg-gradient-to-br from-secondary via-background to-secondary p-4"
      dir="rtl"
    >
      <main className="w-full max-w-md mx-auto">
        <div className="bg-card/60 backdrop-blur-lg rounded-2xl border shadow-lg p-8 text-center">
          <Logo />

          <div className="mb-6">
            <h1 className="text-4xl font-bold mb-2 text-foreground flex items-center justify-center gap-2">
                <Bike />
                بوابة المندوب
            </h1>
            <p className="text-muted-foreground">سجل الدخول للمتابعة</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 mb-6 text-right">
            <Input
              dir="ltr"
              type="text"
              placeholder="اسم المستخدم (e.g., REP1)"
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
        </div>
      </main>
    </div>
  );
}
