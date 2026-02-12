'use client';

import { useState } from 'react';
import { createAccountV2, getAccountIdByName } from '@/lib/accounting-v2-actions';
import { createPurchaseInvoice } from '@/lib/purchase-actions';
import { createSalesInvoice } from '@/lib/sales-actions';
import { setupVerificationData, verifyStock, checkDebugInfo } from '@/lib/verification-actions';

export default function VerifyMigrationPage() {
    const [logs, setLogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const log = (msg: string) => setLogs(prev => [...prev, msg + ` [${new Date().toLocaleTimeString()}]`]);

    const runVerification = async () => {
        setLoading(true);
        setLogs([]);
        log("🚀 Starting Verification Flow...");

        try {
            // WE MUST CALL SERVER ACTIONS HERE. 
            // Note: createAccountV2, createPurchaseInvoice, etc are Server Actions ('use server').
            // We can call them directly from Client Component (this is one of Next.js features).

            // 1. Setup Accounts
            log("🔍 Checking Accounts...");
            let inventoryId = await getAccountIdByName('Inventory');
            if (!inventoryId) {
                // We cannot use supabaseAdmin directly in Client Component! 
                // We must move this logic to a Server Action or just rely on 'createAccountV2' if we can find type ID.
                // For simplicity, let's assume getAccountIdByName (Server Action) works.
                log("⚠️ Inventory Account (Name Search) not found. Checking placeholders...");
            } else {
                log(`✅ Found Inventory Account: ${inventoryId}`);
            }

            // For the purpose of this test, we need valid IDs. 
            // If getAccountIdByName fails, we might fail the test or need to create them via Server Action.
            // Let's wrap the creation in a new Server Action if needed, BUT 'createAccountV2' IS a server action.
            // But we need 'account_type_id'. We can't query DB from client.
            // SOLUTION: I will create a dedicated Server Action for "SetupTestAccounts" in a separate file or just inside the page if I could (but can't mixed).
            // Actually, I'll rely on what I have. If 'Inventory' isn't found, the 'createPurchaseInvoice' action has a fallback placeholder which I added.
            // Let's test that fallback or the dynamic lookup I added.

            const supplierId = await getAccountIdByName('Supplier') || await getAccountIdByName('مورد') || '22222222-2222-2222-2222-222222222222';
            const customerId = await getAccountIdByName('Customer') || await getAccountIdByName('عميل') || '33333333-3333-3333-3333-333333333333';

            // 2. Create Product (Need a Server Action for this?)
            // I don't have a 'createProduct' server action exposed generally, usually it's in inventory-actions.
            // Let's import 'createProduct' or similar if available, or just create a dummy "Service" item if possible?
            // Wait, 'createPurchaseInvoice' takes 'itemId'. 
            // I need a valid product ID.
            // I will add a temporary Server Action `setupVerificationData` in `src/lib/verification-actions.ts` to handle the DB setup securely on server.

            const setupRes = await setupVerificationData();
            if (!setupRes.success || !setupRes.data) throw new Error("Setup Failed: " + (setupRes.error || "No data returned"));

            const { productId, supplierId: realSuppId, customerId: realCustId } = setupRes.data;
            log(`✅ Setup Complete. Product: ${productId}`);

            // 3. Purchase (Stock In)
            log("📦 Creating Purchase Invoice...");
            const purchaseRes = await createPurchaseInvoice({
                supplierId: realSuppId,
                invoiceDate: new Date().toISOString().split('T')[0],
                items: [{
                    itemId: productId,
                    quantity: 10,
                    unitPrice: 50,
                    total: 500,
                    description: 'Test Restock'
                }],
                currency: 'LYD',
                exchangeRate: 1,
                paidAmount: 0
            });

            if (!purchaseRes.success && !purchaseRes.id) throw new Error("Purchase Failed");
            log(`✅ Purchase Created: ${purchaseRes.id}`);

            // 4. Verify Stock (Need Server Action)
            const stock1 = await verifyStock(productId);
            log(`📊 Stock after Purchase: ${stock1} (Expected 10)`);

            if (stock1 !== 10) {
                log("⚠️ Stock mismatch! Fetching Debug Info...");
                const debug = await checkDebugInfo(purchaseRes.id!, productId);
                log(`📝 Invoice Status: ${debug.invoice?.status}`);
                log(`📝 Lines Count: ${debug.lines?.length}`);
                log(`📝 Transactions Found: ${debug.transactions?.length}`);
                log(`📝 Layers Found: ${debug.layers?.length}`);
                console.log("DEBUG INFO:", debug);
                throw new Error(`Stock mismatch! Expected 10, got ${stock1}`);
            }

            // 5. Sale (Stock Out)
            log("💰 Creating Sales Invoice...");
            const saleRes = await createSalesInvoice({
                customerId: realCustId,
                invoiceDate: new Date().toISOString().split('T')[0],
                items: [{
                    itemId: productId,
                    quantity: 3,
                    unitPrice: 100,
                    total: 300,
                    description: 'Test Sale'
                }],
                currency: 'LYD',
                exchangeRate: 1,
                paidAmount: 0
            });

            if (!saleRes.success && !saleRes.id) throw new Error("Sale Failed");
            log(`✅ Sale Created: ${saleRes.id}`);

            // 6. Verify Stock Decrease
            const stock2 = await verifyStock(productId);
            log(`📊 Stock after Sale: ${stock2} (Expected 7)`);
            if (stock2 !== 7) throw new Error(`Stock mismatch! Expected 7, got ${stock2}`);

            log("🎉 VERIFICATION SUCCESSFUL!");

        } catch (e: any) {
            console.error(e);
            log("❌ Error: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-10">
            <h1 className="text-2xl font-bold mb-4">Verification Mode</h1>
            <button
                onClick={runVerification}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
                {loading ? 'Running...' : 'Run Verification Flow'}
            </button>
            <div className="mt-4 bg-gray-100 p-4 rounded min-h-[300px] font-mono whitespace-pre-wrap">
                {logs.map((l, i) => <div key={i}>{l}</div>)}
            </div>
        </div>
    );
}

// =============================================================================
// SERVER ACTIONS (Embedded for simplicity in non-production file)
// =============================================================================
// Next.js allows importing Server Actions. 
// However, defining them INSIDE a Client Component file is not allowed usually, needs separate file.
// I will create `src/lib/verification-actions.ts` and import from there.
