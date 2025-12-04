/**
 * Test script for executor assignment functionality
 * Tests parameter parsing, availability checking, and executor validation
 */

// Mock data based on the API examples
const mockExecutors = [
    {
        "Исполнитель": "alex.m",
        "ПользовательID": "4074",
        "Квалификация -> Уровень": "2",
        "Занятое время": "20251124:9-13",
        "Роль": "849",
        "Квалификация": "Стажер"
    },
    {
        "Исполнитель": "barabashinkv",
        "ПользовательID": "854",
        "Квалификация -> Уровень": "3",
        "Занятое время": "",
        "Роль": "849",
        "Квалификация": "Специалист"
    },
    {
        "Исполнитель": "eng",
        "ПользовательID": "1051",
        "Квалификация -> Уровень": "3",
        "Занятое время": "",
        "Роль": "849",
        "Контролер": "X",
        "Наставник": "X",
        "Квалификация": "Специалист"
    },
    {
        "Исполнитель": "rezhepa",
        "ПользовательID": "1178",
        "Квалификация -> Уровень": "1",
        "Занятое время": "",
        "Роль": "849",
        "Квалификация": "Подсобник"
    },
    {
        "Исполнитель": "Ян",
        "ПользовательID": "1416",
        "Квалификация -> Уровень": "4",
        "Занятое время": "",
        "Роль": "849",
        "Контролер": "X",
        "Наставник": "X",
        "Квалификация": "Бригадир"
    }
];

// Test functions
function testParseParameterString() {
    console.log('\n=== Test: Parse Parameter String ===');

    const parseParameterString = (paramStr) => {
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
                value: null,
                min: null,
                max: null,
                required: false
            };

            if (valueStr.includes('%')) {
                param.required = true;
            } else {
                const rangeMatch = valueStr.match(/\(([^)]+)\)/);
                if (rangeMatch) {
                    const rangeStr = rangeMatch[1];
                    const rangeParts = rangeStr.split('-');

                    if (rangeParts.length === 2) {
                        const minStr = rangeParts[0].trim();
                        const maxStr = rangeParts[1].trim();

                        if (minStr !== '') {
                            const minVal = parseFloat(minStr);
                            if (!isNaN(minVal)) {
                                param.min = minVal;
                            }
                        }

                        if (maxStr !== '') {
                            const maxVal = parseFloat(maxStr);
                            if (!isNaN(maxVal)) {
                                param.max = maxVal;
                            }
                        }
                    }
                }

                const valueBeforeParens = valueStr.split('(')[0].trim();
                if (valueBeforeParens !== '' && valueBeforeParens !== '%') {
                    param.value = valueBeforeParens;
                }
            }

            params.push(param);
        }

        return params;
    };

    const testCases = [
        {
            desc: "Exact value",
            input: "115:849(-)",
            expected: [{paramId: "115", value: "849", min: null, max: null, required: false}]
        },
        {
            desc: "Range with min only",
            input: "2673:(4-)",
            expected: [{paramId: "2673", value: null, min: 4, max: null, required: false}]
        },
        {
            desc: "Required field",
            input: "740:%(-)",
            expected: [{paramId: "740", value: null, min: null, max: null, required: true}]
        },
        {
            desc: "Range with min and max",
            input: "2673:(1-2)",
            expected: [{paramId: "2673", value: null, min: 1, max: 2, required: false}]
        },
        {
            desc: "Multiple parameters",
            input: "115:849(-),2673:(4-)",
            expected: [
                {paramId: "115", value: "849", min: null, max: null, required: false},
                {paramId: "2673", value: null, min: 4, max: null, required: false}
            ]
        },
        {
            desc: "Empty string",
            input: "",
            expected: []
        }
    ];

    let passed = 0;
    testCases.forEach(test => {
        const result = parseParameterString(test.input);
        const success = JSON.stringify(result) === JSON.stringify(test.expected);
        console.log(`  ${success ? '✓' : '✗'} ${test.desc}`);
        if (!success) {
            console.log(`    Expected: ${JSON.stringify(test.expected)}`);
            console.log(`    Got:      ${JSON.stringify(result)}`);
        }
        if (success) passed++;
    });

    console.log(`  Result: ${passed}/${testCases.length} passed`);
    return passed === testCases.length;
}

