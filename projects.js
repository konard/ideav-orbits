/**
 * Projects Workspace - Project Management System
 * Handles project creation, task management, and operation tracking
 */

// Global state
let allProjects = [];
let selectedProject = null;
let projectDetails = [];
let dictionaries = {
    clients: [],
    projectStatuses: [],
    taskStatuses: [],
    units: [],
    operationTemplates: [],
    objects: [],
    directions: [],
    workTypes: []
};
let deleteModeActive = false;
let selectedItemsForDeletion = new Set();

// State for remembering Direction and Work Type selections per task
let lastOperationFilters = {
    taskId: null,
    direction: '',
    workType: '',
    templateFilter: false
};

/**
 * Initialize the projects workspace
 */
function initProjectsWorkspace() {
    // Check if user is guest and redirect to login
    if (typeof uid !== 'undefined' && (uid === '' || uid === 'guest')) {
        window.location.href = `https://${window.location.host}/${db}/login`;
        return;
    }

    // Load all necessary data
    loadDictionaries();
    loadProjects();
    loadAllProducts();
}

/**
 * Load all dictionaries (справочники)
 */
function loadDictionaries() {
    // Load clients (Заказчики)
    fetch(`https://${window.location.host}/${db}/report/6031?JSON_KV`)
        .then(response => response.json())
        .then(data => {
            // For units dictionary
            dictionaries.units = data;
            populateSelect('projectUnit', data, 'Ед.изм.', 'Ед.изм.ID');
            populateSelect('taskUnit', data, 'Ед.изм.', 'Ед.изм.ID');
            populateSelect('operationUnit', data, 'Ед.изм.', 'Ед.изм.ID');
        })
        .catch(error => console.error('Error loading units:', error));

    // Load operation templates (Шаблоны операций)
    fetch(`https://${window.location.host}/${db}/report/6041?JSON_KV`)
        .then(response => response.json())
        .then(data => {
            dictionaries.operationTemplates = data;

            // Extract unique directions and work types
            extractDirectionsAndWorkTypes(data);

            // Populate direction dropdown
            populateDirectionSelect();

            // Don't populate operation template dropdown initially - wait for filters
            // populateSelect('operationTemplate', data, 'Операция (шаблон)', 'Операция (шаблон)ID');
        })
        .catch(error => console.error('Error loading operation templates:', error));

    // Load project statuses (Статусы проекта)
    fetch(`https://${window.location.host}/${db}/report/6052?JSON_KV`)
        .then(response => response.json())
        .then(data => {
            dictionaries.projectStatuses = data;
            populateSelect('projectStatus', data, 'Статус проекта', 'Статус проектаID');
        })
        .catch(error => console.error('Error loading project statuses:', error));

    // Load task statuses (Статусы задачи)
    fetch(`https://${window.location.host}/${db}/report/6058?JSON_KV`)
        .then(response => response.json())
        .then(data => {
            dictionaries.taskStatuses = data;
            populateSelect('taskStatus', data, 'Статус задачи', 'Статус задачиID');
        })
        .catch(error => console.error('Error loading task statuses:', error));

    // Load clients from report/6096 (Заказчики)
    fetch(`https://${window.location.host}/${db}/report/6096?JSON_KV`)
        .then(response => response.json())
        .then(data => {
            dictionaries.clients = data;
            populateSelect('projectClient', data, 'Заказчик', 'ЗаказчикID');
        })
        .catch(error => console.error('Error loading clients:', error));

    // Load objects from report/6102 (Объекты)
    fetch(`https://${window.location.host}/${db}/report/6102?JSON_KV`)
        .then(response => response.json())
        .then(data => {
            dictionaries.objects = data;
            populateSelect('projectObject', data, 'Объект', 'Объект ID');
        })
        .catch(error => console.error('Error loading objects:', error));
}

/**
 * Populate a select element with options
 */
function populateSelect(selectId, data, labelField, idField) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Clear existing options except the first one
    while (select.options.length > 1) {
        select.remove(1);
    }

    // Add new options
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item[idField];
        option.textContent = item[labelField];
        select.appendChild(option);
    });
}

/**
 * Extract unique directions and work types from operation templates
 */
function extractDirectionsAndWorkTypes(templates) {
    const directionsSet = new Set();
    const workTypesMap = new Map(); // Map direction to work types

    templates.forEach(template => {
        const direction = template['Направление'];
        const workType = template['Вид работ'];

        if (direction) {
            directionsSet.add(direction);

            if (workType) {
                if (!workTypesMap.has(direction)) {
                    workTypesMap.set(direction, new Set());
                }
                workTypesMap.get(direction).add(workType);
            }
        }
    });

    // Convert sets to arrays
    dictionaries.directions = Array.from(directionsSet).map(name => ({ name }));
    dictionaries.workTypesMap = workTypesMap;
}

/**
 * Populate direction select dropdown
 */
function populateDirectionSelect() {
    const select = document.getElementById('operationDirection');
    if (!select) return;

    // Clear existing options except the first one
    while (select.options.length > 1) {
        select.remove(1);
    }

    // Add new options
    dictionaries.directions.forEach(direction => {
        const option = document.createElement('option');
        option.value = direction.name;
        option.textContent = direction.name;
        select.appendChild(option);
    });

    // Add event listener for direction change
    select.addEventListener('change', onDirectionChange);

    // Add event listener for template filter checkbox
    const templateFilterCheckbox = document.getElementById('operationTemplateFilter');
    if (templateFilterCheckbox) {
        templateFilterCheckbox.removeEventListener('change', onTemplateFilterChange);
        templateFilterCheckbox.addEventListener('change', onTemplateFilterChange);
    }
}

/**
 * Handle direction selection change
 */
function onDirectionChange(event) {
    const selectedDirection = event.target.value;
    const workTypeSelect = document.getElementById('operationWorkType');
    const operationSelect = document.getElementById('operationTemplate');

    // Save selected direction to state
    lastOperationFilters.direction = selectedDirection;
    lastOperationFilters.workType = ''; // Reset work type when direction changes

    // Reset work type dropdown
    if (workTypeSelect) {
        while (workTypeSelect.options.length > 1) {
            workTypeSelect.remove(1);
        }
    }

    // Reset operation template dropdown
    if (operationSelect) {
        while (operationSelect.options.length > 1) {
            operationSelect.remove(1);
        }
    }

    if (!selectedDirection) {
        return;
    }

    // Populate work types for selected direction
    const workTypes = dictionaries.workTypesMap.get(selectedDirection);
    if (workTypes && workTypeSelect) {
        Array.from(workTypes).forEach(workType => {
            const option = document.createElement('option');
            option.value = workType;
            option.textContent = workType;
            workTypeSelect.appendChild(option);
        });

        // Add event listener for work type change
        workTypeSelect.removeEventListener('change', onWorkTypeChange);
        workTypeSelect.addEventListener('change', onWorkTypeChange);
    }

    // If no work types exist for this direction, filter operations directly
    if (!workTypes || workTypes.size === 0) {
        const templateFilter = document.getElementById('operationTemplateFilter')?.checked || false;
        filterOperationTemplates(selectedDirection, null, templateFilter);
    }
}

