/**
 * Test for Issue #390: Table breaks when selecting two estimate positions
 *
 * Problem: When filtering by multiple non-consecutive estimate positions,
 *          the table structure breaks. Rowspan cells don't span correctly
 *          when there are hidden rows in the middle of the span.
 *
 * Key insight: HTML rowspan spans CONSECUTIVE rows only. You can't skip rows.
 *
 * Scenario:
 * Construction has 3 estimates: A, B, C
 * Filter by A and C (not B) - non-consecutive selection
 * Result: Table structure broken
 */

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  Test: Issue #390 - Multiple Estimate Filter Breaks Table║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');

console.log('=== Problem Description ===');
console.log('When selecting TWO estimate positions in the filter, the table breaks');
console.log('Specifically: when selected estimates are NON-CONSECUTIVE');
console.log('(e.g., 1st and 3rd estimate, skipping the 2nd)');
console.log('');

console.log('=== Initial Table Structure ===');
console.log('');
console.log('Construction ВВ-1 with 3 estimates:');
console.log('┌────┬───┬──────┬────────────────────────┬───────────┐');
console.log('│ №  │ ☐ │ Кон. │ Позиция сметы          │ Изделие   │');
console.log('├────┼───┼──────┼────────────────────────┼───────────┤');
console.log('│ 1  │ ☐ │ ВВ-1 │ Estimate A             │ Product A │ Row 0 (index 0)');
console.log('│ ↓  │ ↓ │  ↓   │ Estimate B             │ Product B │ Row 1 (index 1)');
console.log('│ ↓  │ ↓ │  ↓   │ Estimate C             │ Product C │ Row 2 (index 2)');
console.log('└────┴───┴──────┴────────────────────────┴───────────┘');
console.log('');
console.log('Row 0: [№1 rowspan=3][☐ rowspan=3][ВВ-1 rowspan=3][Estimate A][Product A]');
console.log('Row 1: [Estimate B][Product B]  (cells spanned from Row 0)');
console.log('Row 2: [Estimate C][Product C]  (cells spanned from Row 0)');
console.log('');

console.log('=== Filter: Select "Estimate A" AND "Estimate C" (not B) ===');
console.log('');
console.log('Expected result: Show rows 0 and 2, hide row 1');
console.log('');

console.log('Step 1: applyFilters() - First pass');
console.log('  Row 0: estimate="Estimate A" IN filter → VISIBLE');
console.log('  Row 1: estimate="Estimate B" NOT in filter → HIDDEN');
console.log('  Row 2: estimate="Estimate C" IN filter → VISIBLE');
console.log('');

console.log('Step 2: adjustRowspansAfterFilter()');
console.log('');
console.log('Processing Row 0 (index 0, VISIBLE):');
console.log('  Found cells: [№1], [☐], [ВВ-1] with originalRowspan=3');
console.log('  Count visible rows in range [0, 3):');
console.log('    - rows[0]: VISIBLE ✓');
console.log('    - rows[1]: HIDDEN ✗');
console.log('    - rows[2]: VISIBLE ✓');
console.log('  visibleCount = 2');
console.log('');
console.log('  Current logic:');
console.log('    if (visibleCount > 1) {');
console.log('      cell.setAttribute("rowspan", visibleCount);  // rowspan=2');
console.log('    }');
console.log('');
console.log('  Result: cell.setAttribute("rowspan", 2)');
console.log('');

console.log('=== The Problem ===');
console.log('');
console.log('HTML rowspan=2 on Row 0 means:');
console.log('  "This cell spans Row 0 and Row 1"');
console.log('  NOT "This cell spans 2 visible rows"');
console.log('');
console.log('Visual result:');
console.log('┌────┬───┬──────┬────────────────────────┬───────────┐');
console.log('│ №  │ ☐ │ Кон. │ Позиция сметы          │ Изделие   │');
console.log('├────┼───┼──────┼────────────────────────┼───────────┤');
console.log('│ 1  │ ☐ │ ВВ-1 │ Estimate A             │ Product A │ Row 0 (VISIBLE)');
console.log('│ ↓  │ ↓ │  ↓   │ Estimate B             │ Product B │ Row 1 (HIDDEN)');
console.log('│    │   │      │ Estimate C             │ Product C │ Row 2 (VISIBLE)');
console.log('└────┴───┴──────┴────────────────────────┴───────────┘');
console.log('');
console.log('Row 0: rowspan=2 spans to Row 1 (which is hidden)');
console.log('Row 2: ❌ Missing cells! No №, ☐, or Construction cells');
console.log('');
console.log('The cells span from Row 0 to Row 1, but Row 1 is hidden.');
console.log('Row 2 is visible but has no cells because they\'re not spanned to it.');
console.log('');

console.log('=== Root Cause ===');
console.log('');
console.log('HTML rowspan attribute specifies CONSECUTIVE rows:');
console.log('  rowspan=3 → spans rows N, N+1, N+2 (consecutive)');
console.log('  rowspan=2 → spans rows N, N+1 (consecutive)');
console.log('');
console.log('You CANNOT use rowspan to skip hidden rows!');
console.log('rowspan=2 on Row 0 will ALWAYS span Rows 0-1, not 0,2');
console.log('');
console.log('Our current logic:');
console.log('  visibleCount = count of visible rows in original span');
console.log('  cell.setAttribute("rowspan", visibleCount)');
console.log('');
console.log('This is WRONG when there are hidden rows in the middle!');
console.log('');

