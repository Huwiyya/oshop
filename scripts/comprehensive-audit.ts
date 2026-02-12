import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface AuditIssue {
    category: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    details?: any;
}

const issues: AuditIssue[] = [];

function reportIssue(category: string, severity: AuditIssue['severity'], description: string, details?: any) {
    issues.push({ category, severity, description, details });
    const icon = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : severity === 'medium' ? '🟡' : '🟢';
    console.log(`${icon} [${severity.toUpperCase()}] ${description}`);
    if (details) console.log('   Details:', details);
}

async function auditDatabaseSchema() {
    console.log('\n📋 1. AUDITING DATABASE SCHEMA');
    console.log('═'.repeat(80));

    // Check Treasury Cards
    const { data: treasuryCards, error: tcError } = await supabase
        .from('treasury_cards_v4')
        .select('*');

    if (tcError) {
        reportIssue('Database', 'critical', 'Cannot access treasury_cards_v4', tcError);
        return;
    }

    console.log(`✅ treasury_cards_v4: ${treasuryCards.length} cards found`);

    // Check for required cards
    const requiredTypes = ['cash_libyan', 'bank', 'usdt_treasury'];
    for (const type of requiredTypes) {
        const card = treasuryCards.find(c => c.type === type);
        if (!card) {
            reportIssue('Database', 'high', `Missing required treasury card: ${type}`);
        }
    }

    // Check Treasury Transactions
    const { data: treasuryTx, error: ttError } = await supabase
        .from('treasury_transactions_v4')
        .select('*');

    if (ttError) {
        reportIssue('Database', 'critical', 'Cannot access treasury_transactions_v4', ttError);
    } else {
        console.log(`✅ treasury_transactions_v4: ${treasuryTx.length} transactions found`);

        // Check for orphaned transactions (no cardId)
        const orphaned = treasuryTx.filter(tx => !tx.cardId);
        if (orphaned.length > 0) {
            reportIssue('Database', 'medium', `Found ${orphaned.length} treasury transactions without cardId`);
        }
    }

    // Check Shein Cards
    const { data: sheinCards, error: scError } = await supabase
        .from('shein_cards_v4')
        .select('*');

    if (scError) {
        reportIssue('Database', 'critical', 'Cannot access shein_cards_v4', scError);
    } else {
        console.log(`✅ shein_cards_v4: ${sheinCards.length} cards found`);
    }

    // Check Shein Transactions
    const { data: sheinTx, error: stError } = await supabase
        .from('shein_transactions_v4')
        .select('*');

    if (stError) {
        reportIssue('Database', 'critical', 'Cannot access shein_transactions_v4', stError);
    } else {
        console.log(`✅ shein_transactions_v4: ${sheinTx.length} transactions found`);
    }

    // Check Wallet Transactions
    const { data: walletTx, error: wtError } = await supabase
        .from('wallet_transactions_v4')
        .select('*');

    if (wtError) {
        reportIssue('Database', 'critical', 'Cannot access wallet_transactions_v4', wtError);
    } else {
        console.log(`✅ wallet_transactions_v4: ${walletTx.length} transactions found`);
    }

    // Check Users
    const { data: users, error: uError } = await supabase
        .from('users_v4')
        .select('id, name, walletBalance, debt');

    if (uError) {
        reportIssue('Database', 'critical', 'Cannot access users_v4', uError);
    } else {
        console.log(`✅ users_v4: ${users.length} users found`);
    }

    // Check Orders
    const { data: orders, error: oError } = await supabase
        .from('orders_v4')
        .select('id, invoiceNumber, totalAmountLYD, remainingAmount');

    if (oError) {
        reportIssue('Database', 'critical', 'Cannot access orders_v4', oError);
    } else {
        console.log(`✅ orders_v4: ${orders.length} orders found`);
    }
}

async function auditTreasuryCards() {
    console.log('\n💳 2. AUDITING TREASURY CARDS');
    console.log('═'.repeat(80));

    const { data: cards } = await supabase
        .from('treasury_cards_v4')
        .select('*');

    if (!cards) return;

    for (const card of cards) {
        console.log(`\n🔍 Checking: ${card.name} (${card.type})`);

        // Get all transactions for this card
        const { data: transactions } = await supabase
            .from('treasury_transactions_v4')
            .select('*')
            .eq('cardId', card.id);

        if (!transactions) continue;

        // Calculate balance from transactions
        const calculatedBalance = transactions.reduce((sum, tx) => {
            return sum + (tx.type === 'deposit' ? tx.amount : -tx.amount);
        }, 0);

        const storedBalance = card.balance || 0;
        const diff = Math.abs(storedBalance - calculatedBalance);

        if (diff > 0.01) {
            reportIssue(
                'Treasury',
                'high',
                `Balance mismatch for ${card.name}`,
                {
                    stored: storedBalance.toFixed(2),
                    calculated: calculatedBalance.toFixed(2),
                    difference: diff.toFixed(2)
                }
            );
        } else {
            console.log(`   ✅ Balance matches: ${storedBalance.toFixed(2)} ${card.currency}`);
        }
    }
}

