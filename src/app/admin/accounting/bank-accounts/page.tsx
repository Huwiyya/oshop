import React from 'react';
import { getBankAccounts } from '@/lib/accounting-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Landmark } from 'lucide-react';
import Link from 'next/link';
import NewBankAccountDialog from './_components/new-bank-account-dialog';

export default async function BankAccountsPage() {
    const accountsData = await getBankAccounts();

    // Map database fields to display fields and extract bank info from description
    const accounts = accountsData.map((acc: any) => {
        // Try to extract account number from description
        const descMatch = acc.description?.match(/Account:\s*(\S+)/);
        const accountNumber = descMatch ? descMatch[1] : null;

        return {
            id: acc.id,
            name: acc.name_ar || acc.name_en || 'حساب بنكي',
            currency: acc.currency || 'LYD',
            balance: acc.current_balance || 0,
            accountNumber: accountNumber,
            description: acc.description
        };
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">الحسابات البنكية (Bank Accounts)</h1>
                    <p className="text-muted-foreground">الحسابات المصرفية والجاري</p>
                </div>
                <NewBankAccountDialog />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {accounts.map((account) => (
                    <Link key={account.id} href={`/admin/accounting/bank-accounts/${account.id}`}>
                        <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex justify-between items-start">
                                    <span className="group-hover:text-primary transition-colors">{account.name}</span>
                                    <Landmark className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                                </CardTitle>
                                <CardDescription>
                                    {account.currency} | {account.accountNumber ? `رقم: ${account.accountNumber}` : '---'}
                                </CardDescription>
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
                        <p className="text-muted-foreground">لا توجد حسابات بنكية مسجلة</p>
                    </div>
                )}
            </div>
        </div>
    );
}
