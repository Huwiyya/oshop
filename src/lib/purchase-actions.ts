'use server';

import { supabaseAdmin } from './supabase-admin';
import { addInventoryStock, deleteInventoryTransaction } from './inventory-actions';
import { createJournalEntry, type JournalEntryLine } from './journal-actions';

// --- أنواع البيانات ---
export type PurchaseInvoiceItem = {
    itemId: string;
    quantity: number;
    unitPrice: number; // Cost
    total: number;
    description: string;
    cardNumbers?: string[]; // لأصناف البطاقات، قائمة الأرقام
};

export type CreateInvoiceData = {
    supplierId: string;
    invoiceDate: string;
    items: PurchaseInvoiceItem[];
    currency: 'LYD' | 'USD';
    exchangeRate: number;
    paidAmount: number; // المبلغ المدفوع (إن وجد)
    paymentMethod?: 'cash' | 'bank'; // إذا دفع
    paymentAccountId?: string; // الخزينة/البنك المدفوع منه
    notes?: string;
};

// --- الدوال ---

export async function getPurchaseInvoices() {
    const { data, error } = await supabaseAdmin
        .from('purchase_invoices')
        .select(`
            *,
            supplier:accounts!supplier_account_id(name_ar, name_en)
        `)
        .order('invoice_date', { ascending: false });

    if (error) {
        console.error('Error fetching invoices:', error);
        return [];
    }
    return data;
}

