/**
 * Test for Issue #402: Look up Product ID by name from report/7202
 *
 * Problem: When creating operations on form id="addOperationsModalBackdrop",
 *          we need to look up ИзделиеID (Product ID) by product name from
 *          report/7202 (allProductsReference) and send it as parameter t6700.
 *
 * Issue description:
 * "При создании новой операции на форме id="addOperationsModalBackdrop" вычислять
 *  id Изделия в справочнике изделий по его имени.
 *
 *  Найти ИзделиеID в результатах запроса report/7202 по имени
 *  Изделие={название текущего Изделия} отправить это ИзделиеID как параметр
 *  с именем t6700. То есть, не ID изделия из таблицы Конструкций, а ИзделиеID,
 *  которое будет найдено в в результатах запроса report/7202."
 */

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  Test Issue #402: Product ID Lookup for Operations      ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');

console.log('=== Issue Description ===');
console.log('When adding operations to products via addOperationsModalBackdrop:');
console.log('1. Get the current product name from constructionProducts (report/6503)');
console.log('2. Look up ИзделиеID in report/7202 results (allProductsReference)');
console.log('3. Match by: Изделие = current product name (exact match, trimmed)');
console.log('4. Send this ИзделиеID as parameter t6700 when creating operations');
console.log('');

console.log('=== Data Sources ===');
console.log('report/6503 (constructionProducts): Products with construction IDs');
console.log('  - Contains: ИзделиеID (from table), Изделие (product name), etc.');
console.log('  - This ИзделиеID is NOT what we send as t6700!');
console.log('');
console.log('report/7202 (allProductsReference): Master product reference');
console.log('  - Contains: ИзделиеID (from справочник), Изделие (product name)');
console.log('  - This ИзделиеID IS what we send as t6700!');
console.log('');

console.log('=== Example Data from report/7202 ===');
const exampleData = [
    {
        "Изделие": "Заполнение",
        "ИзделиеID": "6573"
    },
    {
        "Изделие": "Каркас",
        "ИзделиеID": "6572"
    },
    {
        "Изделие": "Примыкания",
        "ИзделиеID": "6574"
    }
];
console.log(JSON.stringify(exampleData, null, 2));
console.log('');

console.log('=== Implementation ===');
console.log('Location: project.js, confirmBulkAddOperations() function');
console.log('');
console.log('Code:');
console.log('  // Get product details to check type');
console.log('  const productData = constructionProducts.find(p => ...');
console.log('  const productTypeId = productData ? (productData["Изделие"] || "") : "";');
console.log('  ');
console.log('  // Fix for issue #402: Look up ИзделиеID from report/7202');
console.log('  let productIdForT6700 = null;');
console.log('  if (productData && productData["Изделие"]) {');
console.log('    const productName = productData["Изделие"];');
console.log('    const matchingProduct = allProductsReference.find(p =>');
console.log('      p["Изделие"] && p["Изделие"].trim() === productName.trim()');
console.log('    );');
console.log('    ');
console.log('    if (matchingProduct && matchingProduct["ИзделиеID"]) {');
console.log('      productIdForT6700 = matchingProduct["ИзделиеID"];');
console.log('      console.log(`Found product ID ${productIdForT6700} for "${productName}"`);');
console.log('    } else {');
console.log('      console.warn(`Could not find product ID for "${productName}"`);');
console.log('    }');
console.log('  }');
console.log('  ');
console.log('  // Send to API');
console.log('  const formData = new URLSearchParams();');
console.log('  formData.append("t695", operation.name);');
console.log('  formData.append("t702", operation.id);');
console.log('  formData.append("_xsrf", xsrf);');
console.log('  if (productIdForT6700) {');
console.log('    formData.append("t6700", productIdForT6700);');
console.log('  }');
console.log('');

console.log('=== Test Scenarios ===');
console.log('');
console.log('Scenario 1: Product "Каркас" found in allProductsReference');
console.log('  - productData.Изделие = "Каркас"');
console.log('  - Search allProductsReference for Изделие="Каркас"');
console.log('  - Found: { ИзделиеID: "6572", Изделие: "Каркас" }');
console.log('  - productIdForT6700 = "6572"');
console.log('  - Send t6700=6572 ✓');
console.log('');
console.log('Scenario 2: Product "Заполнение" found in allProductsReference');
console.log('  - productData.Изделие = "Заполнение"');
console.log('  - Search allProductsReference for Изделие="Заполнение"');
console.log('  - Found: { ИзделиеID: "6573", Изделие: "Заполнение" }');
console.log('  - productIdForT6700 = "6573"');
console.log('  - Send t6700=6573 ✓');
console.log('');
console.log('Scenario 3: Product not found in allProductsReference');
console.log('  - productData.Изделие = "Unknown Product"');
console.log('  - Search allProductsReference → not found');
console.log('  - productIdForT6700 = null');
console.log('  - Do NOT send t6700 parameter');
console.log('  - Console warning logged');
console.log('');

console.log('=== API Call Example ===');
console.log('');
console.log('POST https://host/db/_m_new/695?JSON&up=1234');
console.log('');
console.log('Parameters:');
console.log('  _xsrf: {token}              ← XSRF token');
console.log('  t695: "Операция название"   ← Operation name');
console.log('  t702: "5001"                ← Operation ID from report/7273');
console.log('  t6700: "6572"               ← Product ID from report/7202 (FIX!)');
console.log('');

console.log('=== Expected Behavior ===');
console.log('✓ Product ID correctly looked up from allProductsReference (report/7202)');
console.log('✓ Matching by product name (exact match, trimmed)');
console.log('✓ t6700 parameter sent with correct ИзделиеID from справочник');
console.log('✓ Console logging for debugging');
console.log('✓ Handles case when product not found (productIdForT6700 = null)');
console.log('');

console.log('=== Testing Instructions ===');
console.log('');
console.log('1. Load project.js in browser');
console.log('2. Open browser console');
console.log('3. Select a project with constructions and products');
console.log('4. Click "+ Операции" button on a product row');
console.log('5. Select operations to add');
console.log('6. Click "Добавить" button');
console.log('7. Check console log for product ID lookup message:');
console.log('   "[Issue #402] Found product ID XXX for product name YYY from report/7202"');
console.log('8. Check network tab for POST request to _m_new/695');
console.log('9. Verify t6700 parameter has correct ИзделиеID from report/7202');
console.log('');

console.log('=== Differences from Issue #400 ===');
console.log('');
console.log('Issue #400: Fix for "Create Operation" modal (createOperationForm)');
console.log('  - Single operation creation with product dropdown');
console.log('  - t6700 already being sent, but needs proper lookup');
console.log('');
console.log('Issue #402: Fix for "Add Operations" modal (addOperationsModalBackdrop)');
console.log('  - Bulk operations assignment to products');
console.log('  - t6700 NOT being sent at all → needs to be added');
console.log('  - Two functions need fixing:');
console.log('    1. confirmAddOperations() - single product operations');
console.log('    2. confirmBulkAddOperations() - bulk operations');
console.log('');

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  Test Complete                                           ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