/**
 * Handle work type selection change
 */
function onWorkTypeChange(event) {
    const selectedDirection = document.getElementById('operationDirection').value;
    const selectedWorkType = event.target.value;

    // Save selected work type to state
    lastOperationFilters.workType = selectedWorkType;

    const templateFilter = document.getElementById('operationTemplateFilter')?.checked || false;
    filterOperationTemplates(selectedDirection, selectedWorkType, templateFilter);
}

/**
 * Handle template filter checkbox change
 */
function onTemplateFilterChange(event) {
    const selectedDirection = document.getElementById('operationDirection').value;
    const selectedWorkType = document.getElementById('operationWorkType').value;
    const templateFilter = event.target.checked;

    // Save template filter state
    lastOperationFilters.templateFilter = templateFilter;

    filterOperationTemplates(selectedDirection, selectedWorkType, templateFilter);
}

/**
 * Get filtered operation templates based on direction, work type, and template filter
 */
function getFilteredOperationTemplates(direction, workType, templateFilter) {
    return dictionaries.operationTemplates.filter(template => {
        const matchesDirection = !direction || template['Направление'] === direction;
        const matchesWorkType = !workType || template['Вид работ'] === workType;
        // If templateFilter is checked, only show templates with "Шаблонная" === "X"
        // If templateFilter is not checked, show all templates
        const matchesTemplateFilter = !templateFilter || template['Шаблонная'] === 'X';
        return matchesDirection && matchesWorkType && matchesTemplateFilter;
    });
}

/**
 * Filter operation templates based on direction, work type, and template filter
 */
function filterOperationTemplates(direction, workType, templateFilter) {
    const operationSelect = document.getElementById('operationTemplate');
    if (!operationSelect) return;

    // Clear existing options except the first one
    while (operationSelect.options.length > 1) {
        operationSelect.remove(1);
    }

    // Get filtered templates
    const filteredTemplates = getFilteredOperationTemplates(direction, workType, templateFilter);

    // Populate filtered options
    filteredTemplates.forEach(template => {
        const option = document.createElement('option');
        option.value = template['Операция (шаблон)ID'];
        option.textContent = template['Операция (шаблон)'];
        operationSelect.appendChild(option);
    });
}

/**
 * Reset operation filter dropdowns
 */
function resetOperationFilters() {
    // Reset direction
    const directionSelect = document.getElementById('operationDirection');
    if (directionSelect) {
        directionSelect.value = '';
    }

    // Reset work type
    const workTypeSelect = document.getElementById('operationWorkType');
    if (workTypeSelect) {
        workTypeSelect.value = '';
        while (workTypeSelect.options.length > 1) {
            workTypeSelect.remove(1);
        }
    }

    // Reset template filter checkbox
    const templateFilterCheckbox = document.getElementById('operationTemplateFilter');
    if (templateFilterCheckbox) {
        templateFilterCheckbox.checked = false;
    }

    // Reset operation template
    const operationSelect = document.getElementById('operationTemplate');
    if (operationSelect) {
        operationSelect.value = '';
        while (operationSelect.options.length > 1) {
            operationSelect.remove(1);
        }
    }
}

/**
 * Restore operation filter dropdowns from saved state
 */
function restoreOperationFilters() {
    const directionSelect = document.getElementById('operationDirection');
    const workTypeSelect = document.getElementById('operationWorkType');
    const templateFilterCheckbox = document.getElementById('operationTemplateFilter');

    // Restore template filter checkbox
    if (templateFilterCheckbox) {
        templateFilterCheckbox.checked = lastOperationFilters.templateFilter || false;
    }

    // Restore direction if it was previously selected
    if (lastOperationFilters.direction && directionSelect) {
        directionSelect.value = lastOperationFilters.direction;

        // Trigger direction change to populate work types
        const event = new Event('change');
        directionSelect.dispatchEvent(event);

        // After work types are populated, restore work type selection
        if (lastOperationFilters.workType && workTypeSelect) {
            // Need to wait a bit for the work type dropdown to be populated
            setTimeout(() => {
                workTypeSelect.value = lastOperationFilters.workType;

                // Trigger work type change to filter operations
                const workTypeEvent = new Event('change');
                workTypeSelect.dispatchEvent(workTypeEvent);
            }, 0);
        }
    }
}

/**
 * Load all projects
 */
function loadProjects() {
    fetch(`https://${window.location.host}/${db}/report/4472?JSON_KV`)
        .then(response => response.json())
        .then(data => {
            allProjects = data;
            displayProjects(data);
        })
        .catch(error => {
            console.error('Error loading projects:', error);
            alert('Ошибка загрузки проектов');
        });
}

/**
 * Display projects in the list
 */
function displayProjects(projects) {
    const projectList = document.getElementById('projectList');
    if (!projectList) return;

    if (projects.length === 0) {
        projectList.innerHTML = '<div style="padding: 20px; text-align: center; color: #6c757d;">Проекты не найдены</div>';
        return;
    }

    projectList.innerHTML = projects.map(project => `
        <div class="project-item" onclick="selectProject('${project['ПроектID']}')" data-project-id="${project['ПроектID']}">
            <div class="project-header">${escapeHtml(project['Проект'] || 'Без названия')}</div>
            <div class="project-meta">
                <span>Заказчик: ${escapeHtml(project['Заказчик'] || '—')}</span> |
                <span>Старт: ${escapeHtml(project['Старт'] || '—')}</span> |
                <span>Срок: ${escapeHtml(project['Срок'] || '—')}</span> |
                <span>Объект: ${escapeHtml(project['Объект'] || '—')}</span> |
                <span>Статус: ${escapeHtml(project['Статус проекта'] || '—')}</span>
            </div>
        </div>
    `).join('');
}

/**
 * Filter projects based on search input
 */
function filterProjects() {
    const searchTerm = document.getElementById('projectSearch').value.toLowerCase();

    const filtered = allProjects.filter(project => {
        return Object.values(project).some(value =>
            value && value.toString().toLowerCase().includes(searchTerm)
        );
    });

    displayProjects(filtered);
}

/**
 * Filter tasks and operations based on search input
 */
function filterTasksAndOperations() {
    const searchTerm = document.getElementById('taskSearch').value.toLowerCase();

    const filtered = projectDetails.filter(item => {
        return Object.values(item).some(value =>
            value && value.toString().toLowerCase().includes(searchTerm)
        );
    });

    displayTasksAndOperations(filtered);
}

/**
 * Select a project and load its details
 */
