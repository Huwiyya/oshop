import type { Metadata } from "next";
import { Cairo } from 'next/font/google';
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

// Polyfill localStorage for SSR if needed
if (typeof window === 'undefined') {
  const noop = () => { };
  const storageMock = {
    getItem: () => null,
    setItem: noop,
    removeItem: noop,
    clear: noop,
    length: 0,
    key: () => null,
  };

  try {
    if (typeof global.localStorage === 'undefined' || typeof global.localStorage.getItem !== 'function') {
      Object.defineProperty(global, 'localStorage', {
        value: storageMock,
        writable: true,
        configurable: true
      });
    }
  } catch (e) {
    console.error('Failed to polyfill localStorage:', e);
  }
}



const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-cairo',
});


export const metadata: Metadata = {
  title: "Oshop",
  description: "منظومة Oshop لإدارة الشحنات والعملاء",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Next.js will automatically handle the favicon if it's placed in the app directory. */}
      </head>
      <body className={cn("min-h-screen bg-background font-sans antialiased", cairo.variable)} suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
