'use server';

import { supabaseAdmin } from './supabase-admin';
import { addInventoryStock, deleteInventoryTransaction } from './inventory-actions';
import { createJournalEntry, type JournalEntryLine } from './journal-actions';
import { createPayment } from './payment-actions';

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

export async function getPurchaseInvoices(filters?: { query?: string; startDate?: string; endDate?: string }) {
    let query = supabaseAdmin
        .from('purchase_invoices')
        .select(`
            *,
            supplier:accounts!supplier_account_id(name_ar, name_en)
        `)
        .order('invoice_date', { ascending: false });

    if (filters?.startDate) query = query.gte('invoice_date', filters.startDate);
    if (filters?.endDate) query = query.lte('invoice_date', filters.endDate);
    if (filters?.query) {
        query = query.or(`invoice_number.ilike.%${filters.query}%,notes.ilike.%${filters.query}%`);
    }

    const { data, error } = await query.limit(50);

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
                    notes: `فاتورة شراء #${invoiceNumber}`,
                    referenceId: invoiceNumber,
                    referenceType: 'purchase_invoice'
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
                notes: `فاتورة شراء #${invoiceNumber}`,
                referenceId: invoiceNumber,
                referenceType: 'purchase_invoice'
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

    // 6. Create Payment Record if paid -> Create Formal Payment
    if (data.paidAmount > 0) {
        // Use the centralized createPayment action to ensure "Payments Register" is updated
        // Dr. Supplier (Liability Decrease)
        // Cr. Cash/Bank (Asset Decrease)

        if (data.paymentAccountId) {
            await createPayment({
                date: data.invoiceDate,
                paymentAccountId: data.paymentAccountId,    // Credit: Cash/Bank
                paymentAccountName: '', // Optional
                payee: `مورد فاتورة ${invoiceNumber}`,
                description: `سداد فاتورة شراء #${invoiceNumber}`,
                amount: data.paidAmount,
                currency: data.currency,
                lineItems: [
                    {
                        accountId: data.supplierId, // Debit: Supplier (Payable)
                        amount: data.paidAmount,
                        description: `سداد للمورد - فاتورة شراء #${invoiceNumber}`
                    }
                ]
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
    // Find transactions linked by reference_id (Robust method)
    const { data: transactions } = await supabaseAdmin
        .from('inventory_transactions')
        .select('id')
        .eq('reference_id', invoice.invoice_number)
        .eq('reference_type', 'purchase_invoice');

    // Fallback: search by note if no reference_id (for old data not backfilled yet)
    // But since we ran backfill, we should rely on reference first.
    // If we want to be super safe, we can combine OR logic or check if empty.

    let txToDelete = transactions || [];

    if (txToDelete.length === 0) {
        const { data: oldTx } = await supabaseAdmin
            .from('inventory_transactions')
            .select('id')
            .ilike('notes', `%${invoice.invoice_number}%`);
        if (oldTx) txToDelete = [...txToDelete, ...oldTx];
    }


    if (txToDelete && txToDelete.length > 0) {
        // Deduplicate IDs
        const uniqueIds = Array.from(new Set(txToDelete.map(t => t.id)));
        for (const id of uniqueIds) {
            await deleteInventoryTransaction(id);
        }
    }

    // 4. Delete Invoice Lines
    await supabaseAdmin.from('purchase_invoice_lines').delete().eq('invoice_id', id);

    // 5. Delete Invoice
    const { error } = await supabaseAdmin.from('purchase_invoices').delete().eq('id', id);
    if (error) throw new Error(error.message);

    return true;
}

/**
 * تعديل فاتورة شراء
 * ⚠️ هذه عملية معقدة محاسبياً - نستخدم استراتيجية الحذف وإعادة الإنشاء
 * 
 * @param invoiceId - معرف الفاتورة
 * @param data - البيانات الجديدة
 */
export async function updatePurchaseInvoice(invoiceId: string, data: CreateInvoiceData) {
    // 1. الحصول على الفاتورة القديمة
    const { data: oldInvoice, error: fetchError } = await supabaseAdmin
        .from('purchase_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

    if (fetchError || !oldInvoice) {
        throw new Error('الفاتورة غير موجودة');
    }

    const oldInvoiceNumber = oldInvoice.invoice_number;

    // 2. حذف البيانات القديمة (القيود، المخزون، الأسطر)
    // حذف القيود المحاسبية المرتبطة
    await supabaseAdmin
        .from('journal_entries')
        .delete()
        .eq('reference_id', oldInvoiceNumber);

    // حذف معاملات المخزون وتحديث الكميات
    const { data: transactions } = await supabaseAdmin
        .from('inventory_transactions')
        .select('id')
        .eq('reference_id', oldInvoiceNumber)
        .eq('reference_type', 'purchase_invoice');

    let txToDelete = transactions || [];

    // Fallback للبيانات القديمة
    if (txToDelete.length === 0) {
        const { data: oldTx } = await supabaseAdmin
            .from('inventory_transactions')
            .select('id')
            .ilike('notes', `%${oldInvoiceNumber}%`);
        if (oldTx) txToDelete = [...txToDelete, ...oldTx];
    }

    if (txToDelete && txToDelete.length > 0) {
        const uniqueIds = Array.from(new Set(txToDelete.map(t => t.id)));
        for (const id of uniqueIds) {
            await deleteInventoryTransaction(id);
        }
    }

    // حذف أسطر الفاتورة القديمة
    await supabaseAdmin
        .from('purchase_invoice_lines')
        .delete()
        .eq('invoice_id', invoiceId);

    // 3. تحديث البيانات الأساسية للفاتورة (نحتفظ برقم الفاتورة)
    const subtotal = data.items.reduce((sum, item) => sum + item.total, 0);
    const totalAmount = subtotal;
    const remainingAmount = totalAmount - data.paidAmount;
    const paymentStatus = data.paidAmount >= totalAmount ? 'paid' : (data.paidAmount > 0 ? 'partial' : 'unpaid');

    const { error: updateError } = await supabaseAdmin
        .from('purchase_invoices')
        .update({
            invoice_date: data.invoiceDate,
            supplier_account_id: data.supplierId,
            currency: data.currency,
            exchange_rate: data.exchangeRate,
            subtotal: subtotal,
            total_amount: totalAmount,
            paid_amount: data.paidAmount,
            remaining_amount: remainingAmount,
            payment_status: paymentStatus,
            notes: data.notes,
            updated_at: new Date().toISOString()
        })
        .eq('id', invoiceId);

    if (updateError) throw new Error(updateError.message);

    // 4. إضافة الأسطر الجديدة والمخزون
    for (const item of data.items) {
        // إضافة سطر الفاتورة
        await supabaseAdmin.from('purchase_invoice_lines').insert({
            invoice_id: invoiceId,
            item_id: item.itemId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total: item.total
        });

        // إضافة المخزون
        if (item.cardNumbers && item.cardNumbers.length > 0) {
            for (const cardNum of item.cardNumbers) {
                await addInventoryStock({
                    itemId: item.itemId,
                    quantity: 1,
                    unitCost: item.unitPrice,
                    purchaseDate: data.invoiceDate,
                    cardNumber: cardNum,
                    notes: `فاتورة شراء #${oldInvoiceNumber} (معدلة)`,
                    referenceId: oldInvoiceNumber,
                    referenceType: 'purchase_invoice'
                });
            }
        } else {
            await addInventoryStock({
                itemId: item.itemId,
                quantity: item.quantity,
                unitCost: item.unitPrice,
                purchaseDate: data.invoiceDate,
                notes: `فاتورة شراء #${oldInvoiceNumber} (معدلة)`,
                referenceId: oldInvoiceNumber,
                referenceType: 'purchase_invoice'
            });
        }
    }

    // 5. إنشاء القيد المحاسبي الجديد
    const { data: inventoryAcc } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('account_code', '1130')
        .single();

    const journalLines: JournalEntryLine[] = [];

    if (inventoryAcc) {
        journalLines.push({
            accountId: inventoryAcc.id,
            description: `استحقاق فاتورة شراء #${oldInvoiceNumber} (معدلة) - ${data.items.length} أصناف`,
            debit: totalAmount,
            credit: 0
        });
    }

    journalLines.push({
        accountId: data.supplierId,
        description: `استحقاق فاتورة شراء #${oldInvoiceNumber} (معدلة)`,
        debit: 0,
        credit: totalAmount
    });

    if (journalLines.length === 2) {
        await createJournalEntry({
            date: data.invoiceDate,
            description: `فاتورة شراء #${oldInvoiceNumber} (معدلة)`,
            referenceType: 'purchase_invoice',
            referenceId: oldInvoiceNumber,
            lines: journalLines,
            currency: data.currency
        });
    }

    // 6. معالجة الدفع (إذا كان هناك مبلغ مدفوع)
    if (data.paidAmount > 0 && data.paymentAccountId) {
        await createPayment({
            date: data.invoiceDate,
            paymentAccountId: data.paymentAccountId,
            paymentAccountName: '',
            payee: `مورد فاتورة ${oldInvoiceNumber}`,
            description: `سداد فاتورة شراء #${oldInvoiceNumber} (معدلة)`,
            amount: data.paidAmount,
            currency: data.currency,
            lineItems: [
                {
                    accountId: data.supplierId,
                    amount: data.paidAmount,
                    description: `سداد للمورد - فاتورة شراء #${oldInvoiceNumber} (معدلة)`
                }
            ]
        });
    }

    return { success: true, invoiceId };
}
