/**
 * Test for issue #15: Merge task and operation parameters
 *
 * Issue requirement: Task and operation parameters should be merged.
 * When parameter codes match, operation parameters have higher priority.
 *
 * This test validates the getItemParameters function after the merge implementation.
 */

// Copy the relevant functions from project-scheduler.js

/**
 * Parse parameter string in format: ParamID:Value(MIN-MAX) or ParamID:%(-)
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

        const param = {
            paramId: paramId,
            valueStr: valueStr,
            value: null,
            min: null,
            max: null,
            required: false
        };

        params.push(param);
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
            nonOverriddenTaskParams.push(param.paramId + ':' + param.valueStr);
        }
    }

    // Collect all operation parameters
    const allOperationParams = operationParamsParsed.map(p => p.paramId + ':' + p.valueStr);

    // Merge: non-overridden task params first, then operation params
    const merged = [...nonOverriddenTaskParams, ...allOperationParams].join(',');
    return merged;
}

/**
 * Get parameters for an item (task or operation) - simplified version for testing
 */
function getItemParameters(item, templateLookup, isOperation) {
    const taskName = item['Задача проекта'];
    const operationName = item['Операция'];
    const currentTaskParams = item['Параметры задачи'];
    const currentOperationParams = item['Параметры операции'];

    if (isOperation) {
        // Get task parameters (template or current)
        let taskParams = '';
        if (taskName && templateLookup.taskParameters.has(taskName)) {
            taskParams = templateLookup.taskParameters.get(taskName);
        } else if (currentTaskParams && currentTaskParams.trim() !== '') {
            taskParams = currentTaskParams;
        }

        // Get operation parameters (template or current)
        let operationParams = '';
        if (operationName && templateLookup.operationParameters.has(operationName)) {
            operationParams = templateLookup.operationParameters.get(operationName);
        } else if (currentOperationParams && currentOperationParams.trim() !== '') {
            operationParams = currentOperationParams;
        }

        // Merge parameters (operation has priority on matching codes)
        const merged = mergeParameters(taskParams, operationParams);
        return merged;
    } else {
        // For tasks:
        // Priority 1: Template task parameters
        if (taskName && templateLookup.taskParameters.has(taskName)) {
            const templateParams = templateLookup.taskParameters.get(taskName);
            return templateParams;
        }

        // Priority 2: Current task parameters
        if (currentTaskParams && currentTaskParams.trim() !== '') {
            return currentTaskParams;
        }

        return '';
    }
}

// Test cases
console.log('=== Testing Issue #15: Parameter Merge Logic ===\n');

let testNumber = 0;
let passed = 0;
let failed = 0;

function test(description, item, templateLookup, isOperation, expected) {
    testNumber++;
    const result = getItemParameters(item, templateLookup, isOperation);
    const success = result === expected;

    if (success) {
        console.log(`Test ${testNumber}: ${description} - ✓ PASSED`);
        passed++;
    } else {
        console.log(`Test ${testNumber}: ${description} - ✗ FAILED`);
        console.log(`  Expected: "${expected}"`);
        console.log(`  Got:      "${result}"`);
        failed++;
    }
}

// Create template lookup
const templateLookup = {
    taskParameters: new Map([
        ['Задача A', '115:849(-),2673:(4-)'],
        ['Задача B', '728:engineer'],
        ['Задача C', '115:849(-)']
    ]),
    operationParameters: new Map([
        ['Операция X', '740:%(-)'],
        ['Операция Y', '115:850(-)'],
        ['Операция Z', '2673:(5-)']
    ])
};

// Test 1: Operation merges template task and template operation params (no overlap)
test(
    'Operation: template task + template operation params (no overlap)',
    {
        'Задача проекта': 'Задача A',
        'Операция': 'Операция X',
        'Параметры задачи': '',
        'Параметры операции': ''
    },
    templateLookup,
    true,
    '115:849(-),2673:(4-),740:%(-)'
);

