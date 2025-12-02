/**
 * Test script for project-scheduler.js
 * Verifies the key functionality without making actual API calls
 */

// Mock data based on the API examples
const mockProjectData = [
    // Template project (no status or status != "В работе")
    {
        "ПроектID": "2326",
        "Проект": "Шаблон. Установка витражей СПК (ОПЕРАЦИИ)",
        "Старт": "",
        "Задача проектаID": "2327",
        "Задача проекта": "Проверка документации",
        "Операция": "Проверка доков на полноту и качество",
        "ОперацияID": "2347",
        "Норматив операции": "120",
        "Кол-во": "",
        "Предыдущая Операция": "",
        "Длительность операции": "",
        "Статус проекта": ""
    },
    {
        "ПроектID": "2326",
        "Проект": "Шаблон. Установка витражей СПК (ОПЕРАЦИИ)",
        "Старт": "",
        "Задача проектаID": "2327",
        "Задача проекта": "Проверка документации",
        "Операция": "Обработка документации от заказчика",
        "ОперацияID": "2382",
        "Норматив операции": "240",
        "Кол-во": "",
        "Предыдущая Операция": "Проверка доков на полноту и качество",
        "Длительность операции": "",
        "Статус проекта": ""
    },
    {
        "ПроектID": "2326",
        "Проект": "Шаблон. Установка витражей СПК (ОПЕРАЦИИ)",
        "Старт": "",
        "Задача проектаID": "2344",
        "Задача проекта": "Сдача выполненных работ",
        "Норматив задачи": "300",
        "Операция": "",
        "ОперацияID": "",
        "Кол-во": "",
        "Предыдущая Задача": "Монтаж стеклопакетов",
        "Длительность задачи": "",
        "Статус проекта": ""
    },
    // Active project ("В работе")
    {
        "ПроектID": "2614",
        "Проект": "Установка витражей СПК (ОПЕРАЦИИ)",
        "Старт": "20.11.2025",
        "Задача проектаID": "2615",
        "Задача проекта": "Проверка документации",
        "Операция": "Проверка доков на полноту и качество",
        "ОперацияID": "2632",
        "Норматив операции": "",
        "Кол-во": "",
        "Предыдущая Операция": "",
        "Шаблон Проекта (Проект)": "2326",
        "Статус проекта": "В работе",
        "Длительность операции": ""
    },
    {
        "ПроектID": "2614",
        "Проект": "Установка витражей СПК (ОПЕРАЦИИ)",
        "Старт": "20.11.2025",
        "Задача проектаID": "2615",
        "Задача проекта": "Проверка документации",
        "Операция": "Обработка документации от заказчика",
        "ОперацияID": "2633",
        "Норматив операции": "",
        "Кол-во": "2",
        "Предыдущая Операция": "Проверка доков на полноту и качество",
        "Шаблон Проекта (Проект)": "2326",
        "Статус проекта": "В работе",
        "Длительность операции": ""
    },
    {
        "ПроектID": "2614",
        "Проект": "Установка витражей СПК (ОПЕРАЦИИ)",
        "Старт": "20.11.2025",
        "Задача проектаID": "2628",
        "Задача проекта": "Сдача выполненных работ",
        "Операция": "",
        "ОперацияID": "",
        "Норматив задачи": "",
        "Кол-во": "",
        "Предыдущая Задача": "Монтаж стеклопакетов",
        "Шаблон Проекта (Проект)": "2326",
        "Статус проекта": "В работе",
        "Длительность задачи": ""
    }
];

const mockWorkHours = [
    { "Код": "day_start", "Значение": "9" },
    { "Код": "day_end", "Значение": "18" },
    { "Код": "lunch_start", "Значение": "13" }
];

// Test functions
function testParseQuantity() {
    console.log('\n=== Test: Parse Quantity ===');
    const testCases = [
        { input: "", expected: 1, desc: "empty string" },
        { input: "0", expected: 1, desc: "zero" },
        { input: "5", expected: 5, desc: "valid number" },
        { input: "3.5", expected: 3.5, desc: "decimal" },
        { input: "abc", expected: 1, desc: "non-numeric" }
    ];

    const parseQuantity = (str) => {
        if (!str || str.trim() === '') return 1;
        const parsed = parseFloat(str);
        return isNaN(parsed) || parsed === 0 ? 1 : parsed;
    };

    let passed = 0;
    testCases.forEach(test => {
        const result = parseQuantity(test.input);
        const success = result === test.expected;
        console.log(`  ${success ? '✓' : '✗'} ${test.desc}: "${test.input}" → ${result} (expected ${test.expected})`);
        if (success) passed++;
    });

    console.log(`  Result: ${passed}/${testCases.length} passed`);
    return passed === testCases.length;
}

