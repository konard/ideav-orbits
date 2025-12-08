/**
 * Test script for Issue #66 - Verify _ref_reqs calls for dropdown fields
 *
 * This script verifies that all dropdown fields (Заказчик, Статус проекта,
 * Родительский проект, Объект, Шаблон Проекта) are properly loaded via _ref_reqs
 *
 * Run: node experiments/test-issue-66-dropdown-calls.js
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
    console.log('[Test] Issue #66 - Testing dropdown _ref_reqs calls');
    console.log('[Test] ========================================\n');

    try {
        // Step 1: Get Project table metadata
        console.log('[Test] Step 1: Fetching Project table metadata...');
        const dictUrl = buildApiUrl('/dict?JSON=1');
        const tables = await fetchJson(dictUrl);

        let projectTableId = null;
        for (const [id, name] of Object.entries(tables)) {
            if (name === 'Проект') {
                projectTableId = id;
                console.log(`[Test] ✓ Found Project table: ID = ${id}\n`);
                break;
            }
        }

        if (!projectTableId) {
            throw new Error('Project table not found');
        }

        // Step 2: Get field metadata
        console.log('[Test] Step 2: Fetching field metadata...');
        const metadataUrl = buildApiUrl(`/metadata/${projectTableId}?JSON=1`);
        const metadata = await fetchJson(metadataUrl);
        const projectMetadata = Array.isArray(metadata) ? metadata[0] : metadata;

        console.log(`[Test] ✓ Found ${projectMetadata.reqs.length} fields\n`);

        // Step 3: Find all dropdown fields
        console.log('[Test] Step 3: Identifying dropdown fields...');
        const fieldNames = ['Заказчик', 'Статус', 'Родительский', 'Объект', 'Шаблон'];
        const fields = {};

        for (const fieldName of fieldNames) {
            const field = projectMetadata.reqs.find(f => f.val.includes(fieldName));
            if (field) {
                fields[fieldName] = field;
                console.log(`[Test] ✓ Found "${field.val}" (ID: ${field.id}, ref: ${field.ref || 'none'})`);
            } else {
                console.log(`[Test] ✗ Field containing "${fieldName}" not found`);
            }
        }
        console.log();

        // Step 4: Test _ref_reqs calls for each dropdown field
        console.log('[Test] Step 4: Testing _ref_reqs calls...\n');
        const results = {};

        for (const [fieldName, field] of Object.entries(fields)) {
            if (field.ref) {
                console.log(`[Test] --- Testing "${field.val}" ---`);
                console.log(`[Test] Field ID: ${field.id}`);
                console.log(`[Test] Reference table ID: ${field.ref}`);

                try {
                    const refUrl = buildApiUrl(`/_ref_reqs/${field.id}?JSON=1`);
                    const options = await fetchJson(refUrl);
                    const optionCount = Object.keys(options).length;

                    console.log(`[Test] ✓ _ref_reqs call successful`);
                    console.log(`[Test] ✓ Received ${optionCount} options`);

                    // Show first 3 options as sample
                    const sampleOptions = Object.entries(options).slice(0, 3);
                    console.log(`[Test] Sample options:`);
                    sampleOptions.forEach(([id, name]) => {
                        console.log(`[Test]   - ${id}: ${name}`);
                    });

                    results[fieldName] = {
                        success: true,
                        fieldId: field.id,
                        refTableId: field.ref,
                        optionCount: optionCount
                    };
                } catch (error) {
                    console.log(`[Test] ✗ _ref_reqs call failed: ${error.message}`);
                    results[fieldName] = {
                        success: false,
                        fieldId: field.id,
                        refTableId: field.ref,
                        error: error.message
                    };
                }
                console.log();
            } else {
                console.log(`[Test] --- Skipping "${field.val}" (no reference) ---\n`);
                results[fieldName] = {
                    success: false,
                    fieldId: field.id,
                    error: 'Not a reference field'
                };
            }
        }

        // Step 5: Summary
        console.log('[Test] ========================================');
        console.log('[Test] SUMMARY');
        console.log('[Test] ========================================\n');

        const successCount = Object.values(results).filter(r => r.success).length;
        const totalCount = Object.keys(results).length;

        console.log(`[Test] Total fields tested: ${totalCount}`);
        console.log(`[Test] Successful _ref_reqs calls: ${successCount}`);
        console.log(`[Test] Failed calls: ${totalCount - successCount}\n`);

        console.log('[Test] Detailed results:');
        for (const [fieldName, result] of Object.entries(results)) {
            const status = result.success ? '✓' : '✗';
            const details = result.success
                ? `${result.optionCount} options loaded from table ${result.refTableId}`
                : result.error;
            console.log(`[Test] ${status} ${fieldName}: ${details}`);
        }

        console.log('\n[Test] ========================================');
        console.log('[Test] Test completed successfully!');
        console.log('[Test] ========================================');

        // Check if all expected reference fields are working
        const expectedRefFields = ['Заказчик', 'Статус', 'Родительский', 'Объект', 'Шаблон'];
        const missingCalls = expectedRefFields.filter(f => !results[f] || !results[f].success);

        if (missingCalls.length > 0) {
            console.log('\n[Test] ⚠ WARNING: The following fields are missing _ref_reqs calls:');
            missingCalls.forEach(f => console.log(`[Test]   - ${f}`));
            console.log('\n[Test] These fields should be loaded via _ref_reqs but are not!');
        } else {
            console.log('\n[Test] ✓ All expected dropdown fields are properly loaded via _ref_reqs!');
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
