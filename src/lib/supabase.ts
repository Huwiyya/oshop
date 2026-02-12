import { createClient } from '@supabase/supabase-js';

// Hardcoded credentials per user request for direct Vercel deployment without env vars
const supabaseUrl = 'https://tflgxjuwjfljngzwbgiv.supabase.co';
const supabaseKey = 'sb_publishable_mz1rlg5O9oRbLzDtvygTjQ_0dzQ6Mvv';

// if (!supabaseUrl || !supabaseKey) {
//     console.warn('Missing Supabase environment variables. Sync will be disabled.');
// }

export const supabase = createClient(supabaseUrl, supabaseKey);
