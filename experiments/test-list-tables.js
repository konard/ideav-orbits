/**
 * List all tables to understand the structure
 */

const https = require('https');

const CONFIG = {
    host: 'integram.io',
    database: 'orbits',
};

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        console.log(`Fetching: ${url}`);
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

async function main() {
    try {
        const url = `https://${CONFIG.host}/${CONFIG.database}/dict?JSON=1`;
        const tables = await fetchJson(url);

        console.log('\nAll tables:');
        for (const [id, name] of Object.entries(tables)) {
            console.log(`  ${id}: ${name}`);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
