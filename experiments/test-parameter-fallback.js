/**
 * Test script to verify parameter fallback logic with template lookup
 * Tests that parameters are taken from template first, then fallback to current item
 */

// Mock template lookup
const mockTemplateLookup = {
    taskParameters: new Map([
        ['Test Task 1', '115:849(-),2673:(4-)'],
        ['Test Task 2', '2673:(4-)'],
        ['Test Task 3', '740:%(-)'],
        ['Test Task 5', '1015:%(-),2673:(3-)']
    ]),
    operationParameters: new Map([
        ['Test Operation 1', '115:849(-)'],
        ['Test Operation 3', '740:%(-)'],
        ['Test Operation 7', '2673:(3-)']
    ])
};

// Test data: simulating different scenarios
const testCases = [
    {
        name: "Operation with template operation parameters",
        item: {
            'ОперацияID': '123',
            'Операция': 'Test Operation 1',
            'Задача проекта': 'Test Task 1',
            'Параметры операции': '',
            'Параметры задачи': ''
        },
        expected: '115:849(-)',
        description: "Should use template operation parameters"
    },
    {
        name: "Operation with no template operation params, fallback to template task params",
        item: {
            'ОперацияID': '124',
            'Операция': 'Test Operation 2',
            'Задача проекта': 'Test Task 2',
            'Параметры операции': '',
            'Параметры задачи': ''
        },
        expected: '2673:(4-)',
        description: "Should fall back to template task parameters"
    },
    {
        name: "Operation with template operation params overriding template task params",
        item: {
            'ОперацияID': '125',
            'Операция': 'Test Operation 3',
            'Задача проекта': 'Test Task 3',
            'Параметры операции': '',
            'Параметры задачи': ''
        },
        expected: '740:%(-)',
        description: "Should use template operation parameters (not task)"
    },
    {
        name: "Operation with no template, fallback to current operation params",
        item: {
            'ОперацияID': '126',
            'Операция': 'Test Operation 4',
            'Задача проекта': 'Test Task 4',
            'Параметры операции': '115:849(-),2673:(1-2)',
            'Параметры задачи': '2673:(4-)'
        },
        expected: '115:849(-),2673:(1-2)',
        description: "Should use current operation parameters (no template)"
    },
    {
        name: "Operation with no template, fallback to current task params",
        item: {
            'ОперацияID': '127',
            'Операция': 'Test Operation 5',
            'Задача проекта': 'Test Task 4',
            'Параметры операции': '',
            'Параметры задачи': '2673:(4-)'
        },
        expected: '2673:(4-)',
        description: "Should fall back to current task parameters"
    },
    {
        name: "Task with template parameters",
        item: {
            'Задача проектаID': '128',
            'Задача проекта': 'Test Task 5',
            'Параметры задачи': ''
        },
        expected: '1015:%(-),2673:(3-)',
        description: "Task should use template task parameters"
    },
    {
        name: "Task with no template, use current params",
        item: {
            'Задача проектаID': '129',
            'Задача проекта': 'Test Task 6',
            'Параметры задачи': '2673:(4-)'
        },
        expected: '2673:(4-)',
        description: "Task should use current parameters (no template)"
    },
    {
        name: "All parameters empty",
        item: {
            'ОперацияID': '130',
            'Операция': 'Test Operation 6',
            'Задача проекта': 'Test Task 6',
            'Параметры операции': '',
            'Параметры задачи': ''
        },
        expected: '',
        description: "All empty - should return empty string"
    }
];

// Implementation of the parameter lookup logic (extracted from project-scheduler.js)
function getItemParameters(item, templateLookup, isOperation) {
    const taskName = item['Задача проекта'];
    const operationName = item['Операция'];
    const currentTaskParams = item['Параметры задачи'];
    const currentOperationParams = item['Параметры операции'];

    if (isOperation) {
        // Priority 1: Template operation parameters
        if (operationName && templateLookup.operationParameters.has(operationName)) {
            const templateParams = templateLookup.operationParameters.get(operationName);
            console.log(`  ✓ Using template operation parameters: "${templateParams}" for "${operationName}"`);
            return templateParams;
        }

        // Priority 2: Template task parameters (fallback for operation)
        if (taskName && templateLookup.taskParameters.has(taskName)) {
            const templateParams = templateLookup.taskParameters.get(taskName);
            console.log(`  ✓ Template operation parameters not found, using template task parameters: "${templateParams}" for task "${taskName}"`);
            return templateParams;
        }

        // Priority 3: Current operation parameters
        if (currentOperationParams && currentOperationParams.trim() !== '') {
            console.log(`  ✓ No template parameters found, using current operation parameters: "${currentOperationParams}"`);
            return currentOperationParams;
        }

        // Priority 4: Current task parameters (fallback)
        if (currentTaskParams && currentTaskParams.trim() !== '') {
            console.log(`  ✓ Operation parameters empty, falling back to current task parameters: "${currentTaskParams}"`);
            return currentTaskParams;
        }

        console.log(`  ✓ No parameters found (all sources empty)`);
        return '';
    } else {
        // For tasks:
        // Priority 1: Template task parameters
        if (taskName && templateLookup.taskParameters.has(taskName)) {
            const templateParams = templateLookup.taskParameters.get(taskName);
            console.log(`  ✓ Using template task parameters: "${templateParams}" for "${taskName}"`);
            return templateParams;
        }

        // Priority 2: Current task parameters
        if (currentTaskParams && currentTaskParams.trim() !== '') {
            console.log(`  ✓ No template parameters found, using current task parameters: "${currentTaskParams}"`);
            return currentTaskParams;
        }

        console.log(`  ✓ Task parameters are empty`);
        return '';
    }
}

// Run tests
console.log('=== Testing Parameter Fallback Logic with Template Lookup ===\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log(`  Description: ${testCase.description}`);

    const isOperation = testCase.item['ОперацияID'] && testCase.item['ОперацияID'] !== '';
    const result = getItemParameters(testCase.item, mockTemplateLookup, isOperation);
    const success = result === testCase.expected;

    if (success) {
        console.log(`  ✓ PASSED - Got expected result: "${result}"`);
        passed++;
    } else {
        console.log(`  ✗ FAILED - Expected: "${testCase.expected}", Got: "${result}"`);
        failed++;
    }
    console.log('');
});

console.log('=== Test Results ===');
console.log(`Total: ${testCases.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
    console.log('\n✓ All tests passed!');
    process.exit(0);
} else {
    console.log(`\n✗ ${failed} test(s) failed!`);
    process.exit(1);
}