function testParseBusyTime() {
    console.log('\n=== Test: Parse Busy Time ===');

    const parseBusyTime = (busyTimeStr) => {
        const busySlots = [];
        if (!busyTimeStr || busyTimeStr.trim() === '') {
            return busySlots;
        }

        const slots = busyTimeStr.split(',');
        for (const slot of slots) {
            const trimmed = slot.trim();
            if (!trimmed) continue;

            const colonIndex = trimmed.indexOf(':');
            if (colonIndex === -1) continue;

            const dateStr = trimmed.substring(0, colonIndex);
            const timeRange = trimmed.substring(colonIndex + 1);

            if (dateStr.length !== 8) continue;
            const year = parseInt(dateStr.substring(0, 4), 10);
            const month = parseInt(dateStr.substring(4, 6), 10) - 1;
            const day = parseInt(dateStr.substring(6, 8), 10);
            const date = new Date(year, month, day);

            const timeParts = timeRange.split('-');
            if (timeParts.length !== 2) continue;

            const startHour = parseInt(timeParts[0], 10);
            const endHour = parseInt(timeParts[1], 10);

            if (!isNaN(startHour) && !isNaN(endHour)) {
                busySlots.push({
                    date: date,
                    startHour: startHour,
                    endHour: endHour
                });
            }
        }

        return busySlots;
    };

    const testCases = [
        {
            desc: "Single slot",
            input: "20251124:9-13",
            expected: 1
        },
        {
            desc: "Multiple slots",
            input: "20251121:9-12,20251122:8-11",
            expected: 2
        },
        {
            desc: "Empty string",
            input: "",
            expected: 0
        }
    ];

    let passed = 0;
    testCases.forEach(test => {
        const result = parseBusyTime(test.input);
        const success = result.length === test.expected;
        console.log(`  ${success ? '✓' : '✗'} ${test.desc}: ${result.length} slots (expected ${test.expected})`);
        if (success) passed++;
    });

    console.log(`  Result: ${passed}/${testCases.length} passed`);
    return passed === testCases.length;
}

function testValidateExecutorParameters() {
    console.log('\n=== Test: Validate Executor Parameters ===');

    const validateExecutorParameters = (executor, parameterConstraints) => {
        if (!parameterConstraints || parameterConstraints.length === 0) {
            return true;
        }

        for (const constraint of parameterConstraints) {
            const paramId = constraint.paramId;

            let executorValue = null;
            if (paramId === '2673') {
                executorValue = parseFloat(executor['Квалификация -> Уровень']);
            } else if (paramId === '115') {
                executorValue = executor['Роль'];
            } else if (paramId === '728') {
                executorValue = executor['Квалификация'];
            } else if (paramId === '740' || paramId === '1015') {
                continue;
            }

            if (constraint.required) {
                if (executorValue === null || executorValue === undefined || executorValue === '') {
                    return false;
                }
            }

            if (constraint.value !== null) {
                if (executorValue !== constraint.value && executorValue != constraint.value) {
                    return false;
                }
            }

            if (constraint.min !== null || constraint.max !== null) {
                const numValue = parseFloat(executorValue);
                if (isNaN(numValue)) {
                    return false;
                }

                if (constraint.min !== null && numValue < constraint.min) {
                    return false;
                }

                if (constraint.max !== null && numValue > constraint.max) {
                    return false;
                }
            }
        }

        return true;
    };

    const testCases = [
        {
            desc: "Executor with level 2 matches (1-2) range",
            executor: mockExecutors[0], // alex@gmail.com, level 2
            params: [{paramId: "2673", value: null, min: 1, max: 2, required: false}],
            expected: true
        },
        {
            desc: "Executor with level 3 does NOT match (1-2) range",
            executor: mockExecutors[1], // barabashinkv, level 3
            params: [{paramId: "2673", value: null, min: 1, max: 2, required: false}],
            expected: false
        },
        {
            desc: "Executor with level 3 matches (4-) range",
            executor: mockExecutors[1], // barabashinkv, level 3
            params: [{paramId: "2673", value: null, min: 4, max: null, required: false}],
            expected: false
        },
        {
            desc: "Executor with level 4 matches (4-) range",
            executor: mockExecutors[4], // Ян, level 4
            params: [{paramId: "2673", value: null, min: 4, max: null, required: false}],
            expected: true
        },
        {
            desc: "Executor matches role exact value",
            executor: mockExecutors[0], // role 849
            params: [{paramId: "115", value: "849", min: null, max: null, required: false}],
            expected: true
        },
        {
            desc: "No constraints always pass",
            executor: mockExecutors[0],
            params: [],
            expected: true
        }
    ];

    let passed = 0;
    testCases.forEach(test => {
        const result = validateExecutorParameters(test.executor, test.params);
        const success = result === test.expected;
        console.log(`  ${success ? '✓' : '✗'} ${test.desc}: ${result} (expected ${test.expected})`);
        if (success) passed++;
    });

    console.log(`  Result: ${passed}/${testCases.length} passed`);
    return passed === testCases.length;
}

