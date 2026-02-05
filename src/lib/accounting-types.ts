// src/lib/accounting-types.ts
// النظام المحاسبي - TypeScript Types

// ============================================
// 1. دليل الحسابات (Chart of Accounts)
// ============================================

export type AccountCategory = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export interface AccountType {
    id: string;
    name_ar: string;
    name_en: string;
    category: AccountCategory;
    normal_balance: NormalBalance;
    sort_order: number;
    created_at: string;
}

export interface Account {
    id: string;
    account_code: string;
    name_ar: string;
    name_en: string | null;
    account_type_id: string;
    parent_id: string | null;
    level: number;
    is_parent: boolean;
    is_active: boolean;
    opening_balance: number;
    current_balance: number;
    currency: 'LYD' | 'USD' | 'EUR';
    description: string | null;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    // Computed fields
    account_type?: AccountType;
    parent?: Account;
    children?: Account[];
}

// ============================================
// 2. القيود اليومية (Journal Entries)
// ============================================

export type JournalEntryStatus = 'draft' | 'posted' | 'cancelled';

export interface JournalEntry {
    id: string;
    entry_number: string;
    entry_date: string; // Date string
    description: string;
    reference_type: string | null;
    reference_id: string | null;
    total_debit: number;
    total_credit: number;
    status: JournalEntryStatus;
    posted_at: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    // Relations
    lines?: JournalEntryLine[];
}

export interface JournalEntryLine {
    id: string;
    entry_id: string;
    account_id: string;
    description: string | null;
    debit: number;
    credit: number;
    line_number: number | null;
    created_at: string;
    // Computed
    account?: Account;
}

// ============================================
// 3. سندات القبض (Receipts)
// ============================================

export type ReceiptStatus = 'draft' | 'posted' | 'cancelled';
export type PaymentMethod = 'cash' | 'bank' | 'card' | 'check';

export interface Receipt {
    id: string;
    receipt_number: string;
    receipt_date: string;
    customer_id: string | null;
    total_amount: number;
    payment_method: PaymentMethod | null;
    bank_account_id: string | null;
    main_description: string | null;
    status: ReceiptStatus;
    journal_entry_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    // Relations
    lines?: ReceiptLine[];
    journal_entry?: JournalEntry;
}

export interface ReceiptLine {
    id: string;
    receipt_id: string;
    account_id: string;
    amount: number;
    currency: string;
    exchange_rate: number;
    amount_in_base_currency: number | null;
    description: string | null;
    line_number: number | null;
    created_at: string;
    // Computed
    account?: Account;
}

// ============================================
// 4. سندات الدفع (Payments)
// ============================================

export type PaymentStatus = 'draft' | 'posted' | 'cancelled';

export interface Payment {
    id: string;
    payment_number: string;
    payment_date: string;
    supplier_id: string | null;
    total_amount: number;
    payment_method: PaymentMethod | null;
    bank_account_id: string | null;
    check_number: string | null;
    main_description: string | null;
    status: PaymentStatus;
    journal_entry_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    // Relations
    lines?: PaymentLine[];
    journal_entry?: JournalEntry;
}

export interface PaymentLine {
    id: string;
    payment_id: string;
    account_id: string;
    amount: number;
    currency: string;
    exchange_rate: number;
    amount_in_base_currency: number | null;
    description: string | null;
    line_number: number | null;
    created_at: string;
    // Computed
    account?: Account;
}

// ============================================
// 5. نظام المخزون (Inventory)
// ============================================

export interface InventoryItem {
    id: string;
    item_code: string;
    name_ar: string;
    name_en: string | null;
    category: string | null;
    unit: string;
    quantity_on_hand: number;
    average_cost: number;
    inventory_account_id: string | null;
    cogs_account_id: string | null;
    is_active: boolean;
    is_shein_card: boolean;
    description: string | null;
    created_at: string;
    updated_at: string;
    // Relations
    layers?: InventoryLayer[];
}

export interface InventoryLayer {
    id: string;
    item_id: string;
    purchase_date: string;
    purchase_reference: string | null;
    quantity: number;
    remaining_quantity: number;
    unit_cost: number;
    card_number: string | null;
    created_at: string;
}

export type InventoryTransactionType = 'purchase' | 'sale' | 'adjustment' | 'transfer';

export interface InventoryTransaction {
    id: string;
    item_id: string;
    transaction_type: InventoryTransactionType;
    transaction_date: string;
    quantity: number;
    unit_cost: number | null;
    total_cost: number | null;
    reference_type: string | null;
    reference_id: string | null;
    layer_id: string | null;
    journal_entry_id: string | null;
    notes: string | null;
    created_at: string;
    // Relations
    item?: InventoryItem;
}

// ============================================
// 6. فواتير الشراء (Purchase Invoices)
// ============================================

export type InvoicePaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface PurchaseInvoice {
    id: string;
    invoice_number: string;
    invoice_date: string;
    supplier_account_id: string | null;
    currency: string;
    exchange_rate: number;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
    paid_amount: number;
    remaining_amount: number | null;
    payment_status: InvoicePaymentStatus;
    journal_entry_id: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    // Relations
    lines?: PurchaseInvoiceLine[];
    supplier?: Account;
}

export interface PurchaseInvoiceLine {
    id: string;
    invoice_id: string;
    item_id: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
    card_number: string | null;
    line_number: number | null;
    created_at: string;
    // Relations
    item?: InventoryItem;
}

