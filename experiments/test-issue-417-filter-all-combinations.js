/**
 * Test script for issue #417: Issues #413 and #415 are not solved yet
 *
 * This script tests the product and estimate filters with the exact data from issue #415
 * to reproduce the table breaking defect.
 *
 * Test scenarios:
 * 1. No filter - verify table structure
 * 2. Filter by product "Заполнение" - check for table breakage
 * 3. Filter by product "Каркас" - check for table breakage
 * 4. Filter by product "Примыкания" - check for table breakage
 * 5. Filter by estimate "Монтаж заполнений" - check for table breakage
 * 6. Filter by estimate "Монтаж каркаса" - check for table breakage
 * 7. Combined filters - check for table breakage
 * 8. Clear filters - verify table restoration
 */

// Sample data from issue #415
const testConstructions = [
    {
        "Конструкция": "ВВ-1.1",
        "КонструкцияID": "6987",
        "Номер": "1",
        "Захватка": "2",
        "Оси": "17-12, 24-6",
        "Высотные отметки": "",
        "Этаж": "3",
        "Примечание": "",
        "Документация по конструкции": "https://mail.google.com/mail/u/0/#inbox.dwg"
    },
    {
        "Конструкция": "ВВ-1.2",
        "КонструкцияID": "6988",
        "Номер": "2",
        "Захватка": "1",
        "Оси": "17-12, 20-6",
        "Высотные отметки": "117",
        "Этаж": "",
        "Примечание": ""
    },
    {
        "Конструкция": "ВВ-1.2",
        "КонструкцияID": "6817",
        "Номер": "3",
        "Захватка": "3"
    },
    {
        "Конструкция": "ВВ-4.35",
        "КонструкцияID": "6821",
        "Номер": "4"
    },
    {
        "Конструкция": "ВВ-2.2",
        "КонструкцияID": "7297",
        "Номер": "5"
    }
];

const testEstimates = [
    {
        "Смета": "Монтаж каркаса",
        "СметаID": "6972",
        "СметаOrder": "1"
    },
    {
        "Смета": "Монтаж заполнений",
        "СметаID": "6976",
        "СметаOrder": "2"
    },
    {
        "Смета": "Монтаж примыканий",
        "СметаID": "6973",
        "СметаOrder": "3"
    },
    {
        "Смета": "Отдирание пленки",
        "СметаID": "7295",
        "СметаOrder": "4"
    },
    {
        "Смета": "Смета без рабо",
        "СметаID": "7700",
        "СметаOrder": "5"
    }
];

