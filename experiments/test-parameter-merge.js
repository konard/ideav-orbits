/**
 * Test parameter merging logic for issue #15
 *
 * Issue requirement: When parameter codes match, operation parameters have higher priority
 *
 * This means we need to:
 * 1. Parse task parameters into individual params
 * 2. Parse operation parameters into individual params
 * 3. Merge them, with operation params overriding task params when codes match
 * 4. Reconstruct the parameter string
 */

/**
 * Parse parameter string into array of parameter objects
 * Format: ParamID:Value(MIN-MAX) or ParamID:%(-)
 */
function parseParameterString(paramStr) {
    const params = [];
    if (!paramStr || paramStr.trim() === '') {
        return params;
    }

    const parts = paramStr.split(',');
    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1) continue;

        const paramId = trimmed.substring(0, colonIndex);
        const valueStr = trimmed.substring(colonIndex + 1);

        params.push({
            paramId: paramId,
            valueStr: valueStr,
            originalStr: trimmed
        });
    }

    return params;
}

/**
 * Merge task and operation parameters
 * Operation parameters have priority when codes match
 * Order: non-overridden task params first, then all operation params
 */
function mergeParameters(taskParams, operationParams) {
    if (!taskParams && !operationParams) {
        return '';
    }
    if (!taskParams) return operationParams;
    if (!operationParams) return taskParams;

    const taskParamsParsed = parseParameterString(taskParams);
    const operationParamsParsed = parseParameterString(operationParams);

    // Create a set of operation parameter IDs
    const operationParamIds = new Set(operationParamsParsed.map(p => p.paramId));

    // Collect non-overridden task parameters
    const nonOverriddenTaskParams = [];
    for (const param of taskParamsParsed) {
        if (!operationParamIds.has(param.paramId)) {
            nonOverriddenTaskParams.push(param.originalStr);
        }
    }

    // Collect all operation parameters
    const allOperationParams = operationParamsParsed.map(p => p.originalStr);

    // Merge: non-overridden task params first, then operation params
    const merged = [...nonOverriddenTaskParams, ...allOperationParams].join(',');
    return merged;
}

// Test cases
console.log('=== Testing Parameter Merge Logic ===\n');

let testNumber = 0;
let passed = 0;
let failed = 0;

function test(description, taskParams, operationParams, expected) {
    testNumber++;
    const result = mergeParameters(taskParams, operationParams);
    const success = result === expected;

    if (success) {
        console.log(`Test ${testNumber}: ${description} - ✓ PASSED`);
        passed++;
    } else {
        console.log(`Test ${testNumber}: ${description} - ✗ FAILED`);
        console.log(`  Task params:      "${taskParams}"`);
        console.log(`  Operation params: "${operationParams}"`);
        console.log(`  Expected:         "${expected}"`);
        console.log(`  Got:              "${result}"`);
        failed++;
    }
}

// Test 1: No overlap in parameter codes
test(
    'No overlap in parameter codes',
    '115:849(-),2673:(4-)',
    '740:%(-)',
    '115:849(-),2673:(4-),740:%(-)'
);

// Test 2: Operation overrides task parameter
test(
    'Operation overrides task parameter (same code)',
    '115:849(-),2673:(4-)',
    '115:850(-)',
    '2673:(4-),115:850(-)'
);

// Test 3: Multiple operation overrides
test(
    'Multiple operation overrides',
    '115:849(-),2673:(4-),740:%(-)',
    '115:850(-),2673:(5-)',
    '740:%(-),115:850(-),2673:(5-)'
);

// Test 4: Only task parameters
test(
    'Only task parameters',
    '115:849(-),2673:(4-)',
    '',
    '115:849(-),2673:(4-)'
);

// Test 5: Only operation parameters
test(
    'Only operation parameters',
    '',
    '740:%(-)',
    '740:%(-)'
);

// Test 6: Both empty
test(
    'Both empty',
    '',
    '',
    ''
);

// Test 7: Task empty, operation has params
test(
    'Task empty, operation has params',
    '',
    '115:849(-)',
    '115:849(-)'
);

// Test 8: Task has params, operation empty
test(
    'Task has params, operation empty',
    '115:849(-)',
    '',
    '115:849(-)'
);

// Test 9: Complex merge with partial overlap
test(
    'Complex merge with partial overlap',
    '115:849(-),2673:(4-),728:engineer',
    '115:850(-),740:%(-)',
    '2673:(4-),728:engineer,115:850(-),740:%(-)'
);

console.log(`\nTotal: ${testNumber}, Passed: ${passed}, Failed: ${failed}`);
if (failed === 0) {
    console.log('✓ All tests passed!');
    process.exit(0);
} else {
    console.log('✗ Some tests failed!');
    process.exit(1);
}