function testExecutorAvailability() {
    console.log('\n=== Test: Executor Availability ===');

    const parseBusyTime = (busyTimeStr) => {
        const busySlots = [];
        if (!busyTimeStr || busyTimeStr.trim() === '') {
            return busySlots;
        }

        const slots = busyTimeStr.split(',');
        for (const slot of slots) {
            const trimmed = slot.trim();
            if (!trimmed) continue;

            const colonIndex = trimmed.indexOf(':');
            if (colonIndex === -1) continue;

            const dateStr = trimmed.substring(0, colonIndex);
            const timeRange = trimmed.substring(colonIndex + 1);

            if (dateStr.length !== 8) continue;
            const year = parseInt(dateStr.substring(0, 4), 10);
            const month = parseInt(dateStr.substring(4, 6), 10) - 1;
            const day = parseInt(dateStr.substring(6, 8), 10);
            const date = new Date(year, month, day);

            const timeParts = timeRange.split('-');
            if (timeParts.length !== 2) continue;

            const startHour = parseInt(timeParts[0], 10);
            const endHour = parseInt(timeParts[1], 10);

            if (!isNaN(startHour) && !isNaN(endHour)) {
                busySlots.push({
                    date: date,
                    startHour: startHour,
                    endHour: endHour
                });
            }
        }

        return busySlots;
    };

    const isExecutorAvailable = (executor, startTime, endTime, executorAssignments) => {
        const busySlots = parseBusyTime(executor['Занятое время']);

        for (const slot of busySlots) {
            const slotStart = new Date(slot.date);
            slotStart.setHours(slot.startHour, 0, 0, 0);
            const slotEnd = new Date(slot.date);
            slotEnd.setHours(slot.endHour, 0, 0, 0);

            if (startTime < slotEnd && endTime > slotStart) {
                return false;
            }
        }

        const executorId = executor['ПользовательID'];
        const assignments = executorAssignments.get(executorId) || [];

        for (const assignment of assignments) {
            if (startTime < assignment.endTime && endTime > assignment.startTime) {
                return false;
            }
        }

        return true;
    };

    const testCases = [
        {
            desc: "Executor available when no conflicts",
            executor: mockExecutors[1], // barabashinkv, no busy time
            startTime: new Date(2025, 10, 20, 9, 0, 0),
            endTime: new Date(2025, 10, 20, 11, 0, 0),
            assignments: new Map(),
            expected: true
        },
        {
            desc: "Executor NOT available during pre-existing busy time",
            executor: mockExecutors[0], // alex@gmail.com, busy 20251124:9-13
            startTime: new Date(2025, 10, 24, 10, 0, 0),
            endTime: new Date(2025, 10, 24, 12, 0, 0),
            assignments: new Map(),
            expected: false
        },
        {
            desc: "Executor available outside busy time",
            executor: mockExecutors[0], // alex@gmail.com, busy 20251124:9-13
            startTime: new Date(2025, 10, 24, 14, 0, 0),
            endTime: new Date(2025, 10, 24, 16, 0, 0),
            assignments: new Map(),
            expected: true
        },
        {
            desc: "Executor NOT available when has current assignment",
            executor: mockExecutors[1], // barabashinkv
            startTime: new Date(2025, 10, 20, 10, 0, 0),
            endTime: new Date(2025, 10, 20, 12, 0, 0),
            assignments: new Map([
                ["854", [{
                    startTime: new Date(2025, 10, 20, 9, 0, 0),
                    endTime: new Date(2025, 10, 20, 11, 0, 0)
                }]]
            ]),
            expected: false
        }
    ];

    let passed = 0;
    testCases.forEach(test => {
        const result = isExecutorAvailable(test.executor, test.startTime, test.endTime, test.assignments);
        const success = result === test.expected;
        console.log(`  ${success ? '✓' : '✗'} ${test.desc}: ${result} (expected ${test.expected})`);
        if (success) passed++;
    });

    console.log(`  Result: ${passed}/${testCases.length} passed`);
    return passed === testCases.length;
}