const testProducts = [
    // Монтаж каркаса (6972) - multiple products
    {"Позиция сметыID": "6972", "Изделие": "Каркас", "ИзделиеID": "7328", "КонструкцияID": "7297", "ИзделиеOrder": "1"},
    {"Позиция сметыID": "6972", "Изделие": "Примыкания", "ИзделиеID": "7213", "КонструкцияID": "6988", "ИзделиеOrder": "1"},
    {"Позиция сметыID": "6972", "Изделие": "Каркас", "ИзделиеID": "7320", "КонструкцияID": "6987", "ИзделиеOrder": "2"},
    {"Позиция сметыID": "6972", "Изделие": "Каркас", "ИзделиеID": "7326", "КонструкцияID": "6821", "ИзделиеOrder": "2"},
    {"Позиция сметыID": "6972", "Изделие": "Каркас", "ИзделиеID": "7322", "КонструкцияID": "6988", "ИзделиеOrder": "3"},
    {"Позиция сметыID": "6972", "Изделие": "Каркас", "ИзделиеID": "7324", "КонструкцияID": "6817", "ИзделиеOrder": "3"},
    {"Позиция сметыID": "6972", "Изделие": "Каркас", "ИзделиеID": "7336", "КонструкцияID": "6988", "ИзделиеOrder": "5"},

    // Монтаж заполнений (6976) - multiple products
    {"Позиция сметыID": "6976", "Изделие": "Заполнение", "ИзделиеID": "7219", "КонструкцияID": "6817", "ИзделиеOrder": "1"},
    {"Позиция сметыID": "6976", "Изделие": "Заполнение", "ИзделиеID": "7726", "КонструкцияID": "7297", "ИзделиеOrder": "2"},
    {"Позиция сметыID": "6976", "Изделие": "Примыкания", "ИзделиеID": "7215", "КонструкцияID": "6988", "ИзделиеOrder": "2"},
    {"Позиция сметыID": "6976", "Изделие": "Заполнение", "ИзделиеID": "7330", "КонструкцияID": "6987", "ИзделиеOrder": "3"},
    {"Позиция сметыID": "6976", "Изделие": "Заполнение", "ИзделиеID": "7724", "КонструкцияID": "6821", "ИзделиеOrder": "3"},
    {"Позиция сметыID": "6976", "Изделие": "Заполнение", "ИзделиеID": "7332", "КонструкцияID": "6988", "ИзделиеOrder": "4"},
    {"Позиция сметыID": "6976", "Изделие": "Заполнение", "ИзделиеID": "7334", "КонструкцияID": "6817", "ИзделиеOrder": "4"},
    {"Позиция сметыID": "6976", "Изделие": "Заполнение", "ИзделиеID": "7718", "КонструкцияID": "6987", "ИзделиеOrder": "4"},
    {"Позиция сметыID": "6976", "Изделие": "Заполнение", "ИзделиеID": "7722", "КонструкцияID": "6817", "ИзделиеOrder": "5"},
    {"Позиция сметыID": "6976", "Изделие": "Заполнение", "ИзделиеID": "7720", "КонструкцияID": "6988", "ИзделиеOrder": "6"},

    // Монтаж примыканий (6973) - no products
    {"Позиция сметыID": "6973", "Изделие": "", "ИзделиеID": ""},

    // Отдирание пленки (7295) - multiple products
    {"Позиция сметыID": "7295", "Изделие": "Каркас", "ИзделиеID": "7300", "КонструкцияID": "6987", "ИзделиеOrder": "1"},
    {"Позиция сметыID": "7295", "Изделие": "Каркас", "ИзделиеID": "7306", "КонструкцияID": "6821", "ИзделиеOrder": "1"},
    {"Позиция сметыID": "7295", "Изделие": "Каркас", "ИзделиеID": "7304", "КонструкцияID": "6817", "ИзделиеOrder": "2"},

    // Смета без рабо (7700) - no products
    {"Позиция сметыID": "7700", "Изделие": "", "ИзделиеID": ""}
];

/**
 * Simulate the table structure generation
 * Returns: { rows: Array, structure: Object }
 */
function generateTableStructure() {
    console.log('\n=== GENERATING TABLE STRUCTURE ===\n');

    const rows = [];
    let rowNumber = 0;

    // Group products by construction and estimate
    const constructionMap = new Map();

    testProducts.forEach(product => {
        const constructionId = product['КонструкцияID'] || null;
        const estimateId = product['Позиция сметыID'];

        if (!constructionMap.has(constructionId)) {
            constructionMap.set(constructionId, new Map());
        }

        const estimateMap = constructionMap.get(constructionId);
        if (!estimateMap.has(estimateId)) {
            estimateMap.set(estimateId, []);
        }

        estimateMap.get(estimateId).push(product);
    });

    // Build rows
    testConstructions.forEach(construction => {
        const constructionId = construction['КонструкцияID'];
        const estimatesForConstruction = constructionMap.get(constructionId) || new Map();

        // Count total rows for this construction (for construction cell rowspan)
        let totalRowsForConstruction = 0;
        estimatesForConstruction.forEach(products => {
            totalRowsForConstruction += Math.max(products.length, 1);
        });

        // If no products for this construction, still need 1 row per estimate
        if (totalRowsForConstruction === 0) {
            totalRowsForConstruction = testEstimates.length;
        }

        let firstRowOfConstruction = true;

        // Iterate estimates in order
        testEstimates.forEach(estimate => {
            const productsForEstimate = estimatesForConstruction.get(estimate['СметаID']) || [];
            const rowsForEstimate = Math.max(productsForEstimate.length, 1);

            let firstRowOfEstimate = true;

            for (let i = 0; i < rowsForEstimate; i++) {
                rowNumber++;
                const product = productsForEstimate[i] || { 'Изделие': '—', 'ИзделиеID': '' };

                const row = {
                    rowIndex: rows.length,
                    rowNumber: rowNumber,
                    cells: []
                };

                // Construction cells (only in first row of construction)
                if (firstRowOfConstruction) {
                    row.cells.push({
                        type: 'construction',
                        value: construction['Конструкция'],
                        rowspan: totalRowsForConstruction
                    });
                    firstRowOfConstruction = false;
                }

                // Estimate cells (only in first row of estimate)
                if (firstRowOfEstimate) {
                    row.cells.push({
                        type: 'estimate',
                        value: estimate['Смета'],
                        rowspan: rowsForEstimate
                    });
                    firstRowOfEstimate = false;
                }

                // Product cell (in every row)
                row.cells.push({
                    type: 'product',
                    value: product['Изделие'] || '—',
                    rowspan: 1
                });

                row.construction = construction['Конструкция'];
                row.constructionId = construction['КонструкцияID'];
                row.estimate = estimate['Смета'];
                row.estimateId = estimate['СметаID'];
                row.product = product['Изделие'] || '—';
                row.productId = product['ИзделиеID'];

                rows.push(row);
            }
        });
    });

    console.log(`Generated ${rows.length} rows`);
    return { rows, structure: constructionMap };
}

