'use server';

import { supabaseAdmin as supabase } from './supabase-admin';
import { revalidatePath } from 'next/cache';

export interface ProductV2 {
    id: string;
    sku: string | null;
    name_ar: string;
    name_en: string;
    type: 'product' | 'service';
    current_quantity: number;
    average_cost: number;
    // Relations
    sales_account?: { name_ar: string; name_en: string };
    cogs_account?: { name_ar: string; name_en: string };
    inventory_account?: { name_ar: string; name_en: string };
}

export async function getProductsV2() {
    const { data, error } = await supabase
        .from('products_v2')
        .select(`
            *,
            sales_account:sales_account_id (name_ar, name_en),
            cogs_account:cogs_account_id (name_ar, name_en),
            inventory_account:inventory_account_id (name_ar, name_en)
        `)
        .order('name_ar', { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as ProductV2[] };
}

export async function createProductV2(input: {
    sku?: string;
    name_ar: string;
    name_en: string;
    type: 'product' | 'service';
    sales_account_id: string;
    cogs_account_id?: string;
    inventory_account_id?: string;
}) {
    const { data, error } = await supabase
        .from('products_v2')
        .insert({
            sku: input.sku,
            name_ar: input.name_ar,
            name_en: input.name_en,
            type: input.type,
            sales_account_id: input.sales_account_id,
            cogs_account_id: input.cogs_account_id,
            inventory_account_id: input.inventory_account_id,
            current_quantity: 0,
            average_cost: 0
        })
        .select()
        .single();

    if (error) return { success: false, error: error.message };

    revalidatePath('/accounting/products-v2'); // We might need this page later
    return { success: true, data };
}
