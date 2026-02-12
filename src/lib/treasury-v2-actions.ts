'use server';

import { supabaseAdmin as supabase } from './supabase-admin';
import { revalidatePath } from 'next/cache';

// =============================================================================
// TYPES
// =============================================================================

export interface TreasuryLineItemV2 {
    id?: string;
    account_id: string;
    amount: number;
    description?: string;
}

export interface ReceiptV2 {
    id: string;
    receipt_number: string;
    date: string;
    customer_account_id?: string; // Optional if using lines
    treasury_account_id: string;
    amount: number;
    description: string;
    lines?: TreasuryLineItemV2[]; // For split receipts
    created_at: string;
    // Relations
    customer?: { name_ar: string; name_en: string };
    treasury?: { name_ar: string; name_en: string };
}

export interface PaymentV2 {
    id: string;
    payment_number: string;
    date: string;
    supplier_account_id?: string; // Optional if using lines
    treasury_account_id: string;
    amount: number;
    description: string;
    lines?: TreasuryLineItemV2[]; // For split payments
    created_at: string;
    // Relations
    supplier?: { name_ar: string; name_en: string };
    treasury?: { name_ar: string; name_en: string };
}

// =============================================================================
// RECEIPTS (MONEY IN)
// =============================================================================

export async function getReceiptsV2(filters?: { query?: string; startDate?: string; endDate?: string }) {
    let query = supabase
        .from('receipts_v2')
        .select(`
            *,
            customer:customer_account_id (name_ar, name_en),
            treasury:treasury_account_id (name_ar, name_en),
            journal_entry:journal_entry_id (entry_number),
            lines:receipt_lines_v2 (account_id, amount, description)
        `)
        .order('created_at', { ascending: false });

    if (filters?.startDate) query = query.gte('date', filters.startDate);
    if (filters?.endDate) query = query.lte('date', filters.endDate);
    if (filters?.query) {
        query = query.or(`description.ilike.%${filters.query}%,receipt_number.ilike.%${filters.query}%`);
    }

    const { data, error } = await query;

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as ReceiptV2[] };
}

export async function createReceiptV2(input: {
    date: string;
    customer_account_id?: string;
    treasury_account_id: string;
    amount: number;
    description?: string;
    lines?: { account_id: string; amount: number; description?: string }[];
}) {
    try {
        // Call atomic RPC function that creates receipt + journal entry
        const { data, error } = await supabase.rpc('create_receipt_atomic', {
            p_date: input.date,
            p_treasury_account_id: input.treasury_account_id,
            p_amount: input.amount,
            p_description: input.description || 'Receipt',
            p_customer_account_id: input.customer_account_id || null,
            p_lines: input.lines || []  // Send as array, not string!
        });

        if (error) {
            console.error('Create receipt atomic error:', error);
            return { success: false, error: error.message };
        }

        // data is array from RPC, get first row
        const result = Array.isArray(data) ? data[0] : data;

        revalidatePath('/accounting/receipts');
        revalidatePath('/accounting/receipts-v2');
        revalidatePath('/accounting/journal-entries');
        revalidatePath('/accounting/dashboard');

        return {
            success: true,
            data: {
                id: result.ret_receipt_id,
                receipt_number: result.ret_receipt_number,
                journal_entry_id: result.ret_journal_entry_id
            }
        };
    } catch (e: any) {
        console.error('Create receipt error:', e);
        return { success: false, error: e.message };
    }
}

export async function deleteReceiptV2(id: string) {
    try {
        // Call atomic delete RPC that removes receipt + journal entry
        const { error } = await supabase.rpc('delete_receipt_atomic', {
            p_receipt_id: id
        });

        if (error) throw error;

        revalidatePath('/accounting/receipts');
        revalidatePath('/accounting/receipts-v2');
        revalidatePath('/accounting/journal-entries');
        revalidatePath('/accounting/dashboard');
        return { success: true };
    } catch (e: any) {
        console.error('Delete receipt error:', e);
        return { success: false, error: e.message };
    }
}

// =============================================================================
// PAYMENTS (MONEY OUT)
// =============================================================================

export async function getPaymentsV2(filters?: { query?: string; startDate?: string; endDate?: string }) {
    let query = supabase
        .from('payments_v2')
        .select(`
            *,
            supplier:supplier_account_id (name_ar, name_en),
            treasury:treasury_account_id (name_ar, name_en),
            journal_entry:journal_entry_id (entry_number),
            lines:payment_lines_v2 (account_id, amount, description)
        `)
        .order('created_at', { ascending: false });

    if (filters?.startDate) query = query.gte('date', filters.startDate);
    if (filters?.endDate) query = query.lte('date', filters.endDate);
    if (filters?.query) {
        query = query.or(`description.ilike.%${filters.query}%,payment_number.ilike.%${filters.query}%`);
    }

    const { data, error } = await query;

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as PaymentV2[] };
}

export async function getPaymentV2(id: string) {
    const { data, error } = await supabase
        .from('payments_v2')
        .select(`
            *,
            supplier:supplier_account_id (name_ar, name_en),
            treasury:treasury_account_id (name_ar, name_en),
            journal_entry:journal_entry_id (entry_number),
            lines:payment_lines_v2 (account_id, amount, description)
        `)
        .eq('id', id)
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as PaymentV2 };
}

export async function createPaymentV2(input: {
    date: string;
    supplier_account_id?: string;
    treasury_account_id: string;
    amount: number;
    description?: string;
    lines?: { account_id: string; amount: number; description?: string }[];
}) {
    try {
        // Call atomic RPC function that creates payment + journal entry
        const { data, error } = await supabase.rpc('create_payment_atomic', {
            p_date: input.date,
            p_treasury_account_id: input.treasury_account_id,
            p_amount: input.amount,
            p_description: input.description || 'Payment',
            p_supplier_account_id: input.supplier_account_id || null,
            p_lines: input.lines || []  // Send as array, not string!
        });

        if (error) {
            console.error('Create payment atomic error:', error);
            return { success: false, error: error.message };
        }

        // data is array from RPC, get first row
        const result = Array.isArray(data) ? data[0] : data;

        revalidatePath('/accounting/payments');
        revalidatePath('/accounting/payments-v2');
        revalidatePath('/accounting/journal-entries');
        revalidatePath('/accounting/dashboard');

        return {
            success: true,
            data: {
                id: result.ret_payment_id,
                payment_number: result.ret_payment_number,
                journal_entry_id: result.ret_journal_entry_id
            }
        };
    } catch (e: any) {
        console.error('Create payment error:', e);
        return { success: false, error: e.message };
    }
}

export async function deletePaymentV2(id: string) {
    try {
        // Call atomic delete RPC that removes payment + journal entry
        const { error } = await supabase.rpc('delete_payment_atomic', {
            p_payment_id: id
        });

        if (error) throw error;

        revalidatePath('/accounting/payments');
        revalidatePath('/accounting/payments-v2');
        revalidatePath('/accounting/journal-entries');
        revalidatePath('/accounting/dashboard');
        return { success: true };
    } catch (e: any) {
        console.error('Delete payment error:', e);
        return { success: false, error: e.message };
    }
}


