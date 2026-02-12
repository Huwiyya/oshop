
const { createClient } = require('@supabase/supabase-js');

// Hardcoding for this script since we just read them - normally we'd use dotenv but this is faster for a one-off
const supabaseUrl = 'https://pipupdimlbjiivftgbop.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcHVwZGltbGJqaWl2ZnRnYm9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDczMzMzMCwiZXhwIjoyMDg2MzA5MzMwfQ.3YWHGgmV5old4xJpnrUdqruz5C6wYPDDf5PlLywfmsQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('Checking fixed assets...');
    const { data, error } = await supabase
        .from('fixed_assets_v2')
        .select('*');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Found Assets:', data);
    }
}

check();
