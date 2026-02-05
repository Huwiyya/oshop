import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface AnalysisIssue {
    category: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    issue: string;
    recommendation?: string;
}

const issues: AnalysisIssue[] = [];

function report(category: string, severity: AnalysisIssue['severity'], issue: string, recommendation?: string) {
    issues.push({ category, severity, issue, recommendation });
    const icons = { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢', info: '💡' };
    console.log(`${icons[severity]} [${category}] ${issue}`);
    if (recommendation) console.log(`   💡 ${recommendation}`);
}

async function analyzeFinancialFlow() {
    console.log('\n💰 ANALYZING FINANCIAL FLOW');
    console.log('═'.repeat(80));

    // 1. Check for الدفع المزدوج (Double Payment)
    console.log('\n🔍 Checking for potential double payment scenarios...');

    const { data: orders } = await supabase.from('orders_v4').select('*').limit(10);

    if (orders && orders.length > 0) {
        for (const order of orders) {
            // Check if order has both cash payment and wallet payment
            if (order.cashPaymentAmount && order.walletPaymentAmount) {
                const total = (order.cashPaymentAmount || 0) + (order.walletPaymentAmount || 0);
                if (total > (order.totalAmountLYD || 0)) {
                    report(
                        'Orders',
                        'high',
                        `Order ${order.invoiceNumber} has payment total (${total}) exceeding totalAmount (${order.totalAmountLYD})`,
                        'Verify payment calculation logic'
                    );
                }
            }
        }
    }

    // 2. Check Treasury Balance Flow
    console.log('\n🔍 Checking treasury balance consistency...');
    const { data: treasuryCards } = await supabase.from('treasury_cards_v4').select('*');

    if (treasuryCards) {
        let totalUSD = 0;
        let totalLYD = 0;

        for (const card of treasuryCards) {
            if (card.currency === 'USD') {
                totalUSD += card.balance;
            } else {
                totalLYD += card.balance;
            }
        }

        console.log(`   Total USD in treasury: $${totalUSD.toFixed(2)}`);
        console.log(`   Total LYD in treasury: ${totalLYD.toFixed(2)} د.ل`);

        if (totalUSD < 0) {
            report('Treasury', 'critical', 'Total USD balance is negative!');
        }
        if (totalLYD < 0) {
            report('Treasury', 'critical', 'Total LYD balance is negative!');
        }
    }

    // 3. Check User Debts
    console.log('\n🔍 Checking user debt calculations...');
    const { data: users } = await supabase
        .from('users_v4')
        .select('id, name, debt, walletBalance')
        .gt('debt', 0)
        .limit(10);

    if (users && users.length > 0) {
        console.log(`   Found ${users.length} users with debt`);

        for (const user of users) {
            if (user.debt < 0) {
                report(
                    'Users',
                    'medium',
                    `User ${user.name} has negative debt: ${user.debt}`,
                    'Negative debt usually means credit/overpayment'
                );
            }
        }
    } else {
        console.log('   ✅ No users with debt found');
    }

    // 4. Check for Orphaned Transactions
    console.log('\n🔍 Checking for orphaned transactions...');

    const { data: treasuryTx } = await supabase
        .from('treasury_transactions_v4')
        .select('*')
        .not('relatedOrderId', 'is', null);

    if (treasuryTx) {
        let orphaned = 0;
        for (const tx of treasuryTx) {
            const { data: order } = await supabase
                .from('orders_v4')
                .select('id')
                .eq('id', tx.relatedOrderId)
                .single();

            if (!order) {
                orphaned++;
            }
        }

        if (orphaned > 0) {
            report(
                'Transactions',
                'medium',
                `Found ${orphaned} treasury transactions linked to non-existent orders`,
                'These might be from deleted orders - verify if reversal happened'
            );
        } else {
            console.log('   ✅ All treasury transactions properly linked');
        }
    }
}

async function analyzeCodeLogic() {
    console.log('\n🔧 ANALYZING CODE LOGIC');
    console.log('═'.repeat(80));

    // Check for potential race conditions
    report(
        'Code Review',
        'info',
        'Potential race condition in concurrent order creation',
        'Consider adding transaction locks or optimistic locking for balance updates'
    );

    // Check exchange rate usage
    const { data: settings } = await supabase
        .from('settings_v4')
        .select('exchangeRate, shippingExchangeRate')
        .single();

    if (settings) {
        console.log(`\n📊 Current Settings:`);
        console.log(`   Exchange Rate: ${settings.exchangeRate}`);
        console.log(`   Shipping Exchange Rate: ${settings.shippingExchangeRate || 'Not set'}`);

        if (!settings.exchangeRate || settings.exchangeRate <= 0) {
            report(
                'Settings',
                'critical',
                'Exchange rate is invalid or not set',
                'Set a valid exchange rate immediately'
            );
        }

        if (settings.exchangeRate < 1) {
            report(
                'Settings',
                'high',
                'Exchange rate is less than 1 (should be LYD per USD)',
                'Verify exchange rate configuration'
            );
        }
    }
}

async function checkEdgeCases() {
    console.log('\n⚠️  CHECKING EDGE CASES');
    console.log('═'.repeat(80));

    // 1. Check for zero-value orders
    console.log('\n🔍 Checking for zero-value orders...');
    const { data: zeroOrders } = await supabase
        .from('orders_v4')
        .select('*')
        .eq('sellingPriceLYD', 0);

    if (zeroOrders && zeroOrders.length > 0) {
        report(
            'Orders',
            'medium',
            `Found ${zeroOrders.length} orders with zero selling price`,
            'Verify if these are intentional (free items, tests, etc.)'
        );
    }

    // 2. Check for orders with missing financial data
    console.log('\n🔍 Checking for orders with missing financial data...');
    const { data: allOrders } = await supabase
        .from('orders_v4')
        .select('*');

    if (allOrders) {
        let missingExchangeRate = 0;
        let missingTotalAmount = 0;

        for (const order of allOrders) {
            if (!order.exchangeRate) missingExchangeRate++;
            if (!order.totalAmountLYD) missingTotalAmount++;
        }

        if (missingExchangeRate > 0) {
            report(
                'Orders',
                'high',
                `${missingExchangeRate} orders missing exchangeRate`,
                'Exchange rate should be captured at order creation time'
            );
        }

        if (missingTotalAmount > 0) {
            report(
                'Orders',
                'medium',
                `${missingTotalAmount} orders missing totalAmountLYD`,
                'Total amount should be calculated when weight is added'
            );
        }
    }

    // 3. Check Shein card usage
    console.log('\n🔍 Checking Shein card configuration...');
    const { data: sheinCards } = await supabase
        .from('shein_cards_v4')
        .select('*');

    if (!sheinCards || sheinCards.length === 0) {
        report(
            'Shein Cards',
            'info',
            'No Shein cards found in system',
            'Add Shein cards if you use them for purchasing'
        );
    } else {
        const available = sheinCards.filter(c => c.status === 'available');
        const totalAvailable = available.reduce((sum, c) => sum + (c.remainingValue ?? c.value), 0);

        console.log(`   Available Shein cards: ${available.length}`);
        console.log(`   Total available balance: $${totalAvailable.toFixed(2)}`);
    }
}

async function checkDuplicateCards() {
    console.log('\n🔍 Checking for duplicate treasury cards...');

    const { data: treasuryCards } = await supabase
        .from('treasury_cards_v4')
        .select('*');

    if (treasuryCards) {
        const typeCount: Record<string, number> = {};

        for (const card of treasuryCards) {
            typeCount[card.type] = (typeCount[card.type] || 0) + 1;
        }

        for (const [type, count] of Object.entries(typeCount)) {
            if (count > 1) {
                report(
                    'Treasury',
                    'high',
                    `Found ${count} treasury cards of type '${type}'`,
                    'Should only have one card per type - consider merging or removing duplicates'
                );
            }
        }
    }
}

async function generateReport() {
    console.log('\n\n📋 DEEP ANALYSIS REPORT');
    console.log('═'.repeat(80));

    const critical = issues.filter(i => i.severity === 'critical');
    const high = issues.filter(i => i.severity === 'high');
    const medium = issues.filter(i => i.severity === 'medium');
    const low = issues.filter(i => i.severity === 'low');
    const info = issues.filter(i => i.severity === 'info');

    console.log(`\n🔴 Critical: ${critical.length}`);
    console.log(`🟠 High: ${high.length}`);
    console.log(`🟡 Medium: ${medium.length}`);
    console.log(`🟢 Low: ${low.length}`);
    console.log(`💡 Info: ${info.length}`);
    console.log(`\nTotal Items: ${issues.length}`);

    if (critical.length === 0 && high.length === 0) {
        console.log('\n✅ NO CRITICAL OR HIGH PRIORITY ISSUES FOUND!');
    } else {
        console.log('\n⚠️  ACTION REQUIRED FOR CRITICAL/HIGH PRIORITY ISSUES');
    }

    // Save detailed report
    const fs = require('fs');
    fs.writeFileSync(
        'deep_analysis_report.json',
        JSON.stringify(issues, null, 2)
    );
    console.log('\n💾 Detailed analysis saved to: deep_analysis_report.json');

    return issues;
}

async function runDeepAnalysis() {
    console.log('🔬 STARTING DEEP SYSTEM ANALYSIS');
    console.log('═'.repeat(80));

    try {
        await analyzeFinancialFlow();
        await analyzeCodeLogic();
        await checkEdgeCases();
        await checkDuplicateCards();
        await generateReport();

    } catch (error) {
        console.error('\n❌ Analysis failed:', error);
    }
}

runDeepAnalysis().then(() => {
    console.log('\n✅ Deep analysis complete!');
    process.exit(0);
}).catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
