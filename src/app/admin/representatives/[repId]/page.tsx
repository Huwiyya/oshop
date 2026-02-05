// src/app/admin/representatives/[repId]/page.tsx
import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { 
    getRepresentativeById, 
    getOrdersByRepresentativeId, 
    getDepositsByRepresentativeId,
    getTempSubOrdersByRepresentativeId
} from '@/lib/actions';
import { Loader2 } from 'lucide-react';
import { RepresentativeDetails } from '../representative-details';

async function RepresentativeProfilePage({ params }: { params: { repId: string } }) {
    const { repId } = params;

    const [representative, orders, deposits, tempSubOrders] = await Promise.all([
        getRepresentativeById(repId),
        getOrdersByRepresentativeId(repId),
        getDepositsByRepresentativeId(repId),
        getTempSubOrdersByRepresentativeId(repId),
    ]);

    if (!representative) {
        notFound();
    }
    
    return (
        <RepresentativeDetails 
            initialRepresentative={representative}
            initialOrders={orders}
            initialDeposits={deposits}
            initialTempSubOrders={tempSubOrders}
        />
    );
}

const Page = async ({ params: paramsPromise }: { params: Promise<{ repId:string }> }) => {
    const params = await paramsPromise;
    return (
        <Suspense fallback={<LoadingFallback />}>
            <RepresentativeProfilePage params={params} />
        </Suspense>
    );
};

const LoadingFallback = () => (
    <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
    </div>
);

export default Page;
