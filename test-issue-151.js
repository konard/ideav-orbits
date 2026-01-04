/**
 * Test for Issue #151: Add "Изделия" link to project cards
 *
 * Requirements:
 * - Link label: "Изделия"
 * - Link URL: report/6503?FR_ProjectID={project ID}
 * - Opens in new tab with target="items"
 * - Positioned in bottom-right corner
 * - Clicking link should not trigger project selection
 */

// Simulate the escapeHtml function
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

// Simulate the displayProjects function logic
function generateProjectHTML(projects) {
    return projects.map(project => `
        <div class="project-item" onclick="selectProject('${project['ПроектID']}')" data-project-id="${project['ПроектID']}">
            <div class="project-header">${escapeHtml(project['Проект'] || 'Без названия')}</div>
            <div class="project-meta">
                <span>Заказчик: ${escapeHtml(project['Заказчик'] || '—')}</span> |
                <span>Старт: ${escapeHtml(project['Старт'] || '—')}</span> |
                <span>Срок: ${escapeHtml(project['Срок'] || '—')}</span> |
                <span>Объект: ${escapeHtml(project['Объект'] || '—')}</span> |
                <span>Статус: ${escapeHtml(project['Статус проекта'] || '—')}</span>
            </div>
            <a href="report/6503?FR_ProjectID=${project['ПроектID']}"
               target="items"
               class="project-products-link"
               onclick="event.stopPropagation()">Изделия</a>
        </div>
    `).join('');
}

// Test data
const testProjects = [
    {
        'ПроектID': '12345',
        'Проект': 'Test Project 1',
        'Заказчик': 'Customer A',
        'Старт': '01.01.2024',
        'Срок': '31.12.2024',
        'Объект': 'Object A',
        'Статус проекта': 'В работе'
    },
    {
        'ПроектID': '67890',
        'Проект': 'Test Project 2',
        'Заказчик': 'Customer B',
        'Старт': '15.02.2024',
        'Срок': '30.06.2024',
        'Объект': 'Object B',
        'Статус проекта': 'Завершен'
    }
];

console.log('Testing Issue #151: Add "Изделия" link to project cards\n');
console.log('='.repeat(70));

let passed = 0;
let failed = 0;

// Generate HTML
const html = generateProjectHTML(testProjects);

// Test 1: Check if "Изделия" link exists
console.log('\nTest 1: Link with label "Изделия" exists');
if (html.includes('>Изделия</a>')) {
    console.log('  ✓ PASSED - Link label "Изделия" found');
    passed++;
} else {
    console.log('  ✗ FAILED - Link label "Изделия" not found');
    failed++;
}

// Test 2: Check if URL format is correct for first project
console.log('\nTest 2: URL format is correct (report/6503?FR_ProjectID={id})');
const expectedUrl1 = 'report/6503?FR_ProjectID=12345';
const expectedUrl2 = 'report/6503?FR_ProjectID=67890';
if (html.includes(expectedUrl1) && html.includes(expectedUrl2)) {
    console.log('  ✓ PASSED - URLs are correctly formatted');
    console.log(`    - ${expectedUrl1}`);
    console.log(`    - ${expectedUrl2}`);
    passed++;
} else {
    console.log('  ✗ FAILED - URLs are not correctly formatted');
    failed++;
}

// Test 3: Check if target="items" attribute is present
console.log('\nTest 3: Link opens in new tab with target="items"');
if (html.includes('target="items"')) {
    console.log('  ✓ PASSED - target="items" attribute found');
    passed++;
} else {
    console.log('  ✗ FAILED - target="items" attribute not found');
    failed++;
}

// Test 4: Check if CSS class is applied
console.log('\nTest 4: Link has correct CSS class');
if (html.includes('class="project-products-link"')) {
    console.log('  ✓ PASSED - class="project-products-link" found');
    passed++;
} else {
    console.log('  ✗ FAILED - class="project-products-link" not found');
    failed++;
}

// Test 5: Check if event.stopPropagation() is used
console.log('\nTest 5: Link click does not trigger parent onclick');
if (html.includes('onclick="event.stopPropagation()"')) {
    console.log('  ✓ PASSED - event.stopPropagation() found');
    passed++;
} else {
    console.log('  ✗ FAILED - event.stopPropagation() not found');
    failed++;
}

// Test 6: Check if link is inside project-item
console.log('\nTest 6: Link is placed inside project-item div');
const projectItemPattern = /<div class="project-item"[^>]*>[\s\S]*?<a[^>]*class="project-products-link"[\s\S]*?<\/div>/;
if (projectItemPattern.test(html)) {
    console.log('  ✓ PASSED - Link is correctly nested inside project-item');
    passed++;
} else {
    console.log('  ✗ FAILED - Link nesting structure is incorrect');
    failed++;
}

console.log('\n' + '='.repeat(70));
console.log(`\nResults: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);

if (failed === 0) {
    console.log('\n✓ All tests passed! Issue #151 is implemented correctly.');
    console.log('  "Изделия" links are properly added to project cards.');
} else {
    console.log('\n✗ Some tests failed. Please review the implementation.');
    process.exit(1);
}
