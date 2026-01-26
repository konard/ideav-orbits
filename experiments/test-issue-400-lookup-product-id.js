/**
 * Test for Issue #400: Calculate Product ID by name when creating operation
 *
 * Problem: When creating a new operation on form id="addOperationsModalBackdrop",
 *          we need to look up ИзделиеID (Product ID) by product name from
 *          report/7202 (allProductsReference) and send it as parameter t6700.
 *
 * Issue description:
 * "При создании новой операции на форме id="addOperationsModalBackdrop"
 *  вычислять id Изделия по его имени
 *
 *  Найти ИзделиеID в результатах запроса report/7202 по имени
 *  Изделие={текущее Изделие} и отправить это ИзделиеID как параметр
 *  с именем t6700."
 */

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  Test: Issue #400 - Lookup Product ID by Name            ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');

console.log('=== Problem Description ===');
console.log('When creating a new operation, we need to:');
console.log('1. Get the current product name');
console.log('2. Look up ИзделиеID in report/7202 results (allProductsReference)');
console.log('3. Match by: Изделие = current product name');
console.log('4. Send this ИзделиеID as parameter t6700');
console.log('');

console.log('=== Current Implementation ===');
console.log('');
console.log('Function: saveNewOperation()');
console.log('Location: project.js around line 5349');
console.log('');
console.log('OLD CODE:');
console.log('  const productId = document.getElementById("operationProduct").value;');
console.log('  ...');
console.log('  if (productId) {');
console.log('    formData.append("t6700", productId);');
console.log('  }');
console.log('');
console.log('Problem: productId comes from dropdown value, which might be:');
console.log('  - Set from currentOperationsContext.productId');
console.log('  - Empty string if "Пустое значение" selected');
console.log('  - Not validated against allProductsReference');
console.log('');

console.log('=== Data Source ===');
console.log('');
console.log('report/7202 → allProductsReference');
console.log('Loaded in: loadAllProductsReference() at line 131');
console.log('');
console.log('Structure:');
console.log('[');
console.log('  {');
console.log('    "ИзделиеID": "1234",');
console.log('    "Изделие": "Каркас",');
console.log('    ... other fields');
console.log('  },');
console.log('  {');
console.log('    "ИзделиеID": "5678",');
console.log('    "Изделие": "Заполнение",');
console.log('    ... other fields');
console.log('  }');
console.log(']');
console.log('');

console.log('=== The Fix ===');
console.log('');
console.log('NEW CODE:');
console.log('  const productSelectValue = document.getElementById("operationProduct").value;');
console.log('  ');
console.log('  // Fix for issue #400: Look up ИзделиеID by product name');
console.log('  let productId = null;');
console.log('  if (productSelectValue) {');
console.log('    // Use the selected value (already a product ID)');
console.log('    productId = productSelectValue;');
console.log('  } else if (currentOperationsContext.productName) {');
console.log('    // Look up by product name in allProductsReference');
console.log('    const productName = currentOperationsContext.productName;');
console.log('    const matchingProduct = allProductsReference.find(p =>');
console.log('      p["Изделие"] && p["Изделие"].trim() === productName.trim()');
console.log('    );');
console.log('    ');
console.log('    if (matchingProduct && matchingProduct["ИзделиеID"]) {');
console.log('      productId = matchingProduct["ИзделиеID"];');
console.log('      console.log(`Found product ID ${productId} for "${productName}"`);');
console.log('    } else {');
console.log('      console.warn(`Could not find ID for "${productName}"`);');
console.log('    }');
console.log('  }');
console.log('  ');
console.log('  // Send to API');
console.log('  if (productId) {');
console.log('    formData.append("t6700", productId);');
console.log('  }');
console.log('');

console.log('=== How It Works ===');
console.log('');
console.log('Scenario 1: Product selected from dropdown');
console.log('  - productSelectValue = "1234" (the product ID)');
console.log('  - Use this directly as productId');
console.log('  - Send t6700=1234');
console.log('');
console.log('Scenario 2: No product selected (empty value)');
console.log('  - productSelectValue = ""');
console.log('  - currentOperationsContext.productName = "Каркас"');
console.log('  - Search allProductsReference for Изделие="Каркас"');
console.log('  - Found: { ИзделиеID: "1234", Изделие: "Каркас" }');
console.log('  - productId = "1234"');
console.log('  - Send t6700=1234');
console.log('');
console.log('Scenario 3: Product not found');
console.log('  - productSelectValue = ""');
console.log('  - currentOperationsContext.productName = "Unknown Product"');
console.log('  - Search allProductsReference → not found');
console.log('  - productId = null');
console.log('  - Do NOT send t6700 parameter');
console.log('  - Console warning logged');
console.log('');

console.log('=== API Call ===');
console.log('');
console.log('POST: /_m_new/700?JSON&up=1');
console.log('Parameters:');
console.log('  _xsrf: {token}              ← XSRF token');
console.log('  t700: "Операция название"   ← Operation name');
console.log('  t6700: "1234"               ← Product ID (from lookup)');
console.log('  t5244: "101,102"            ← Work types (comma-separated)');
console.log('  t1043: "Описание"           ← Description');
console.log('');

console.log('=== Expected Behavior ===');
console.log('✓ Product ID correctly looked up from allProductsReference');
console.log('✓ Matching by product name (exact match, trimmed)');
console.log('✓ t6700 parameter sent with correct ИзделиеID');
console.log('✓ Console logging for debugging');
console.log('✓ Handles case when product not found (productId = null)');
console.log('');

console.log('=== Testing ===');
console.log('1. Open project page');
console.log('2. Click on a product to view operations');
console.log('3. Click "+ Добавить операции" button');
console.log('4. Click "Создать операцию" button');
console.log('5. Fill in operation form');
console.log('6. Submit form');
console.log('7. Check console log for product ID lookup message');
console.log('8. Check network tab for POST request to _m_new/700');
console.log('9. Verify t6700 parameter has correct ИзделиеID');
