
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pipupdimlbjiivftgbop.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpcHVwZGltbGJqaWl2ZnRnYm9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDczMzMzMCwiZXhwIjoyMDg2MzA5MzMwfQ.3YWHGgmV5old4xJpnrUdqruz5C6wYPDDf5PlLywfmsQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    try {
        console.log('Checking table counts...');

        // Check V1 Table
        const { count: v1Count, error: v1Error } = await supabase
            .from('fixed_assets')
            .select('*', { count: 'exact', head: true });

        if (v1Error && v1Error.code !== '42P01') console.error('Error checking fixed_assets (V1):', v1Error.message);
        else console.log(`Legacy 'fixed_assets' count: ${v1Count ?? 'Table not found or empty'}`);

        // Check V2 Table
        const { count: v2Count, error: v2Error } = await supabase
            .from('fixed_assets_v2')
            .select('*', { count: 'exact', head: true });

        if (v2Error) console.error('Error checking fixed_assets_v2:', v2Error.message);
        else console.log(`Current 'fixed_assets_v2' count: ${v2Count}`);

    } catch (e) {
        console.error(e);
    }
}

checkTables();
