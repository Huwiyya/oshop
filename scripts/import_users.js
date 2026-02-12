
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });
const crypto = require('crypto');

// Credentials from .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const FILE_PATH = path.join(process.cwd(), 'بيانات الزبائن.xlsx');

async function importUsers() {
    if (!require('fs').existsSync(FILE_PATH)) {
        console.error('File not found:', FILE_PATH);
        return;
    }

    const workbook = XLSX.readFile(FILE_PATH);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`Found ${data.length} rows in Excel file.`);

    // 1. Fetch existing usernames to avoid duplicates manually
    console.log('Fetching existing users...');
    const { data: existingUsers, error: fetchError } = await supabase.from('users').select('username');

    if (fetchError) {
        console.error('Failed to fetch existing users:', fetchError.message);
        return;
    }

    const existingUsernames = new Set(existingUsers.map(u => u.username));
    console.log(`Found ${existingUsernames.size} existing users.`);

    let count = 0;
    let errors = 0;
    let skipped = 0;
    let duplicates = 0;

    // Batch processing
    const BATCH_SIZE = 50;
    let usersBatch = [];

    for (const row of data) {
        // Map columns
        const name = row['اسم الزبون'];
        const city = row['المدينة'];
        const address = row['العنوان'];
        const codeA = row[' '];
        const codeE = row['شحن فقط'];

        let phone = row['رقم الهاتف'];
        if (!phone && row['__EMPTY_2']) phone = row['__EMPTY_2'];

        if (!name) {
            skipped++;
            continue;
        }

        // Determine username
        let username = codeA ? String(codeA).trim() : (codeE ? String(codeE).trim() : null);

        if (!username) {
            skipped++;
            continue;
        }

        // Check duplicates locally
        if (existingUsernames.has(username)) {
            duplicates++;
            continue;
        }

        // Add to Set to prevent duplicates within the file itself
        existingUsernames.add(username);

        // Clean phone
        const finalPhone = phone ? String(phone).replace(/[^0-9]/g, '') : '';
        const finalAddress = address ? (city ? `${city} - ${address}` : address) : (city || '');

        usersBatch.push({
            id: crypto.randomUUID(),
            name: name,
            username: username,
            password: '123456',
            phone: finalPhone,
            address: finalAddress,
            orderCount: 0,
            debt: 0
        });

        if (usersBatch.length >= BATCH_SIZE) {
            const { error } = await supabase.from('users').insert(usersBatch);

            if (error) {
                console.error('Batch insert error:', error.message);
                errors += usersBatch.length;
            } else {
                console.log(`Processed batch of ${usersBatch.length} users.`);
                count += usersBatch.length;
            }
            usersBatch = [];
        }
    }

    // Remaining batch
    if (usersBatch.length > 0) {
        const { error } = await supabase.from('users').insert(usersBatch);
        if (error) {
            console.error('Final batch insert error:', error.message);
            errors += usersBatch.length;
        } else {
            console.log(`Processed final batch of ${usersBatch.length} users.`);
            count += usersBatch.length;
        }
    }

    console.log(`\nImport Summary:`);
    console.log(`Inserted: ${count}`);
    console.log(`Duplicates (Skipped): ${duplicates}`);
    console.log(`Skipped (Missing Data): ${skipped}`);
    console.log(`Errors: ${errors}`);
}

importUsers().catch(console.error);