function selectProject(projectId) {
    // Remove active class from all items
    document.querySelectorAll('.project-item').forEach(item => {
        item.classList.remove('active');
    });

    // Add active class to selected item
    const selectedItem = document.querySelector(`.project-item[data-project-id="${projectId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }

    selectedProject = allProjects.find(p => p['ПроектID'] === projectId);
    if (!selectedProject) return;

    // Update UI
    document.getElementById('selectedProjectName').textContent = selectedProject['Проект'];
    document.getElementById('taskSection').classList.add('active');

    // Load project details (tasks and operations)
    loadProjectDetails(projectId);
}

/**
 * Load project details (tasks and operations)
 */
function loadProjectDetails(projectId) {
    fetch(`https://${window.location.host}/${db}/report/5977?JSON_KV&FR_ПроектID=${projectId}`)
        .then(response => response.json())
        .then(data => {
            projectDetails = data;
            displayTasksAndOperations(data);
        })
        .catch(error => {
            console.error('Error loading project details:', error);
            alert('Ошибка загрузки задач проекта');
        });
}

/**
 * Display tasks and operations
 */
function displayTasksAndOperations(data) {
    const taskList = document.getElementById('taskList');
    if (!taskList) return;

    if (data.length === 0) {
        taskList.innerHTML = '<div style="padding: 20px; text-align: center; color: #6c757d;">Задачи не найдены</div>';
        return;
    }

    // Group by tasks
    const taskGroups = {};
    data.forEach(item => {
        const taskId = item['Задача проектаID'];
        if (!taskGroups[taskId]) {
            taskGroups[taskId] = {
                task: item,
                operations: []
            };
        }
        if (item['ОперацияID']) {
            taskGroups[taskId].operations.push(item);
        }
    });

    // Sort tasks by order
    const sortedTaskIds = Object.keys(taskGroups).sort((a, b) => {
        const orderA = parseInt(taskGroups[a].task['Задача проектаOrder'] || 0);
        const orderB = parseInt(taskGroups[b].task['Задача проектаOrder'] || 0);
        return orderA - orderB;
    });

    taskList.innerHTML = sortedTaskIds.map((taskId, index) => {
        const group = taskGroups[taskId];
        const task = group.task;
        const operations = group.operations.sort((a, b) => {
            const orderA = parseInt(a['ОперацияOrder'] || 0);
            const orderB = parseInt(b['ОперацияOrder'] || 0);
            return orderA - orderB;
        });

        const deleteCheckbox = deleteModeActive ? `<input type="checkbox" class="delete-checkbox" data-type="task" data-id="${taskId}" onchange="toggleItemSelection(this)">` : '';
        const isSelected = selectedItemsForDeletion.has(`task-${taskId}`) ? 'selected' : '';
        const operationCount = operations.length;
        const operationCountBubble = operationCount > 0 ? `<span class="operation-count-bubble">${operationCount}</span>` : '';

        let html = `
            <div class="task-item ${isSelected}" draggable="${!deleteModeActive}" data-task-id="${taskId}" data-order="${task['Задача проектаOrder']}">
                ${deleteCheckbox}
                <span class="drag-handle" style="display: ${deleteModeActive ? 'none' : 'inline'}">☰</span>
                <span class="chevron" style="display: ${deleteModeActive || operationCount === 0 ? 'none' : 'inline'}" onclick="toggleOperations('${taskId}')">></span>
                <span class="task-order">${index + 1}</span>
                <div class="task-content">
                    <strong>${escapeHtml(task['Задача проекта'] || 'Без названия')}</strong>
                    ${task['Задача Описание'] ? '<br><small>' + escapeHtml(task['Задача Описание']) + '</small>' : ''}
                    ${task['Статус задачи'] ? '<br><small>Статус: ' + escapeHtml(task['Статус задачи']) + '</small>' : ''}
                </div>
                <div class="task-actions">
                    ${operationCountBubble}
                    <button class="btn btn-sm btn-primary" onclick="showAddOperationModal('${taskId}')">+ Операция</button>
                    <button class="btn btn-sm btn-secondary" onclick="editTask('${taskId}')">Изм.</button>
                </div>
            </div>
        `;

        // Add operations
        operations.forEach((op, opIndex) => {
            if (op['ОперацияID']) {
                const opDeleteCheckbox = deleteModeActive ? `<input type="checkbox" class="delete-checkbox" data-type="operation" data-id="${op['ОперацияID']}" onchange="toggleItemSelection(this)">` : '';
                const opIsSelected = selectedItemsForDeletion.has(`operation-${op['ОперацияID']}`) ? 'selected' : '';

                html += `
                    <div class="operation-item operations-hidden ${opIsSelected}" draggable="${!deleteModeActive}" data-operation-id="${op['ОперацияID']}" data-task-id="${taskId}" data-order="${op['ОперацияOrder']}">
                        ${opDeleteCheckbox}
                        <span class="drag-handle" style="display: ${deleteModeActive ? 'none' : 'inline'}">☰</span>
                        <span class="operation-order">${opIndex + 1}</span>
                        <div class="operation-content">
                            ${escapeHtml(op['Операция'] || 'Без названия')}
                            ${op['Операция Начать'] ? '<br><small>Начать: ' + escapeHtml(op['Операция Начать']) + '</small>' : ''}
                            ${op['Операция Кол-во'] ? '<br><small>Кол-во: ' + escapeHtml(op['Операция Кол-во']) + ' ' + escapeHtml(op['Операция Ед.изм.'] || '') + '</small>' : ''}
                        </div>
                        <div class="operation-actions">
                            <button class="btn btn-sm btn-secondary" onclick="editOperation('${op['ОперацияID']}')">Изм.</button>
                        </div>
                    </div>
                `;
            }
        });

        return html;
    }).join('');

    // Update delete mode class on task list container
    if (deleteModeActive) {
        taskList.classList.add('delete-mode');
    } else {
        taskList.classList.remove('delete-mode');
    }

    // Add drag and drop handlers (only if not in delete mode)
    if (!deleteModeActive) {
        addDragAndDropHandlers();
    }
}

/**
 * Toggle visibility of operations for a specific task
 */
function toggleOperations(taskId) {
    // Find all operations for this task
    const operations = document.querySelectorAll(`.operation-item[data-task-id="${taskId}"]`);

    // Find the chevron for this task
    const taskItem = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    const chevron = taskItem ? taskItem.querySelector('.chevron') : null;

    if (operations.length === 0) return;

    // Check if operations are currently hidden
    const isHidden = operations[0].classList.contains('operations-hidden');

    // Toggle visibility
    operations.forEach(operation => {
        if (isHidden) {
            operation.classList.remove('operations-hidden');
        } else {
            operation.classList.add('operations-hidden');
        }
    });

    // Toggle chevron rotation
    if (chevron) {
        if (isHidden) {
            chevron.classList.add('expanded');
        } else {
            chevron.classList.remove('expanded');
        }
    }
}

/**
 * Add drag and drop handlers for reordering
 */
function addDragAndDropHandlers() {
    const tasks = document.querySelectorAll('.task-item');
    const operations = document.querySelectorAll('.operation-item');

    tasks.forEach(task => {
        task.addEventListener('dragstart', handleDragStart);
        task.addEventListener('dragover', handleDragOver);
        task.addEventListener('drop', handleDrop);
        task.addEventListener('dragend', handleDragEnd);
    });

    operations.forEach(operation => {
        operation.addEventListener('dragstart', handleDragStart);
        operation.addEventListener('dragover', handleDragOver);
        operation.addEventListener('drop', handleDrop);
        operation.addEventListener('dragend', handleDragEnd);
    });
}

let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';

    // Console tracing for drag start
    const isTask = this.classList.contains('task-item');
    const id = isTask ? this.dataset.taskId : this.dataset.operationId;
    console.log(`[DRAG] Start: ${isTask ? 'Task' : 'Operation'} ID=${id}, Order=${this.dataset.order}`);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    // Console tracing for drag over (throttled to avoid spam)
    if (!this._lastDragOverLog || Date.now() - this._lastDragOverLog > 500) {
        const isTask = this.classList.contains('task-item');
        const id = isTask ? this.dataset.taskId : this.dataset.operationId;
        console.log(`[DRAG] Over: ${isTask ? 'Task' : 'Operation'} ID=${id}`);
        this._lastDragOverLog = Date.now();
    }

    return false;
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    console.log('[DRAG] Drop event triggered');

    // Check if both elements are of the same type (both tasks or both operations)
    const isDraggedTask = draggedElement.classList.contains('task-item');
    const isDraggedOperation = draggedElement.classList.contains('operation-item');
    const isDropTargetTask = this.classList.contains('task-item');
    const isDropTargetOperation = this.classList.contains('operation-item');
    const isSameType = (isDraggedTask && isDropTargetTask) || (isDraggedOperation && isDropTargetOperation);

    if (draggedElement !== this && isSameType) {
        const draggedId = isDraggedTask ? draggedElement.dataset.taskId : draggedElement.dataset.operationId;
        const dropTargetId = isDropTargetTask ? this.dataset.taskId : this.dataset.operationId;

        console.log(`[DRAG] Valid drop: Moving ${isDraggedTask ? 'Task' : 'Operation'} ID=${draggedId} near ${isDropTargetTask ? 'Task' : 'Operation'} ID=${dropTargetId}`);

        // Get the bounding rectangle of the drop target
        const rect = this.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;

        // Insert before or after based on mouse position
        const insertBefore = e.clientY < midpoint;
        console.log(`[DRAG] Insert position: ${insertBefore ? 'before' : 'after'} drop target`);

        if (insertBefore) {
            this.parentNode.insertBefore(draggedElement, this);
        } else {
            this.parentNode.insertBefore(draggedElement, this.nextSibling);
        }

        console.log('[DRAG] Element moved in DOM, calling saveOrder()');
        // Save new order
        saveOrder(draggedElement);
    } else {
        if (draggedElement === this) {
            console.log('[DRAG] Drop ignored: Element dropped on itself');
        } else if (!isSameType) {
            console.log('[DRAG] Drop ignored: Different element types (task vs operation)');
        }
    }

    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');

    // Console tracing for drag end
    const isTask = this.classList.contains('task-item');
    const id = isTask ? this.dataset.taskId : this.dataset.operationId;
    console.log(`[DRAG] End: ${isTask ? 'Task' : 'Operation'} ID=${id}`);
}