/**
 * Simulate the filtering logic from project.js
 */
function applyFilter(rows, filterType, filterValue) {
    console.log(`\n=== APPLYING FILTER: ${filterType} = "${filterValue}" ===\n`);

    let currentEstimateValue = null;
    let currentProductValue = null;
    let currentProductRowsRemaining = 0;
    let visibleCount = 0;
    let hiddenCount = 0;

    rows.forEach((row, rowIndex) => {
        let shouldShowRow = true;

        // Check estimate filter
        const estimateCell = row.cells.find(c => c.type === 'estimate');
        if (estimateCell) {
            currentEstimateValue = estimateCell.value;
            if (filterType === 'estimate' && estimateCell.value !== filterValue) {
                shouldShowRow = false;
            }
        } else if (filterType === 'estimate' && currentEstimateValue !== filterValue) {
            shouldShowRow = false;
        }

        // Check product filter (matching the logic in project.js lines 4022-4066)
        if (filterType === 'product') {
            const productCell = row.cells.find(c => c.type === 'product');
            if (productCell) {
                // This row has a product cell
                currentProductValue = productCell.value;
                currentProductRowsRemaining = productCell.rowspan || 1;

                if (productCell.value && productCell.value !== '—') {
                    shouldShowRow = shouldShowRow && (productCell.value === filterValue);
                } else {
                    shouldShowRow = false;
                }
            } else {
                // No product cell in this row - check if within rowspan
                if (currentProductRowsRemaining > 0) {
                    currentProductRowsRemaining--;
                    if (currentProductValue && currentProductValue !== '—') {
                        shouldShowRow = shouldShowRow && (currentProductValue === filterValue);
                    } else {
                        shouldShowRow = false;
                    }
                } else {
                    shouldShowRow = false;
                }
            }
        } else {
            // Product filter not active - just track rowspan
            const productCell = row.cells.find(c => c.type === 'product');
            if (productCell) {
                currentProductRowsRemaining = productCell.rowspan || 1;
            } else if (currentProductRowsRemaining > 0) {
                currentProductRowsRemaining--;
            }
        }

        row.visible = shouldShowRow;
        if (shouldShowRow) {
            visibleCount++;
        } else {
            hiddenCount++;
        }
    });

    console.log(`Result: ${visibleCount} visible, ${hiddenCount} hidden`);
    return { visibleCount, hiddenCount };
}

/**
 * Simulate adjustRowspansAfterFilter from project.js
 */
