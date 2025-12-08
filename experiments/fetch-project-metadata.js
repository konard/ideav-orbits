/**
 * Experimental script to fetch Project table metadata
 * This helps us understand the structure before implementing the Add Project feature
 */

(async function() {
    'use strict';

    console.log('=== Fetching Project Table Metadata ===');

    const host = 'integram.io';
    const dbName = 'orbits';

    function buildApiUrl(path) {
        return `https://${host}/${dbName}${path}`;
    }

    async function fetchJson(url) {
        console.log(`Fetching: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    try {
        // Step 1: Get list of all tables
        console.log('\n--- Step 1: Getting list of tables ---');
        const dictUrl = buildApiUrl('/apix/dict?JSON=1');
        const tables = await fetchJson(dictUrl);
        console.log('Available tables:', tables);

        // Find Project table ID (looking for "Проект" in table names)
        let projectTableId = null;
        for (const [id, name] of Object.entries(tables)) {
            if (name === 'Проект') {
                projectTableId = id;
                console.log(`\nFound Project table: ID = ${id}, Name = ${name}`);
                break;
            }
        }

        if (!projectTableId) {
            // If exact match not found, search for partial match
            console.log('\nExact match not found, searching for partial matches...');
            for (const [id, name] of Object.entries(tables)) {
                if (name.includes('Проект') || name.includes('Project')) {
                    console.log(`  Possible match: ID = ${id}, Name = ${name}`);
                }
            }
            throw new Error('Project table not found');
        }

        // Step 2: Get Project table metadata
        console.log('\n--- Step 2: Getting Project table metadata ---');
        const metadataUrl = buildApiUrl(`/apix/metadata/${projectTableId}?JSON=1`);
        const metadata = await fetchJson(metadataUrl);
        console.log('\nProject table metadata:');
        console.log(JSON.stringify(metadata, null, 2));

        // Step 3: Parse and display field information
        console.log('\n--- Step 3: Field Information ---');
        if (metadata && metadata[0] && metadata[0].reqs) {
            console.log('\nFields in Project table:');
            metadata[0].reqs.forEach(field => {
                console.log(`\n  Field: ${field.val}`);
                console.log(`    ID: ${field.id}`);
                console.log(`    Type: ${field.type}`);
                if (field.ref) {
                    console.log(`    Reference table ID: ${field.ref}`);
                    console.log(`    Reference field ID: ${field.ref_id}`);
                }
                if (field.attrs) {
                    console.log(`    Attributes: ${field.attrs}`);
                }
            });

            // Step 4: Get reference field options for important fields
            console.log('\n--- Step 4: Getting reference field options ---');

            // Find Status field (Статус проекта)
            const statusField = metadata[0].reqs.find(f => f.val.includes('Статус'));
            if (statusField && statusField.ref) {
                console.log(`\nFetching options for "${statusField.val}" field...`);
                const refUrl = buildApiUrl(`/apix/_ref_reqs/${statusField.id}?JSON=1`);
                const statusOptions = await fetchJson(refUrl);
                console.log('Status options:', statusOptions);
            }

            // Find Parent Project field (Родительский проект)
            const parentField = metadata[0].reqs.find(f => f.val.includes('Родительский'));
            if (parentField && parentField.ref) {
                console.log(`\nFetching options for "${parentField.val}" field...`);
                const refUrl = buildApiUrl(`/apix/_ref_reqs/${parentField.id}?JSON=1`);
                const parentOptions = await fetchJson(refUrl);
                console.log('Parent project options:', parentOptions);
            }

            // Find Project Template field (Шаблон Проекта)
            const templateField = metadata[0].reqs.find(f => f.val.includes('Шаблон'));
            if (templateField && templateField.ref) {
                console.log(`\nFetching options for "${templateField.val}" field...`);
                const refUrl = buildApiUrl(`/apix/_ref_reqs/${templateField.id}?JSON=1`);
                const templateOptions = await fetchJson(refUrl);
                console.log('Template options:', templateOptions);
            }
        }

        console.log('\n=== Metadata fetch completed ===');

    } catch (error) {
        console.error('Error:', error);
    }

})();
