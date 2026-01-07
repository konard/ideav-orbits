/**
 * Test script for issue 171: New constructions should be added at the end of the table
 *
 * This script tests the order calculation logic for new constructions
 */

// Mock data to simulate existing constructions
const existingConstructions = [
    { 'КонструкцияID': '1001', 'Конструкция': 'Фундамент', 'КонструкцияOrder': '1' },
    { 'КонструкцияID': '1002', 'Конструкция': 'Стены', 'КонструкцияOrder': '2' },
    { 'КонструкцияID': '1003', 'Конструкция': 'Кровля', 'КонструкцияOrder': '3' }
];

// Test case 1: Adding a new construction to non-empty list
console.log('Test 1: Adding new construction to non-empty list');
const tempId1 = 'temp_12345';
const newConstruction1 = { 'КонструкцияID': tempId1, 'Конструкция': '' };

const constructionsData1 = [...existingConstructions, newConstruction1];

// Calculate max order (same logic as in the fix)
const maxOrder1 = constructionsData1.reduce((max, c) => {
    if (c['КонструкцияID'] === tempId1) return max; // Skip the current temp item
    const order = parseInt(c['КонструкцияOrder'] || 0);
    return order > max ? order : max;
}, 0);

const newOrder1 = maxOrder1 + 1;

console.log('  Existing constructions:', existingConstructions.map(c => `${c['Конструкция']} (order: ${c['КонструкцияOrder']})`));
console.log('  Max order found:', maxOrder1);
console.log('  New order assigned:', newOrder1);
console.log('  Expected: 4');
console.log('  Result:', newOrder1 === 4 ? '✓ PASS' : '✗ FAIL');
console.log();

// Test case 2: Adding a new construction to empty list
console.log('Test 2: Adding new construction to empty list');
const tempId2 = 'temp_67890';
const newConstruction2 = { 'КонструкцияID': tempId2, 'Конструкция': '' };

const constructionsData2 = [newConstruction2];

const maxOrder2 = constructionsData2.reduce((max, c) => {
    if (c['КонструкцияID'] === tempId2) return max;
    const order = parseInt(c['КонструкцияOrder'] || 0);
    return order > max ? order : max;
}, 0);

const newOrder2 = maxOrder2 + 1;

console.log('  Existing constructions: (empty)');
console.log('  Max order found:', maxOrder2);
console.log('  New order assigned:', newOrder2);
console.log('  Expected: 1');
console.log('  Result:', newOrder2 === 1 ? '✓ PASS' : '✗ FAIL');
console.log();

// Test case 3: Adding construction with mixed order values
console.log('Test 3: Adding construction with mixed/undefined order values');
const mixedConstructions = [
    { 'КонструкцияID': '2001', 'Конструкция': 'Item 1', 'КонструкцияOrder': '5' },
    { 'КонструкцияID': '2002', 'Конструкция': 'Item 2' }, // No order
    { 'КонструкцияID': '2003', 'Конструкция': 'Item 3', 'КонструкцияOrder': '10' }
];

const tempId3 = 'temp_11111';
const newConstruction3 = { 'КонструкцияID': tempId3, 'Конструкция': '' };

const constructionsData3 = [...mixedConstructions, newConstruction3];

const maxOrder3 = constructionsData3.reduce((max, c) => {
    if (c['КонструкцияID'] === tempId3) return max;
    const order = parseInt(c['КонструкцияOrder'] || 0);
    return order > max ? order : max;
}, 0);

const newOrder3 = maxOrder3 + 1;

console.log('  Existing constructions:', mixedConstructions.map(c => `${c['Конструкция']} (order: ${c['КонструкцияOrder'] || 'undefined'})`));
console.log('  Max order found:', maxOrder3);
console.log('  New order assigned:', newOrder3);
console.log('  Expected: 11');
console.log('  Result:', newOrder3 === 11 ? '✓ PASS' : '✗ FAIL');
console.log();

// Test case 4: Verify sorting behavior
console.log('Test 4: Verify sorting behavior after assigning order');
const testData = [
    { 'КонструкцияID': '3001', 'Конструкция': 'First', 'КонструкцияOrder': '1' },
    { 'КонструкцияID': '3002', 'Конструкция': 'Second', 'КонструкцияOrder': '2' },
    { 'КонструкцияID': '3003', 'Конструкция': 'Third', 'КонструкцияOrder': '3' },
    { 'КонструкцияID': '3004', 'Конструкция': 'New Item', 'КонструкцияOrder': '4' } // Simulating newly assigned order
];

// Sort by order (same logic as displayConstructionsData)
testData.sort((a, b) => {
    const orderA = parseInt(a['КонструкцияOrder'] || 0);
    const orderB = parseInt(b['КонструкцияOrder'] || 0);
    return orderA - orderB;
});

console.log('  Sorted constructions:');
testData.forEach((item, index) => {
    console.log(`    ${index + 1}. ${item['Конструкция']} (order: ${item['КонструкцияOrder']})`);
});

const isLastItem = testData[testData.length - 1]['Конструкция'] === 'New Item';
console.log('  Is "New Item" at the end?', isLastItem ? '✓ PASS' : '✗ FAIL');
console.log();

console.log('='.repeat(50));
console.log('All tests completed!');