function adjustRowspansAfterFilter(rows) {
    console.log('\n=== ADJUSTING ROWSPANS ===\n');

    const issues = [];

    rows.forEach((row, rowIndex) => {
        if (row.visible) {
            return; // Skip visible rows for this analysis
        }

        // This row is hidden - check if it has cells with rowspan
        const cellsWithRowspan = row.cells.filter(c => c.rowspan > 1);

        if (cellsWithRowspan.length === 0) {
            return; // No rowspan cells to move
        }

        // Find first visible row in the rowspan range
        let firstVisibleRowIndex = -1;
        for (let i = rowIndex; i < rows.length; i++) {
            // Check each cell's rowspan range
            for (const cell of cellsWithRowspan) {
                if (i < rowIndex + cell.rowspan && rows[i].visible) {
                    firstVisibleRowIndex = i;
                    break;
                }
            }
            if (firstVisibleRowIndex !== -1) break;
        }

        if (firstVisibleRowIndex === -1) {
            // No visible rows in span - cells will be hidden
            console.log(`Row ${rowIndex} (HIDDEN): ${cellsWithRowspan.length} cells with rowspan, all target rows hidden`);
            return;
        }

        // Cells need to be moved to firstVisibleRowIndex
        const targetRow = rows[firstVisibleRowIndex];
        console.log(`\nRow ${rowIndex} (HIDDEN): Moving ${cellsWithRowspan.length} cells to row ${firstVisibleRowIndex}`);
        console.log(`  Source row cells: ${row.cells.map(c => c.type).join(', ')}`);
        console.log(`  Target row cells: ${targetRow.cells.map(c => c.type).join(', ')}`);

        // Check for duplicate cell types
        cellsWithRowspan.forEach(cell => {
            const targetHasType = targetRow.cells.some(c => c.type === cell.type);
            if (targetHasType) {
                const issue = `❌ DUPLICATE: Target row ${firstVisibleRowIndex} already has ${cell.type} cell!`;
                console.log(`  ${issue}`);
                issues.push({
                    type: 'duplicate_cell',
                    sourceRow: rowIndex,
                    targetRow: firstVisibleRowIndex,
                    cellType: cell.type,
                    message: issue
                });
            } else {
                console.log(`  ✓ ${cell.type} cell can be moved (no duplicate)`);
            }
        });
    });

    return issues;
}

/**
 * Run all test scenarios
 */
function runAllTests() {
    console.log('='.repeat(80));
    console.log('TEST: Issue #417 - Filter combinations test');
    console.log('='.repeat(80));

    const { rows } = generateTableStructure();

    // Display initial structure
    console.log('\n=== INITIAL TABLE STRUCTURE ===');
    rows.slice(0, 15).forEach(row => {
        const cellTypes = row.cells.map(c => `${c.type}(${c.value})`).join(' | ');
        console.log(`Row ${row.rowIndex}: ${cellTypes}`);
    });
    console.log(`... (showing first 15 of ${rows.length} rows)\n`);

    const testScenarios = [
        { type: 'product', value: 'Заполнение', description: 'Filter by product "Заполнение"' },
        { type: 'product', value: 'Каркас', description: 'Filter by product "Каркас"' },
        { type: 'product', value: 'Примыкания', description: 'Filter by product "Примыкания"' },
        { type: 'estimate', value: 'Монтаж заполнений', description: 'Filter by estimate "Монтаж заполнений"' },
        { type: 'estimate', value: 'Монтаж каркаса', description: 'Filter by estimate "Монтаж каркаса"' },
    ];

    const allIssues = [];

    testScenarios.forEach((scenario, index) => {
        console.log('\n' + '='.repeat(80));
        console.log(`TEST SCENARIO ${index + 1}: ${scenario.description}`);
        console.log('='.repeat(80));

        // Reset visibility
        rows.forEach(row => row.visible = true);

        // Apply filter
        const filterResult = applyFilter(rows, scenario.type, scenario.value);

        // Check rowspan adjustments
        const issues = adjustRowspansAfterFilter(rows);

        if (issues.length > 0) {
            console.log(`\n⚠️  FOUND ${issues.length} ISSUES:`);
            issues.forEach(issue => {
                console.log(`   ${issue.message}`);
            });
            allIssues.push({ scenario, issues });
        } else {
            console.log('\n✅ No issues detected for this scenario');
        }
    });

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));

    if (allIssues.length === 0) {
        console.log('✅ All test scenarios passed - no table breaking issues detected');
    } else {
        console.log(`❌ Found issues in ${allIssues.length} scenario(s):\n`);
        allIssues.forEach(({ scenario, issues }) => {
            console.log(`  ${scenario.description}:`);
            issues.forEach(issue => {
                console.log(`    - ${issue.message}`);
            });
        });

        console.log('\n⚠️  These duplicate cells will cause the table layout to break!');
    }

    return allIssues.length === 0;
}

// Run tests
const success = runAllTests();
process.exit(success ? 0 : 1);