async function auditSheinCards() {
    console.log('\n🎴 3. AUDITING SHEIN CARDS');
    console.log('═'.repeat(80));

    const { data: cards } = await supabase
        .from('shein_cards_v4')
        .select('*');

    if (!cards) return;

    for (const card of cards) {
        const remaining = card.remainingValue ?? card.value;

        // Check for invalid remaining values
        if (remaining < 0) {
            reportIssue(
                'Shein Cards',
                'high',
                `Negative remaining value for card ${card.code}`,
                { remainingValue: remaining }
            );
        }

        if (remaining > card.value) {
            reportIssue(
                'Shein Cards',
                'medium',
                `Remaining value exceeds original value for card ${card.code}`,
                { value: card.value, remaining }
            );
        }

        // Check status logic
        if (remaining < 0.01 && card.status !== 'used') {
            reportIssue(
                'Shein Cards',
                'medium',
                `Card ${card.code} has 0 balance but status is '${card.status}' (should be 'used')`
            );
        }
    }

    console.log(`✅ Checked ${cards.length} Shein cards`);
}

async function auditUserWallets() {
    console.log('\n👛 4. AUDITING USER WALLETS');
    console.log('═'.repeat(80));

    const { data: users } = await supabase
        .from('users_v4')
        .select('*');

    if (!users) return;

    for (const user of users) {
        const { data: transactions } = await supabase
            .from('wallet_transactions_v4')
            .select('*')
            .eq('userId', user.id);

        if (!transactions) continue;

        const calculatedBalance = transactions.reduce((sum, tx) => {
            return sum + (tx.type === 'deposit' ? tx.amount : -tx.amount);
        }, 0);

        const storedBalance = user.walletBalance || 0;
        const diff = Math.abs(storedBalance - calculatedBalance);

        if (diff > 0.01) {
            reportIssue(
                'Wallets',
                'high',
                `Wallet balance mismatch for user ${user.name}`,
                {
                    stored: storedBalance.toFixed(2),
                    calculated: calculatedBalance.toFixed(2),
                    difference: diff.toFixed(2)
                }
            );
        }

        // Check for negative balances
        if (storedBalance < 0) {
            reportIssue(
                'Wallets',
                'critical',
                `Negative wallet balance for user ${user.name}`,
                { balance: storedBalance }
            );
        }
    }

    console.log(`✅ Checked ${users.length} user wallets`);
}

async function auditOrders() {
    console.log('\n📦 5. AUDITING ORDERS');
    console.log('═'.repeat(80));

    const { data: orders } = await supabase
        .from('orders_v4')
        .select('*');

    if (!orders) return;

    for (const order of orders) {
        // Check for negative remaining amounts
        if (order.remainingAmount < 0) {
            reportIssue(
                'Orders',
                'high',
                `Negative remaining amount for order ${order.invoiceNumber}`,
                { remainingAmount: order.remainingAmount }
            );
        }

        // Check if remainingAmount > totalAmount
        if (order.totalAmountLYD && order.remainingAmount > order.totalAmountLYD) {
            reportIssue(
                'Orders',
                'medium',
                `Remaining amount exceeds total for order ${order.invoiceNumber}`,
                {
                    total: order.totalAmountLYD,
                    remaining: order.remainingAmount
                }
            );
        }
    }

    console.log(`✅ Checked ${orders.length} orders`);
}

async function generateSummary() {
    console.log('\n\n📊 AUDIT SUMMARY');
    console.log('═'.repeat(80));

    const critical = issues.filter(i => i.severity === 'critical');
    const high = issues.filter(i => i.severity === 'high');
    const medium = issues.filter(i => i.severity === 'medium');
    const low = issues.filter(i => i.severity === 'low');

    console.log(`\n🔴 Critical Issues: ${critical.length}`);
    console.log(`🟠 High Priority: ${high.length}`);
    console.log(`🟡 Medium Priority: ${medium.length}`);
    console.log(`🟢 Low Priority: ${low.length}`);
    console.log(`\nTotal Issues Found: ${issues.length}`);

    if (issues.length === 0) {
        console.log('\n✅ NO ISSUES FOUND! System is in good shape.');
    } else {
        console.log('\n⚠️  ISSUES REQUIRE ATTENTION');
        console.log('\nIssues by Category:');
        const categories = Array.from(new Set(issues.map(i => i.category)));
        for (const cat of categories) {
            const catIssues = issues.filter(i => i.category === cat);
            console.log(`  ${cat}: ${catIssues.length} issues`);
        }
    }

    return issues;
}

async function runFullAudit() {
    console.log('🔍 STARTING COMPREHENSIVE SYSTEM AUDIT');
    console.log('═'.repeat(80));

    try {
        await auditDatabaseSchema();
        await auditTreasuryCards();
        await auditSheinCards();
        await auditUserWallets();
        await auditOrders();

        const allIssues = await generateSummary();

        // Save issues to file
        const fs = require('fs');
        fs.writeFileSync(
            'audit_report.json',
            JSON.stringify(allIssues, null, 2)
        );
        console.log('\n💾 Detailed report saved to: audit_report.json');

    } catch (error) {
        console.error('\n❌ Audit failed with error:', error);
    }
}

runFullAudit().then(() => {
    console.log('\n✅ Audit complete!');
    process.exit(0);
}).catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
