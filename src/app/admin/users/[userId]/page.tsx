
// src/app/admin/users/[userId]/page.tsx
import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getUserById, getOrdersByUserId, getTransactionsByUserId, getDepositsByUserId, getWalletTransactions } from '@/lib/actions';
import { UserProfileClient } from './UserProfileClient';
import { Loader2 } from 'lucide-react';

const UserProfilePage = async ({ params }: { params: { userId: string } }) => {
    const { userId } = params;

    const user = await getUserById(userId);

    if (!user) {
        notFound();
    }

    const [orders, transactions, deposits, walletTransactions] = await Promise.all([
        getOrdersByUserId(userId),
        getTransactionsByUserId(userId),
        getDepositsByUserId(userId),
        getWalletTransactions(userId),
    ]);

    const totalOrdersValue = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.sellingPriceLYD, 0);
    // User debt is stored in user object efficiently, but we could recalculate if needed.
    // user.debt is the source of truth for now.
    const totalDebt = user.debt;
    const totalOrdersCount = user.orderCount;

    return (
        <UserProfileClient
            user={user}
            orders={orders}
            transactions={transactions}
            deposits={deposits}
            walletTransactions={walletTransactions}
            totalOrdersValue={totalOrdersValue}
            totalOrdersCount={totalOrdersCount}
            totalDebt={totalDebt}
        />
    );
};

const Page = async ({ params: paramsPromise }: { params: Promise<{ userId: string }> }) => {
    const params = await paramsPromise;
    return (
        <Suspense fallback={<LoadingFallback />}>
            <UserProfilePage params={params} />
        </Suspense>
    );
};

const LoadingFallback = () => (
    <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
    </div>
);

export default Page;
