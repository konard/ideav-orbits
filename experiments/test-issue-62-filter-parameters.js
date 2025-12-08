/**
 * Test filter parameter building for issue #62
 *
 * Issue requirement: Support server-side filtering with special prefixes
 * - @ prefix: filter by ID instead of value
 * - ! prefix: negate the filter condition
 * - !@ combined: NOT equal to ID
 *
 * Example: F_698=!@957 means "field 698 is NOT equal to ID 957"
 */

/**
 * Build a filter parameter string for integram.io API
 * @param {string|number} fieldId - The field ID to filter on
 * @param {string|number} value - The value to filter by
 * @param {boolean} byId - If true, add @ prefix to filter by ID instead of value
 * @param {boolean} negate - If true, add ! prefix to negate the condition
 * @returns {string} - The filter parameter string (e.g., "F_698=!@957")
 */
function buildFilterParameter(fieldId, value, byId = false, negate = false) {
    let filterValue = '';

    // Add prefixes in correct order: ! comes before @
    if (negate) {
        filterValue += '!';
    }
    if (byId) {
        filterValue += '@';
    }

    // Add the value
    filterValue += value;

    return `F_${fieldId}=${filterValue}`;
}

/**
 * Build a URL with filter parameters
 * @param {string} baseUrl - Base URL (e.g., "/object/663/?JSON_DATA")
 * @param {Array<{fieldId, value, byId, negate}>} filters - Array of filter specifications
 * @returns {string} - Complete URL with filters
 */
function buildUrlWithFilters(baseUrl, filters) {
    if (!filters || filters.length === 0) {
        return baseUrl;
    }

    // Check if baseUrl already has query parameters
    const separator = baseUrl.includes('?') ? '&' : '?';

    // Build filter parameters
    const filterParams = filters.map(filter =>
        buildFilterParameter(filter.fieldId, filter.value, filter.byId, filter.negate)
    ).join('&');

    return `${baseUrl}${separator}${filterParams}`;
}

// Test cases
console.log('=== Testing Filter Parameter Building ===\n');

let passed = 0;
let failed = 0;

function test(description, result, expected) {
    if (result === expected) {
        console.log(`✓ PASS: ${description}`);
        console.log(`  Result: ${result}\n`);
        passed++;
    } else {
        console.log(`✗ FAIL: ${description}`);
        console.log(`  Expected: ${expected}`);
        console.log(`  Got:      ${result}\n`);
        failed++;
    }
}

// Test 1: Simple filter by value
test(
    'Simple filter by value',
    buildFilterParameter('698', '123'),
    'F_698=123'
);

// Test 2: Filter by ID (@ prefix)
test(
    'Filter by ID with @ prefix',
    buildFilterParameter('698', '957', true, false),
    'F_698=@957'
);

// Test 3: Negated filter (! prefix)
test(
    'Negated filter with ! prefix',
    buildFilterParameter('698', '123', false, true),
    'F_698=!123'
);

// Test 4: Negated filter by ID (!@ prefix)
test(
    'Negated filter by ID with !@ prefix',
    buildFilterParameter('698', '957', true, true),
    'F_698=!@957'
);

// Test 5: Build URL with single filter
test(
    'URL with single filter parameter',
    buildUrlWithFilters('/object/663/?JSON_DATA', [
        { fieldId: '698', value: '957', byId: true, negate: true }
    ]),
    '/object/663/?JSON_DATA&F_698=!@957'
);

// Test 6: Build URL with multiple filters
test(
    'URL with multiple filter parameters',
    buildUrlWithFilters('/object/663/?JSON_DATA', [
        { fieldId: '698', value: '957', byId: true, negate: true },
        { fieldId: '700', value: '810', byId: true, negate: false }
    ]),
    '/object/663/?JSON_DATA&F_698=!@957&F_700=@810'
);

// Test 7: Build URL without existing query params
test(
    'URL without existing query params',
    buildUrlWithFilters('/object/663', [
        { fieldId: '698', value: '957', byId: true, negate: true }
    ]),
    '/object/663?F_698=!@957'
);

// Test 8: Build URL with no filters
test(
    'URL with no filters',
    buildUrlWithFilters('/object/663/?JSON_DATA', []),
    '/object/663/?JSON_DATA'
);

// Test 9: Complex scenario from issue #62
test(
    'Issue #62 example: Projects where parent is NOT Типовой проект',
    buildUrlWithFilters('/object/663', [
        { fieldId: '698', value: '957', byId: true, negate: true }
    ]) + '&JSON_DATA',
    '/object/663?F_698=!@957&JSON_DATA'
);

console.log('=== Test Summary ===');
console.log(`Total: ${passed + failed}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
    console.log('\n✓ All tests passed!');
    process.exit(0);
} else {
    console.log('\n✗ Some tests failed!');
    process.exit(1);
}
