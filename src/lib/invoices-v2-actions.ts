'use server';

import { supabaseAdmin as supabase } from './supabase-admin';
import { revalidatePath } from 'next/cache';

// =============================================================================
// TYPES
// =============================================================================

export interface InvoiceV2 {
    id: string;
    invoice_number: string;
    date: string;
    customer_account_id?: string;
    supplier_account_id?: string;
    revenue_account_id?: string;
    expense_account_id?: string;
    amount: number;
    tax_amount: number;
    total_amount: number;
    total_cost?: number; // Added for profit calculation
    description: string | null;
    status: 'draft' | 'posted';
    journal_entry_id: string | null;
    created_at: string;

    // Relations
    customer?: { name_ar: string; name_en: string };
    supplier?: { name_ar: string; name_en: string };
    lines?: InvoiceLineV2[];
}

export interface InvoiceLineV2 {
    id?: string;
    invoice_id?: string;
    product_id?: string | null;
    product_name?: string; // Sales
    description?: string; // Purchase
    quantity: number;
    unit_price: number;
    line_total?: number;
    card_number?: string;
}

// =============================================================================
// SALES INVOICES (AR)
// =============================================================================

export async function getSalesInvoicesV2(filters?: { query?: string; startDate?: string; endDate?: string }) {
    let query = supabase
        .from('sales_invoices_v2')
        .select(`
            *,
            customer:customer_account_id (name_ar, name_en),
            lines:sales_invoice_lines_v2 (*)
        `)
        .order('created_at', { ascending: false });

    if (filters?.startDate) query = query.gte('date', filters.startDate);
    if (filters?.endDate) query = query.lte('date', filters.endDate);
    if (filters?.query) {
        query = query.or(`description.ilike.%${filters.query}%,invoice_number.ilike.%${filters.query}%`);
    }

    const { data, error } = await query;

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as InvoiceV2[] };
}

export async function createSalesInvoiceV2(input: {
    date: string;
    customer_account_id: string;
    revenue_account_id: string;
    items: { product_id?: string; product_name: string; quantity: number; unit_price: number; card_number?: string }[];
    description?: string;
}) {
    // 1. Calculate Totals
    const amount = input.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const taxAmount = 0; // TODO: Add tax logic later if needed
    const invoiceNumber = `INV-${Date.now()}`;

    // 2. Insert Header
    const { data: header, error: headerError } = await supabase
        .from('sales_invoices_v2')
        .insert({
            invoice_number: invoiceNumber,
            date: input.date,
            customer_account_id: input.customer_account_id,
            revenue_account_id: input.revenue_account_id,
            amount: amount,
            tax_amount: taxAmount,
            description: input.description,
            status: 'draft' // Changed from 'posted' to 'draft' to allow trigger to fire on update
        })
        .select()
        .single();

    if (headerError) return { success: false, error: headerError.message };

    // 3. Insert Lines
    if (input.items.length > 0) {
        const lines = input.items.map(item => ({
            invoice_id: header.id,
            product_id: item.product_id || null, // Triggers inventory deduction
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            card_number: item.card_number
        }));

        const { error: linesError } = await supabase
            .from('sales_invoice_lines_v2')
            .insert(lines);

        if (linesError) {
            console.error('Error inserting sales lines:', linesError);
            // Logic to rollback header could be added here
            return { success: false, error: 'Header created but lines failed: ' + linesError.message };
        }
    }

    // 4. Post Invoice (Triggers Inventory & Journal)
    const { error: postError } = await supabase
        .from('sales_invoices_v2')
        .update({ status: 'posted' })
        .eq('id', header.id);

    if (postError) return { success: false, error: 'Failed to post invoice: ' + postError.message };

    revalidatePath('/accounting/sales-v2');
    revalidatePath('/accounting/journal-v2');
    return { success: true, data: header };
}

export async function deleteSalesInvoiceV2(id: string) {
    // 1. Get Invoice to find Journal
    const { data: invoice } = await supabase.from('sales_invoices_v2').select('journal_entry_id').eq('id', id).single();

    // 2. Delete Invoice (Cascade deletes lines, Triggers reverse inventory)
    const { error: delError } = await supabase.from('sales_invoices_v2').delete().eq('id', id);
    if (delError) return { success: false, error: delError.message };

    // 3. Delete Journal (if exists)
    if (invoice?.journal_entry_id) {
        await supabase.from('journal_entries_v2').delete().eq('id', invoice.journal_entry_id);
    }

    revalidatePath('/accounting/sales-v2');
    revalidatePath('/accounting/journal-v2');
    return { success: true };
}

// =============================================================================
// PURCHASE INVOICES (AP)
// =============================================================================

export async function getPurchaseInvoicesV2(filters?: { query?: string; startDate?: string; endDate?: string }) {
    let query = supabase
        .from('purchase_invoices_v2')
        .select(`
            *,
            supplier:supplier_account_id (name_ar, name_en),
             lines:purchase_invoice_lines_v2 (*)
        `)
        .order('created_at', { ascending: false });

    if (filters?.startDate) query = query.gte('date', filters.startDate);
    if (filters?.endDate) query = query.lte('date', filters.endDate);
    if (filters?.query) {
        query = query.or(`description.ilike.%${filters.query}%,invoice_number.ilike.%${filters.query}%`);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as InvoiceV2[] };
}

