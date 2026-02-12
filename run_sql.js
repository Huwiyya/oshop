const fs = require('fs');
const https = require('https');

const projectRef = 'pipupdimlbjiivftgbop';
const token = 'sbp_aff9cadab3a0c812844c0bad2f17b1579a345ae2';
const sqlFilePath = process.argv[2];

if (!sqlFilePath) {
    console.error('Please provide a SQL file path as an argument.');
    process.exit(1);
}

try {
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    const data = JSON.stringify({
        query: sqlContent
    });

    const options = {
        hostname: 'api.supabase.com',
        path: `/v1/projects/${projectRef}/database/query`,
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    console.log(`Sending SQL from ${sqlFilePath} to Supabase...`);

    const req = https.request(options, (res) => {
        let responseBody = '';

        res.on('data', (chunk) => {
            responseBody += chunk;
        });

        res.on('end', () => {
            console.log(`Status Code: ${res.statusCode}`);
            try {
                const parsed = JSON.parse(responseBody);
                console.log('Response Data:', JSON.stringify(parsed, null, 2));
            } catch (e) {
                console.log('Response (Raw):', responseBody);
            }

            if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log('✅ SQL executed successfully!');
            } else {
                console.error('❌ Failed to execute SQL.');
            }
        });
    });

    req.on('error', (error) => {
        console.error('Request Error:', error);
    });

    req.write(data);
    req.end();

} catch (err) {
    console.error('File Read Error:', err);
}
