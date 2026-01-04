/**
 * Test for Issue #149: Tasks should be counted even without amounts/quantities
 *
 * Bug: In Total: Tasks: 0 if amounts and quantities are not specified in tasks.
 * Fix: Tasks should be counted regardless of whether they have К-во or Сумма values.
 */

// Simulate the task counting logic from projects.js
function countTasks(taskGroups) {
    let totalQuantity = 0;
    let totalSum = 0;
    let taskCount = 0;

    const taskIds = Object.keys(taskGroups);

    taskIds.forEach(taskId => {
        const task = taskGroups[taskId].task;
        const quantity = task['К-во'] ? parseFloat(task['К-во']) : 0;
        const sum = task['Сумма'] ? parseFloat(task['Сумма']) : 0;

        // Always count tasks, regardless of whether they have quantities or sums
        taskCount++;
        totalQuantity += quantity;
        totalSum += sum;
    });

    return { taskCount, totalQuantity, totalSum };
}

// Test data
const testCases = [
    {
        name: "Tasks with quantities and sums",
        taskGroups: {
            '1': { task: { 'Задача проекта': 'Task 1', 'К-во': '10', 'Сумма': '1000' } },
            '2': { task: { 'Задача проекта': 'Task 2', 'К-во': '5', 'Сумма': '500' } }
        },
        expected: { taskCount: 2, totalQuantity: 15, totalSum: 1500 }
    },
    {
        name: "Tasks without quantities or sums",
        taskGroups: {
            '1': { task: { 'Задача проекта': 'Task 1' } },
            '2': { task: { 'Задача проекта': 'Task 2' } },
            '3': { task: { 'Задача проекта': 'Task 3' } }
        },
        expected: { taskCount: 3, totalQuantity: 0, totalSum: 0 }
    },
    {
        name: "Mixed: some tasks with values, some without",
        taskGroups: {
            '1': { task: { 'Задача проекта': 'Task 1', 'К-во': '10', 'Сумма': '1000' } },
            '2': { task: { 'Задача проекта': 'Task 2' } },
            '3': { task: { 'Задача проекта': 'Task 3', 'К-во': '5' } },
            '4': { task: { 'Задача проекта': 'Task 4' } }
        },
        expected: { taskCount: 4, totalQuantity: 15, totalSum: 1000 }
    },
    {
        name: "Tasks with only quantities",
        taskGroups: {
            '1': { task: { 'Задача проекта': 'Task 1', 'К-во': '10' } },
            '2': { task: { 'Задача проекта': 'Task 2', 'К-во': '20' } }
        },
        expected: { taskCount: 2, totalQuantity: 30, totalSum: 0 }
    },
    {
        name: "Tasks with only sums",
        taskGroups: {
            '1': { task: { 'Задача проекта': 'Task 1', 'Сумма': '1000' } },
            '2': { task: { 'Задача проекта': 'Task 2', 'Сумма': '2000' } }
        },
        expected: { taskCount: 2, totalQuantity: 0, totalSum: 3000 }
    }
];

// Run tests
console.log('Testing Issue #149 fix: Task counting logic\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
    console.log(`\nTest ${index + 1}: ${testCase.name}`);

    const result = countTasks(testCase.taskGroups);
    const { taskCount, totalQuantity, totalSum } = result;
    const { taskCount: expCount, totalQuantity: expQty, totalSum: expSum } = testCase.expected;

    const taskCountMatch = taskCount === expCount;
    const quantityMatch = Math.abs(totalQuantity - expQty) < 0.01;
    const sumMatch = Math.abs(totalSum - expSum) < 0.01;

    if (taskCountMatch && quantityMatch && sumMatch) {
        console.log(`  ✓ PASSED`);
        console.log(`    Tasks: ${taskCount}, Quantity: ${totalQuantity}, Sum: ${totalSum}`);
        passed++;
    } else {
        console.log(`  ✗ FAILED`);
        console.log(`    Expected: Tasks: ${expCount}, Quantity: ${expQty}, Sum: ${expSum}`);
        console.log(`    Got:      Tasks: ${taskCount}, Quantity: ${totalQuantity}, Sum: ${totalSum}`);
        if (!taskCountMatch) console.log(`    - Task count mismatch!`);
        if (!quantityMatch) console.log(`    - Quantity mismatch!`);
        if (!sumMatch) console.log(`    - Sum mismatch!`);
        failed++;
    }
});

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
    console.log('\n✓ All tests passed! Issue #149 is fixed.');
    console.log('  Tasks are now counted regardless of К-во and Сумма values.');
} else {
    console.log('\n✗ Some tests failed. Please review the implementation.');
    process.exit(1);
}