/**
 * Save new order after drag and drop
 * Only saves the dragged element's new order position.
 * The backend will recalculate the order for all other elements.
 */
function saveOrder(element) {
    console.log('[SAVE_ORDER] Function called');

    const isTask = element.classList.contains('task-item');
    const elementId = isTask ? element.dataset.taskId : element.dataset.operationId;
    console.log(`[SAVE_ORDER] Element type: ${isTask ? 'Task' : 'Operation'}, ID: ${elementId}`);

    // Get all siblings of the same type to calculate the new order position
    let siblings;
    if (isTask) {
        // For tasks, get all task items
        siblings = Array.from(element.parentNode.children).filter(el =>
            el.classList.contains('task-item')
        );
    } else {
        // For operations, only get operations within the same task
        const parentTaskId = element.dataset.taskId;
        console.log(`[SAVE_ORDER] Operation belongs to task: ${parentTaskId}`);
        siblings = Array.from(element.parentNode.children).filter(el =>
            el.classList.contains('operation-item') && el.dataset.taskId === parentTaskId
        );
    }

    console.log(`[SAVE_ORDER] Found ${siblings.length} siblings of the same type`);

    // Calculate the new order for the dragged element only
    const newOrder = siblings.indexOf(element) + 1;
    console.log(`[SAVE_ORDER] Dragged element new order: ${newOrder}`);

    // Update the data-order attribute immediately for UI consistency
    element.dataset.order = newOrder;

    // Send update to server only for the dragged element
    const formData = new FormData();
    formData.append('_xsrf', xsrf);

    const url = `https://${window.location.host}/${db}/_m_ord/${elementId}?JSON&order=${newOrder}`;
    console.log(`[SAVE_ORDER] Sending API request for ${isTask ? 'task' : 'operation'} ${elementId}: ${url}`);

    fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(response => {
        console.log(`[SAVE_ORDER] API response for ${isTask ? 'task' : 'operation'} ${elementId}: Status ${response.status}`);
        return response.json();
    })
    .then(data => {
        console.log(`[SAVE_ORDER] Order updated for ${isTask ? 'task' : 'operation'} ${elementId}: ${newOrder}`, data);
        // Reload to show updated order from server (backend recalculates all orders)
        if (selectedProject) {
            console.log(`[SAVE_ORDER] Reloading project details for project ${selectedProject['ПроектID']}`);
            loadProjectDetails(selectedProject['ПроектID']);
        }
    })
    .catch(error => {
        console.error(`[SAVE_ORDER] Error updating order for ${isTask ? 'task' : 'operation'} ${elementId}:`, error);
        alert('Ошибка сохранения порядка');
        // Reload anyway to restore correct state
        if (selectedProject) {
            console.log(`[SAVE_ORDER] Reloading project details after error for project ${selectedProject['ПроектID']}`);
            loadProjectDetails(selectedProject['ПроектID']);
        }
    });
}

/**
 * Show add project modal
 */
function showAddProjectModal() {
    document.getElementById('projectModalTitle').textContent = 'Добавить проект';
    document.getElementById('projectForm').reset();
    document.getElementById('projectId').value = '';

    // Show the first tab by default
    $('#projectInfo-tab').tab('show');

    document.getElementById('projectModalBackdrop').classList.add('show');
}

/**
 * Close project modal
 */
function closeProjectModal() {
    document.getElementById('projectModalBackdrop').classList.remove('show');
}

/**
 * Edit project
 */
function editProject() {
    if (!selectedProject) return;

    document.getElementById('projectModalTitle').textContent = 'Редактировать проект';
    document.getElementById('projectId').value = selectedProject['ПроектID'];
    document.getElementById('projectName').value = selectedProject['Проект'] || '';
    document.getElementById('projectDescription').value = ''; // Not in the project list data

    // Set client if available
    const clientSelect = document.getElementById('projectClient');
    const clientOption = Array.from(clientSelect.options).find(opt =>
        opt.textContent === selectedProject['Заказчик']
    );
    if (clientOption) {
        clientSelect.value = clientOption.value;
    }

    // Set status if available
    const statusSelect = document.getElementById('projectStatus');
    const statusOption = Array.from(statusSelect.options).find(opt =>
        opt.textContent === selectedProject['Статус проекта']
    );
    if (statusOption) {
        statusSelect.value = statusOption.value;
    }

    // Set object if available
    const objectSelect = document.getElementById('projectObject');
    const objectOption = Array.from(objectSelect.options).find(opt =>
        opt.textContent === selectedProject['Объект']
    );
    if (objectOption) {
        objectSelect.value = objectOption.value;
    }

    // Set dates
    if (selectedProject['Старт']) {
        document.getElementById('projectStart').value = formatDateForInput(selectedProject['Старт']);
    }
    if (selectedProject['Срок']) {
        document.getElementById('projectDeadline').value = formatDateForInput(selectedProject['Срок']);
    }

    // Load project products
    loadProjectProducts(selectedProject['ПроектID']);

    // Show the first tab by default
    $('#projectInfo-tab').tab('show');

    document.getElementById('projectModalBackdrop').classList.add('show');
}

