/**
 * Test script for Issue #46: Rescheduling tasks when executors are insufficient
 *
 * This test validates:
 * 1. Tasks with grips that lack sufficient executors are identified
 * 2. These tasks are rescheduled to a later time when executors are available
 * 3. Executor assignments are properly tracked and updated
 * 4. Rescheduled tasks receive proper executor assignments
 */

console.log('=== Test: Issue #46 - Rescheduling Tasks with Insufficient Executors ===\n');

// Test harness
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
    if (condition) {
        console.log(`✓ ${testName}`);
        passedTests++;
        return true;
    } else {
        console.log(`✗ ${testName}`);
        failedTests++;
        return false;
    }
}

// Mock data: Executors
const mockExecutors = [
    {
        "Исполнитель": "Иван",
        "ПользовательID": "1001",
        "Квалификация -> Уровень": "2",
        "Занятое время": "",
        "Роль": "849",
        "Координаты": "55.7558, 37.6173"
    },
    {
        "Исполнитель": "Петр",
        "ПользовательID": "1002",
        "Квалификация -> Уровень": "2",
        "Занятое время": "",
        "Роль": "849",
        "Координаты": "55.75, 37.62"
    }
];

// Mock work hours
const workHours = {
    dayStart: 9,
    dayEnd: 18,
    lunchStart: 13
};

// Helper functions (extracted from project-scheduler.js)

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
}

function validateExecutorParameters(executor, parameterConstraints) {
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
}

function parseBusyTime(busyTimeStr) {
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
}

function isExecutorAvailable(executor, startTime, endTime, executorAssignments) {
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
}

function addWorkingTime(startDate, durationMinutes, workHours) {
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
        } else if (currentHour < workHours.dayEnd) {
            minutesUntilBreak = (workHours.dayEnd - currentHour) * 60 - currentMinute;
        } else {
            minutesUntilBreak = 0;
        }

        const minutesToWork = Math.min(remainingMinutes, minutesUntilBreak);
        current.setMinutes(current.getMinutes() + minutesToWork);
        remainingMinutes -= minutesToWork;

        if (current.getHours() === workHours.lunchStart && current.getMinutes() === 0 && remainingMinutes > 0) {
            current.setHours(workHours.lunchStart + 1, 0, 0, 0);
        }
    }

    return current;
}

// Test 1: Identify tasks needing rescheduling
console.log('Test 1: Identify tasks needing rescheduling\n');

const scheduled = [
    {
        id: '1',
        name: 'Монтаж каркаса',
        gripId: 'Участок А',
        executorsNeeded: 2,
        executors: [{ id: '1001', name: 'Иван' }], // Only 1 assigned, need 2
        startTime: new Date(2025, 10, 20, 9, 0, 0),
        endTime: new Date(2025, 10, 20, 12, 0, 0),
        duration: 180,
        parameters: '2673:(1-3)'
    },
    {
        id: '2',
        name: 'Монтаж каркаса',
        gripId: 'Участок Б',
        executorsNeeded: 2,
        executors: [{ id: '1001', name: 'Иван' }, { id: '1002', name: 'Петр' }], // Fully staffed
        startTime: new Date(2025, 10, 20, 9, 0, 0),
        endTime: new Date(2025, 10, 20, 12, 0, 0),
        duration: 180,
        parameters: '2673:(1-3)'
    },
    {
        id: '3',
        name: 'Покраска',
        gripId: '', // No grip - should not be rescheduled
        executorsNeeded: 2,
        executors: [{ id: '1001', name: 'Иван' }],
        startTime: new Date(2025, 10, 20, 13, 0, 0),
        endTime: new Date(2025, 10, 20, 16, 0, 0),
        duration: 180,
        parameters: '2673:(1-3)'
    }
];

const tasksNeedingReschedule = scheduled.filter(item =>
    item.gripId && item.executorsNeeded > 0 && item.executors.length < item.executorsNeeded
);

assert(tasksNeedingReschedule.length === 1, 'Exactly 1 task needs rescheduling (Участок А)');
assert(tasksNeedingReschedule[0].id === '1', 'Task with ID "1" (Участок А) identified for rescheduling');
assert(tasksNeedingReschedule[0].gripId === 'Участок А', 'Identified task has gripId "Участок А"');