console.log('=== The Solution ===');
console.log('');
console.log('We need to find the LAST CONSECUTIVE visible row, not count all visible rows.');
console.log('');
console.log('New logic:');
console.log('  1. Find last consecutive visible row from current row');
console.log('  2. Set rowspan to span only to that row');
console.log('  3. For rows after gaps, duplicate the cells');
console.log('');
console.log('Example:');
console.log('  Row 0: VISIBLE');
console.log('  Row 1: HIDDEN');
console.log('  Row 2: VISIBLE');
console.log('');
console.log('  Process Row 0:');
console.log('    - Find last consecutive visible: Row 0 itself (row 1 is hidden)');
console.log('    - Set rowspan=1 (or remove rowspan)');
console.log('    - Row 0 cells span ONLY Row 0');
console.log('');
console.log('  Process Row 1:');
console.log('    - Hidden, skip');
console.log('');
console.log('  Process Row 2:');
console.log('    - VISIBLE but has no cells (they were in Row 0)');
console.log('    - Need to CHECK if this row is missing cells due to gap');
console.log('    - If missing cells with rowspan, move/copy them from Row 0');
console.log('');

console.log('=== Implementation Approach ===');
console.log('');
console.log('Option 1: Find last consecutive visible row');
console.log('');
console.log('function findLastConsecutiveVisibleRow(startIndex, originalRowspan) {');
console.log('  let lastVisible = startIndex;');
console.log('  for (let i = startIndex + 1; i < startIndex + originalRowspan; i++) {');
console.log('    if (rows[i].style.display === "none") {');
console.log('      break;  // Stop at first hidden row');
console.log('    }');
console.log('    lastVisible = i;');
console.log('  }');
console.log('  return lastVisible;');
console.log('}');
console.log('');
console.log('Then:');
console.log('  const lastVisible = findLastConsecutiveVisibleRow(rowIndex, originalRowspan);');
console.log('  const consecutiveSpan = lastVisible - rowIndex + 1;');
console.log('  cell.setAttribute("rowspan", consecutiveSpan);');
console.log('');

console.log('Option 2: Move cells to next visible segment');
console.log('');
console.log('When we find a visible row that should have rowspan cells but doesn\'t:');
console.log('  1. Check if previous rows had rowspan cells that should extend here');
console.log('  2. If there was a gap (hidden rows), those cells didn\'t reach this row');
console.log('  3. Move/duplicate cells to this row');
console.log('');

console.log('=== Recommended Solution ===');
console.log('');
console.log('Modify adjustRowspansAfterFilter():');
console.log('');
console.log('When row is VISIBLE:');
console.log('  1. Find last CONSECUTIVE visible row in the span');
console.log('  2. Set rowspan to span only consecutive visible rows');
console.log('  3. For remaining visible rows after gaps, duplicate cells');
console.log('');
console.log('Code:');
console.log('  // Find last consecutive visible row');
console.log('  let lastConsecutiveVisible = rowIndex;');
console.log('  for (let i = rowIndex + 1; i < rowIndex + originalRowspan; i++) {');
console.log('    if (rows[i].style.display === "none") {');
console.log('      break;  // Stop at first hidden row');
console.log('    }');
console.log('    lastConsecutiveVisible = i;');
console.log('  }');
console.log('');
console.log('  const consecutiveSpan = lastConsecutiveVisible - rowIndex + 1;');
console.log('  if (consecutiveSpan > 1) {');
console.log('    cell.setAttribute("rowspan", consecutiveSpan);');
console.log('  } else {');
console.log('    cell.removeAttribute("rowspan");');
console.log('  }');
console.log('');
console.log('  // Check for visible rows after the consecutive span');
console.log('  // These need their own copies of the cells');
console.log('  for (let i = lastConsecutiveVisible + 1; i < rowIndex + originalRowspan; i++) {');
console.log('    if (rows[i].style.display !== "none") {');
console.log('      // Found a visible row after a gap - it needs cells');
console.log('      // Clone and add cells to this row');
console.log('      const targetRow = rows[i];');
console.log('      const clonedCell = cell.cloneNode(true);');
console.log('      clonedCell.removeAttribute("rowspan");');
console.log('      targetRow.insertBefore(clonedCell, targetRow.firstChild);');
console.log('    }');
console.log('  }');
console.log('');

console.log('=== Expected Result After Fix ===');
console.log('');
console.log('Filter: "Estimate A" and "Estimate C"');
console.log('┌────┬───┬──────┬────────────────────────┬───────────┐');
console.log('│ №  │ ☐ │ Кон. │ Позиция сметы          │ Изделие   │');
console.log('├────┼───┼──────┼────────────────────────┼───────────┤');
console.log('│ 1  │ ☐ │ ВВ-1 │ Estimate A             │ Product A │ Row 0 (VISIBLE)');
console.log('│ 1  │ ☐ │ ВВ-1 │ Estimate C             │ Product C │ Row 2 (VISIBLE)');
console.log('└────┴───┴──────┴────────────────────────┴───────────┘');
console.log('');
console.log('✓ Both visible rows have all necessary cells');
console.log('✓ Cells appear in both Row 0 and Row 2');
console.log('✓ No rowspan (or rowspan=1) since rows are not consecutive');
console.log('✓ Table structure intact');
