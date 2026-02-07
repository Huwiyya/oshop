'use server';

import { supabaseAdmin } from './supabase-admin';

// Wrapper for Atomic SQL RPCs

export async function createSalesInvoiceAtomic(data: any, items: any[]) {
    const { data: result, error } = await supabaseAdmin.rpc('create_sales_invoice_rpc', {
        invoice_data: data,
        items: items
    });

    if (error) throw new Error(error.message);
    return result;
}

export async function createPurchaseInvoiceAtomic(data: any, items: any[]) {
    const { data: result, error } = await supabaseAdmin.rpc('create_purchase_invoice_rpc', {
        invoice_data: data,
        items: items
    });

    if (error) throw new Error(error.message);
    return result;
}

export async function voidSalesInvoice(invoiceNumber: string, reason: string) {
    const { data: result, error } = await supabaseAdmin.rpc('void_sales_invoice_rpc', {
        invoice_number_param: invoiceNumber,
        reason: reason
    });

    if (error) throw new Error(error.message);
    return result;
}

export async function voidPurchaseInvoice(invoiceNumber: string, reason: string) {
    const { data: result, error } = await supabaseAdmin.rpc('void_purchase_invoice_rpc', {
        invoice_number_param: invoiceNumber,
        reason: reason
    });

    if (error) throw new Error(error.message);
    return result;
}