export async function createPurchaseInvoice(data: CreateInvoiceData) {
    // 1. Generate Invoice Number
    // Simple logic: PI-{Year}-{Sequence}
    const year = new Date().getFullYear();
    const { count } = await supabaseAdmin.from('purchase_invoices').select('*', { count: 'exact', head: true });
    const invoiceNumber = `PI-${year}-${(count || 0) + 1000}`; // Start from 1000

    // 2. Calculate Totals
    const subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
    const totalAmount = subtotal; // Add tax logic if needed
    const remainingAmount = totalAmount - data.paidAmount;
    const paymentStatus = data.paidAmount >= totalAmount ? 'paid' : (data.paidAmount > 0 ? 'partial' : 'unpaid');

    // 3. Create Journal Entry (Draft first, or Posted)
    // Dr. Inventory (Total)
    //   Cr. Accounts Payable (Supplier) (Total)
    // If paid:
    //   Dr. Accounts Payable (Paid Amount)
    //     Cr. Cash/Bank (Paid Amount)

    // For simplicity, we create the Invoice Record first
    const { data: invoice, error: invoiceError } = await supabaseAdmin
        .from('purchase_invoices')
        .insert({
            invoice_number: invoiceNumber,
            invoice_date: data.invoiceDate,
            supplier_account_id: data.supplierId,
            currency: data.currency,
            exchange_rate: data.exchangeRate,
            subtotal: subtotal,
            total_amount: totalAmount,
            paid_amount: data.paidAmount,
            remaining_amount: remainingAmount,
            payment_status: paymentStatus,
            notes: data.notes
        })
        .select()
        .single();

    if (invoiceError) throw new Error(invoiceError.message);

    // 4. Insert Invoice Lines & Create Inventory Layers
    for (const item of data.items) {
        // A. Insert Invoice Line
        await supabaseAdmin.from('purchase_invoice_lines').insert({
            invoice_id: invoice.id,
            item_id: item.itemId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total: item.total
            // card_number column can store one, but if multiple, logic differs.
            // We usually store one line per card if needed, or aggregate.
            // Let's assume aggregated line in invoice_lines, but detailed layers.
        });

        // B. Add to Inventory (Layers) - Perpetual Inventory
        // If it's a card item, we might have multiple card numbers
        if (item.cardNumbers && item.cardNumbers.length > 0) {
            // Create a layer for EACH card (quantity 1 per card)
            for (const cardNum of item.cardNumbers) {
                await addInventoryStock({
                    itemId: item.itemId,
                    quantity: 1,
                    unitCost: item.unitPrice,
                    purchaseDate: data.invoiceDate,
                    cardNumber: cardNum,
                    notes: `فاتورة شراء #${invoiceNumber}`
                });
            }
            // If quantity > cardNumbers.length, the rest are added without card numbers?
            // User should ensure they match.
        } else {
            // Normal item (bulk)
            await addInventoryStock({
                itemId: item.itemId,
                quantity: item.quantity,
                unitCost: item.unitPrice,
                purchaseDate: data.invoiceDate,
                notes: `فاتورة شراء #${invoiceNumber}`
            });
        }
    }

    // 5. Create Journal Entry (Accrual)
    // We need to group inventory amounts by their Inventory Account.
    // For MVP, we fetch the first item's inventory account or a default '1140'.
    // A better approach is to fetch item details.
    // Let's assume we use a general Inventory Account '1140' for the total DEBIT.
    // And Supplier Account for CREDIT.

    // Fetch Supplier Account ID (already have data.supplierId)
    // Fetch Inventory Account ID. Let's assume '1130' or find one.
    const { data: inventoryAcc } = await supabaseAdmin.from('accounts').select('id').eq('account_code', '1130').single();
    if (!inventoryAcc) {
        // Fallback: search by name
        // console.warn("Inventory Account 1130 not found, journal entry might fail or need fallback");
    }

    const journalLines: JournalEntryLine[] = [];

    // Debit: Inventory (Total)
    if (inventoryAcc) {
        journalLines.push({
            accountId: inventoryAcc.id,
            description: `استحقاق فاتورة شراء #${invoiceNumber} - ${data.items.length} أصناف`,
            debit: totalAmount,
            credit: 0
        });
    }

    // Credit: Accounts Payable (Supplier)
    journalLines.push({
        accountId: data.supplierId,
        description: `استحقاق فاتورة شراء #${invoiceNumber}`,
        debit: 0,
        credit: totalAmount
    });

    if (journalLines.length === 2) {
        await createJournalEntry({
            date: data.invoiceDate,
            description: `فاتورة شراء #${invoiceNumber}`,
            referenceType: 'purchase_invoice',
            referenceId: invoiceNumber, // or invoice.id
            lines: journalLines,
            currency: data.currency
        });
    }

    // 6. Create Payment Record if paid
    if (data.paidAmount > 0) {
        // Create Payment Journal Entry
        // Dr. Supplier
        //   Cr. Cash/Bank (PaymentAccount)

        // We need the payment account ID. If not provided, we can't post.
        // Assuming data.paymentAccountId is mandatory if paidAmount > 0
        if (data.paymentAccountId) {
            await createJournalEntry({
                date: data.invoiceDate,
                description: `سداد فاتورة شراء #${invoiceNumber}`,
                referenceType: 'payment',
                referenceId: invoiceNumber,
                lines: [
                    {
                        accountId: data.supplierId,
                        description: `سداد جزئي/كلي للفاتورة #${invoiceNumber}`,
                        debit: data.paidAmount,
                        credit: 0
                    },
                    {
                        accountId: data.paymentAccountId,
                        description: `صرف نقدية - فاتورة #${invoiceNumber}`,
                        debit: 0,
                        credit: data.paidAmount
                    }
                ],
                currency: data.currency
            });
        }
    }

    return invoice;
}

export async function deletePurchaseInvoice(id: string) {
    // 1. Get Invoice
    const { data: invoice, error: invError } = await supabaseAdmin.from('purchase_invoices').select('*').eq('id', id).single();
    if (invError || !invoice) throw new Error('Invoice not found');

    // 2. Delete Journal Entries
    await supabaseAdmin.from('journal_entries').delete().eq('reference_id', invoice.invoice_number);

    // 3. Delete Inventory Transactions (and update stock)
    // Find transactions linked by note (Hack due to missing FK)
    const { data: transactions } = await supabaseAdmin
        .from('inventory_transactions')
        .select('id')
        .ilike('notes', `%${invoice.invoice_number}%`);

    if (transactions && transactions.length > 0) {
        for (const trx of transactions) {
            await deleteInventoryTransaction(trx.id);
        }
    }

    // 4. Delete Invoice Lines
    await supabaseAdmin.from('purchase_invoice_lines').delete().eq('invoice_id', id);

    // 5. Delete Invoice
    const { error } = await supabaseAdmin.from('purchase_invoices').delete().eq('id', id);
    if (error) throw new Error(error.message);

    return true;
}