/**
 * Show add task modal
 */
function showAddTaskModal() {
    if (!selectedProject) return;

    document.getElementById('taskModalTitle').textContent = 'Добавить задачу';
    document.getElementById('taskForm').reset();
    document.getElementById('taskId').value = '';
    document.getElementById('taskProjectId').value = selectedProject['ПроектID'];

    // Hide delete button when adding new task
    document.getElementById('deleteTaskBtn').classList.add('hidden');

    document.getElementById('taskModalBackdrop').classList.add('show');
}

/**
 * Close task modal
 */
function closeTaskModal() {
    document.getElementById('taskModalBackdrop').classList.remove('show');
}

/**
 * Edit task
 */
function editTask(taskId) {
    const taskData = projectDetails.find(item => item['Задача проектаID'] === taskId);
    if (!taskData) return;

    document.getElementById('taskModalTitle').textContent = 'Редактировать задачу';
    document.getElementById('taskId').value = taskId;
    document.getElementById('taskProjectId').value = selectedProject['ПроектID'];
    document.getElementById('taskName').value = taskData['Задача проекта'] || '';
    document.getElementById('taskDescription').value = taskData['Задача Описание'] || '';

    // Set status
    const statusSelect = document.getElementById('taskStatus');
    const statusOption = Array.from(statusSelect.options).find(opt =>
        opt.textContent === taskData['Статус задачи']
    );
    if (statusOption) {
        statusSelect.value = statusOption.value;
    }

    // Set quantity and unit
    document.getElementById('taskQuantity').value = taskData['К-во'] || '';
    const unitSelect = document.getElementById('taskUnit');
    const unitOption = Array.from(unitSelect.options).find(opt =>
        opt.textContent === taskData['Задача Ед.изм.']
    );
    if (unitOption) {
        unitSelect.value = unitOption.value;
    }

    // Show delete button when editing existing task
    document.getElementById('deleteTaskBtn').classList.remove('hidden');

    document.getElementById('taskModalBackdrop').classList.add('show');
}

/**
 * Show add operation modal
 */
function showAddOperationModal(taskId) {
    document.getElementById('operationModalTitle').textContent = 'Добавить операцию';
    document.getElementById('operationForm').reset();
    document.getElementById('operationId').value = '';
    document.getElementById('operationTaskId').value = taskId;

    // If switching to a different task, reset filters and clear state
    if (lastOperationFilters.taskId !== taskId) {
        lastOperationFilters.taskId = taskId;
        lastOperationFilters.direction = '';
        lastOperationFilters.workType = '';
        resetOperationFilters();
    } else {
        // Same task - restore previous selections
        restoreOperationFilters();
    }

    // Hide delete button when adding new operation
    document.getElementById('deleteOperationBtn').classList.add('hidden');

    // Show filter fields for creation, hide template link
    document.getElementById('operationDirection').parentElement.style.display = 'block';
    document.getElementById('operationWorkType').parentElement.style.display = 'block';
    document.getElementById('operationTemplateFilter').parentElement.parentElement.style.display = 'block';
    document.getElementById('operationTemplate').parentElement.style.display = 'block';
    document.getElementById('operationTemplateNameGroup').style.display = 'none';

    // Enable all fields for creation
    document.getElementById('operationDirection').disabled = false;
    document.getElementById('operationWorkType').disabled = false;
    document.getElementById('operationTemplateFilter').disabled = false;

    // Hide the Операция name field for creation (it will be auto-filled from template)
    const operationNameField = document.getElementById('operationName');
    if (operationNameField) {
        operationNameField.parentElement.style.display = 'none';
    }

    document.getElementById('operationModalBackdrop').classList.add('show');
}

/**
 * Close operation modal
 */
function closeOperationModal() {
    document.getElementById('operationModalBackdrop').classList.remove('show');
}

/**
 * Edit operation
 */
function editOperation(operationId) {
    const opData = projectDetails.find(item => item['ОперацияID'] === operationId);
    if (!opData) return;

    document.getElementById('operationModalTitle').textContent = 'Редактировать операцию';
    document.getElementById('operationId').value = operationId;
    document.getElementById('operationTaskId').value = opData['Задача проектаID'];

    // Find the operation template in dictionaries
    const templateId = opData['Операция (шаблон)ID'];
    const template = dictionaries.operationTemplates.find(t =>
        t['Операция (шаблон)ID'] === templateId
    );

    // Hide filter fields in edit mode, show template name as link
    document.getElementById('operationDirection').parentElement.style.display = 'none';
    document.getElementById('operationWorkType').parentElement.style.display = 'none';
    document.getElementById('operationTemplateFilter').parentElement.parentElement.style.display = 'none';
    document.getElementById('operationTemplate').parentElement.style.display = 'none';

    // Show template name as read-only hyperlink
    const templateNameGroup = document.getElementById('operationTemplateNameGroup');
    const templateLink = document.getElementById('operationTemplateLink');
    if (template && templateId) {
        templateLink.textContent = template['Операция (шаблон)'] || opData['Операция'] || '-';
        templateLink.href = `https://${window.location.host}/${db}/edit_obj/${templateId}`;
        templateNameGroup.style.display = 'block';
    } else {
        templateNameGroup.style.display = 'none';
    }

    // Show and populate the editable Операция field
    const operationNameField = document.getElementById('operationName');
    if (operationNameField) {
        operationNameField.value = opData['Операция'] || '';
        operationNameField.parentElement.style.display = 'block';
    }

    document.getElementById('operationQuantity').value = opData['Операция Кол-во'] || '';

    // Set unit
    const unitSelect = document.getElementById('operationUnit');
    const unitOption = Array.from(unitSelect.options).find(opt =>
        opt.textContent === opData['Операция Ед.изм.']
    );
    if (unitOption) {
        unitSelect.value = unitOption.value;
    }

    // Set start time
    if (opData['Операция Начать']) {
        document.getElementById('operationStart').value = formatDateTimeForInput(opData['Операция Начать']);
    }

    // Show delete button when editing existing operation
    document.getElementById('deleteOperationBtn').classList.remove('hidden');

    document.getElementById('operationModalBackdrop').classList.add('show');
}

/**
 * Handle project form submission
 */
