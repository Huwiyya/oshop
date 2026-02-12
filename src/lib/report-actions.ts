'use server';

import { supabaseAdmin } from './supabase-admin';

export type ReportLine = {
    accountId: string;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    balance: number;
    level: number;
    isParent: boolean;
};

// --- ميزان المراجعة (Trial Balance) ---
export async function getTrialBalance(startDate?: string, endDate?: string) {
    let query = supabaseAdmin
        .from('journal_entry_lines')
        .select(`
            debit,
            credit,
            account:accounts!inner (
                id, account_code, name_ar, account_type_id, parent_id
            ),
            journal_entries!inner (
                entry_date,
                status
            )
        `)
        .eq('journal_entries.status', 'posted');

    // If endDate is provided, we only need transactions up to that date.
    // We NEED transactions before startDate to calculate opening balance.
    if (endDate) query = query.lte('journal_entries.entry_date', endDate);

    const { data: lines, error } = await query;

    if (error) {
        console.error('Error fetching trial balance:', error);
        return [];
    }

    const accountMap = new Map<string, ReportLine>();

    for (const line of lines) {
        const acc: any = Array.isArray(line.account) ? line.account[0] : line.account;
        if (!acc || !acc.account_code) continue;

        const code = acc.account_code;
        // journal_entries might be an array or object depending on join
        const je: any = Array.isArray(line.journal_entries) ? line.journal_entries[0] : line.journal_entries;
        const jeDate = je.entry_date;

        const debit = Number(line.debit);
        const credit = Number(line.credit);

        if (!accountMap.has(code)) {
            accountMap.set(code, {
                accountId: acc.id,
                accountCode: code,
                accountName: acc.name_ar,
                debit: 0,
                credit: 0,
                balance: 0,
                level: 3,
                isParent: false
            });
        }

        const rec = accountMap.get(code)!;

        // Check if transaction is within the selected period or before it (Opening Balance)
        const isBeforeStart = startDate ? jeDate < startDate : false;

        if (isBeforeStart) {
            // Add to Opening Balance (Net Effect)
            // For Trial Balance logic, we usually just want the total Debit/Credit for the period
            // But to show accurate "Balance", we need the opening.
            // However, a standard Trial Balance usually shows: Opening Dr/Cr, Period Dr/Cr, Closing Dr/Cr.
            // Our UI currently shows: Dr (Period?), Cr (Period?), Balance (Closing?).
            // Let's assume Dr/Cr columns in UI are for the PERIOD, and Balance is Cumulative.

            // We'll effectively "hide" the opening balance in the 'balance' calculation 
            // but NOT add it to the 'debit'/'credit' columns which typically represent activity.
            // OR: We add it to balance directly.

            // Strategy: 
            // balance = OpeningBalance + (PeriodDr - PeriodCr)
            // OpeningBalance = Sum(Dr - Cr) where date < startDate

            rec.balance += (debit - credit);
        } else {
            // Within Period
            rec.debit += debit;
            rec.credit += credit;
            rec.balance += (debit - credit);
        }
    }

    const accountArray = Array.from(accountMap.values());

    // Convert Balance to absolute if needed? 
    // Usually Trial Balance report lists accounts and their balances.
    // If we want Dr/Cr columns to match the Balance, they strictly should be Period Activity.
    // The "Balance" column is the one that matters most for Closing.

    return accountArray.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

// --- قائمة الدخل (Income Statement) ---
export async function getIncomeStatement(startDate: string, endDate: string) {
    const { data: lines, error } = await supabaseAdmin
        .from('journal_entry_lines')
        .select(`
            debit,
            credit,
            account:accounts!inner (id, account_code, name_ar, account_type_id),
            journal_entries!inner (entry_date, status)
        `)
        .eq('journal_entries.status', 'posted')
        .gte('journal_entries.entry_date', startDate)
        .lte('journal_entries.entry_date', endDate);

    if (error) {
        console.error(error);
        return { revenues: [], cogs: [], expenses: [], totalRevenue: 0, totalCOGS: 0, totalExpense: 0, grossProfit: 0, netIncome: 0 };
    }

    const revenues: ReportLine[] = [];
    const cogs: ReportLine[] = [];
    const expenses: ReportLine[] = [];

    const revenueMap = new Map<string, ReportLine>();
    const cogsMap = new Map<string, ReportLine>();
    const expenseMap = new Map<string, ReportLine>();

    for (const line of lines) {
        const acc: any = Array.isArray(line.account) ? line.account[0] : line.account;
        if (!acc || !acc.account_code) continue;

        let category: 'revenue' | 'cogs' | 'expense' | null = null;
        let map: Map<string, ReportLine> | null = null;

        if (acc.account_code.startsWith('4')) {
            category = 'revenue';
            map = revenueMap;
        } else if (acc.account_code.startsWith('51')) {
            category = 'cogs';
            map = cogsMap;
        } else if (acc.account_code.startsWith('5')) { // All other expenses (52, 53, etc.)
            category = 'expense';
            map = expenseMap;
        }

        if (!category || !map) continue;

        if (!map.has(acc.account_code)) {
            map.set(acc.account_code, {
                accountId: acc.id,
                accountCode: acc.account_code,
                accountName: acc.name_ar,
                debit: 0,
                credit: 0,
                balance: 0,
                isParent: false,
                level: 3
            });
        }

        const rec = map.get(acc.account_code)!;
        rec.debit += Number(line.debit);
        rec.credit += Number(line.credit);
    }

    // Finalize Revenues
    let totalRevenue = 0;
    for (const rec of Array.from(revenueMap.values())) {
        rec.balance = rec.credit - rec.debit;
        revenues.push(rec);
        totalRevenue += rec.balance;
    }

    // Finalize COGS
    let totalCOGS = 0;
    for (const rec of Array.from(cogsMap.values())) {
        rec.balance = rec.debit - rec.credit; // Expense nature
        cogs.push(rec);
        totalCOGS += rec.balance;
    }

    // Finalize Operating Expenses
    let totalExpense = 0;
    for (const rec of Array.from(expenseMap.values())) {
        rec.balance = rec.debit - rec.credit; // Expense nature
        expenses.push(rec);
        totalExpense += rec.balance;
    }

    const grossProfit = totalRevenue - totalCOGS;
    const netIncome = grossProfit - totalExpense;

    return {
        revenues: revenues.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
        cogs: cogs.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
        expenses: expenses.sort((a, b) => a.accountCode.localeCompare(b.accountCode)),
        totalRevenue,
        totalCOGS,
        grossProfit,
        totalExpense,
        netIncome
    };
}

// --- قائمة المركز المالي (Balance Sheet) ---
export async function getBalanceSheet() {
    // 1. جلب هيكل الحسابات (Account Structure)
    const { data: accounts, error } = await supabaseAdmin
        .from('accounts')
        .select(`
            id,
            account_code,
            name_ar,
            name_en,
            level,
            parent_id,
            is_parent,
            account_type: account_types!inner(
                category,
                normal_balance
            )
        `)
        .eq('is_active', true)
        .order('account_code');

    if (error) {
        console.error('Error fetching balance sheet:', error);
        return { assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0 };
    }

    // 2. جلب الأرصدة الحقيقية من القيود (Source of Truth)
    // نستخدم getTrialBalance لأنه يجمع من journal_entry_lines مباشرة
    const trialBalanceLines = await getTrialBalance();
    const balanceMap = new Map<string, number>();
    trialBalanceLines.forEach(line => {
        balanceMap.set(line.accountCode, line.balance);
    });

    // 3. بناء الهيكل الشجري وتجميع الأرصدة
    const accountMap = new Map<string, any>();

    // تهيئة الحسابات في Map
    accounts.forEach((acc: any) => {
        acc.children = [];
        // استخدام الرصيد المحسوب من القيود، أو 0 إذا لم توجد حركات
        // الرصيد في TrialBalance هو (مدين - دائن).
        // للأصول والمصروفات: الرصيد موجب يعني رصيد مدين صحيح.
        // للخصوم والإيرادات وحقوق الملكية: الرصيد سيكون سالباً (لأن الدائن > المدين).
        // سنأخذ القيمة كما هي مبدئياً ونعالج الإشارة عند العرض حسب الفئة.
        acc.computed_balance = balanceMap.get(acc.account_code) || 0;

        accountMap.set(acc.id, acc);
    });

    // بناء العلاقات (Parent-Child)
    const roots: any[] = [];
    accounts.forEach((acc: any) => {
        if (acc.parent_id && accountMap.has(acc.parent_id)) {
            const parent = accountMap.get(acc.parent_id);
            parent.children.push(acc);
        } else {
            // حسابات رئيسية ليس لها أب (أو الأب غير موجود في القائمة)
            roots.push(acc);
        }
    });

    // دالة تجميعية (Recursive Roll-up)
    const calculateRollup = (node: any) => {
        let childrenSum = 0;
        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                childrenSum += calculateRollup(child);
            }
        }
        // رصيد الحساب المجمع = رصيده المباشر + مجموع أرصدة أبنائه
        // ملاحظة: في الغالب الحسابات الأب رصيدها المباشر 0، لكن نجمع احتياطاً
        node.total_balance = node.computed_balance + childrenSum;
        return node.total_balance;
    };

    // حساب الأرصدة لجميع الجذور (وهذا سينزل لجميع المستويات)
    roots.forEach(root => calculateRollup(root));

    // 3. التصفية والتنسيق (Filtering & Formatting)
    // نعرض فقط الحسابات حتى المستوى 3 (أو 4 حسب الحاجة)، ونخفي التفاصيل الدقيقة مثل العملاء الأفراد
    // الافتراضي: عرض المستويات 1, 2, 3 فقط.
    // العملاء عادة في المستوى 3 (حساب رئيسي) والعملاء الأفراد في 4.
    const DISPLAY_LEVEL_LIMIT = 3;

    const assets: any[] = [];
    const liabilities: any[] = [];
    const equity: any[] = [];

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    // دالة مساعدة لإضافة الحسابات للقوائم النهائية (Flattening the tree view based on level)
    const processNode = (node: any) => {
        // تحديد القائمة المستهدفة
        let targetList: any[] | null = null;
        let category = '';

        // تصنيف بناءً على الكود (أسرع وأضمن من الاعتماد على النوع المرتبط أحياناً)
        if (node.account_code.startsWith('1')) {
            targetList = assets;
            category = 'assets';
        } else if (node.account_code.startsWith('2')) {
            targetList = liabilities;
            category = 'liabilities';
        } else if (node.account_code.startsWith('3')) {
            targetList = equity;
            category = 'equity';
        }

        if (targetList) {
            // شرط العرض:
            // 1. المستوى أقل من أو يساوي الحد (مثلاً 1، 2، 3)
            // 2. أو الحساب له رصيد وليس له أبناء (حساب فرعي مباشر في مستوى عالي)
            // 3. نستثني الحسابات الصفرية إذا لم تكن حسابات رئيسية

            const shouldShow = (node.level <= DISPLAY_LEVEL_LIMIT) || (node.is_parent === false && node.level < DISPLAY_LEVEL_LIMIT);
            const hasBalance = Math.abs(node.total_balance) > 0.001;

            if (shouldShow && (hasBalance || node.level === 1)) {
                targetList.push({
                    id: node.id,
                    account_code: node.account_code,
                    name_ar: node.name_ar,
                    name_en: node.name_en,
                    balance: Math.abs(node.total_balance), // عرض موجب دائماً
                    level: node.level,
                    is_parent: node.is_parent,
                    has_children: node.children.length > 0
                });
            }

            // إضافة للمجاميع الكلية (فقط للمستوى الأول لتجنب التكرار، أو نستخدم الجذر)
            if (node.level === 1) {
                if (category === 'assets') totalAssets += node.total_balance;
                else if (category === 'liabilities') totalLiabilities += node.total_balance;
                else if (category === 'equity') totalEquity += node.total_balance;
            }
        }

        // الاستمرار للأبناء إذا كنا لم نصل للحد المسموح للعرض
        // إذا وصلنا للمستوى 3، لن نعالج الأبناء (المستوى 4) للعرض، لكن أرصدتهم مجمعة بالفعل في الأب
        if (node.level < DISPLAY_LEVEL_LIMIT && node.children) {
            // ترتيب الأبناء بالكود
            node.children.sort((a: any, b: any) => a.account_code.localeCompare(b.account_code));
            node.children.forEach((child: any) => processNode(child));
        }
    };

    // معالجة الجذور بترتيب الكود
    roots.sort((a, b) => a.account_code.localeCompare(b.account_code));
    roots.forEach(root => processNode(root));

    return {
        assets,
        liabilities,
        equity,
        totalAssets,
        totalLiabilities: Math.abs(totalLiabilities),
        totalEquity: Math.abs(totalEquity)
    };
}