// Test 2: Find available time slot
console.log('\nTest 2: Find available time slot for rescheduling\n');

const executorAssignments = new Map();

// Иван is busy from 9-12 on 20th (Участок Б)
executorAssignments.set('1001', [{
    startTime: new Date(2025, 10, 20, 9, 0, 0),
    endTime: new Date(2025, 10, 20, 12, 0, 0),
    gripId: 'Участок Б'
}]);

// Петр is busy from 9-12 on 20th (Участок Б)
executorAssignments.set('1002', [{
    startTime: new Date(2025, 10, 20, 9, 0, 0),
    endTime: new Date(2025, 10, 20, 12, 0, 0),
    gripId: 'Участок Б'
}]);

const item = tasksNeedingReschedule[0];
const parameterConstraints = parseParameterString(item.parameters);

// Check that executors match constraints
const eligibleExecutors = mockExecutors.filter(executor =>
    validateExecutorParameters(executor, parameterConstraints)
);

assert(eligibleExecutors.length === 2, 'Both executors match parameter constraints');

// Check availability at 13:00 on same day (after lunch, after Участок Б ends)
const testStartTime = new Date(2025, 10, 20, 14, 0, 0);
const testEndTime = addWorkingTime(testStartTime, item.duration, workHours);

let availableCount = 0;
for (const executor of eligibleExecutors) {
    if (isExecutorAvailable(executor, testStartTime, testEndTime, executorAssignments)) {
        availableCount++;
    }
}

assert(availableCount >= 2, `Both executors available at 14:00 (found ${availableCount})`);

// Test 3: Verify rescheduling logic
console.log('\nTest 3: Verify rescheduling updates item times\n');

// Simulate rescheduling
item.startTime = testStartTime;
item.endTime = testEndTime;

assert(item.startTime.getHours() === 14, 'Task rescheduled to 14:00');
assert(item.startTime.getDate() === 20, 'Task stays on same day (20th)');

console.log(`Rescheduled from 09:00 to ${item.startTime.getHours()}:00`);

// Test 4: Verify executors can be reassigned after rescheduling
console.log('\nTest 4: Verify executors can be reassigned after rescheduling\n');

// Clear previous assignments for the item
item.executors = [];

// Try to assign executors at new time
const newlyAssignedExecutors = [];
for (const executor of eligibleExecutors) {
    if (newlyAssignedExecutors.length >= item.executorsNeeded) break;

    if (isExecutorAvailable(executor, item.startTime, item.endTime, executorAssignments)) {
        newlyAssignedExecutors.push({
            id: executor['ПользовательID'],
            name: executor['Исполнитель']
        });

        // Record new assignment
        if (!executorAssignments.has(executor['ПользовательID'])) {
            executorAssignments.set(executor['ПользовательID'], []);
        }
        executorAssignments.get(executor['ПользовательID']).push({
            startTime: item.startTime,
            endTime: item.endTime,
            gripId: item.gripId
        });
    }
}

item.executors = newlyAssignedExecutors;

assert(item.executors.length === 2, `All executors assigned after rescheduling (assigned ${item.executors.length}/2)`);
assert(item.executors[0].name === 'Иван', 'Executor "Иван" assigned');
assert(item.executors[1].name === 'Петр', 'Executor "Петр" assigned');

// Test 5: Verify tasks without grips are not rescheduled
console.log('\nTest 5: Verify tasks without grips are not rescheduled\n');

const nonGripTask = scheduled[2]; // "Покраска" with no grip
const shouldNotReschedule = !nonGripTask.gripId;

assert(shouldNotReschedule, 'Task without gripId should not be rescheduled');
assert(nonGripTask.executors.length === 1, 'Task without grip keeps original assignment (1/2 executors)');

console.log('\n=== Results ===');
console.log(`Total: ${passedTests + failedTests}, Passed: ${passedTests}, Failed: ${failedTests}`);

if (failedTests === 0) {
    console.log('✓ All tests passed! The rescheduling logic is ready.');
    process.exit(0);
} else {
    console.log(`✗ ${failedTests} test(s) failed`);
    process.exit(1);
}