// Test 2: Operation merges template task and template operation params (with overlap)
test(
    'Operation: template task + template operation params (with overlap)',
    {
        'Задача проекта': 'Задача C',
        'Операция': 'Операция Y',
        'Параметры задачи': '',
        'Параметры операции': ''
    },
    templateLookup,
    true,
    '115:850(-)'  // Operation param 115:850(-) overrides task param 115:849(-)
);

// Test 3: Operation merges current task and template operation params
test(
    'Operation: current task + template operation params',
    {
        'Задача проекта': 'Неизвестная задача',
        'Операция': 'Операция X',
        'Параметры задачи': '115:849(-),2673:(4-)',
        'Параметры операции': ''
    },
    templateLookup,
    true,
    '115:849(-),2673:(4-),740:%(-)'
);

// Test 4: Operation merges template task and current operation params
test(
    'Operation: template task + current operation params',
    {
        'Задача проекта': 'Задача A',
        'Операция': 'Неизвестная операция',
        'Параметры задачи': '',
        'Параметры операции': '740:%(-)' },
    templateLookup,
    true,
    '115:849(-),2673:(4-),740:%(-)'
);

// Test 5: Operation with only task params (no operation params)
test(
    'Operation: only task params (no operation params)',
    {
        'Задача проекта': 'Задача A',
        'Операция': 'Неизвестная операция',
        'Параметры задачи': '',
        'Параметры операции': ''
    },
    templateLookup,
    true,
    '115:849(-),2673:(4-)'
);

// Test 6: Operation with only operation params (no task params)
test(
    'Operation: only operation params (no task params)',
    {
        'Задача проекта': 'Неизвестная задача',
        'Операция': 'Операция X',
        'Параметры задачи': '',
        'Параметры операции': ''
    },
    templateLookup,
    true,
    '740:%(-)'
);

// Test 7: Operation with no params at all
test(
    'Operation: no params at all',
    {
        'Задача проекта': 'Неизвестная задача',
        'Операция': 'Неизвестная операция',
        'Параметры задачи': '',
        'Параметры операции': ''
    },
    templateLookup,
    true,
    ''
);

// Test 8: Operation merges current task and current operation params (with overlap)
test(
    'Operation: current task + current operation params (with overlap)',
    {
        'Задача проекта': 'Неизвестная задача',
        'Операция': 'Неизвестная операция',
        'Параметры задачи': '115:849(-),2673:(4-)',
        'Параметры операции': '115:850(-)'
    },
    templateLookup,
    true,
    '2673:(4-),115:850(-)'  // Operation param 115:850(-) overrides task param 115:849(-)
);

// Test 9: Complex merge with multiple overlaps
test(
    'Operation: complex merge with multiple overlaps',
    {
        'Задача проекта': 'Задача A',
        'Операция': 'Операция Z',
        'Параметры задачи': '',
        'Параметры операции': ''
    },
    templateLookup,
    true,
    '115:849(-),2673:(5-)'  // Operation param 2673:(5-) overrides task param 2673:(4-)
);

// Test 10: Task uses template parameters
test(
    'Task: uses template parameters',
    {
        'Задача проекта': 'Задача A',
        'Операция': '',
        'Параметры задачи': '',
        'Параметры операции': ''
    },
    templateLookup,
    false,
    '115:849(-),2673:(4-)'
);

// Test 11: Task uses current parameters (no template)
test(
    'Task: uses current parameters (no template)',
    {
        'Задача проекта': 'Неизвестная задача',
        'Операция': '',
        'Параметры задачи': '115:849(-)',
        'Параметры операции': ''
    },
    templateLookup,
    false,
    '115:849(-)'
);

// Test 12: Task with no parameters
test(
    'Task: no parameters',
    {
        'Задача проекта': 'Неизвестная задача',
        'Операция': '',
        'Параметры задачи': '',
        'Параметры операции': ''
    },
    templateLookup,
    false,
    ''
);

console.log(`\n=== Results ===`);
console.log(`Total: ${testNumber}, Passed: ${passed}, Failed: ${failed}`);
if (failed === 0) {
    console.log('✓ All tests passed!');
    process.exit(0);
} else {
    console.log('✗ Some tests failed!');
    process.exit(1);
}