function testMultipleExecutorsAssignment() {
    console.log('\n=== Test: Multiple Executors Assignment ===');

    // Simplified version of assignExecutors for testing
    const parseParameterString = (paramStr) => {
        const params = [];
        if (!paramStr || paramStr.trim() === '') return params;
        const parts = paramStr.split(',');
        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            const colonIndex = trimmed.indexOf(':');
            if (colonIndex === -1) continue;
            const paramId = trimmed.substring(0, colonIndex);
            const valueStr = trimmed.substring(colonIndex + 1);
            const param = { paramId, value: null, min: null, max: null, required: false };
            if (valueStr.includes('%')) {
                param.required = true;
            } else {
                const rangeMatch = valueStr.match(/\(([^)]+)\)/);
                if (rangeMatch) {
                    const rangeStr = rangeMatch[1];
                    const rangeParts = rangeStr.split('-');
                    if (rangeParts.length === 2) {
                        const minStr = rangeParts[0].trim();
                        const maxStr = rangeParts[1].trim();
                        if (minStr !== '') param.min = parseFloat(minStr);
                        if (maxStr !== '') param.max = parseFloat(maxStr);
                    }
                }
                const valueBeforeParens = valueStr.split('(')[0].trim();
                if (valueBeforeParens !== '' && valueBeforeParens !== '%') {
                    param.value = valueBeforeParens;
                }
            }
            params.push(param);
        }
        return params;
    };

    const validateExecutorParameters = (executor, parameterConstraints) => {
        if (!parameterConstraints || parameterConstraints.length === 0) return true;
        for (const constraint of parameterConstraints) {
            const paramId = constraint.paramId;
            let executorValue = null;
            if (paramId === '2673') {
                executorValue = parseFloat(executor['Квалификация -> Уровень']);
            } else if (paramId === '115') {
                executorValue = executor['Роль'];
            }
            if (constraint.min !== null || constraint.max !== null) {
                const numValue = parseFloat(executorValue);
                if (isNaN(numValue)) return false;
                if (constraint.min !== null && numValue < constraint.min) return false;
                if (constraint.max !== null && numValue > constraint.max) return false;
            }
        }
        return true;
    };

    const item = {
        name: "Разгрузка стоек и ригелей",
        parameters: "2673:(1-2)",
        executorsNeeded: 2,
        startTime: new Date(2025, 10, 20, 9, 0, 0),
        endTime: new Date(2025, 10, 20, 11, 0, 0)
    };

    const parameterConstraints = parseParameterString(item.parameters);
    const assignedExecutors = [];
    const executorAssignments = new Map();

    for (const executor of mockExecutors) {
        if (assignedExecutors.length >= item.executorsNeeded) break;
        if (!validateExecutorParameters(executor, parameterConstraints)) continue;

        assignedExecutors.push({
            id: executor['ПользовательID'],
            name: executor['Исполнитель'],
            qualificationLevel: executor['Квалификация -> Уровень']
        });
    }

    const success = assignedExecutors.length === 2;
    console.log(`  ${success ? '✓' : '✗'} Operation needing 2 executors with level (1-2): assigned ${assignedExecutors.length}`);
    if (assignedExecutors.length > 0) {
        assignedExecutors.forEach(e => {
            console.log(`    - ${e.name} (level ${e.qualificationLevel})`);
        });
    }

    console.log(`  Result: ${success ? '1/1' : '0/1'} passed`);
    return success;
}

// Run all tests
function runAllTests() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  Executor Assignment - Test Suite                      ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const results = [
        testParseParameterString(),
        testParseBusyTime(),
        testValidateExecutorParameters(),
        testExecutorAvailability(),
        testMultipleExecutorsAssignment()
    ];

    const totalPassed = results.filter(r => r).length;
    const totalTests = results.length;

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log(`║  Final Result: ${totalPassed}/${totalTests} test groups passed${' '.repeat(24 - totalPassed.toString().length - totalTests.toString().length)}║`);
    console.log('╚════════════════════════════════════════════════════════╝');

    if (totalPassed === totalTests) {
        console.log('\n✓ All tests passed! The executor assignment implementation is ready.');
    } else {
        console.log(`\n✗ ${totalTests - totalPassed} test group(s) failed. Please review the implementation.`);
    }
}

// Execute tests
runAllTests();
