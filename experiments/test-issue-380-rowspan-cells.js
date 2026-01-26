/**
 * Test for Issue #380: Table broken with rowspan cells after filtering
 *
 * Problem: When filtering by "Монтаж заполнений", table structure breaks
 * Console shows: "Итого после adjustRowspansAfterFilter: 7 видимых строк"
 * But visually: Row number cells, checkboxes, and construction cells are missing
 *
 * Root cause: adjustRowspansAfterFilter() was HIDING cells with rowspan when their
 *             original row became hidden, even though those cells span into visible rows
 *
 * Test scenario:
 * - Construction ВВ-1 has multiple estimates: "Монтаж каркаса", "Монтаж заполнений"
 * - Filter applied for "Монтаж заполнений"
 * - Expected: 7 visible rows with proper table structure
 * - Bug: Rowspan cells (row numbers, checkboxes, construction) are hidden
 */

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  Test Suite: Issue #380 - Broken Rowspan Cells           ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');

console.log('=== Problem Description ===');
console.log('Filter set to: "Монтаж заполнений"');
console.log('Expected: 7 visible rows with complete table structure');
console.log('Bug: Table structure broken - missing row numbers, checkboxes, construction cells');
console.log('');

console.log('=== Visual Problem ===');
console.log('When viewing filtered table:');
console.log('❌ Row number cells missing (first column empty)');
console.log('❌ Checkbox cells missing (second column empty)');
console.log('❌ Construction cells missing (Конструкция column empty)');
console.log('✓ Estimate cells visible (Позиция сметы shows "Монтаж заполнений")');
console.log('✓ Product cells visible');
console.log('');

console.log('=== Root Cause Analysis ===');
console.log('');
console.log('Table structure before filter:');
console.log('Row 1: [№1][☐][ВВ-1][Монтаж каркаса][Product A]    (rowspan on №1, ☐, ВВ-1)');
console.log('Row 2: ----  ----  ----  [Монтаж заполнений][Product B]  (spans covered)');
console.log('Row 3: ----  ----  ----  [Монтаж заполнений][Product C]  (spans covered)');
console.log('');

console.log('After filter by "Монтаж заполнений":');
console.log('Row 1: HIDDEN (filtered out)');
console.log('Row 2: VISIBLE');
console.log('Row 3: VISIBLE');
console.log('');

console.log('OLD BEHAVIOR (BUG):');
console.log('adjustRowspansAfterFilter() logic:');
console.log('1. Found cells with rowspan in Row 1: [№1], [☐], [ВВ-1]');
console.log('2. Row 1 is hidden (display: none)');
console.log('3. Action: cell.style.display = "none"');
console.log('4. Result: ❌ Cells are HIDDEN even though they span into visible rows');
console.log('5. Visual: Row 2 and Row 3 have missing cells → table broken!');
console.log('');

console.log('NEW BEHAVIOR (FIX):');
console.log('adjustRowspansAfterFilter() logic:');
console.log('1. Found cells with rowspan in Row 1: [№1], [☐], [ВВ-1]');
console.log('2. Row 1 is hidden (display: none)');
console.log('3. Found first visible row in span: Row 2');
console.log('4. Action: MOVE cells from Row 1 to Row 2');
console.log('   - cell.remove() from Row 1');
console.log('   - firstVisibleRow.insertBefore(cell, firstChild)');
console.log('   - Adjust rowspan to visible count (2 in this case)');
console.log('5. Result: ✓ Cells now in Row 2 with rowspan=2');
console.log('6. Visual: Complete table structure maintained!');
console.log('');

console.log('=== Code Changes ===');
console.log('');
console.log('Location: project.js, adjustRowspansAfterFilter(), lines ~4050-4090');
console.log('');
console.log('OLD CODE:');
console.log('  if (row.style.display === "none") {');
console.log('    if (visibleCount === 0) {');
console.log('      cell.style.display = "none";');
console.log('    } else {');
console.log('      cell.style.display = "none";  // ❌ WRONG! Hides cell even when needed');
console.log('    }');
console.log('  }');
console.log('');
console.log('NEW CODE:');
console.log('  if (row.style.display === "none") {');
console.log('    if (visibleCount === 0) {');
console.log('      cell.style.display = "none";');
console.log('    } else {');
console.log('      // Find first visible row in the span');
console.log('      let firstVisibleRowIndex = -1;');
console.log('      for (let i = rowIndex; i < rowIndex + originalRowspan; i++) {');
console.log('        if (rows[i].style.display !== "none") {');
console.log('          firstVisibleRowIndex = i;');
console.log('          break;');
console.log('        }');
console.log('      }');
console.log('      if (firstVisibleRowIndex !== -1) {');
console.log('        // MOVE the cell to first visible row');
console.log('        cell.remove();');
console.log('        const firstVisibleRow = rows[firstVisibleRowIndex];');
console.log('        firstVisibleRow.insertBefore(cell, firstVisibleRow.firstChild);');
console.log('        cell.style.display = "";');
console.log('        // Update rowspan to visible count');
console.log('        if (visibleCount > 1) {');
console.log('          cell.setAttribute("rowspan", visibleCount);');
console.log('        } else {');
console.log('          cell.removeAttribute("rowspan");');
console.log('        }');
console.log('      }');
console.log('    }');
console.log('  }');
console.log('');

console.log('=== Expected Result After Fix ===');
console.log('Filter: "Монтаж заполнений"');
console.log('Console: "Итого после adjustRowspansAfterFilter: 7 видимых строк"');
console.log('Visual table:');
console.log('✓ Row number cells visible in first visible row of each construction');
console.log('✓ Checkbox cells visible in first visible row');
console.log('✓ Construction cells visible in first visible row with adjusted rowspan');
console.log('✓ Estimate cells showing only "Монтаж заполнений"');
console.log('✓ Product cells visible');
console.log('✓ Table structure complete and intact');
console.log('');

console.log('=== Test Verification ===');
console.log('To verify this fix:');
console.log('1. Open project page and apply filter for "Монтаж заполнений"');
console.log('2. Check console log: Should show "7 видимых строк"');
console.log('3. Check first column: Row numbers should be visible');
console.log('4. Check second column: Checkboxes should be visible');
console.log('5. Check Конструкция column: Construction names should be visible');
console.log('6. Check rowspan: Construction cells should span correct number of rows');
console.log('7. Verify: NO broken table structure, all cells properly aligned');
console.log('');

console.log('=== Why Moving Works ===');
console.log('The HTML table model requires rowspan cells to be in an actual visible row.');
console.log('When we hide a row that contains cells with rowspan:');
console.log('  Option 1 (OLD): Hide the cells → ❌ Breaks table structure');
console.log('  Option 2 (NEW): Move cells to first visible row → ✓ Maintains structure');
console.log('');
console.log('By moving the cell:');
console.log('- Cell physically exists in a visible row');
console.log('- Rowspan attribute properly covers subsequent visible rows');
console.log('- Browser renders complete table structure');
console.log('- No missing columns or broken layout');
