
import { getDashboardMetricsV2, getAccountsSummaryV2 } from './src/lib/accounting-v2-actions';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Mock Supabase Admin if needed? 
// accounting-v2-actions imports supabaseAdmin from './supabase-admin'.
// I need to ensure that file works in this context.
// 'use server' might cause issues running with tsx if not handled? 
// actually TSX handles it fine usually if dependencies are met.

async function debugActions() {
    console.log('Debugging getAccountsSummaryV2...');
    const summary = await getAccountsSummaryV2();

    console.log('Revenue Accounts found:', summary.revenue.length);
    summary.revenue.forEach(acc => {
        console.log(`- ${acc.code}: Cur=${acc.current_balance}, Comp=${acc.computed_balance}`);
    });

    console.log('Debugging getDashboardMetricsV2...');
    const metrics = await getDashboardMetricsV2();
    console.log('Total Revenue:', metrics.totalRevenue);
    console.log('Net Income:', metrics.netIncome);
}

debugActions().catch(console.error);
