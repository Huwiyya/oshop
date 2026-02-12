
import XLSX from 'xlsx';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Load .env.local specifically
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config(); // Fallback to .env
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE_ROLE) {
    console.error("❌ Missing Supabase credentials in .env.local!");
    process.exit(1);
}

const supabase = createClient(URL, SERVICE_ROLE, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function run() {
    console.log("🚀 Starting Import...");
    const filePath = path.join(process.cwd(), 'بيانات الزبائن.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    // 1. Get Parent (Customers Control - 1121)
    // Using ID found via SQL check to be safe: bf6e3a43-4be5-49ff-a22f-e065fdf17a74
    const parentId = 'bf6e3a43-4be5-49ff-a22f-e065fdf17a74';

    const { data: parent, error: parentError } = await supabase
        .from('accounts_v2')
        .select('*')
        .eq('id', parentId)
        .single();

    if (parentError || !parent) {
        console.error("❌ Parent account fetch failed:", parentError);
        return;
    }

    console.log(`✅ Parent Found: ${parent.name_ar} (${parent.code})`);

    // 2. Get Last Child Code to start sequence
    const { data: children } = await supabase
        .from('accounts_v2')
        .select('code')
        .eq('parent_id', parent.id)
        .order('code', { ascending: false })
        .limit(1);

    let nextSerial = 1;
    if (children && children.length > 0) {
        const lastCode = children[0].code;
        // Assuming format 11210001, extract suffix
        // Check if length is greater than parent code
        if (lastCode.length > parent.code.length) {
            const suffix = lastCode.substring(parent.code.length);
            const num = parseInt(suffix);
            if (!isNaN(num)) nextSerial = num + 1;
        }
    }

    console.log(`Starting serial from: ${nextSerial}`);

    // 3. Extract Customers
    const customersToInsert: any[] = [];

    // Rows start data at index 1 (Table 1) and index 2 (Table 2)?
    // Let's iterate from index 1.

    // Table 1: Cols 0(Code), 1(Name), 2(Phone), 3(City), 4(Address)
    // Table 2: Cols 8(Code), 9(Name), 10(Phone)

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];

        // --- Table 1 ---
        const name1 = row[1];
        if (name1) {
            const phone = row[2] || '';
            const city = row[3] || '';
            const address = row[4] || '';
            const oldCode = row[0] || '';

            let descParts = [];
            if (phone) descParts.push(`Phone: ${phone}`);
            if (city) descParts.push(`City: ${city}`);
            if (address) descParts.push(`Address: ${address}`);
            if (oldCode) descParts.push(`Old Code: ${oldCode}`);

            customersToInsert.push({
                name_ar: name1,
                description: descParts.join(' - ')
            });
        }

        // --- Table 2 ---
        // Header for Table 2 is usually row 1, data starts row 2.
        if (i >= 2) {
            const name2 = row[9];
            if (name2) {
                const phone = row[10] || '';
                const oldCode = row[8] || '';

                let descParts = [];
                if (phone) descParts.push(`Phone: ${phone}`);
                if (oldCode) descParts.push(`Old Code: ${oldCode}`);

                customersToInsert.push({
                    name_ar: name2,
                    description: descParts.join(' - ')
                });
            }
        }
    }

    console.log(`Found ${customersToInsert.length} customers to insert.`);

    // 4. Insert Batch
    // Doing strict sequential insert.

    for (const cust of customersToInsert) {
        // Pad serial to 3 digits? 1121001.
        // Let's verify standard length. Usually 3-4 digits.
        const codeSuffix = nextSerial.toString().padStart(4, '0');
        const newCode = `${parent.code}${codeSuffix}`;

        const { error } = await supabase.from('accounts_v2').insert({
            name_ar: cust.name_ar,
            name_en: cust.name_ar, // Fallback
            code: newCode,
            parent_id: parent.id,
            type_id: parent.type_id,
            level: parent.level + 1,
            is_group: false,
            current_balance: 0,
            currency: 'LYD',
            description: cust.description,
            is_active: true,
            is_system: false
        });

        if (error) {
            console.error(`❌ Failed to insert ${cust.name_ar}: ${error.message}`);
        } else {
            // console.log(`✅ Inserted ${cust.name_ar} (${newCode})`);
            nextSerial++;
        }
    }

    console.log("🚀 Import Complete!");
}

run();
