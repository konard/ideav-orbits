/**
 * Test for Issue #378: Filter second pass causing extra visible rows
 *
 * Problem: When filtering by "Монтаж заполнений", extra rows with "Монтаж каркаса" are visible
 * Console shows: First pass: 7 visible, 22 hidden → After second pass: 12 visible (5 extra!)
 *
 * Root cause: Second pass in applyFilters() was un-hiding entire rows to preserve
 *             construction cells with rowspan, even when those rows contained
 *             filtered-out estimates
 *
 * Test scenario:
 * - Multiple constructions, each with multiple estimate positions
 * - Filter applied for "Монтаж заполнений"
 * - Expected: Only rows with "Монтаж заполнений" visible
 * - Bug: Rows with "Монтаж каркаса" also visible after second pass
 */

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  Test Suite: Issue #378 - Filter Second Pass Bug         ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');

console.log('=== Problem Description ===');
console.log('Filter set to: "Монтаж заполнений"');
console.log('Expected: Only rows with "Монтаж заполнений" visible');
console.log('Bug: Extra 5 rows with "Монтаж каркаса" are visible');
console.log('');

console.log('=== Console Output from Issue ===');
console.log('Фильтр по Позиция сметы: Монтаж заполнений');
console.log('Фильтр по Изделие: (не активен)');
console.log('Всего строк в таблице: 29');
console.log('Результат первого прохода: 7 видимых, 22 скрытых ✓ CORRECT');
console.log('Итого после второго прохода: 12 видимых строк ❌ WRONG (should be 7)');
console.log('');

console.log('=== Root Cause Analysis ===');
console.log('');
console.log('Second pass logic (lines 3968-4002):');
console.log('1. Iterate through all rows');
console.log('2. For each HIDDEN row:');
console.log('   - Check if it has construction cells with rowspan');
console.log('   - Check if there are VISIBLE rows in the rowspan range');
console.log('   - If yes: UN-HIDE the entire row with row.style.display = ""');
console.log('');
console.log('Why this causes the bug:');
console.log('- Construction ВВ-1 has 2 estimates: "Монтаж каркаса" and "Монтаж заполнений"');
console.log('- First pass correctly hides "Монтаж каркаса" rows (22 hidden)');
console.log('- Second pass finds hidden "Монтаж каркаса" rows with construction cells');
console.log('- Construction cells have rowspan=2 (spanning both estimates)');
console.log('- "Монтаж заполнений" rows are visible');
console.log('- Second pass UN-HIDES the "Монтаж каркаса" rows');
console.log('- Result: Filtered-out estimates become visible!');
console.log('');

console.log('=== The Fix ===');
console.log('');
console.log('REMOVE the second pass entirely (lines 3968-4002)');
console.log('');
console.log('Why this works:');
console.log('- adjustRowspansAfterFilter() already handles all rowspan adjustments');
console.log('- It adjusts rowspan values without un-hiding filtered rows');
console.log('- Construction cells in hidden rows are hidden via cell.style.display = "none"');
console.log('- First visible row gets the construction cells with adjusted rowspan');
console.log('- No need to un-hide entire rows');
console.log('');

console.log('=== Expected Result After Fix ===');
console.log('Filter: "Монтаж заполнений"');
console.log('Результат первого прохода: 7 видимых, 22 скрытых');
console.log('Итого после второго прохода: 7 видимых строк ✓');
console.log('');
console.log('Benefits:');
console.log('✓ Filter shows ONLY selected estimates');
console.log('✓ No extra rows from filtered-out estimates');
console.log('✓ Construction cells properly adjusted by adjustRowspansAfterFilter()');
console.log('✓ Table structure remains intact');
console.log('');

console.log('=== Code Comparison ===');
console.log('');
console.log('OLD (Buggy):');
console.log('  First pass: Filter rows, mark hidden');
console.log('  Second pass: Un-hide rows with construction cells + visible children');
console.log('  Result: Filtered rows become visible again ❌');
console.log('');
console.log('NEW (Fixed):');
console.log('  First pass: Filter rows, mark hidden');
console.log('  adjustRowspansAfterFilter(): Adjust cell rowspans without un-hiding rows');
console.log('  Result: Only filtered rows visible ✓');
console.log('');

console.log('=== Test Verification ===');
console.log('To verify this fix:');
console.log('1. Apply filter for "Монтаж заполнений"');
console.log('2. Check console log: First pass should show N visible rows');
console.log('3. Check console log: After adjustments should show SAME N visible rows');
console.log('4. Verify table: ONLY "Монтаж заполнений" rows visible');
console.log('5. Verify table: NO "Монтаж каркаса" rows visible');
