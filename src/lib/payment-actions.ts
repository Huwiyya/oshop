'use server';

import { createPaymentV2, deletePaymentV2, getPaymentsV2, getReceiptsV2 } from './treasury-v2-actions';
import { revalidatePath } from 'next/cache';

// =============================================================================
// LEGACY INTERFACES (Mapped to V2)
// =============================================================================

export interface Payment {
    id: string;
    date: string;
    reference: string;
    payee?: string;
    relatedUserId?: string;
    paymentAccountId: string; // The Treasury Account (Cash/Bank)
    paymentAccountName: string;
    description: string;
    amount: number;
    currency: 'LYD' | 'USD';
    lineItems: { accountId: string; amount: number; description?: string }[];
}

// =============================================================================
// MIGRATION ACTIONS
// =============================================================================

export async function createPayment(data: Omit<Payment, 'id' | 'reference'>) {
    try {
        console.log("Creating Payment via V2 Backend...", data);

        // 1. Calculate Total from lines
        const totalAmount = data.lineItems.reduce((sum, item) => sum + item.amount, 0);

        // 2. Map Legacy Data to V2 Input
        const input = {
            date: data.date,
            treasury_account_id: data.paymentAccountId,
            amount: totalAmount,
            description: data.description,
            // If there's a specific "Supplier" account in lines, we could maybe set supplier_account_id,
            // but for split payments, we rely on 'lines'.
            supplier_account_id: undefined,
            lines: data.lineItems.map(item => ({
                account_id: item.accountId,
                amount: item.amount,
                description: item.description
            }))
        };

        const result = await createPaymentV2(input);

        if (!result.success) {
            throw new Error(result.error);
        }

        revalidatePath('/accounting/payments');
        return { success: true, id: result.data!.id };

    } catch (e: any) {
        console.error('Create Payment Error (V2 Migration):', e);
        return { success: false, error: e.message };
    }
}

export async function getPayments(filters?: { query?: string; startDate?: string; endDate?: string }): Promise<Payment[]> {
    const result = await getPaymentsV2(filters);

    if (!result.success || !result.data) {
        return [];
    }

    // Map V2 Data back to Legacy Interface
    return result.data.map(v2 => ({
        id: v2.id,
        date: v2.date,
        reference: v2.payment_number,
        payee: v2.supplier?.name_ar || v2.supplier?.name_en || '-',
        paymentAccountId: v2.treasury_account_id,
        paymentAccountName: v2.treasury?.name_ar || v2.treasury?.name_en || 'Unknown Account',
        description: v2.description,
        amount: v2.amount,
        currency: 'LYD', // V2 default
        lineItems: v2.lines ? v2.lines.map(l => ({
            accountId: l.account_id,
            amount: l.amount,
            description: l.description
        })) : []
    }));
}

export async function deletePayment(id: string) {
    return await deletePaymentV2(id);
}

// Stub for update (not fully implemented in V2 actions yet, but legacy expects it)
export async function updatePayment(id: string, data: Omit<Payment, 'id' | 'reference'>) {
    // For now, simpler to Delete + Create, or just throw not implemented if user doesn't use it much.
    // Given the constraints, let's try delete + create as a poor man's update to ensure data integrity

    await deletePaymentV2(id);
    return await createPayment(data);
}


export async function getPaymentById(id: string): Promise<Payment | null> {
    const { getPaymentV2 } = await import('./treasury-v2-actions');
    const result = await getPaymentV2(id);

    if (!result.success || !result.data) {
        return null;
    }

    const v2 = result.data;

    return {
        id: v2.id,
        date: v2.date,
        reference: v2.payment_number,
        payee: v2.supplier?.name_ar || v2.supplier?.name_en || '-',
        paymentAccountId: v2.treasury_account_id,
        paymentAccountName: v2.treasury?.name_ar || v2.treasury?.name_en || 'Unknown Account',
        description: v2.description,
        amount: v2.amount,
        currency: 'LYD',
        lineItems: v2.lines ? v2.lines.map(l => ({
            accountId: l.account_id,
            amount: l.amount,
            description: l.description
        })) : []
    };
}