document.getElementById('projectForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const projectId = document.getElementById('projectId').value;
    const formData = new FormData();
    formData.append('_xsrf', xsrf);
    formData.append('t663', document.getElementById('projectName').value);
    formData.append('t664', document.getElementById('projectDescription').value);
    formData.append('t667', document.getElementById('projectClient').value);
    formData.append('t670', document.getElementById('projectStatus').value);
    formData.append('t717', document.getElementById('projectObject').value);
    formData.append('t672', document.getElementById('projectStart').value);
    formData.append('t674', document.getElementById('projectDeadline').value);
    formData.append('t677', document.getElementById('projectBudget').value);

    const url = projectId ?
        `https://${window.location.host}/${db}/_m_save/${projectId}?JSON` :
        `https://${window.location.host}/${db}/_m_new/663?JSON&up=1`;

    fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Project saved:', data);
        closeProjectModal();
        loadProjects();
    })
    .catch(error => {
        console.error('Error saving project:', error);
        alert('Ошибка сохранения проекта');
    });
});

/**
 * Handle task form submission
 */
document.getElementById('taskForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const taskId = document.getElementById('taskId').value;
    const projectId = document.getElementById('taskProjectId').value;
    const formData = new FormData();
    formData.append('_xsrf', xsrf);
    formData.append('t678', document.getElementById('taskName').value); // Задача проекта
    formData.append('t683', document.getElementById('taskDescription').value); // Описание
    formData.append('t688', document.getElementById('taskStatus').value); // Статус задачи
    formData.append('t1030', document.getElementById('taskQuantity').value); // К-во
    formData.append('t1036', document.getElementById('taskUnit').value); // Ед.изм.

    const url = taskId ?
        `https://${window.location.host}/${db}/_m_save/${taskId}?JSON` :
        `https://${window.location.host}/${db}/_m_new/678?JSON&up=${projectId}`;

    fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Task saved:', data);
        closeTaskModal();
        if (selectedProject) {
            loadProjectDetails(selectedProject['ПроектID']);
        }
    })
    .catch(error => {
        console.error('Error saving task:', error);
        alert('Ошибка сохранения задачи');
    });
});

/**
 * Create a single operation via _m_new
 */
async function createOperation(taskId, template, quantity, unit, start) {
    const formData = new FormData();
    formData.append('_xsrf', xsrf);
    formData.append('t702', template['Операция (шаблон)ID']); // Операция (шаблон)

    if (template['Операция (шаблон)']) {
        formData.append('t695', template['Операция (шаблон)']); // Имя операции из шаблона
    }

    if (quantity) {
        formData.append('t2403', quantity); // Кол-во
    }
    if (unit) {
        formData.append('t3060', unit); // Ед.изм.
    }
    if (start) {
        formData.append('t2665', start); // Начать
    }

    const url = `https://${window.location.host}/${db}/_m_new/695?JSON&up=${taskId}`;

    const response = await fetch(url, {
        method: 'POST',
        body: formData
    });

    return response.json();
}

/**
 * Handle operation form submission
 */
document.getElementById('operationForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const operationId = document.getElementById('operationId').value;
    const taskId = document.getElementById('operationTaskId').value;
    const templateId = document.getElementById('operationTemplate').value;
    const quantity = document.getElementById('operationQuantity').value;
    const unit = document.getElementById('operationUnit').value;
    const start = document.getElementById('operationStart').value;

    // If editing an existing operation
    if (operationId) {
        const formData = new FormData();
        formData.append('_xsrf', xsrf);

        // Get the operation name from the editable field
        const operationNameField = document.getElementById('operationName');
        const operationName = operationNameField ? operationNameField.value : '';

        // Save the editable Операция field (t695)
        if (operationName) {
            formData.append('t695', operationName);
        }

        // Keep the template ID if it exists (for reference)
        const opData = projectDetails.find(item => item['ОперацияID'] === operationId);
        if (opData && opData['Операция (шаблон)ID']) {
            formData.append('t702', opData['Операция (шаблон)ID']);
        }

        formData.append('t2403', quantity);
        formData.append('t3060', unit);
        if (start) {
            formData.append('t2665', start);
        }

        const url = `https://${window.location.host}/${db}/_m_save/${operationId}?JSON`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            console.log('Operation saved:', data);
            closeOperationModal();
            if (selectedProject) {
                loadProjectDetails(selectedProject['ПроектID']);
            }
        } catch (error) {
            console.error('Error saving operation:', error);
            alert('Ошибка сохранения операции');
        }
        return;
    }

    // Creating new operation(s)
    // If no specific operation is selected, add all filtered operations
    if (!templateId) {
        const direction = document.getElementById('operationDirection').value;
        const workType = document.getElementById('operationWorkType').value;
        const templateFilter = document.getElementById('operationTemplateFilter')?.checked || false;

        const filteredTemplates = getFilteredOperationTemplates(direction, workType, templateFilter);

        if (filteredTemplates.length === 0) {
            alert('Нет операций для добавления. Пожалуйста, выберите фильтры.');
            return;
        }

        // Show loading indicator
        const loadingIndicator = document.getElementById('operationLoadingIndicator');
        const saveBtn = document.getElementById('saveOperationBtn');
        const cancelBtn = document.querySelector('#operationForm .btn-secondary');

        if (loadingIndicator) loadingIndicator.classList.remove('hidden');
        if (saveBtn) saveBtn.disabled = true;
        if (cancelBtn) cancelBtn.disabled = true;

        try {
            // Add operations sequentially
            for (let i = 0; i < filteredTemplates.length; i++) {
                const template = filteredTemplates[i];
                console.log(`Adding operation ${i + 1} of ${filteredTemplates.length}:`, template['Операция (шаблон)']);
                await createOperation(taskId, template, quantity, unit, start);
            }

            console.log('All operations added successfully');
            closeOperationModal();
            if (selectedProject) {
                loadProjectDetails(selectedProject['ПроектID']);
            }
        } catch (error) {
            console.error('Error adding operations:', error);
            alert('Ошибка добавления операций');
        } finally {
            // Hide loading indicator
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            if (saveBtn) saveBtn.disabled = false;
            if (cancelBtn) cancelBtn.disabled = false;
        }
    } else {
        // Single operation selected
        const selectedTemplate = dictionaries.operationTemplates.find(t =>
            t['Операция (шаблон)ID'] === templateId
        );

        if (!selectedTemplate) {
            alert('Операция не найдена');
            return;
        }

        try {
            const data = await createOperation(taskId, selectedTemplate, quantity, unit, start);
            console.log('Operation saved:', data);
            closeOperationModal();
            if (selectedProject) {
                loadProjectDetails(selectedProject['ПроектID']);
            }
        } catch (error) {
            console.error('Error saving operation:', error);
            alert('Ошибка сохранения операции');
        }
    }
});

/**
 * Utility functions
 */

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDateForInput(dateStr) {
    // Convert "DD.MM.YYYY" to "YYYY-MM-DD"
    if (!dateStr) return '';
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return '';
}

function formatDateTimeForInput(dateTimeStr) {
    // Convert "DD.MM.YYYY HH:MM:SS" to "YYYY-MM-DDTHH:MM"
    if (!dateTimeStr) return '';
    const parts = dateTimeStr.split(' ');
    if (parts.length === 2) {
        const datePart = formatDateForInput(parts[0]);
        const timePart = parts[1].substring(0, 5); // Get HH:MM
        return `${datePart}T${timePart}`;
    }
    return '';
}

/**
 * Toggle bulk delete mode
 */