export async function createPurchaseInvoiceV2(input: {
    date: string;
    supplier_account_id: string;
    expense_account_id: string; // Can be Inventory Asset Account for stock
    items: { product_id?: string; description: string; quantity: number; unit_price: number; card_number?: string }[];
    description?: string;
}) {
    const invoiceNumber = `BILL-${Date.now()}`;
    const amount = input.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    // 1. Insert Header
    const { data: header, error: headerError } = await supabase
        .from('purchase_invoices_v2')
        .insert({
            invoice_number: invoiceNumber,
            date: input.date,
            supplier_account_id: input.supplier_account_id,
            expense_account_id: input.expense_account_id,
            amount: amount,
            tax_amount: 0,
            description: input.description,
            status: 'draft' // Start as draft to allow lines insertion before processing
        })
        .select()
        .single();

    if (headerError) return { success: false, error: headerError.message };

    // 2. Insert Lines
    if (input.items.length > 0) {
        const lines = input.items.map(item => ({
            invoice_id: header.id,
            product_id: item.product_id || null, // Triggers inventory addition
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            card_number: item.card_number
        }));

        const { error: linesError } = await supabase
            .from('purchase_invoice_lines_v2')
            .insert(lines);

        if (linesError) {
            return { success: false, error: 'Header created but lines failed: ' + linesError.message };
        }
    }

    // 3. Post Invoice (Triggers Inventory & Journal)
    const { error: postError } = await supabase
        .from('purchase_invoices_v2')
        .update({ status: 'posted' })
        .eq('id', header.id);

    if (postError) return { success: false, error: 'Failed to post invoice: ' + postError.message };

    revalidatePath('/accounting/purchases-v2');
    revalidatePath('/accounting/journal-v2');

    // =========================================================================
    // POST-PROCESSING: FIX CARD LAYERS (Since Trigger might not handle split)
    // =========================================================================
    // Fetch lines to check for card numbers
    const { data: insertedLines } = await supabase
        .from('purchase_invoice_lines_v2')
        .select('*')
        .eq('invoice_id', header.id);

    if (insertedLines) {
        for (const line of insertedLines) {
            if (line.card_number && line.product_id) {
                const cards = line.card_number.split('\n').filter((c: string) => c.trim() !== '');

                if (cards.length > 0) {
                    // 1. Delete the BULK layer created by trigger (if any)
                    // The trigger creates a layer with source_id = invoice_id and product_id
                    await supabase.from('inventory_layers_v2')
                        .delete()
                        .eq('source_id', header.id)
                        .eq('source_type', 'purchase_invoice')
                        .eq('product_id', line.product_id);

                    // 2. Insert INDIVIDUAL layers for each card
                    const layers = cards.map((c: string) => ({
                        product_id: line.product_id,
                        date: header.date,
                        quantity: 1,
                        remaining_quantity: 1,
                        unit_cost: line.unit_price,
                        source_type: 'purchase_invoice',
                        source_id: header.id,
                        card_number: c.trim()
                    }));

                    // 3. Handle Remainder (if quantity > cards)
                    // If user bought 10 but provided 8 cards, we need 2 more items as bulk/unknown
                    const remainder = line.quantity - layers.length;
                    if (remainder > 0) {
                        layers.push({
                            product_id: line.product_id,
                            date: header.date,
                            quantity: remainder,
                            remaining_quantity: remainder, // Start full
                            unit_cost: line.unit_price,
                            source_type: 'purchase_invoice',
                            source_id: header.id,
                            card_number: null
                        });
                    }

                    if (layers.length > 0) {
                        const { error: layerErr } = await supabase.from('inventory_layers_v2').insert(layers);
                        if (layerErr) console.error('Error correcting layers for cards:', layerErr);
                    }
                }
            }
        }
    }

    return { success: true, data: header };
}

export async function deletePurchaseInvoiceV2(id: string) {
    // 1. Get Invoice to find Journal
    const { data: invoice } = await supabase.from('purchase_invoices_v2').select('journal_entry_id').eq('id', id).single();

    // 2. Delete Invoice (Cascade deletes lines, Triggers reverse inventory)
    const { error: delError } = await supabase.from('purchase_invoices_v2').delete().eq('id', id);
    if (delError) return { success: false, error: delError.message };

    // 3. Delete Journal (if exists)
    if (invoice?.journal_entry_id) {
        await supabase.from('journal_entries_v2').delete().eq('id', invoice.journal_entry_id);
    }

    revalidatePath('/accounting/purchases-v2');
    revalidatePath('/accounting/journal-v2');
    return { success: true };
}

export async function getPurchaseInvoiceV2(id: string) {
    const { data, error } = await supabase
        .from('purchase_invoices_v2')
        .select(`
            *,
            supplier:supplier_account_id (name_ar, name_en),
             lines:purchase_invoice_lines_v2 (*)
        `)
        .eq('id', id)
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as InvoiceV2 };
}

export async function getSalesInvoiceV2(id: string) {
    const { data, error } = await supabase
        .from('sales_invoices_v2')
        .select(`
            *,
            customer:customer_account_id (name_ar, name_en),
            lines:sales_invoice_lines_v2 (*)
        `)
        .eq('id', id)
        .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as InvoiceV2 };
}
