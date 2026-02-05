
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import logo from '@/app/assets/logo.png';
import { Ship, Plane } from 'lucide-react';

const SplashScreen = () => {
  const router = useRouter();

  useEffect(() => {
    // This function will only be defined and called on the client-side
    const initializeThemeAndRedirect = () => {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');

      const timer = setTimeout(() => {
        const loggedInUser = localStorage.getItem('loggedInUser');
        if (loggedInUser) {
          try {
            const userData = JSON.parse(loggedInUser);
            switch (userData.type) {
              case 'user':
                router.push('/dashboard');
                break;
              case 'admin':
                router.push('/admin/dashboard');
                break;
              case 'representative':
                router.push('/representative/dashboard');
                break;
              default:
                router.push('/login');
            }
          } catch (e) {
            router.push('/login');
          }
        } else {
          router.push('/login');
        }
      }, 4000); // Keep animation duration

      return () => clearTimeout(timer);
    };

    // Ensure this runs only in the browser
    if (typeof window !== 'undefined') {
      initializeThemeAndRedirect();
    }

  }, [router]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: 'easeInOut',
        staggerChildren: 0.4,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.7, ease: 'easeOut' },
    },
  };

  const planeVariants = {
    fly: {
      x: ['-100%', '150%'],
      y: ['-20%', '20%'],
      rotate: [10, -5],
      transition: {
        x: { duration: 15, repeat: Infinity, ease: 'linear' },
        y: { duration: 7, repeat: Infinity, yoyo: Infinity, ease: 'easeInOut' },
        rotate: { duration: 10, repeat: Infinity, yoyo: Infinity, ease: 'easeInOut' }
      }
    }
  };

  const shipVariants = {
    sail: {
      x: ['120%', '-150%'],
      y: ['-5%', '5%'],
      rotate: [-2, 2],
      transition: {
        x: { duration: 20, repeat: Infinity, ease: 'linear', delay: 2 },
        y: { duration: 4, repeat: Infinity, yoyo: Infinity, ease: 'easeInOut' },
        rotate: { duration: 5, repeat: Infinity, yoyo: Infinity, ease: 'easeInOut' }
      }
    }
  };

  return (
    <div className="relative flex flex-col min-h-screen items-center justify-center bg-gradient-to-br from-secondary via-background to-secondary dark:from-slate-900 dark:via-black dark:to-slate-900 p-4 text-center overflow-hidden">

      <motion.div
        className="absolute top-1/4 left-0 w-full opacity-10"
        variants={planeVariants}
        animate="fly"
      >
        <Plane className="w-24 h-24 text-primary" />
      </motion.div>

      <motion.div
        className="absolute bottom-1/4 right-0 w-full opacity-5"
        variants={shipVariants}
        animate="sail"
      >
        <Ship className="w-32 h-32 text-primary" />
      </motion.div>


      <motion.div
        className="relative z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} suppressHydrationWarning={true}>
          <Image
            src={logo}
            alt="Logo"
            width={120}
            height={120}
            className="mx-auto mb-8"
            priority
          />
        </motion.div>
        <motion.h1
          variants={itemVariants}
          className="text-2xl md:text-3xl font-bold text-foreground mb-4 max-w-lg mx-auto"
        >
          سواء كنت شركة أو فردًا، نوصل شحنتك بأمان وفي الوقت المحدد
        </motion.h1>
        <motion.div variants={itemVariants} className="mt-8">
          <div className="w-16 h-1.5 bg-primary/30 rounded-full mx-auto animate-pulse"></div>
        </motion.div>
      </motion.div>

      <footer className="absolute bottom-4 text-xs text-muted-foreground z-10">
        جميع الحقوق محفوظة لشركة Oshop
      </footer>
    </div>
  );
};

export default SplashScreen;