// --- كشف حساب عميل (Customer Statement) ---
export type StatementTransaction = {
    date: string;
    description: string;
    type: string;
    reference: string;
    debit: number;
    credit: number;
    balance: number;
};

export type CustomerStatement = {
    customerName: string;
    openingBalance: number;
    closingBalance: number;
    totalDebit: number;
    totalCredit: number;
    transactions: StatementTransaction[];
};

export async function getCustomerStatement(customerId: string, startDate?: string, endDate?: string): Promise<CustomerStatement> {
    // 1. Get Customer Details
    const { data: customer } = await supabaseAdmin.from('accounts').select('name_ar, current_balance').eq('id', customerId).single();
    if (!customer) throw new Error('Customer not found');

    // 2. Get Transactions
    let query = supabaseAdmin
        .from('journal_entry_lines')
        .select(`
    debit,
        credit,
        description,
        journal_entries!inner(
            entry_date,
            entry_number,
            reference_type,
            reference_id,
            status,
            description
        )
            `)
        .eq('account_id', customerId)
        .eq('journal_entries.status', 'posted')
        .order('journal_entries(entry_date)', { ascending: true });

    if (startDate) query = query.gte('journal_entries.entry_date', startDate);
    if (endDate) query = query.lte('journal_entries.entry_date', endDate);

    const { data: lines, error } = await query;
    if (error) throw new Error(error.message);

    // 3. Process
    let runningBalance = 0; // Should ideally account for opening balance before startDate
    const transactions: StatementTransaction[] = [];
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines || []) {
        const je = Array.isArray(line.journal_entries) ? line.journal_entries[0] : line.journal_entries;
        const debit = Number(line.debit);
        const credit = Number(line.credit);

        runningBalance += (debit - credit); // Normal balance for Asset (Receivable) is Debit. So +Dr -Cr.

        totalDebit += debit;
        totalCredit += credit;

        transactions.push({
            date: je.entry_date,
            description: line.description || je.description || '-',
            type: je.reference_type || 'manual',
            reference: je.reference_id || je.entry_number,
            debit,
            credit,
            balance: runningBalance
        });
    }

    return {
        customerName: customer.name_ar,
        openingBalance: 0, // Simplified
        closingBalance: runningBalance,
        totalDebit,
        totalCredit,
        transactions
    };
}