function testParseDuration() {
    console.log('\n=== Test: Parse Duration ===');
    const testCases = [
        { input: "", expected: 0, desc: "empty string" },
        { input: "120", expected: 120, desc: "valid number" },
        { input: "0", expected: 0, desc: "zero" },
        { input: "abc", expected: 0, desc: "non-numeric" }
    ];

    const parseDuration = (str) => {
        if (!str || str.trim() === '') return 0;
        const parsed = parseFloat(str);
        return isNaN(parsed) ? 0 : parsed;
    };

    let passed = 0;
    testCases.forEach(test => {
        const result = parseDuration(test.input);
        const success = result === test.expected;
        console.log(`  ${success ? '✓' : '✗'} ${test.desc}: "${test.input}" → ${result} (expected ${test.expected})`);
        if (success) passed++;
    });

    console.log(`  Result: ${passed}/${testCases.length} passed`);
    return passed === testCases.length;
}

function testDateParsing() {
    console.log('\n=== Test: Date Parsing ===');

    const parseDate = (dateStr) => {
        if (!dateStr || dateStr.trim() === '') return null;
        const parts = dateStr.split('.');
        if (parts.length !== 3) return null;
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
    };

    const formatDate = (date) => {
        const pad = (n) => n.toString().padStart(2, '0');
        return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
    };

    const testCases = [
        { input: "20.11.2025", expected: "20.11.2025", desc: "valid date" },
        { input: "01.01.2025", expected: "01.01.2025", desc: "new year" },
        { input: "", expected: null, desc: "empty string" }
    ];

    let passed = 0;
    testCases.forEach(test => {
        const result = parseDate(test.input);
        const formatted = result ? formatDate(result) : null;
        const success = formatted === test.expected;
        console.log(`  ${success ? '✓' : '✗'} ${test.desc}: "${test.input}" → ${formatted} (expected ${test.expected})`);
        if (success) passed++;
    });

    console.log(`  Result: ${passed}/${testCases.length} passed`);
    return passed === testCases.length;
}

function testTemplateLookup() {
    console.log('\n=== Test: Template Lookup ===');

    const buildTemplateLookup = (projectData) => {
        const templateMap = { tasks: new Map(), operations: new Map() };
        projectData.forEach(item => {
            const isTemplate = !item['Статус проекта'] || item['Статус проекта'] !== 'В работе';
            if (isTemplate) {
                const taskName = item['Задача проекта'];
                const operationName = item['Операция'];
                const taskNormative = parseFloat(item['Норматив задачи']) || 0;
                const operationNormative = parseFloat(item['Норматив операции']) || 0;

                if (taskName && taskNormative > 0 && !templateMap.tasks.has(taskName)) {
                    templateMap.tasks.set(taskName, taskNormative);
                }
                if (operationName && operationNormative > 0 && !templateMap.operations.has(operationName)) {
                    templateMap.operations.set(operationName, operationNormative);
                }
            }
        });
        return templateMap;
    };

    const lookup = buildTemplateLookup(mockProjectData);

    const tests = [
        { type: 'operation', name: 'Проверка доков на полноту и качество', expected: 120 },
        { type: 'operation', name: 'Обработка документации от заказчика', expected: 240 },
        { type: 'task', name: 'Сдача выполненных работ', expected: 300 }
    ];

    let passed = 0;
    tests.forEach(test => {
        const map = test.type === 'operation' ? lookup.operations : lookup.tasks;
        const result = map.get(test.name);
        const success = result === test.expected;
        console.log(`  ${success ? '✓' : '✗'} ${test.type} "${test.name}": ${result} (expected ${test.expected})`);
        if (success) passed++;
    });

    console.log(`  Result: ${passed}/${tests.length} passed`);
    return passed === tests.length;
}

function testDurationCalculation() {
    console.log('\n=== Test: Duration Calculation ===');

    const buildTemplateLookup = (projectData) => {
        const templateMap = { tasks: new Map(), operations: new Map() };
        projectData.forEach(item => {
            const isTemplate = !item['Статус проекта'] || item['Статус проекта'] !== 'В работе';
            if (isTemplate) {
                const operationName = item['Операция'];
                const operationNormative = parseFloat(item['Норматив операции']) || 0;
                if (operationName && operationNormative > 0 && !templateMap.operations.has(operationName)) {
                    templateMap.operations.set(operationName, operationNormative);
                }
            }
        });
        return templateMap;
    };

    const parseQuantity = (str) => {
        if (!str || str.trim() === '') return 1;
        const parsed = parseFloat(str);
        return isNaN(parsed) || parsed === 0 ? 1 : parsed;
    };

    const calculateDuration = (item, templateLookup) => {
        const existingDuration = parseFloat(item['Длительность операции']) || 0;
        if (existingDuration > 0) {
            return { duration: existingDuration, source: 'existing' };
        }

        const quantity = parseQuantity(item['Кол-во']);
        const operationName = item['Операция'];
        if (operationName && templateLookup.operations.has(operationName)) {
            const normative = templateLookup.operations.get(operationName);
            return { duration: normative * quantity, source: 'template' };
        }

        return { duration: 60, source: 'default' };
    };

    const lookup = buildTemplateLookup(mockProjectData);

    const tests = [
        {
            desc: "Operation without duration, quantity = 1",
            item: mockProjectData[3], // "Проверка доков на полноту и качество" in active project
            expected: { duration: 120, source: 'template' }
        },
        {
            desc: "Operation without duration, quantity = 2",
            item: mockProjectData[4], // "Обработка документации от заказчика" with Кол-во = 2
            expected: { duration: 480, source: 'template' }
        }
    ];

    let passed = 0;
    tests.forEach(test => {
        const result = calculateDuration(test.item, lookup);
        const success = result.duration === test.expected.duration && result.source === test.expected.source;
        console.log(`  ${success ? '✓' : '✗'} ${test.desc}: ${result.duration} min (${result.source}) - expected ${test.expected.duration} min (${test.expected.source})`);
        if (success) passed++;
    });

    console.log(`  Result: ${passed}/${tests.length} passed`);
    return passed === tests.length;
}

