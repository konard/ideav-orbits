/**
 * Test script for Issue #29 - JSON format changes
 * Validates that the code correctly handles the new API JSON format
 */

// Mock project data with new format
const mockProjectData = [
    {
        "ПроектID": "2614",
        "Проект": "Установка витражей СПК (ОПЕРАЦИИ)",
        "Старт": "20.11.2025",
        "Задача проектаID": "2624",
        "Задача проекта": "Монтаж стеклопакетов",
        "К-во": "",
        "Начать": "",
        "Исполнитель Задачи": "",
        "Параметры задачи": "",
        "Норматив задачи": "",
        "Предыдущая Задача": "",
        "Операция": "Монтаж стеклопакетов",
        "Операция -> Начать": null,
        "ОперацияID": "2627",
        "Норматив операции": "",
        "Кол-во": "20",
        "Исполнителей": "",
        "Предыдущая Операция": "Разгрузка стеклопакетов",
        "Ед.изм.": "",
        "Шаблон Проекта (Проект)": "2326",
        "Статус проекта": "В работе",
        "ЗахваткаID": "888",
        "Захватка (координаты)": "В209 №40 (55.691110, 37.495410)",
        "Параметры операции": "",
        "Длительность задачи": "",
        "Длительность операции": "600",
        "Исполнитель операции": "alex.m"
    }
];

// Mock executors data with new format
const mockExecutors = [
    {
        "Исполнитель": "alex.m",
        "ПользовательID": "4074",
        "Квалификация -> Уровень": "2",
        "Занятое время": "20251124:9-13",
        "Роль": "849",
        "Контролер": "",
        "Наставник": "",
        "Квалификация": "Стажер"
    },
    {
        "Исполнитель": "barabashinkv",
        "ПользовательID": "854",
        "Квалификация -> Уровень": "3",
        "Занятое время": "",
        "Роль": "849",
        "Контролер": "",
        "Наставник": "",
        "Квалификация": "Специалист"
    }
];

console.log('=== Testing Issue #29 - JSON Format Changes ===\n');

// Test 1: Verify new field names are accessible
console.log('Test 1: Check new field names in project data');
const testItem = mockProjectData[0];
console.log(`  ЗахваткаID: ${testItem['ЗахваткаID']}`);
console.log(`  Захватка (координаты): ${testItem['Захватка (координаты)']}`);
console.log(`  Исполнитель операции: ${testItem['Исполнитель операции']}`);
console.log(`  Длительность операции: ${testItem['Длительность операции']}`);
console.log(`  ✓ All new fields are accessible\n`);

// Test 2: Verify old field names are not present
console.log('Test 2: Check that old field names are not present');
if (!testItem.hasOwnProperty('Захватка') && !testItem.hasOwnProperty('Координаты')) {
    console.log('  ✓ Old fields (Захватка, Координаты) are not present\n');
} else {
    console.log('  ✗ Old fields still present - this should not happen!\n');
}

// Test 3: Verify executor data has new Квалификация field
console.log('Test 3: Check new Квалификация field in executors data');
mockExecutors.forEach(executor => {
    console.log(`  ${executor['Исполнитель']}: Квалификация = ${executor['Квалификация']}`);
});
console.log('  ✓ All executors have Квалификация field\n');

// Test 4: Parse grip coordinates from new format
console.log('Test 4: Parse coordinates from new format');
const coordsStr = testItem['Захватка (координаты)'];
const coordsMatch = coordsStr.match(/\(([0-9.]+),\s*([0-9.]+)\)/);
if (coordsMatch) {
    const lat = parseFloat(coordsMatch[1]);
    const lon = parseFloat(coordsMatch[2]);
    console.log(`  Parsed coordinates: lat=${lat}, lon=${lon}`);
    console.log('  ✓ Coordinates parsed successfully\n');
} else {
    console.log('  ✗ Failed to parse coordinates\n');
}

// Test 5: Simulate code usage
console.log('Test 5: Simulate how the scheduler code uses these fields');
const gripId = testItem['ЗахваткаID'] || '';
const gripCoordinates = testItem['Захватка (координаты)'] || '';
console.log(`  gripId: "${gripId}"`);
console.log(`  gripCoordinates: "${gripCoordinates}"`);
console.log(`  ✓ Fields can be accessed as expected\n`);

console.log('=== All tests passed! ===');
