export type AccountCategoryV2 = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalanceV2 = 'debit' | 'credit';

export interface AccountTypeV2 {
    id: string;
    name_ar: string;
    name_en: string;
    category: AccountCategoryV2;
    normal_balance: NormalBalanceV2;
    created_at: string;
}

export interface AccountV2 {
    id: string;
    code: string;
    name_ar: string;
    name_en: string;
    type_id: string;
    parent_id: string | null;
    level: number;
    is_group: boolean;
    is_active: boolean;
    is_system: boolean;
    current_balance: number;
    currency: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    // Relations
    account_type?: AccountTypeV2;
    parent?: AccountV2;
    children?: AccountV2[];
}

export type JournalStatusV2 = 'draft' | 'posted' | 'archived' | 'cancelled';

export interface JournalEntryV2 {
    id: string;
    entry_number: string;
    date: string;
    description: string | null;
    status: JournalStatusV2;
    source_type: string | null;
    source_id: string | null;
    total_debit: number;
    total_credit: number;
    created_by: string | null;
    posted_at: string | null;
    created_at: string;
    updated_at: string;
    // Relations
    lines?: JournalEntryLineV2[];
}

export interface JournalEntryLineV2 {
    id: string;
    journal_id: string;
    account_id: string;
    debit: number;
    credit: number;
    description: string | null;
    currency: string;
    exchange_rate: number;
    amount_currency: number;
    product_id?: string | null; // Added
    quantity?: number;          // Added
    created_at: string;
    // Relations
    account?: AccountV2;
    product?: any; // We'll refine this type if we import ProductV2
}

// Sub-ledger Types
export interface ReceiptV2 {
    id: string;
    receipt_number: string;
    date: string;
    customer_account_id: string | null;
    treasury_account_id: string;
    amount: number;
    description: string | null;
    status: JournalStatusV2;
    journal_entry_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    // Relations
    customer?: AccountV2;
    treasury?: AccountV2;
    journal_entry?: JournalEntryV2;
}

export interface PaymentV2 {
    id: string;
    payment_number: string;
    date: string;
    supplier_account_id: string | null;
    treasury_account_id: string;
    amount: number;
    description: string | null;
    status: JournalStatusV2;
    journal_entry_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    // Relations
    supplier?: AccountV2;
    treasury?: AccountV2;
    journal_entry?: JournalEntryV2;
}

// Form Inputs
export type CreateAccountV2Input = Omit<AccountV2, 'id' | 'created_at' | 'updated_at' | 'current_balance' | 'account_type' | 'parent' | 'children'>;

export type CreateJournalEntryV2Input = {
    date: string;
    description?: string;
    lines: {
        account_id: string;
        debit: number;
        credit: number;
        description?: string;
        product_id?: string; // Added
        quantity?: number;   // Added
    }[];
};
