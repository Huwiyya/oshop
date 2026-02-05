import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Use Service Role Key to bypass RLS
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function ensureUser() {
    console.log('🔵 Checking for existing users...');

    // Check if any user exists
    const { data: users, error } = await supabase
        .from('users_v4')
        .select('id, username')
        .limit(1);

    if (error) {
        console.error('❌ Error checking users:', error);
        return;
    }

    if (users && users.length > 0) {
        console.log(`✅ User exists: ${users[0].username} (${users[0].id})`);
        return;
    }

    console.log('⚠️ No users found. Creating test user...');

    // Create new user
    const newUser = {
        name: 'Test Customer',
        username: 'TEST01',
        phone: '0910000000',
        address: 'Tripoli',
        debt: 0,
        orderCount: 0,
        notes: 'Created via script'
    };

    const { data: createdUser, error: createError } = await supabase
        .from('users_v4')
        .insert(newUser)
        .select()
        .single();

    if (createError) {
        console.error('❌ Failed to create user:', createError);
    } else {
        console.log('✅ Created test user:', createdUser);
    }
}

ensureUser();
