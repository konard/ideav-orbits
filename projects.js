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
    objects: []
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
            populateSelect('operationTemplate', data, 'Операция (шаблон)', 'Операция (шаблон)ID');
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

        let html = `
            <div class="task-item" draggable="true" data-task-id="${taskId}" data-order="${task['Задача проектаOrder']}">
                <span class="drag-handle">☰</span>
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
                html += `
                    <div class="operation-item" draggable="true" data-operation-id="${op['ОперацияID']}" data-order="${op['ОперацияOrder']}">
                        <span class="drag-handle">☰</span>
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

    // Add drag and drop handlers
    addDragAndDropHandlers();
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

    if (draggedElement !== this && draggedElement.className === this.className) {
        const isDraggedTask = draggedElement.classList.contains('task-item');
        const isDropTargetTask = this.classList.contains('task-item');
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
        } else if (draggedElement.className !== this.className) {
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
 */
function saveOrder(element) {
    console.log('[SAVE_ORDER] Function called');

    const isTask = element.classList.contains('task-item');
    const elementId = isTask ? element.dataset.taskId : element.dataset.operationId;
    console.log(`[SAVE_ORDER] Element type: ${isTask ? 'Task' : 'Operation'}, ID: ${elementId}`);

    // Get all siblings of the same type
    const siblings = Array.from(element.parentNode.children).filter(el =>
        el.classList.contains(isTask ? 'task-item' : 'operation-item')
    );

    console.log(`[SAVE_ORDER] Found ${siblings.length} siblings of the same type`);
    siblings.forEach((sibling, index) => {
        const id = isTask ? sibling.dataset.taskId : sibling.dataset.operationId;
        const currentOrder = sibling.dataset.order;
        console.log(`[SAVE_ORDER] Sibling ${index + 1}: ID=${id}, Current Order=${currentOrder}, New Order=${index + 1}`);
    });

    // Update order for ALL siblings, not just the dragged element
    const updatePromises = siblings.map((sibling, index) => {
        const id = isTask ? sibling.dataset.taskId : sibling.dataset.operationId;
        const newOrder = index + 1;

        // Update the data-order attribute immediately for UI consistency
        sibling.dataset.order = newOrder;

        // Send update to server
        const formData = new FormData();
        formData.append('_xsrf', xsrf);

        const url = `https://${window.location.host}/${db}/_m_ord/${id}?JSON&order=${newOrder}`;
        console.log(`[SAVE_ORDER] Sending API request for ${isTask ? 'task' : 'operation'} ${id}: ${url}`);

        return fetch(url, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            console.log(`[SAVE_ORDER] API response for ${isTask ? 'task' : 'operation'} ${id}: Status ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log(`[SAVE_ORDER] Order updated for ${isTask ? 'task' : 'operation'} ${id}: ${newOrder}`, data);
            return data;
        })
        .catch(error => {
            console.error(`[SAVE_ORDER] Error updating order for ${isTask ? 'task' : 'operation'} ${id}:`, error);
            throw error;
        });
    });

    console.log(`[SAVE_ORDER] Created ${updatePromises.length} update promises`);

    // Wait for all updates to complete, then reload
    Promise.all(updatePromises)
        .then(() => {
            console.log('[SAVE_ORDER] All order updates completed successfully');
            // Reload to show updated order from server
            if (selectedProject) {
                console.log(`[SAVE_ORDER] Reloading project details for project ${selectedProject['ПроектID']}`);
                loadProjectDetails(selectedProject['ПроектID']);
            }
        })
        .catch(error => {
            console.error('[SAVE_ORDER] Error updating orders:', error);
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

    // Set operation template
    const templateSelect = document.getElementById('operationTemplate');
    const templateOption = Array.from(templateSelect.options).find(opt =>
        opt.textContent === opData['Операция']
    );
    if (templateOption) {
        templateSelect.value = templateOption.value;
    }

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
        `https://${window.location.host}/${db}/_m_new/663?JSON&up=1&id=${projectId}` :
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
        `https://${window.location.host}/${db}/_m_new/327?JSON&up=${projectId}&id=${taskId}` :
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
    formData.append('t702', document.getElementById('operationTemplate').value); // Операция (шаблон)
    formData.append('t704', document.getElementById('operationNorm').value); // Норматив
    formData.append('t2403', document.getElementById('operationQuantity').value); // Кол-во
    formData.append('t3060', document.getElementById('operationUnit').value); // Ед.изм.

    const startValue = document.getElementById('operationStart').value;
    if (startValue) {
        formData.append('t2665', startValue); // Начать
    }

    const url = operationId ?
        `https://${window.location.host}/${db}/_m_new/695?JSON&up=${taskId}&id=${operationId}` :
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
