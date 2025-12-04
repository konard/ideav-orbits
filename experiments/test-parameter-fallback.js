/**
 * Test script to verify parameter fallback logic
 * Tests that operations without parameters fall back to task parameters
 */

// Test data: simulating different scenarios
const testCases = [
    {
        name: "Operation with its own parameters",
        item: {
            'ОперацияID': '123',
            'Операция': 'Test Operation 1',
            'Задача проекта': 'Test Task 1',
            'Параметры операции': '115:849(-)',
            'Параметры задачи': '2673:(4-)'
        },
        expected: '115:849(-)',
        description: "Should use operation parameters"
    },
    {
        name: "Operation with empty parameters (should fallback)",
        item: {
            'ОперацияID': '124',
            'Операция': 'Test Operation 2',
            'Задача проекта': 'Test Task 2',
            'Параметры операции': '',
            'Параметры задачи': '2673:(4-)'
        },
        expected: '2673:(4-)',
        description: "Should fall back to task parameters"
    },
    {
        name: "Operation with whitespace parameters (should fallback)",
        item: {
            'ОперацияID': '125',
            'Операция': 'Test Operation 3',
            'Задача проекта': 'Test Task 3',
            'Параметры операции': '   ',
            'Параметры задачи': '740:%(-)'
        },
        expected: '740:%(-)',
        description: "Should fall back to task parameters (whitespace)"
    },
    {
        name: "Operation with null parameters (should fallback)",
        item: {
            'ОперацияID': '126',
            'Операция': 'Test Operation 4',
            'Задача проекта': 'Test Task 4',
            'Параметры операции': null,
            'Параметры задачи': '115:849(-),2673:(1-2)'
        },
        expected: '115:849(-),2673:(1-2)',
        description: "Should fall back to task parameters (null)"
    },
    {
        name: "Task with parameters",
        item: {
            'Задача проектаID': '127',
            'Задача проекта': 'Test Task 5',
            'Параметры задачи': '2673:(4-)'
        },
        expected: '2673:(4-)',
        description: "Task should use its own parameters"
    },
    {
        name: "Both operation and task parameters empty",
        item: {
            'ОперацияID': '128',
            'Операция': 'Test Operation 6',
            'Задача проекта': 'Test Task 6',
            'Параметры операции': '',
            'Параметры задачи': ''
        },
        expected: '',
        description: "Both empty - should use empty string"
    }
];

// Implementation of the parameter fallback logic (extracted from project-scheduler.js)
function getItemParameters(item) {
    const isOperation = item['ОперацияID'] && item['ОперацияID'] !== '';

    let itemParameters;
    if (isOperation) {
        const operationParams = item['Параметры операции'];
        const taskParams = item['Параметры задачи'];
        if (operationParams && operationParams.trim() !== '') {
            itemParameters = operationParams;
            console.log(`  ✓ Using operation parameters: "${operationParams}"`);
        } else {
            itemParameters = taskParams;
            if (taskParams && taskParams.trim() !== '') {
                console.log(`  ✓ Operation parameters empty, falling back to task parameters: "${taskParams}"`);
            } else {
                console.log(`  ✓ Both operation and task parameters are empty`);
            }
        }
    } else {
        itemParameters = item['Параметры задачи'];
        if (itemParameters && itemParameters.trim() !== '') {
            console.log(`  ✓ Using task parameters: "${itemParameters}"`);
        } else {
            console.log(`  ✓ Task parameters are empty`);
        }
    }

    return itemParameters;
}

// Run tests
console.log('=== Testing Parameter Fallback Logic ===\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log(`  Description: ${testCase.description}`);

    const result = getItemParameters(testCase.item);
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
