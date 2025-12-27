/**
 * Test experiment for Issue #82
 *
 * Issue: При перетаскивании сохранять надо только порядок перетащенного элемента,
 *        остальные будет пересчитаны бэкендом
 *
 * Translation: When dragging, only the order of the dragged element should be saved,
 *              the rest will be recalculated by the backend
 *
 * PROBLEM:
 * The previous implementation (Issue #72) updated the order for ALL siblings after a drag-and-drop:
 * - If you had 5 tasks and dragged task #5 to position #2
 * - The code would send 5 API requests: one for each task
 * - This was inefficient and could cause race conditions
 *
 * SOLUTION:
 * Now the code only sends ONE API request for the dragged element:
 * - If you drag task #5 to position #2
 * - Only task #5's order is updated to 2
 * - The backend automatically recalculates the order for tasks #2, #3, and #4
 *
 * KEY CHANGES in projects.js (saveOrder function):
 *
 * BEFORE (Issue #72 implementation - lines 448-478):
 * ```javascript
 * const updatePromises = siblings.map((sibling, index) => {
 *     const id = isTask ? sibling.dataset.taskId : sibling.dataset.operationId;
 *     const newOrder = index + 1;
 *     sibling.dataset.order = newOrder;
 *
 *     const url = `https://${window.location.host}/${db}/_m_ord/${id}?JSON&order=${newOrder}`;
 *     return fetch(url, { method: 'POST', body: formData });
 * });
 * Promise.all(updatePromises).then(...)
 * ```
 * This sent N API requests (one for each sibling).
 *
 * AFTER (Issue #82 implementation - lines 444-482):
 * ```javascript
 * const newOrder = siblings.indexOf(element) + 1;
 * element.dataset.order = newOrder;
 *
 * const url = `https://${window.location.host}/${db}/_m_ord/${elementId}?JSON&order=${newOrder}`;
 * fetch(url, { method: 'POST', body: formData })
 *     .then(response => response.json())
 *     .then(data => {
 *         loadProjectDetails(selectedProject['ПроектID']);
 *     });
 * ```
 * This sends only 1 API request for the dragged element.
 *
 * BENEFITS:
 * 1. Reduced API calls: From N requests to 1 request
 * 2. Better performance: Less network traffic
 * 3. No race conditions: Backend controls order recalculation
 * 4. Simpler code: No Promise.all() needed
 * 5. Clearer responsibility: Frontend moves, backend recalculates
 *
 * TEST SCENARIO:
 * 1. Open a project with multiple tasks
 * 2. Drag task from position 5 to position 2
 * 3. Open browser DevTools Network tab
 * 4. Verify only ONE POST request to /_m_ord/{taskId}?order=2
 * 5. Verify after reload, all tasks have correct sequential order
 *
 * EXPECTED API CALL:
 * POST https://host/db/_m_ord/12345?JSON&order=2
 * (where 12345 is the dragged task ID)
 *
 * Backend should then:
 * - Update task 12345 to order 2
 * - Shift task at order 2 to order 3
 * - Shift task at order 3 to order 4
 * - Shift task at order 4 to order 5
 */

console.log('Issue #82 test experiment loaded');
console.log('This file documents the change from saving all siblings to saving only the dragged element');
