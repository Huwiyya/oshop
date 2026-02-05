import React from 'react';
import { getCashAccounts, getBankAccounts } from '@/lib/accounting-actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, Landmark, Plus } from 'lucide-react';
import Link from 'next/link';

export default async function CashAndBankPage() {
    const cashAccountsData = await getCashAccounts();
    const bankAccountsData = await getBankAccounts();

    // Map database fields to display fields
    const cashAccounts = cashAccountsData.map((acc: any) => ({
        id: acc.id,
        name: acc.name_ar || acc.name_en || 'حساب نقدي',
        currency: acc.currency || 'LYD',
        balance: acc.current_balance || 0,
        type: 'cash' as const
    }));

    const bankAccounts = bankAccountsData.map((acc: any) => {
        const descMatch = acc.description?.match(/Account:\s*(\S+)/);
        const accountNumber = descMatch ? descMatch[1] : null;

        return {
            id: acc.id,
            name: acc.name_ar || acc.name_en || 'حساب بنكي',
            currency: acc.currency || 'LYD',
            balance: acc.current_balance || 0,
            accountNumber: accountNumber,
            type: 'bank' as const
        };
    });

    const totalCashLYD = cashAccounts
        .filter(a => a.currency === 'LYD')
        .reduce((sum, a) => sum + a.balance, 0);

    const totalCashUSD = cashAccounts
        .filter(a => a.currency === 'USD')
        .reduce((sum, a) => sum + a.balance, 0);

    const totalBankLYD = bankAccounts
        .filter(a => a.currency === 'LYD')
        .reduce((sum, a) => sum + a.balance, 0);

    const totalBankUSD = bankAccounts
        .filter(a => a.currency === 'USD')
        .reduce((sum, a) => sum + a.balance, 0);

    const grandTotalLYD = totalCashLYD + totalBankLYD;
    const grandTotalUSD = totalCashUSD + totalBankUSD;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-orange-500">
                    النقدية والبنوك (Cash & Bank)
                </h1>
                <p className="text-muted-foreground mt-1">
                    نظرة شاملة على جميع الخزائن النقدية والحسابات البنكية
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-t-4 border-t-emerald-500">
                    <CardHeader className="pb-2">
                        <CardDescription>إجمالي النقدية (LYD)</CardDescription>
                        <CardTitle className="text-2xl font-mono text-emerald-600">
                            {totalCashLYD.toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card className="border-t-4 border-t-blue-500">
                    <CardHeader className="pb-2">
                        <CardDescription>إجمالي البنوك (LYD)</CardDescription>
                        <CardTitle className="text-2xl font-mono text-blue-600">
                            {totalBankLYD.toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card className="border-t-4 border-t-emerald-400">
                    <CardHeader className="pb-2">
                        <CardDescription>إجمالي النقدية (USD)</CardDescription>
                        <CardTitle className="text-2xl font-mono text-emerald-500">
                            ${totalCashUSD.toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card className="border-t-4 border-t-blue-400">
                    <CardHeader className="pb-2">
                        <CardDescription>إجمالي البنوك (USD)</CardDescription>
                        <CardTitle className="text-2xl font-mono text-blue-500">
                            ${totalBankUSD.toLocaleString()}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Grand Total */}
            <Card className="bg-gradient-to-r from-primary/10 to-orange-500/10 border-2 border-primary/20">
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-center md:text-right">
                            <p className="text-sm text-muted-foreground mb-1">المجموع الكلي</p>
                            <p className="text-3xl font-bold font-mono text-primary">
                                {grandTotalLYD.toLocaleString()} LYD
                            </p>
                        </div>
                        <div className="text-center md:text-left">
                            <p className="text-sm text-muted-foreground mb-1">Total</p>
                            <p className="text-3xl font-bold font-mono text-orange-600">
                                ${grandTotalUSD.toLocaleString()} USD
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Cash Accounts Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Wallet className="w-6 h-6 text-emerald-600" />
                        الخزائن النقدية
                    </h2>
                    <Link href="/admin/accounting/cash-accounts">
                        <button className="text-sm text-primary hover:underline">
                            عرض الكل ←
                        </button>
                    </Link>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {cashAccounts.map((account) => (
                        <Link key={account.id} href={`/admin/accounting/cash-accounts/${account.id}`}>
                            <Card className="hover:border-emerald-500/50 transition-colors cursor-pointer group">
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex justify-between items-start text-lg">
                                        <span className="group-hover:text-emerald-600 transition-colors">{account.name}</span>
                                        <Wallet className="w-5 h-5 text-muted-foreground group-hover:text-emerald-600" />
                                    </CardTitle>
                                    <CardDescription>{account.currency === 'LYD' ? 'دينار ليبي' : 'دولار أمريكي'}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold font-mono text-emerald-600">
                                        {account.balance.toLocaleString()}
                                        <span className="text-sm font-normal text-muted-foreground ml-1">{account.currency}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}

                    {cashAccounts.length === 0 && (
                        <div className="col-span-full text-center py-8 bg-white dark:bg-white/5 rounded-xl border border-dashed">
                            <p className="text-muted-foreground">لا توجد خزائن نقدية</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bank Accounts Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Landmark className="w-6 h-6 text-blue-600" />
                        الحسابات البنكية
                    </h2>
                    <Link href="/admin/accounting/bank-accounts">
                        <button className="text-sm text-primary hover:underline">
                            عرض الكل ←
                        </button>
                    </Link>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {bankAccounts.map((account) => (
                        <Link key={account.id} href={`/admin/accounting/bank-accounts/${account.id}`}>
                            <Card className="hover:border-blue-500/50 transition-colors cursor-pointer group">
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex justify-between items-start text-lg">
                                        <span className="group-hover:text-blue-600 transition-colors">{account.name}</span>
                                        <Landmark className="w-5 h-5 text-muted-foreground group-hover:text-blue-600" />
                                    </CardTitle>
                                    <CardDescription>
                                        {account.currency} | {account.accountNumber ? `رقم: ${account.accountNumber}` : '---'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold font-mono text-blue-600">
                                        {account.balance.toLocaleString()}
                                        <span className="text-sm font-normal text-muted-foreground ml-1">{account.currency}</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}

                    {bankAccounts.length === 0 && (
                        <div className="col-span-full text-center py-8 bg-white dark:bg-white/5 rounded-xl border border-dashed">
                            <p className="text-muted-foreground">لا توجد حسابات بنكية</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
