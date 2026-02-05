
import React, { Suspense } from 'react';
import AddOrderForm from './form';
import { Loader2 } from 'lucide-react';

const AdminAddOrderPage = () => {
    return (
        <div dir="rtl">
             <Suspense fallback={<LoadingFallback />}>
                <AddOrderForm />
            </Suspense>
        </div>
    );
};

const LoadingFallback = () => (
    <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
    </div>
);

export default AdminAddOrderPage;
