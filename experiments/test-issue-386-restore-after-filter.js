/**
 * Test for Issue #386: Table doesn't restore properly after clearing filter
 *
 * Problem: After applying a filter and then clearing it, the table structure is broken
 * Root cause: Cells moved from hidden rows to visible rows stay in the wrong rows
 *             when the filter is cleared
 *
 * Scenario:
 * 1. Initial state - all rows visible
 * 2. Apply filter - some rows hidden, cells moved to visible rows
 * 3. Clear filter - all rows visible again, BUT cells are in wrong rows!
 */

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  Test: Issue #386 - Table Not Restoring After Filter     ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');

console.log('=== Problem Description ===');
console.log('After applying a filter and then clearing it, the table does not restore');
console.log('to its original state. Cells appear in wrong rows.');
console.log('');

console.log('=== Step-by-Step Scenario ===');
console.log('');

console.log('STEP 1: Initial State (No Filter)');
console.log('┌────┬───┬──────┬────────────────────────┬───────────┐');
console.log('│ №  │ ☐ │ Кон. │ Позиция сметы          │ Изделие   │');
console.log('├────┼───┼──────┼────────────────────────┼───────────┤');
console.log('│ 1  │ ☐ │ ВВ-1 │ Монтаж заполнений      │ Product A │ Row 1');
console.log('│ ↓  │ ↓ │  ↓   │ Монтаж каркаса         │ Product B │ Row 2');
console.log('│ ↓  │ ↓ │  ↓   │ Монтаж каркаса         │ Product C │ Row 3');
console.log('└────┴───┴──────┴────────────────────────┴───────────┘');
console.log('Row 1 contains: [№1 rowspan=3], [☐ rowspan=3], [ВВ-1 rowspan=3], [Estimate], [Product]');
console.log('Row 2 contains: [Estimate], [Product] (cells spanned from Row 1)');
console.log('Row 3 contains: [Estimate], [Product] (cells spanned from Row 1)');
console.log('✓ All cells in correct rows');
console.log('');

console.log('STEP 2: Apply Filter (Монтаж каркаса only)');
console.log('Action: Hide Row 1, show Rows 2-3');
console.log('');
console.log('adjustRowspansAfterFilter() executes:');
console.log('  - Find cells in Row 1: [№1], [☐], [ВВ-1]');
console.log('  - Row 1 is hidden, but has visible rows in span (Rows 2-3)');
console.log('  - MOVE cells from Row 1 to Row 2');
console.log('  - Mark cells with data-moved="true"');
console.log('');
console.log('Result after filtering:');
console.log('┌────┬───┬──────┬────────────────────────┬───────────┐');
console.log('│ №  │ ☐ │ Кон. │ Позиция сметы          │ Изделие   │');
console.log('├────┼───┼──────┼────────────────────────┼───────────┤');
console.log('│ 1  │ ☐ │ ВВ-1 │ Монтаж каркаса         │ Product B │ Row 2 (visible)');
console.log('│ ↓  │ ↓ │  ↓   │ Монтаж каркаса         │ Product C │ Row 3 (visible)');
console.log('└────┴───┴──────┴────────────────────────┴───────────┘');
console.log('Row 1 (hidden): [Estimate], [Product]');
console.log('Row 2 (visible): [№1 rowspan=2], [☐ rowspan=2], [ВВ-1 rowspan=2], [Estimate], [Product]');
console.log('Row 3 (visible): [Estimate], [Product]');
console.log('✓ Filtered view correct');
console.log('');

console.log('STEP 3: Clear Filter (Show All)');
console.log('Action: Clear estimate filter, make all rows visible');
console.log('');
console.log('Current restoration logic:');
console.log('  if (!hasActiveFilters) {');
console.log('    rows.forEach(row => {');
console.log('      const cells = row.querySelectorAll("td[data-original-rowspan]");');
console.log('      cells.forEach(cell => {');
console.log('        cell.setAttribute("rowspan", originalRowspan); // Restore rowspan');
console.log('        cell.style.display = ""; // Make visible');
console.log('        cell.removeAttribute("data-moved"); // Clear flag');
console.log('      });');
console.log('    });');
console.log('  }');
console.log('');
console.log('What this does:');
console.log('  - Iterates over all rows');
console.log('  - Finds cells with data-original-rowspan in CURRENT row');
console.log('  - Restores rowspan attributes');
console.log('  - Makes cells visible');
console.log('  - Clears data-moved flag');
console.log('');
console.log('What this DOES NOT do:');
console.log('  ❌ Move cells back to their original rows!');
console.log('');

