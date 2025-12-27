/**
 * Test experiment for Issue #94: Incorrect order calculation for operations
 *
 * Issue: https://github.com/ideav/orbits/issues/94
 * Title: Неверно вычислен order для операции _m_ord/3985?JSON&order=11
 *
 * PROBLEM:
 * When dragging operation #4 to position #2 within a task that has 4 operations,
 * the system was sending order=11 instead of order=2.
 *
 * ROOT CAUSE:
 * The saveOrder() function was counting ALL operations across ALL tasks in the project,
 * not just operations within the same task.
 *
 * EXAMPLE SCENARIO (from the issue):
 * Project has multiple tasks:
 * - Task 1: "Сборка каркаса" with 2 operations
 * - Task 2: "Установка каркаса" with 2 operations
 * - Task 3: "Монтаж стеклопакетов" with 4 operations
 *   - Operation 1: order=1
 *   - Operation 2: order=2
 *   - Operation 3: order=3
 *   - Operation 4: order=4 (ID=3985)
 * - Task 4: with some operations
 *
 * HTML Structure (ALL in same parent container):
 * <div class="task-list">
 *   <div class="task-item" data-task-id="1">Task 1</div>
 *   <div class="operation-item" data-operation-id="100">Op 1 of Task 1</div>
 *   <div class="operation-item" data-operation-id="101">Op 2 of Task 1</div>
 *   <div class="task-item" data-task-id="2">Task 2</div>
 *   <div class="operation-item" data-operation-id="200">Op 1 of Task 2</div>
 *   <div class="operation-item" data-operation-id="201">Op 2 of Task 2</div>
 *   <div class="task-item" data-task-id="3">Task 3 - Монтаж стеклопакетов</div>
 *   <div class="operation-item" data-operation-id="3982">Op 1 of Task 3</div>
 *   <div class="operation-item" data-operation-id="3983">Op 2 of Task 3</div>
 *   <div class="operation-item" data-operation-id="3984">Op 3 of Task 3</div>
 *   <div class="operation-item" data-operation-id="3985">Op 4 of Task 3</div> <!-- This is being dragged -->
 *   ...more tasks and operations...
 * </div>
 *
 * BEFORE FIX (projects.js line 691-693):
 * ```javascript
 * const siblings = Array.from(element.parentNode.children).filter(el =>
 *     el.classList.contains(isTask ? 'task-item' : 'operation-item')
 * );
 * ```
 * This returned ALL operations in the project (e.g., 11 operations total),
 * so siblings.indexOf(element) returned 10 (0-indexed), and newOrder = 10 + 1 = 11
 *
 * AFTER FIX (projects.js line 691-704):
 * ```javascript
 * let siblings;
 * if (isTask) {
 *     // For tasks, get all task items
 *     siblings = Array.from(element.parentNode.children).filter(el =>
 *         el.classList.contains('task-item')
 *     );
 * } else {
 *     // For operations, only get operations within the same task
 *     const parentTaskId = element.dataset.taskId;
 *     console.log(`[SAVE_ORDER] Operation belongs to task: ${parentTaskId}`);
 *     siblings = Array.from(element.parentNode.children).filter(el =>
 *         el.classList.contains('operation-item') && el.dataset.taskId === parentTaskId
 *     );
 * }
 * ```
 * This returns only operations within the same task (e.g., 4 operations for Task 3),
 * so when dragging operation #4 to position #2, siblings.indexOf(element) returns 1,
 * and newOrder = 1 + 1 = 2 (CORRECT!)
 *
 * CHANGES MADE:
 * 1. Added data-task-id attribute to operation elements (projects.js line 536)
 *    - Changed: <div class="operation-item" data-operation-id="${op['ОперацияID']}" ...>
 *    - To: <div class="operation-item" data-operation-id="${op['ОперацияID']}" data-task-id="${taskId}" ...>
 *
 * 2. Updated saveOrder() function to filter operations by parent task ID (projects.js lines 691-704)
 *    - For tasks: counts all tasks (no change)
 *    - For operations: counts only operations with matching data-task-id attribute
 *
 * BENEFITS:
 * - Operations are now correctly numbered within their parent task
 * - Order calculation is independent for each task's operations
 * - Prevents incorrect order values that exceed the actual operation count
 * - Maintains backward compatibility with task ordering
 *
 * TEST SCENARIO:
 * 1. Create a project with multiple tasks, each having multiple operations
 * 2. Navigate to Task 3 with 4 operations
 * 3. Drag operation #4 to position #2
 * 4. Open browser DevTools Network tab
 * 5. Verify POST request shows: /_m_ord/3985?JSON&order=2 (NOT order=11)
 * 6. After reload, verify all operations maintain correct sequential order within their task
 *
 * EXPECTED API CALL:
 * POST https://integram.io/orbits/_m_ord/3985?JSON&order=2
 *
 * Backend will then:
 * - Update operation 3985 to order 2
 * - Recalculate order for other operations in the same task
 */

console.log('Issue #94 test experiment loaded');
console.log('This file documents the fix for incorrect operation order calculation');
console.log('Key insight: Operations must be counted only within their parent task, not across all tasks');
