import { createClient } from '@supabase/supabase-js';
import 'server-only';

// Hardcoded credentials for Server-Side Admin operations (Bypasses RLS)
// WARN: This file must NEVER be imported on the client side.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