function toggleDeleteMode() {
    deleteModeActive = !deleteModeActive;
    selectedItemsForDeletion.clear();

    const toggleBtn = document.getElementById('toggleDeleteModeBtn');
    const deleteBtn = document.getElementById('deleteSelectedBtn');

    if (deleteModeActive) {
        toggleBtn.textContent = 'Отменить режим удаления';
        toggleBtn.classList.remove('btn-warning');
        toggleBtn.classList.add('btn-secondary');
    } else {
        toggleBtn.textContent = 'Групповое удаление';
        toggleBtn.classList.remove('btn-secondary');
        toggleBtn.classList.add('btn-warning');
        deleteBtn.classList.add('hidden');
    }

    // Refresh the task list to show/hide checkboxes
    if (selectedProject) {
        loadProjectDetails(selectedProject['ПроектID']);
    }
}

/**
 * Toggle item selection for deletion
 */
function toggleItemSelection(checkbox) {
    const itemType = checkbox.dataset.type;
    const itemId = checkbox.dataset.id;
    const key = `${itemType}-${itemId}`;

    if (checkbox.checked) {
        selectedItemsForDeletion.add(key);
    } else {
        selectedItemsForDeletion.delete(key);
    }

    // Show/hide delete button based on selection
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    if (selectedItemsForDeletion.size > 0) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }

    // Update visual state
    const item = checkbox.closest('.task-item, .operation-item');
    if (item) {
        if (checkbox.checked) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    }
}

/**
 * Show delete confirmation modal
 */
function deleteSelected() {
    if (selectedItemsForDeletion.size === 0) {
        return;
    }

    const count = selectedItemsForDeletion.size;
    const confirmText = document.getElementById('deleteConfirmText');
    confirmText.textContent = `Вы уверены, что хотите удалить выбранные элементы (${count} шт.)?`;

    document.getElementById('deleteModalBackdrop').classList.add('show');
}

/**
 * Close delete confirmation modal
 */
function closeDeleteModal() {
    document.getElementById('deleteModalBackdrop').classList.remove('show');
}

/**
 * Confirm and execute deletion
 */
function confirmDelete() {
    const itemsToDelete = Array.from(selectedItemsForDeletion);

    // Delete items one by one
    const deletePromises = itemsToDelete.map(item => {
        const [type, id] = item.split('-');
        return deleteItem(id);
    });

    Promise.all(deletePromises)
        .then(() => {
            console.log('All items deleted successfully');
            closeDeleteModal();
            selectedItemsForDeletion.clear();

            // Exit delete mode and reload
            deleteModeActive = false;
            const toggleBtn = document.getElementById('toggleDeleteModeBtn');
            toggleBtn.textContent = 'Групповое удаление';
            toggleBtn.classList.remove('btn-secondary');
            toggleBtn.classList.add('btn-warning');
            document.getElementById('deleteSelectedBtn').classList.add('hidden');

            if (selectedProject) {
                loadProjectDetails(selectedProject['ПроектID']);
            }
        })
        .catch(error => {
            console.error('Error deleting items:', error);
            alert('Ошибка при удалении элементов');
            closeDeleteModal();
        });
}

/**
 * Delete a single item via API
 */
function deleteItem(itemId) {
    const formData = new FormData();
    formData.append('_xsrf', xsrf);

    const url = `https://${window.location.host}/${db}/_m_del/${itemId}?JSON`;

    return fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Item deleted:', data);
        return data;
    });
}

/**
 * Confirm deletion of task from edit form
 */
function confirmDeleteTask() {
    const taskId = document.getElementById('taskId').value;
    if (!taskId) return;

    const taskData = projectDetails.find(item => item['Задача проектаID'] === taskId);
    const taskName = taskData ? taskData['Задача проекта'] : '';

    if (confirm(`Вы уверены, что хотите удалить задачу "${taskName}"?`)) {
        deleteItem(taskId)
            .then(() => {
                closeTaskModal();
                if (selectedProject) {
                    loadProjectDetails(selectedProject['ПроектID']);
                }
            })
            .catch(error => {
                console.error('Error deleting task:', error);
                alert('Ошибка при удалении задачи');
            });
    }
}

/**
 * Confirm deletion of operation from edit form
 */
function confirmDeleteOperation() {
    const operationId = document.getElementById('operationId').value;
    if (!operationId) return;

    const opData = projectDetails.find(item => item['ОперацияID'] === operationId);
    const operationName = opData ? opData['Операция'] : '';

    if (confirm(`Вы уверены, что хотите удалить операцию "${operationName}"?`)) {
        deleteItem(operationId)
            .then(() => {
                closeOperationModal();
                if (selectedProject) {
                    loadProjectDetails(selectedProject['ПроектID']);
                }
            })
            .catch(error => {
                console.error('Error deleting operation:', error);
                alert('Ошибка при удалении операции');
            });
    }
}

/**
 * Clone project
 */
function cloneProject() {
    if (!selectedProject) return;

    // Pre-fill with current project name
    const currentName = selectedProject['Проект'] || '';
    document.getElementById('cloneProjectName').value = currentName + ' (копия)';

    document.getElementById('cloneModalBackdrop').classList.add('show');
}

/**
 * Close clone modal
 */
function closeCloneModal() {
    document.getElementById('cloneModalBackdrop').classList.remove('show');
}

/**
 * Handle clone form submission
 */
document.getElementById('cloneForm').addEventListener('submit', function(e) {
    e.preventDefault();

    if (!selectedProject) return;

    const newProjectName = document.getElementById('cloneProjectName').value.trim();
    const currentProjectName = selectedProject['Проект'] || '';

    // Validate that new name is different
    if (newProjectName === currentProjectName) {
        alert('Имя нового проекта должно отличаться от текущего');
        return;
    }

    if (!newProjectName) {
        alert('Введите имя нового проекта');
        return;
    }

    const projectId = selectedProject['ПроектID'];
    const formData = new FormData();
    formData.append('_xsrf', xsrf);
    formData.append('t693', newProjectName);

    const url = `https://${window.location.host}/${db}/_m_save/${projectId}?JSON&copybtn`;

    fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Project cloned:', data);
        closeCloneModal();
        loadProjects();
        alert('Проект успешно клонирован');
    })
    .catch(error => {
        console.error('Error cloning project:', error);
        alert('Ошибка при клонировании проекта');
    });
});

// ==================== PRODUCTS MANAGEMENT ====================

// Global state for products
let allProducts = [];
let projectProducts = [];
let draggedProductElement = null;

/**
 * Load all available products from dictionary
 */
function loadAllProducts() {
    fetch(`https://${window.location.host}/${db}/report/6236?JSON_KV`)
        .then(response => response.json())
        .then(data => {
            allProducts = data;
            populateProductSelect();
        })
        .catch(error => console.error('Error loading all products:', error));
}

/**
 * Load products for the current project
 */
function loadProjectProducts(projectId) {
    if (!projectId) return;

    fetch(`https://${window.location.host}/${db}/report/6247?JSON_KV&FR_ProjectID=${projectId}`)
        .then(response => response.json())
        .then(data => {
            projectProducts = data;
            displayProjectProducts();
        })
        .catch(error => console.error('Error loading project products:', error));
}

