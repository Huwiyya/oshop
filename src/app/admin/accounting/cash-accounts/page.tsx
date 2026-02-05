import React from 'react';
import { getCashAccounts } from '@/lib/accounting-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Wallet } from 'lucide-react';
import Link from 'next/link';
import NewCashAccountDialog from './_components/new-account-dialog';

export default async function CashAccountsPage() {
    const accountsData = await getCashAccounts();

    // Map database fields to display fields
    const accounts = accountsData.map((acc: any) => ({
        id: acc.id,
        name: acc.name_ar || acc.name_en || 'حساب نقدي',
        currency: acc.currency || 'LYD',
        balance: acc.current_balance || 0,
        description: acc.description
    }));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">الخزائن النقدية (Cash Accounts)</h1>
                    <p className="text-muted-foreground">صناديق النقد والعهد النقدية</p>
                </div>
                <NewCashAccountDialog />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {accounts.map((account) => (
                    <Link key={account.id} href={`/admin/accounting/cash-accounts/${account.id}`}>
                        <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex justify-between items-start">
                                    <span className="group-hover:text-primary transition-colors">{account.name}</span>
                                    <Wallet className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                                </CardTitle>
                                <CardDescription>{account.currency === 'LYD' ? 'دينار ليبي' : 'دولار أمريكي'}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold font-mono">
                                    {account.balance.toLocaleString()}
                                    <span className="text-sm font-normal text-muted-foreground ml-1">{account.currency}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}

                {accounts.length === 0 && (
                    <div className="col-span-full text-center py-12 bg-white dark:bg-white/5 rounded-xl border border-dashed">
                        <p className="text-muted-foreground">لا توجد خزائن نقدية مسجلة</p>
                    </div>
                )}
            </div>
        </div>
    );
}
