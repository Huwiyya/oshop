'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2, Grip, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Representative } from '@/lib/types';
import { getRepresentatives } from '@/lib/actions';
import { MobileBottomNav, BottomNavItem } from '@/components/ui/MobileBottomNav';
import { Home, Package, History, User } from 'lucide-react';
import Image from 'next/image';
import logo from '@/app/assets/logo.png'; // Import the logo

export default function RepresentativeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [rep, setRep] = useState<Representative | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Force dark mode for this layout
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');

      const loggedInUserStr = localStorage.getItem('loggedInUser');
      if (loggedInUserStr) {
        try {
          const loggedInUser = JSON.parse(loggedInUserStr);
          if (loggedInUser.type === 'representative') {
            const allReps = await getRepresentatives();
            const currentRep = allReps.find(r => r.id === loggedInUser.id);
            if (currentRep) {
              setRep(currentRep);
            } else {
              router.push('/representative/login');
            }
          } else {
            router.push('/representative/login');
          }
        } catch (e) {
          router.push('/representative/login');
        }
      } else {
        router.push('/representative/login');
      }
      setIsLoading(false);
    };
    checkAuth();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('loggedInUser');
    document.documentElement.classList.remove('dark'); // Revert theme on logout
    router.push('/representative/login');
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const navItems: BottomNavItem[] = [
    { label: 'الرئيسية', icon: Home, href: '/representative/dashboard', exact: true },
    { label: 'المعلقة', icon: Package, href: '#pending' },
    { label: 'السجل', icon: History, href: '#history' },
    { label: 'الملف', icon: User, href: '#profile' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 font-sans" dir="rtl">
      {/* Background Effects similar to User Dashboard */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-900/20 via-background to-background" />

      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 p-4 sm:px-6 bg-background/60 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 relative">
            <Image src={logo} alt="Oshop" layout="fill" objectFit="contain" />
          </div>
          <h1 className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-orange-400">محفظة المندوبين</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" title="تسجيل الخروج" onClick={handleLogout} className="text-muted-foreground hover:text-primary">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <div className="min-h-[calc(100vh-4rem)]">
        {children}
      </div>

      <MobileBottomNav items={navItems} />
    </div>
  );
}
