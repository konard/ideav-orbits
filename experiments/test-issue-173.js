/**
 * Test script to reproduce issue #173
 * Problem: Empty rows persist in constructions list even when not saved to DB
 */

// Simulate the constructions data structure
let constructionsData = [];

// Simulate displayConstructionsData function
function displayConstructionsData() {
    console.log('\n=== Displaying Constructions Data ===');
    if (constructionsData.length === 0) {
        console.log('Display: "Нет данных" (No data)');
        return;
    }

    console.log('Rows in table:');
    constructionsData.forEach((item, index) => {
        console.log(`  ${index + 1}. ID: ${item['КонструкцияID']}, Name: "${item['Конструкция']}"`);
    });
}

// Simulate addConstructionRow function
function addConstructionRow() {
    console.log('\n--- User clicks "+ Добавить строку" ---');
    const tempId = `temp_${Date.now()}`;
    const newRow = {
        'КонструкцияID': tempId,
        'Конструкция': ''
    };

    constructionsData.push(newRow);
    displayConstructionsData();
}

// Simulate updateConstructionField function (simplified)
function updateConstructionField(constructionId, fieldName, value) {
    console.log(`\n--- User changes field "${fieldName}" to "${value}" for ID ${constructionId} ---`);
    const item = constructionsData.find(c => c['КонструкцияID'] === constructionId);
    if (!item) {
        console.log('Item not found!');
        return;
    }

    // Update local data
    item[fieldName] = value;

    // If this is a new unsaved row (has temp ID starting with 'temp_')
    if (constructionId.startsWith('temp_')) {
        // Only create row in DB when construction name field is edited
        if (fieldName === 'Конструкция' && value.trim() !== '') {
            console.log(`Would call createConstructionRowInDB() - saving "${value}" to database`);
            // In real code, this would save to DB and reload data
        } else {
            console.log('Value is empty or whitespace - NOT saving to database');
            console.log('But the row remains in constructionsData!');
        }
        displayConstructionsData();
        return;
    }
}

// Run test scenarios
console.log('=== SCENARIO 1: Empty list, add row, leave empty ===');
constructionsData = [];
displayConstructionsData(); // Should show "Нет данных"
addConstructionRow(); // Adds temp row with empty name
// User doesn't type anything, just closes modal
console.log('\nResult: Empty row persists in constructionsData');
console.log('Problem: When modal is reopened, user sees empty row instead of "Нет данных"');

console.log('\n\n=== SCENARIO 2: Empty list, add row, type name, then clear it ===');
constructionsData = [];
displayConstructionsData(); // Should show "Нет данных"
addConstructionRow(); // Adds temp row with empty name
const tempId = constructionsData[0]['КонструкцияID'];
updateConstructionField(tempId, 'Конструкция', 'Test Construction'); // User types something
updateConstructionField(tempId, 'Конструкция', ''); // User clears the field
console.log('\nResult: Empty row persists, but it was saved to DB with name "Test Construction"');
console.log('Problem: User sees empty row locally, but DB might have the old value');

console.log('\n\n=== PROPOSED SOLUTION ===');
console.log('Option 1: Filter out empty temp rows in displayConstructionsData()');
console.log('  - Filter constructionsData to exclude temp rows with empty Конструкция field');
console.log('  - Show "Нет данных" if all rows are empty temps');
console.log('');
console.log('Option 2: Remove empty temp rows when modal closes');
console.log('  - In closeConstructionsModal(), clean up temp rows with empty fields');
console.log('');
console.log('Option 3: Remove empty temp row when field is cleared');
console.log('  - In updateConstructionField(), if value is empty and row is temp, remove it from constructionsData');
