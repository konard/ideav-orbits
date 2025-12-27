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
    workType: ''
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

    // Load metadata to get clients and objects
    fetch(`https://${window.location.host}/${db}/metadata`)
        .then(response => response.json())
        .then(metadata => {
            // Find clients table (id 665)
            const clientsTable = metadata.find(t => t.id === '665');
            if (clientsTable) {
                loadTableData(665, 'clients', 'Заказчик', 'ЗаказчикID');
            }

            // Find objects table (id 715)
            const objectsTable = metadata.find(t => t.id === '715');
            if (objectsTable) {
                loadTableData(715, 'objects', 'Объект ', 'Объект ID');
            }
        })
        .catch(error => console.error('Error loading metadata:', error));
}

/**
 * Load table data for dictionaries
 */
function loadTableData(tableId, dictKey, labelField, idField) {
    fetch(`https://${window.location.host}/${db}/report/22?JSON_KV&FR_table=${tableId}`)
        .then(response => response.json())
        .then(data => {
            dictionaries[dictKey] = data;
            const selectId = dictKey === 'clients' ? 'projectClient' : 'projectObject';
            populateSelect(selectId, data, labelField, idField);
        })
        .catch(error => console.error(`Error loading ${dictKey}:`, error));
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
        filterOperationTemplates(selectedDirection, null);
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

    filterOperationTemplates(selectedDirection, selectedWorkType);
}

/**
 * Filter operation templates based on direction and work type
 */
function filterOperationTemplates(direction, workType) {
    const operationSelect = document.getElementById('operationTemplate');
    if (!operationSelect) return;

    // Clear existing options except the first one
    while (operationSelect.options.length > 1) {
        operationSelect.remove(1);
    }

    // Filter templates
    const filteredTemplates = dictionaries.operationTemplates.filter(template => {
        const matchesDirection = !direction || template['Направление'] === direction;
        const matchesWorkType = !workType || template['Вид работ'] === workType;
        return matchesDirection && matchesWorkType;
    });

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

        let html = `
            <div class="task-item ${isSelected}" draggable="${!deleteModeActive}" data-task-id="${taskId}" data-order="${task['Задача проектаOrder']}">
                ${deleteCheckbox}
                <span class="drag-handle" style="display: ${deleteModeActive ? 'none' : 'inline'}">☰</span>
                <span class="task-order">${index + 1}</span>
                <div class="task-content">
                    <strong>${escapeHtml(task['Задача проекта'] || 'Без названия')}</strong>
                    ${task['Задача Описание'] ? '<br><small>' + escapeHtml(task['Задача Описание']) + '</small>' : ''}
                    ${task['Статус задачи'] ? '<br><small>Статус: ' + escapeHtml(task['Статус задачи']) + '</small>' : ''}
                </div>
                <div class="task-actions">
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
                    <div class="operation-item ${opIsSelected}" draggable="${!deleteModeActive}" data-operation-id="${op['ОперацияID']}" data-task-id="${taskId}" data-order="${op['ОперацияOrder']}">
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
    const template = dictionaries.operationTemplates.find(t =>
        t['Операция (шаблон)'] === opData['Операция']
    );

    // Reset filters first
    resetOperationFilters();

    // If template has direction and work type, set filters accordingly
    if (template) {
        const direction = template['Направление'];
        const workType = template['Вид работ'];

        // Set direction and trigger change
        if (direction) {
            const directionSelect = document.getElementById('operationDirection');
            if (directionSelect) {
                directionSelect.value = direction;
                // Manually trigger the change event to populate work types
                onDirectionChange({ target: directionSelect });

                // Set work type if available
                if (workType) {
                    setTimeout(() => {
                        const workTypeSelect = document.getElementById('operationWorkType');
                        if (workTypeSelect) {
                            workTypeSelect.value = workType;
                            // Trigger change to filter operations
                            onWorkTypeChange({ target: workTypeSelect });
                        }
                    }, 0);
                }
            }
        }
    } else {
        // If no direction/work type, show all operations
        populateSelect('operationTemplate', dictionaries.operationTemplates, 'Операция (шаблон)', 'Операция (шаблон)ID');
    }

    // Set operation template after filters are applied
    setTimeout(() => {
        const templateSelect = document.getElementById('operationTemplate');
        const templateOption = Array.from(templateSelect.options).find(opt =>
            opt.textContent === opData['Операция']
        );
        if (templateOption) {
            templateSelect.value = templateOption.value;
        }
    }, 100);

    document.getElementById('operationNorm').value = ''; // Not in response
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
    formData.append('t679', document.getElementById('taskName').value); // Задача проекта
    formData.append('t683', document.getElementById('taskDescription').value); // Описание
    formData.append('t688', document.getElementById('taskStatus').value); // Статус задачи
    formData.append('t1030', document.getElementById('taskQuantity').value); // К-во
    formData.append('t1036', document.getElementById('taskUnit').value); // Ед.изм.

    const url = taskId ?
        `https://${window.location.host}/${db}/_m_save/${taskId}?JSON` :
        `https://${window.location.host}/${db}/_m_new/327?JSON&up=${projectId}`;

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
 * Handle operation form submission
 */
document.getElementById('operationForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const operationId = document.getElementById('operationId').value;
    const taskId = document.getElementById('operationTaskId').value;
    const formData = new FormData();
    formData.append('_xsrf', xsrf);

    const templateId = document.getElementById('operationTemplate').value;
    formData.append('t702', templateId); // Операция (шаблон)

    // Find the selected template and add its name as t2628
    const selectedTemplate = dictionaries.operationTemplates.find(t =>
        t['Операция (шаблон)ID'] === templateId
    );
    if (selectedTemplate && selectedTemplate['Операция (шаблон)']) {
        formData.append('t2628', selectedTemplate['Операция (шаблон)']); // Имя операции из шаблона
    }

    formData.append('t704', document.getElementById('operationNorm').value); // Норматив
    formData.append('t2403', document.getElementById('operationQuantity').value); // Кол-во
    formData.append('t3060', document.getElementById('operationUnit').value); // Ед.изм.

    const startValue = document.getElementById('operationStart').value;
    if (startValue) {
        formData.append('t2665', startValue); // Начать
    }

    const url = operationId ?
        `https://${window.location.host}/${db}/_m_save/${operationId}?JSON` :
        `https://${window.location.host}/${db}/_m_new/695?JSON&up=${taskId}`;

    fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Operation saved:', data);
        closeOperationModal();
        if (selectedProject) {
            loadProjectDetails(selectedProject['ПроектID']);
        }
    })
    .catch(error => {
        console.error('Error saving operation:', error);
        alert('Ошибка сохранения операции');
    });
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