/**
 * Populate the product select dropdown
 */
function populateProductSelect() {
    const select = document.getElementById('productSelect');

    // Clear existing options except the first one
    while (select.options.length > 1) {
        select.remove(1);
    }

    // Add new options
    allProducts.forEach(product => {
        const option = document.createElement('option');
        option.value = product['ИзделиеID'];
        option.textContent = `${product['Изделие']} (${product['Конструкций']})`;
        option.dataset.name = product['Изделие'];
        option.dataset.constructions = product['Конструкций'];
        select.appendChild(option);
    });
}

/**
 * Initialize tab switching and filter for product dropdown
 * Note: Using $(document).ready() instead of DOMContentLoaded because this script is loaded dynamically
 * and DOMContentLoaded may have already fired by the time this script executes
 */
$(document).ready(function() {
    // Initialize tab switching for project modal
    // Use jQuery's tab() method to handle clicks since stopPropagation() on modal prevents default Bootstrap behavior
    $('#projectInfo-tab').on('click', function(e) {
        e.preventDefault();
        $(this).tab('show');
    });

    $('#projectProducts-tab').on('click', function(e) {
        e.preventDefault();
        $(this).tab('show');
    });

    // Filter product dropdown based on search input
    const productSearchInput = document.getElementById('productSearch');
    if (productSearchInput) {
        productSearchInput.addEventListener('keyup', function() {
            const searchTerm = this.value.toLowerCase();
            const select = document.getElementById('productSelect');

            Array.from(select.options).forEach((option, index) => {
                if (index === 0) return; // Skip first option

                const text = option.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    option.style.display = '';
                } else {
                    option.style.display = 'none';
                }
            });
        });
    }
});

/**
 * Display project products list
 */
function displayProjectProducts() {
    const productsList = document.getElementById('projectProductsList');

    if (!projectProducts || projectProducts.length === 0) {
        productsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #6c757d;">Изделия не добавлены</div>';
        return;
    }

    // Sort by order
    const sortedProducts = [...projectProducts].sort((a, b) => {
        return (parseInt(a['ИзделияOrder']) || 0) - (parseInt(b['ИзделияOrder']) || 0);
    });

    // Build products list
    productsList.innerHTML = sortedProducts.map(product => {
        // Find product details from allProducts
        const productDetails = allProducts.find(p => p['ИзделиеID'] === product['ИзделиеID']);
        const productName = productDetails ? productDetails['Изделие'] : 'Unknown';
        const constructions = productDetails ? productDetails['Конструкций'] : '0';

        return `
            <div class="product-item"
                 draggable="true"
                 data-product-id="${product['ИзделиеID']}"
                 data-selection-id="${product['Строка Изделия']}"
                 data-order="${product['ИзделияOrder']}">
                <div class="product-content">
                    <span class="drag-handle">☰</span>
                    <span>${escapeHtml(productName)} (${constructions})</span>
                </div>
                <div class="product-actions">
                    <button type="button" class="product-delete-btn" onclick="confirmDeleteProduct('${product['Строка Изделия']}', '${escapeHtml(productName)}')">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // Add drag-and-drop handlers
    addProductDragHandlers();
}

/**
 * Filter displayed project products based on search
 */
function filterProjectProducts() {
    const searchTerm = document.getElementById('projectProductSearch').value.toLowerCase();
    const productItems = document.querySelectorAll('.product-item');

    productItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
 * Add product to project
 */
function addProductToProject() {
    const projectId = document.getElementById('projectId').value;
    const productSelect = document.getElementById('productSelect');
    const productId = productSelect.value;

    if (!projectId) {
        alert('Сначала сохраните проект');
        return;
    }

    if (!productId) {
        alert('Выберите изделие');
        return;
    }

    const formData = new FormData();
    formData.append('_xsrf', xsrf);
    formData.append('t6154', productId);

    const url = `https://${window.location.host}/${db}/_m_new/6152?JSON&up=${projectId}`;

    fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Product added:', data);

        // Reload project products
        loadProjectProducts(projectId);

        // Reset selection
        productSelect.value = '';
        document.getElementById('productSearch').value = '';
    })
    .catch(error => {
        console.error('Error adding product:', error);
        alert('Ошибка при добавлении изделия');
    });
}

/**
 * Confirm product deletion
 */
function confirmDeleteProduct(selectionId, productName) {
    if (confirm(`Вы уверены, что хотите удалить изделие "${productName}"?`)) {
        deleteProduct(selectionId);
    }
}

/**
 * Delete product from project
 */
function deleteProduct(selectionId) {
    const formData = new FormData();
    formData.append('_xsrf', xsrf);

    const url = `https://${window.location.host}/${db}/_m_del/${selectionId}?JSON`;

    fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Product deleted:', data);

        // Reload project products
        const projectId = document.getElementById('projectId').value;
        loadProjectProducts(projectId);
    })
    .catch(error => {
        console.error('Error deleting product:', error);
        alert('Ошибка при удалении изделия');
    });
}

/**
 * Add drag-and-drop handlers to product items
 */
function addProductDragHandlers() {
    const productItems = document.querySelectorAll('.product-item');

    productItems.forEach(item => {
        item.addEventListener('dragstart', handleProductDragStart);
        item.addEventListener('dragover', handleProductDragOver);
        item.addEventListener('drop', handleProductDrop);
        item.addEventListener('dragend', handleProductDragEnd);
    });
}

/**
 * Handle drag start
 */
function handleProductDragStart(e) {
    draggedProductElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

/**
 * Handle drag over
 */
function handleProductDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    const afterElement = getDragAfterElement(document.getElementById('projectProductsList'), e.clientY);
    const draggable = draggedProductElement;

    if (afterElement == null) {
        document.getElementById('projectProductsList').appendChild(draggable);
    } else {
        document.getElementById('projectProductsList').insertBefore(draggable, afterElement);
    }

    return false;
}

/**
 * Handle drop
 */
function handleProductDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }

    return false;
}

/**
 * Handle drag end
 */
function handleProductDragEnd(e) {
    this.classList.remove('dragging');

    // Calculate new order
    const productItems = Array.from(document.querySelectorAll('.product-item'));
    const draggedIndex = productItems.indexOf(this);
    const newOrder = draggedIndex + 1;

    const selectionId = this.dataset.selectionId;

    // Save the new order for the dragged element only (Issue #82 pattern)
    saveProductOrder(selectionId, newOrder);
}

/**
 * Get element after which the dragged element should be placed
 */
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.product-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/**
 * Save product order (only for the dragged element - Issue #82 pattern)
 */
function saveProductOrder(selectionId, newOrder) {
    const formData = new FormData();
    formData.append('_xsrf', xsrf);
    formData.append('order', newOrder);

    const url = `https://${window.location.host}/${db}/_m_ord/${selectionId}?JSON`;

    fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Product order saved:', data);

        // Reload project products to get updated order from backend
        const projectId = document.getElementById('projectId').value;
        loadProjectProducts(projectId);
    })
    .catch(error => {
        console.error('Error saving product order:', error);
        alert('Ошибка при сохранении порядка изделия');
    });
}
