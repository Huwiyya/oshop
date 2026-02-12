'use client';

import { ArrowLeft, ArrowUpCircle, ArrowDownCircle, Landmark } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import React, { useState, useEffect } from 'react';
import { Transaction, User } from '@/lib/types';
import { getTransactions, getUsers } from '@/lib/actions'; 

const FinancialOperationsPage = () => {
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            setIsLoading(true);
            try {
                // In a real app, user ID would come from an auth session.
                const loggedInUserStr = localStorage.getItem('loggedInUser');
                if (!loggedInUserStr) {
                    router.push('/login');
                    return;
                }
                const loggedInUser = JSON.parse(loggedInUserStr);

                // Fetch the specific user
                const allUsers = await getUsers();
                const currentUser = allUsers.find(u => u.id === loggedInUser.id);

                if (currentUser) {
                    setUser(currentUser);
                    const allTransactions = await getTransactions();
                    const userTransactions = allTransactions.filter(t => t.customerId === currentUser.id);
                    setTransactions(userTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                } else {
                     router.push('/login');
                }
            } catch (error) {
                console.error("Failed to fetch data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchUserData();
    }, [router]);

    const totalOrders = transactions.filter(t => (t.type === 'order') && t.status !== 'cancelled').reduce((acc, t) => acc + t.amount, 0);
    const totalPayments = transactions.filter(t => t.type === 'payment').reduce((acc, t) => acc + t.amount, 0);
    const remainingDebt = user?.debt ?? 0; // Use the accurate debt from user object

    const getTransactionIcon = (type: Transaction['type']) => {
        switch(type) {
            case 'order':
                return <ArrowUpCircle className="w-6 h-6" />;
            case 'payment':
                return <ArrowDownCircle className="w-6 h-6" />;
            default:
                return <ArrowUpCircle className="w-6 h-6" />;
        }
    }
    const getTransactionColorClasses = (type: Transaction['type']) => {
        switch(type) {
            case 'order':
                return {
                    bg: 'bg-red-100 text-red-600',
                    text: 'text-destructive'
                };
            case 'payment':
                return {
                    bg: 'bg-green-100 text-green-600',
                    text: 'text-green-600'
                };
            default:
                return {
                    bg: 'bg-red-100 text-red-600',
                    text: 'text-destructive'
                };
        }
    }


    return (
        <div className="min-h-screen bg-background flex flex-col" dir="rtl">
            <header className="bg-primary text-primary-foreground p-4 flex justify-between items-center sticky top-0 z-10 shadow-md">
                <h1 className="text-xl font-bold flex-grow text-center">سجل المعاملات</h1>
                <button onClick={() => router.back()} className="text-primary-foreground">
                    <ArrowLeft className="w-6 h-6" />
                </button>
            </header>

            <main className="flex-grow bg-secondary/50">
                <div className="flex flex-col h-full">
                    <div className="p-4">
                        <div className="relative bg-card text-card-foreground rounded-2xl p-5 shadow-sm border">
                            <h2 className="text-lg font-bold mb-3 text-center">{user?.name || '...'}</h2>
                            <div className="flex justify-between items-center">
                                <div className="text-center">
                                    <p className="text-sm text-muted-foreground">الدين المتبقي</p>
                                    <p className="font-bold text-lg text-destructive">{remainingDebt.toFixed(2)} د.ل</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-muted-foreground">إجمالي المطلوبات</p>
                                    <p className="font-bold text-lg text-primary">{totalOrders.toFixed(2)} د.ل</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-grow overflow-y-auto p-4 pt-0 space-y-3">
                         {isLoading ? (
                            <div className="text-center text-muted-foreground pt-10">جاري تحميل المعاملات...</div>
                        ) : transactions.length === 0 ? (
                            <div className="text-center text-muted-foreground pt-10">لا توجد معاملات لعرضها.</div>
                        ) : (
                            transactions.map(transaction => {
                                const colors = getTransactionColorClasses(transaction.type);
                                return (
                                <Card key={transaction.id} className="bg-card rounded-xl shadow-sm">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className={`p-2 rounded-lg ${colors.bg}`}>
                                            {getTransactionIcon(transaction.type)}
                                        </div>
                                        <div className="flex-grow">
                                            <p className="font-semibold text-foreground">{transaction.description}</p>
                                            <p className="text-sm text-muted-foreground">{new Date(transaction.date).toLocaleDateString('ar-LY')}</p>
                                        </div>
                                        <div className="text-left">
                                            <p className={`font-bold text-lg ${colors.text}`}>
                                                {transaction.type === 'payment' ? '+' : '-'}
                                                {transaction.amount.toFixed(2)} د.ل
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )})
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default FinancialOperationsPage;