// --- قائمة التدفقات النقدية (Cash Flow Statement) ---
export type CashFlowData = {
    netIncome: number;
    operatingActivities: number;
    operatingDetails: { name: string; amount: number }[];
    investingActivities: number;
    investingDetails: { name: string; amount: number }[];
    financingActivities: number;
    financingDetails: { name: string; amount: number }[];
    netCashFlow: number;
};

export async function getCashFlowStatement(startDate: string, endDate: string): Promise<CashFlowData | null> {
    // 1. Calculate Net Income first
    const incomeStmt = await getIncomeStatement(startDate, endDate);
    const netIncome = incomeStmt.netIncome;

    // 2. Fetch movements for *Balance Sheet* accounts only (Assets 1, Liab 2, Equity 3)
    const { data: movements, error } = await supabaseAdmin
        .from('journal_entry_lines')
        .select(`
    debit,
        credit,
        account: accounts!inner(
            account_code,
            name_ar,
            account_type_id,
            cash_flow_type
        ),
            journal_entries!inner(
                entry_date,
                status
            )
        `)
        .eq('journal_entries.status', 'posted')
        .gte('journal_entries.entry_date', startDate)
        .lte('journal_entries.entry_date', endDate)
        .or('account_code.like.1%,account_code.like.2%,account_code.like.3%');

    if (error) {
        console.error('Error fetching cash flow data:', error);
        return null;
    }

    let operatingActivities = 0;
    let investingActivities = 0;
    let financingActivities = 0;

    const operatingDetails: { name: string; amount: number }[] = [];
    const investingDetails: { name: string; amount: number }[] = [];
    const financingDetails: { name: string; amount: number }[] = [];

    const addDetail = (type: 'operating' | 'investing' | 'financing', name: string, amount: number) => {
        if (Math.abs(amount) < 0.01) return;
        const target = type === 'operating' ? operatingDetails : type === 'investing' ? investingDetails : financingDetails;
        target.push({ name, amount });
        if (type === 'operating') operatingActivities += amount;
        else if (type === 'investing') investingActivities += amount;
        else financingActivities += amount;
    };

    // 3. Find Depreciation (Non-cash expense) Add-back
    // Typical Depreciation Expense accounts start with 5 or are named clearly
    let depreciation = 0;
    for (const exp of incomeStmt.expenses) {
        if (exp.accountName.includes('إهلاك') || exp.accountName.toLowerCase().includes('depreciation')) {
            depreciation += exp.balance;
        }
    }
    addDetail('operating', 'الإهلاك (مصروف غير نقدي)', depreciation);

    // 4. Analyze Balance Sheet Changes
    // Change = Dr - Cr
    // Asset Increase (+Change) -> Cash Outflow (-) => Effect = -Change
    // Liab/Eq Increase (-Change i.e. Cr>Dr) -> Cash Inflow (+) => Effect = -Change
    // So for ALL BS accounts: Cash Effect = -(Dr - Cr) = (Cr - Dr)

    // Grouping
    // Aggregate by account code first
    const accountChanges = new Map<string, { change: number, name: string, type: string }>();

    movements?.forEach(line => {
        const acc: any = Array.isArray(line.account) ? line.account[0] : line.account;
        const code = acc.account_code;

        // EXCLUDE Cash/Bank accounts (Cash Flow is ABOUT them, not BY them)
        // Standard: 111 (Cash 1111, Bank 1112)
        if (code.startsWith('111')) {
            return;
        }

        const netLineChange = Number(line.debit) - Number(line.credit);
        const current = accountChanges.get(code) || { change: 0, name: acc.name_ar, type: acc.cash_flow_type };

        accountChanges.set(code, {
            change: current.change + netLineChange,
            name: current.name,
            type: current.type
        });
    });

    // Initialize Grouping for Operating Activities
    let changeReceivables = 0;
    let changeInventory = 0;
    let changePayables = 0;

    // Fix iteration error by converting to array
    for (const [code, { change, name, type }] of Array.from(accountChanges.entries())) {
        const cashEffect = -change; // (Cr - Dr)

        // Determine Activity Type
        let activityType: 'operating' | 'investing' | 'financing' = 'operating';

        if (type && (type === 'operating' || type === 'investing' || type === 'financing')) {
            activityType = type as any;
        } else {
            // Fallback Logic based on Code
            // A. Investing Activities (Fixed Assets 12xx - excluding Inventory if it starts with 120)
            // Note: Dashboard says Inventory is 120. Fixed assets usually 12something else? 
            // Let's assume Fixed Assets are 121+ if Inventory is 120.
            // Or just check if it IS NOT inventory.

            if (code.startsWith('12') && !code.startsWith('120')) {
                activityType = 'investing';
            }
            // B. Financing Activities (Long Term Liab 22xx, Equity 3xxx)
            else if (code.startsWith('22') || code.startsWith('3')) {
                activityType = 'financing';
            }
            // C. Default execution is Operating
        }

        if (activityType !== 'operating') {
            addDetail(activityType, `صافي التغير في ${name}`, cashEffect);
        } else {
            // Operating Grouping
            // Inventory (120)
            if (code.startsWith('120') || name.includes('مخزون')) {
                changeInventory += cashEffect;
            }
            // Receivables (112)
            else if (code.startsWith('112') || name.includes('عملاء') || name.includes('ذمم مدينة')) {
                changeReceivables += cashEffect;
            }
            // Payables (211)
            else if (code.startsWith('211') || name.includes('موردين') || name.includes('ذمم دائنة')) {
                changePayables += cashEffect;
            }
            else {
                addDetail('operating', `التغير في ${name}`, cashEffect);
            }
        }
    }

    // Add Grouped Operating Items
    if (Math.abs(changeReceivables) > 0.01) addDetail('operating', 'التغير في العملاء والذمم المدينة', changeReceivables);
    if (Math.abs(changeInventory) > 0.01) addDetail('operating', 'التغير في المخزون', changeInventory);
    if (Math.abs(changePayables) > 0.01) addDetail('operating', 'التغير في الموردين والذمم الدائنة', changePayables);

    return {
        netIncome,
        operatingActivities: operatingActivities + netIncome, // Add Net Income to Total Operating
        operatingDetails,
        investingActivities,
        investingDetails,
        financingActivities,
        financingDetails,
        netCashFlow: (operatingActivities + netIncome) + investingActivities + financingActivities
    };
}