console.log('Result after clearing filter:');
console.log('┌────┬───┬──────┬────────────────────────┬───────────┐');
console.log('│ №  │ ☐ │ Кон. │ Позиция сметы          │ Изделие   │');
console.log('├────┼───┼──────┼────────────────────────┼───────────┤');
console.log('│    │   │      │ Монтаж заполнений      │ Product A │ Row 1 (visible)');
console.log('│ 1  │ ☐ │ ВВ-1 │ Монтаж каркаса         │ Product B │ Row 2 (visible)');
console.log('│ ↓  │ ↓ │  ↓   │ Монтаж каркаса         │ Product C │ Row 3 (visible)');
console.log('└────┴───┴──────┴────────────────────────┴───────────┘');
console.log('Row 1 (visible): [Estimate], [Product] ❌ Missing №, ☐, Construction!');
console.log('Row 2 (visible): [№1 rowspan=3], [☐ rowspan=3], [ВВ-1 rowspan=3], [Estimate], [Product]');
console.log('Row 3 (visible): [Estimate], [Product]');
console.log('❌ Table structure BROKEN! Cells in wrong rows!');
console.log('');

console.log('=== Root Cause ===');
console.log('');
console.log('When we moved cells from Row 1 to Row 2 during filtering:');
console.log('  - Cells physically moved in the DOM');
console.log('  - Cell.parentElement changed from Row 1 to Row 2');
console.log('  - We did NOT track their original row location');
console.log('');
console.log('When clearing the filter:');
console.log('  - We only restore attributes (rowspan, display, data-moved)');
console.log('  - We do NOT move cells back to original rows');
console.log('  - Cells stay in Row 2 where they were moved');
console.log('  - Row 1 is missing its cells');
console.log('');

console.log('=== The Fix ===');
console.log('');
console.log('Solution: Track original row for each moved cell and restore on clear');
console.log('');
console.log('Option 1: Store reference to original row in cell');
console.log('  cell.dataset.originalRow = row; // Store row reference');
console.log('  Problem: Cannot store object references in dataset');
console.log('');
console.log('Option 2: Store original row index');
console.log('  cell.setAttribute("data-original-row-index", rowIndex);');
console.log('  On restore: Move cell back to rows[originalRowIndex]');
console.log('  Problem: Row indices might change if rows are added/removed');
console.log('');
console.log('Option 3 (BEST): Store original parent row element and restore it');
console.log('  When moving:');
console.log('    cell._originalParentRow = cell.parentElement; // Store reference');
console.log('  When restoring:');
console.log('    if (cell._originalParentRow && cell._originalParentRow !== cell.parentElement) {');
console.log('      cell._originalParentRow.insertBefore(cell, cell._originalParentRow.firstChild);');
console.log('      delete cell._originalParentRow;');
console.log('    }');
console.log('');
console.log('This ensures cells return to their exact original row.');
console.log('');

console.log('=== Implementation Details ===');
console.log('');
console.log('BEFORE moving cells (in adjustRowspansAfterFilter):');
console.log('  cellsToMove.forEach(({cell}) => {');
console.log('    // Store original parent BEFORE removing');
console.log('    if (!cell._originalParentRow) {');
console.log('      cell._originalParentRow = cell.parentElement;');
console.log('    }');
console.log('    cell.remove();');
console.log('  });');
console.log('');
console.log('WHEN clearing filter (in restoration block):');
console.log('  rows.forEach(row => {');
console.log('    const cells = row.querySelectorAll("td[data-moved]");');
console.log('    cells.forEach(cell => {');
console.log('      if (cell._originalParentRow && cell._originalParentRow !== cell.parentElement) {');
console.log('        // Move back to original row');
console.log('        const originalRow = cell._originalParentRow;');
console.log('        const targetPosition = findOriginalPosition(cell, originalRow);');
console.log('        originalRow.insertBefore(cell, targetPosition);');
console.log('      }');
console.log('      // Restore attributes');
console.log('      cell.setAttribute("rowspan", cell.getAttribute("data-original-rowspan"));');
console.log('      cell.style.display = "";');
console.log('      cell.removeAttribute("data-moved");');
console.log('      delete cell._originalParentRow;');
console.log('    });');
console.log('  });');
console.log('');

console.log('=== Expected Result After Fix ===');
console.log('After clearing filter:');
console.log('┌────┬───┬──────┬────────────────────────┬───────────┐');
console.log('│ №  │ ☐ │ Кон. │ Позиция сметы          │ Изделие   │');
console.log('├────┼───┼──────┼────────────────────────┼───────────┤');
console.log('│ 1  │ ☐ │ ВВ-1 │ Монтаж заполнений      │ Product A │ Row 1');
console.log('│ ↓  │ ↓ │  ↓   │ Монтаж каркаса         │ Product B │ Row 2');
console.log('│ ↓  │ ↓ │  ↓   │ Монтаж каркаса         │ Product C │ Row 3');
console.log('└────┴───┴──────┴────────────────────────┴───────────┘');
console.log('✓ All cells back in original rows');
console.log('✓ Original rowspan values restored');
console.log('✓ Table structure identical to initial state');