// ============================================
// 7. فواتير البيع (Sales Invoices)
// ============================================

export interface SalesInvoice {
    id: string;
    invoice_number: string;
    invoice_date: string;
    customer_account_id: string | null;
    currency: string;
    exchange_rate: number;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
    total_cost: number;
    paid_amount: number;
    remaining_amount: number | null;
    payment_status: InvoicePaymentStatus;
    journal_entry_id: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    // Relations
    lines?: SalesInvoiceLine[];
    customer?: Account;
}

export interface SalesInvoiceLine {
    id: string;
    invoice_id: string;
    item_id: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    unit_cost: number | null;
    total: number;
    card_number: string | null;
    line_number: number | null;
    created_at: string;
    // Relations
    item?: InventoryItem;
}

// ============================================
// 8. نظام الرواتب (Payroll)
// ============================================

export type PayrollPaymentStatus = 'unpaid' | 'paid';

export interface PayrollSlip {
    id: string;
    slip_number: string;
    employee_id: string | null;
    employee_name: string;
    period_month: number;
    period_year: number;
    basic_salary: number;
    basic_salary_account_id: string | null;
    overtime: number;
    overtime_account_id: string | null;
    allowances: number;
    allowances_account_id: string | null;
    absences: number;
    deductions: number;
    advances: number;
    advances_account_id: string | null;
    net_salary: number;
    employee_payable_account_id: string | null;
    journal_entry_id: string | null;
    payment_status: PayrollPaymentStatus;
    created_by: string | null;
    created_at: string;
}

// ============================================
// 9. الأصول الثابتة (Fixed Assets)
// ============================================

export type DepreciationMethod = 'straight_line' | 'declining_balance';

export interface AssetCategory {
    id: string;
    name_ar: string;
    name_en: string | null;
    depreciation_method: DepreciationMethod;
    useful_life_years: number | null;
    salvage_value_percent: number;
    asset_account_id: string | null;
    depreciation_account_id: string | null;
    accumulated_depreciation_account_id: string | null;
    created_at: string;
}

export interface FixedAsset {
    id: string;
    asset_code: string;
    name_ar: string;
    name_en: string | null;
    category_id: string | null;
    purchase_date: string;
    cost: number;
    salvage_value: number;
    useful_life_years: number | null;
    accumulated_depreciation: number;
    net_book_value: number | null;
    is_active: boolean;
    location: string | null;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    // Relations
    category?: AssetCategory;
}

// ============================================
// 10. كشف الحساب
// ============================================

export interface AccountTransaction {
    id: string;
    account_id: string;
    transaction_date: string;
    description: string | null;
    debit: number;
    credit: number;
    balance: number | null;
    reference_type: string | null;
    reference_id: string | null;
    journal_entry_id: string | null;
    created_at: string;
}

// ============================================
// التقارير المالية
// ============================================

export interface BalanceSheetItem {
    account_code: string;
    account_name: string;
    amount: number;
    level: number;
    is_parent: boolean;
    children?: BalanceSheetItem[];
}

export interface BalanceSheet {
    as_of_date: string;
    assets: BalanceSheetItem[];
    liabilities: BalanceSheetItem[];
    equity: BalanceSheetItem[];
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
}

export interface IncomeStatementItem {
    account_code: string;
    account_name: string;
    amount: number;
    level: number;
    is_parent: boolean;
    children?: IncomeStatementItem[];
}

export interface IncomeStatement {
    from_date: string;
    to_date: string;
    revenue: IncomeStatementItem[];
    expenses: IncomeStatementItem[];
    total_revenue: number;
    total_expenses: number;
    net_income: number;
}

// ============================================
// Form Types للإنشاء/التحديث
// ============================================

export type CreateAccountInput = Omit<Account, 'id' | 'created_at' | 'updated_at' | 'current_balance'>;
export type UpdateAccountInput = Partial<CreateAccountInput>;

export type CreateJournalEntryInput = Omit<JournalEntry, 'id' | 'created_at' | 'updated_at' | 'total_debit' | 'total_credit'> & {
    lines: Omit<JournalEntryLine, 'id' | 'entry_id' | 'created_at'>[];
};

export type CreateReceiptInput = Omit<Receipt, 'id' | 'created_at' | 'updated_at' | 'journal_entry_id'> & {
    lines: Omit<ReceiptLine, 'id' | 'receipt_id' | 'created_at'>[];
};

export type CreatePaymentInput = Omit<Payment, 'id' | 'created_at' | 'updated_at' | 'journal_entry_id'> & {
    lines: Omit<PaymentLine, 'id' | 'payment_id' | 'created_at'>[];
};

export type CreatePurchaseInvoiceInput = Omit<PurchaseInvoice, 'id' | 'created_at' | 'updated_at' | 'remaining_amount' | 'journal_entry_id'> & {
    lines: Omit<PurchaseInvoiceLine, 'id' | 'invoice_id' | 'created_at'>[];
};

export type CreateSalesInvoiceInput = Omit<SalesInvoice, 'id' | 'created_at' | 'updated_at' | 'remaining_amount' | 'total_cost' | 'journal_entry_id'> & {
    lines: Omit<SalesInvoiceLine, 'id' | 'invoice_id' | 'created_at' | 'unit_cost'>[];
};
