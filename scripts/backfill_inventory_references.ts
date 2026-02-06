
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillReferences() {
    console.log('STARTING BACKFILL: Linking Inventory Transactions to Purchase Invoices...');

    // 1. Get all purchase transactions with null reference_id
    // We assume 'purchase' type transactions created from invoices have notes like "فاتورة شراء #PI-xxxx"
    const { data: transactions, error } = await supabase
        .from('inventory_transactions')
        .select('id, notes, created_at')
        .eq('transaction_type', 'purchase')
        .is('reference_id', null)
        .ilike('notes', '%#PI-%'); // Only target those that look like invoice notes

    if (error) {
        console.error('Error fetching transactions:', error);
        return;
    }

    console.log(`Found ${transactions?.length || 0} transactions to process.`);

    if (!transactions || transactions.length === 0) return;

    let updatedCount = 0;
    let errorsCount = 0;

    for (const trx of transactions) {
        // Extract Invoice Number from notes
        // Format: "... #PI-2026-1001 ..."
        const match = trx.notes.match(/#(PI-\d{4}-\d+)/);
        if (match && match[1]) {
            const invoiceNumber = match[1];

            // Find the invoice
            const { data: invoice } = await supabase
                .from('purchase_invoices')
                .select('id, invoice_number')
                .eq('invoice_number', invoiceNumber)
                .single();

            if (invoice) {
                // Update the transaction
                const { error: updateError } = await supabase
                    .from('inventory_transactions')
                    .update({
                        reference_id: invoice.invoice_number, // Storing Invoice Number as reference (string) matches current pattern
                        reference_type: 'purchase_invoice'
                    })
                    .eq('id', trx.id);

                if (updateError) {
                    console.error(`Failed to update Tx ${trx.id}:`, updateError.message);
                    errorsCount++;
                } else {
                    updatedCount++;
                    // console.log(`Linked Tx ${trx.id} -> Invoice ${invoice.invoice_number}`);
                }
            } else {
                console.warn(`Invoice ${invoiceNumber} not found for Tx ${trx.id}`);
                errorsCount++;
            }
        } else {
            console.warn(`Could not extract invoice number from note: "${trx.notes}"`);
        }
    }

    console.log(`BACKFILL COMPLETE.`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Errors/Skipped: ${errorsCount}`);
}

backfillReferences();
