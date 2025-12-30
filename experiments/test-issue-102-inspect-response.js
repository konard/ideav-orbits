/**
 * Inspect the actual response format from the APIs
 */

const https = require('https');

const CONFIG = {
    host: 'integram.io',
    database: 'orbits',
};

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        console.log(`Fetching: ${url}\n`);
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function inspectApis() {
    try {
        // Check customers
        console.log('=== CUSTOMERS (report/6096) ===\n');
        const customersUrl = `https://${CONFIG.host}/${CONFIG.database}/report/6096?JSON_KV`;
        const customers = await fetchJson(customersUrl);
        console.log('Raw data:', JSON.stringify(customers, null, 2));
        console.log('\nData type:', Array.isArray(customers) ? 'Array' : 'Object');
        console.log('Length/Keys:', Array.isArray(customers) ? customers.length : Object.keys(customers).length);
        if (Array.isArray(customers) && customers.length > 0) {
            console.log('First item keys:', Object.keys(customers[0]));
            console.log('First item:', customers[0]);
        } else if (!Array.isArray(customers)) {
            console.log('Object keys:', Object.keys(customers));
        }

        console.log('\n\n=== OBJECTS (report/6102) ===\n');
        const objectsUrl = `https://${CONFIG.host}/${CONFIG.database}/report/6102?JSON_KV`;
        const objects = await fetchJson(objectsUrl);
        console.log('Raw data:', JSON.stringify(objects, null, 2));
        console.log('\nData type:', Array.isArray(objects) ? 'Array' : 'Object');
        console.log('Length/Keys:', Array.isArray(objects) ? objects.length : Object.keys(objects).length);
        if (Array.isArray(objects) && objects.length > 0) {
            console.log('First item keys:', Object.keys(objects[0]));
            console.log('First item:', objects[0]);
        } else if (!Array.isArray(objects)) {
            console.log('Object keys:', Object.keys(objects));
        }

    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

inspectApis();
