'use server';

import { supabaseAdmin } from './supabase-admin';
import { revalidatePath } from 'next/cache';

export type InventoryCategory = {
    id: string;
    name_ar: string;
    name_en?: string;
    description?: string;
    revenue_account_id?: string;
    cogs_account_id?: string;
    inventory_account_id?: string;
    created_at?: string;
};

export async function getCategories() {
    const { data, error } = await supabaseAdmin
        .from('inventory_categories')
        .select(`
            *,
            revenue_account:accounts!revenue_account_id(name_ar),
            cogs_account:accounts!cogs_account_id(name_ar),
            inventory_account:accounts!inventory_account_id(name_ar)
        `)
        .order('name_ar');

    if (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
    return data;
}

export async function createCategory(data: Partial<InventoryCategory>) {
    const { error } = await supabaseAdmin
        .from('inventory_categories')
        .insert(data);

    if (error) throw new Error(error.message);
    revalidatePath('/admin/inventory/categories');
    return { success: true };
}

export async function updateCategory(id: string, data: Partial<InventoryCategory>) {
    const { error } = await supabaseAdmin
        .from('inventory_categories')
        .update(data)
        .eq('id', id);

    if (error) throw new Error(error.message);
    revalidatePath('/admin/inventory/categories');
    return { success: true };
}

export async function deleteCategory(id: string) {
    const { error } = await supabaseAdmin
        .from('inventory_categories')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);
    revalidatePath('/admin/inventory/categories');
    return { success: true };
}
