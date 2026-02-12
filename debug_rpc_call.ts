
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugRpc() {
    console.log('Debugging create_fixed_asset_rpc...');

    const params = {
        p_name_ar: 'تجربة كود 1111',
        p_name_en: 'Test Code 1111',
        p_asset_category: 'intangible',
        p_asset_subcategory: 'trademark', // Try lowercase
        p_description: 'Debug Test',
        p_acquisition_date: '2024-12-30',
        p_acquisition_cost: 5000,
        p_useful_life_years: 5,
        p_residual_value: 0,
        p_depreciation_method: 'straight_line',
        p_location: 'Test Loc',
        p_responsible_person: 'Tester',
        p_serial_number: 'SN-DEBUG-001',
        p_warranty_expiry: null,
        p_payment_account_id: '111001' // Sending Legacy Code
    };

    console.log('Calling RPC with:', params);

    const { data, error } = await supabase.rpc('create_fixed_asset_rpc', params);

    if (error) {
        console.error('RPC Error:', error);
    } else {
        console.log('RPC Success! Asset ID:', data);
    }
}

debugRpc();
