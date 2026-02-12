
import { supabaseAdminScript as supabaseAdmin } from './supabase-client-script';

async function seedAdmin() {
    console.log('Checking managers table...');

    // 1. Check if we can access the managers table
    const { data: existing, error: checkError } = await supabaseAdmin
        .from('managers')
        .select('*')
        .eq('username', 'admin@Oshop.app')
        .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "Row not found" (which is fine)
        console.error('Error accessing managers table:', checkError.message);
        console.log('HINT: Did you run the CREATE TABLE SQL in the Supabase Editor?');
        return;
    }

    if (existing) {
        console.log('✅ Admin user already exists in Supabase:', existing.username);
        return;
    }

    // 2. Insert the admin
    console.log('Inserting default admin...');
    const { data, error } = await supabaseAdmin
        .from('managers')
        .insert([
            {
                username: 'admin@Oshop.app',
                name: 'المدير العام',
                password: '0920064400',
                phone: '0920064400',
                role: 'super_admin',
                permissions: [
                    'dashboard', 'users', 'employees', 'representatives', 'orders',
                    'inventory', 'shipping_label', 'temporary_users', 'financial_reports',
                    'instant_sales', 'deposits', 'expenses', 'creditors', 'support',
                    'notifications', 'exchange_rate', 'data_export', 'accounting_dashboard'
                ]
            }
        ])
        .select();

    if (error) {
        console.error('❌ Failed to insert admin:', error.message);
    } else {
        console.log('✅ Admin inserted successfully:', data);
    }
}

seedAdmin();