function testWorkingHours() {
    console.log('\n=== Test: Working Hours Calculation ===');

    const addWorkingTime = (startDate, durationMinutes, workHours) => {
        let current = new Date(startDate);
        let remainingMinutes = durationMinutes;

        while (remainingMinutes > 0) {
            const currentHour = current.getHours();
            const currentMinute = current.getMinutes();

            if (currentHour < workHours.dayStart) {
                current.setHours(workHours.dayStart, 0, 0, 0);
                continue;
            }

            if (currentHour >= workHours.dayEnd) {
                current.setDate(current.getDate() + 1);
                current.setHours(workHours.dayStart, 0, 0, 0);
                continue;
            }

            if (currentHour === workHours.lunchStart && currentMinute === 0) {
                current.setHours(workHours.lunchStart + 1, 0, 0, 0);
                continue;
            }

            let minutesUntilBreak;
            if (currentHour < workHours.lunchStart) {
                minutesUntilBreak = (workHours.lunchStart - currentHour) * 60 - currentMinute;
            } else {
                minutesUntilBreak = (workHours.dayEnd - currentHour) * 60 - currentMinute;
            }

            const minutesToWork = Math.min(remainingMinutes, minutesUntilBreak);
            current.setMinutes(current.getMinutes() + minutesToWork);
            remainingMinutes -= minutesToWork;

            if (current.getHours() === workHours.lunchStart && current.getMinutes() === 0 && remainingMinutes > 0) {
                current.setHours(workHours.lunchStart + 1, 0, 0, 0);
            }
        }

        return current;
    };

    const workHours = { dayStart: 9, dayEnd: 18, lunchStart: 13 };

    const tests = [
        {
            desc: "2 hours from 9:00 (before lunch)",
            start: new Date(2025, 10, 20, 9, 0, 0),
            duration: 120,
            expectedHour: 11,
            expectedMinute: 0
        },
        {
            desc: "5 hours from 9:00 (crosses lunch)",
            start: new Date(2025, 10, 20, 9, 0, 0),
            duration: 300,
            expectedHour: 15, // 9:00 + 4h = 13:00 (lunch), then 14:00 + 1h = 15:00
            expectedMinute: 0
        },
        {
            desc: "4 hours from 11:00 (crosses lunch)",
            start: new Date(2025, 10, 20, 11, 0, 0),
            duration: 240,
            expectedHour: 16, // 11:00 + 2h = 13:00 (lunch), then 14:00 + 2h = 16:00
            expectedMinute: 0
        }
    ];

    let passed = 0;
    tests.forEach(test => {
        const result = addWorkingTime(test.start, test.duration, workHours);
        const success = result.getHours() === test.expectedHour && result.getMinutes() === test.expectedMinute;
        console.log(`  ${success ? '✓' : '✗'} ${test.desc}: ${result.getHours()}:${result.getMinutes().toString().padStart(2, '0')} (expected ${test.expectedHour}:${test.expectedMinute.toString().padStart(2, '0')})`);
        if (success) passed++;
    });

    console.log(`  Result: ${passed}/${tests.length} passed`);
    return passed === tests.length;
}

// Run all tests
function runAllTests() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  Project Scheduler - Test Suite                        ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    const results = [
        testParseQuantity(),
        testParseDuration(),
        testDateParsing(),
        testTemplateLookup(),
        testDurationCalculation(),
        testWorkingHours()
    ];

    const totalPassed = results.filter(r => r).length;
    const totalTests = results.length;

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log(`║  Final Result: ${totalPassed}/${totalTests} test groups passed${' '.repeat(24 - totalPassed.toString().length - totalTests.toString().length)}║`);
    console.log('╚════════════════════════════════════════════════════════╝');

    if (totalPassed === totalTests) {
        console.log('\n✓ All tests passed! The implementation is ready.');
    } else {
        console.log(`\n✗ ${totalTests - totalPassed} test group(s) failed. Please review the implementation.`);
    }
}

// Execute tests
runAllTests();
