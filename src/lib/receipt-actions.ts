'use server';

import { createReceiptV2, deleteReceiptV2, getReceiptsV2 } from './treasury-v2-actions';
import { supabaseAdmin as supabase } from './supabase-admin';
import { revalidatePath } from 'next/cache';

// =============================================================================
// LEGACY INTERFACES (Mapped to V2)
// =============================================================================

export interface Receipt {
    id: string;
    date: string;
    reference: string;
    payer?: string;
    relatedUserId?: string; // Link to specific user
    receiveAccountId: string; // The Treasury Account (Cash/Bank) - Debit
    receiveAccountName: string;
    creditAccountId?: string; // The Account paying (Credit) - Customer or Revenue
    creditAccountName?: string;
    description: string;
    amount: number;
    currency: 'LYD' | 'USD';
    lineItems: { accountId: string; amount: number; description?: string }[];
}

// =============================================================================
// MIGRATION ACTIONS
// =============================================================================

export async function createReceipt(data: Omit<Receipt, 'id' | 'reference'>) {
    try {
        console.log("Creating Receipt via V2 Backend...", data);

        // 1. Calculate Total
        const totalAmount = data.lineItems.reduce((sum, item) => sum + item.amount, 0) || data.amount;

        // 2. Map Legacy Data to V2 Input
        const input = {
            date: data.date,
            treasury_account_id: data.receiveAccountId,
            amount: totalAmount,
            description: data.description,
            customer_account_id: undefined, // relying on lines
            lines: data.lineItems.map(item => ({
                account_id: item.accountId,
                amount: item.amount,
                description: item.description
            }))
        };

        // Fallback for single line (creditAccountId) if lineItems is empty
        if ((!input.lines || input.lines.length === 0) && data.creditAccountId) {
            input.lines = [{
                account_id: data.creditAccountId,
                amount: data.amount,
                description: data.description
            }];
        }

        const result = await createReceiptV2(input);

        if (!result.success) {
            throw new Error(result.error);
        }

        revalidatePath('/accounting/receipts');
        return { success: true, id: result.data!.id };

    } catch (e: any) {
        console.error('Create Receipt Error (V2 Migration):', e);
        return { success: false, error: e.message };
    }
}

export async function getReceiptById(id: string): Promise<Receipt | null> {
    const { data, error } = await supabase
        .from('receipts_v2')
        .select(`
            *,
            customer:customer_account_id (name_ar, name_en),
            lines:receipt_lines_v2 (account_id, amount, description)
        `)
        .eq('id', id)
        .single();

    if (error || !data) return null;

    // Map V2 to Legacy Receipt
    const receipt: Receipt = {
        id: data.id,
        date: data.date,
        reference: data.receipt_number,
        payer: data.customer?.name_ar || data.customer?.name_en || '-',
        receiveAccountId: data.treasury_account_id,
        receiveAccountName: '', // Not strictly needed by Edit Page
        description: data.description,
        amount: data.amount,
        currency: 'LYD', // Default V2
        lineItems: data.lines?.map((l: any) => ({
            accountId: l.account_id,
            amount: l.amount,
            description: l.description
        })) || []
    };

    return receipt;
}

export async function getReceipts(filters?: { query?: string; startDate?: string; endDate?: string }): Promise<Receipt[]> {
    const result = await getReceiptsV2(filters);

    if (!result.success || !result.data) {
        return [];
    }

    return result.data.map(v2 => ({
        id: v2.id,
        date: v2.date,
        reference: v2.receipt_number,
        payer: v2.customer?.name_ar || v2.customer?.name_en || '-',
        receiveAccountId: v2.treasury_account_id,
        receiveAccountName: v2.treasury?.name_ar || v2.treasury?.name_en || 'Unknown',
        description: v2.description,
        amount: v2.amount,
        currency: 'LYD',
        lineItems: v2.lines ? v2.lines.map(l => ({
            accountId: l.account_id,
            amount: l.amount,
            description: l.description
        })) : []
    }));
}

export async function deleteReceipt(id: string) {
    return await deleteReceiptV2(id);
}

export async function updateReceipt(id: string, data: Omit<Receipt, 'id' | 'reference'>) {
    // Delete + Create pattern for update
    await deleteReceiptV2(id);
    return await createReceipt(data);
}

