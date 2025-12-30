/**
 * Test script for Issue #102 - Verify directory selection from reports
 *
 * This script verifies that:
 * 1. Customers are loaded from report/6096
 * 2. Objects are loaded from report/6102
 * 3. Data format matches expected structure
 *
 * Run: node experiments/test-issue-102-directory-selection.js
 */

const https = require('https');

const CONFIG = {
    host: 'integram.io',
    database: 'orbits',
};

/**
 * Build API URL
 */
function buildApiUrl(path) {
    return `https://${CONFIG.host}/${CONFIG.database}${path}`;
}

/**
 * Fetch JSON from URL
 */
function fetchJson(url) {
    return new Promise((resolve, reject) => {
        console.log(`[Test] Fetching: ${url}`);
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log(`[Test] ✓ Received data`);
                    resolve(json);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

/**
 * Main test function
 */
async function runTest() {
    console.log('[Test] ========================================');
    console.log('[Test] Issue #102 - Testing directory selection');
    console.log('[Test] ========================================\n');

    try {
        // Test 1: Load customers from report/6096
        console.log('[Test] Step 1: Loading customers from report/6096...');
        const customersUrl = buildApiUrl('/report/6096?JSON_KV');
        const customers = await fetchJson(customersUrl);

        console.log(`[Test] ✓ Received ${customers.length} customers`);
        console.log('[Test] Sample customers:');
        customers.slice(0, 3).forEach(customer => {
            console.log(`[Test]   - ${customer['Заказчик']} (ID: ${customer['ЗаказчикID']})`);
        });
        console.log();

        // Verify expected format
        if (customers.length > 0) {
            const firstCustomer = customers[0];
            if (!firstCustomer['Заказчик'] || !firstCustomer['ЗаказчикID']) {
                throw new Error('Customers data format is incorrect. Expected fields: Заказчик, ЗаказчикID');
            }
            console.log('[Test] ✓ Customers data format is correct\n');
        }

        // Test 2: Load objects from report/6102
        console.log('[Test] Step 2: Loading objects from report/6102...');
        const objectsUrl = buildApiUrl('/report/6102?JSON_KV');
        const objects = await fetchJson(objectsUrl);

        console.log(`[Test] ✓ Received ${objects.length} objects`);
        console.log('[Test] Sample objects:');
        objects.slice(0, 3).forEach(obj => {
            console.log(`[Test]   - ${obj['Объект']} (ID: ${obj['Объект ID']})`);
        });
        console.log();

        // Verify expected format
        if (objects.length > 0) {
            const firstObject = objects[0];
            if (!firstObject['Объект'] || !firstObject['Объект ID']) {
                throw new Error('Objects data format is incorrect. Expected fields: Объект, Объект ID');
            }
            console.log('[Test] ✓ Objects data format is correct\n');
        }

        // Summary
        console.log('[Test] ========================================');
        console.log('[Test] SUMMARY');
        console.log('[Test] ========================================\n');

        console.log('[Test] ✓ Customers endpoint (report/6096): Working');
        console.log(`[Test]   - ${customers.length} customers available`);
        console.log('[Test] ✓ Objects endpoint (report/6102): Working');
        console.log(`[Test]   - ${objects.length} objects available`);

        console.log('\n[Test] ========================================');
        console.log('[Test] All tests passed!');
        console.log('[Test] ========================================');

        // Verify expected data from issue
        console.log('\n[Test] Verifying expected data from issue...');

        const expectedCustomers = [
            { name: 'АО Вектор', id: '6051' },
            { name: 'Орбиты', id: '799' }
        ];

        let foundCount = 0;
        expectedCustomers.forEach(expected => {
            const found = customers.find(c => c['ЗаказчикID'] === expected.id);
            if (found) {
                console.log(`[Test] ✓ Found expected customer: ${expected.name} (ID: ${expected.id})`);
                foundCount++;
            } else {
                console.log(`[Test] ⚠ Expected customer not found: ${expected.name} (ID: ${expected.id})`);
            }
        });

        const expectedObjects = [
            { name: 'Красная поляна, влд.1', id: '882' }
        ];

        expectedObjects.forEach(expected => {
            const found = objects.find(o => o['Объект ID'] === expected.id);
            if (found) {
                console.log(`[Test] ✓ Found expected object: ${expected.name} (ID: ${expected.id})`);
                foundCount++;
            } else {
                console.log(`[Test] ⚠ Expected object not found: ${expected.name} (ID: ${expected.id})`);
            }
        });

        if (foundCount === expectedCustomers.length + expectedObjects.length) {
            console.log('\n[Test] ✓ All expected data from issue found!');
        }

    } catch (error) {
        console.error('[Test] ✗ Test failed:', error.message);
        console.error('[Test] Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
runTest().catch(error => {
    console.error('[Test] Fatal error:', error);
    process.exit(1);
});
