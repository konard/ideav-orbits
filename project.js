/**
 * Project Workspace - Single Project View with Estimate and Constructions
 * Handles project viewing, estimate management, and constructions tracking
 */

// Global state
let allProjects = [];
let selectedProject = null;
let projectInfo = null;
let estimateData = [];
let constructionsData = [];
let constructionEstimatePositions = []; // Data from report/7148
let constructionProducts = []; // Data from report/6503
let workTypesReference = [];
let dictionaries = {
    clients: [],
    objects: [],
    directions: [],
    units: [],
    workTypesMap: new Map()
};

// Current row being edited for work type selector
let currentWorkTypeRow = null;
let pendingDeleteEstimateRowId = null;
let pendingDeleteConstructionRowId = null;

// Products reference data and current selection context
let allProductsReference = [];
let currentProductAddContext = null; // {constructionId, estimatePositionId}

// Operations data
let operationsData = []; // Data from report/5977
let currentOperationsProductId = null; // Currently viewed product's operations
let currentOperationsContext = null; // {productId, productName, estimatePositionId, estimateId}

/**
 * Initialize the project workspace
 */
function initProjectWorkspace() {
    // Check if user is guest and redirect to login
    if (typeof uid !== 'undefined' && (uid === '' || uid === 'guest')) {
        window.location.href = `https://${window.location.host}/${db}/login`;
        return;
    }

    // Load all necessary data
    loadDictionaries();
    loadWorkTypesReference();
    loadAllProductsReference();
    loadProjects();

    // Setup form handlers
    setupFormHandlers();

    // Initialize work type selector size from cookies
    initWorkTypeSelectorSize();

    // Load column visibility preferences
    loadColumnVisibility();

    // Load product details visibility preferences
    initializeProductDetailsVisibility();

    // Setup click outside handler for work type selector
    document.addEventListener('click', function(e) {
        const selector = document.getElementById('workTypeSelector');
        if (selector && !selector.classList.contains('hidden')) {
            if (!selector.contains(e.target) && !e.target.classList.contains('add-work-type-btn')) {
                closeWorkTypeSelector();
            }
        }
        // Also handle product selector
        const productSelector = document.getElementById('productSelector');
        if (productSelector && !productSelector.classList.contains('hidden')) {
            if (!productSelector.contains(e.target) && !e.target.classList.contains('add-product-icon')) {
                closeProductSelector();
            }
        }
    });
}

/**
 * Load dictionaries
 */
function loadDictionaries() {
    // Load clients
    fetch(`https://${window.location.host}/${db}/report/6096?JSON_KV`)
        .then(response => response.json())
        .then(data => {
            dictionaries.clients = data;
            populateSelect('projectClient', data, 'Заказчик', 'ЗаказчикID');
        })
        .catch(error => console.error('Error loading clients:', error));

    // Load objects
    fetch(`https://${window.location.host}/${db}/report/6102?JSON_KV`)
        .then(response => response.json())
        .then(data => {
            dictionaries.objects = data;
            populateSelect('projectObject', data, 'Объект', 'Объект ID');
        })
        .catch(error => console.error('Error loading objects:', error));

    // Load units (Единицы измерения)
    fetch(`https://${window.location.host}/${db}/report/6031?JSON_KV`)
        .then(response => response.json())
        .then(data => {
            dictionaries.units = data || [];
        })
        .catch(error => console.error('Error loading units:', error));
}

/**
 * Load work types reference (Виды работ справочник)
 */
function loadWorkTypesReference() {
    fetch(`https://${window.location.host}/${db}/report/6944?JSON_KV`)
        .then(response => response.json())
        .then(data => {
            workTypesReference = data;
            extractDirectionsFromWorkTypes(data);
            populateSelectorDropdowns();
        })
        .catch(error => console.error('Error loading work types reference:', error));
}

/**
 * Load all products reference (Все Изделия)
 */
function loadAllProductsReference() {
    fetch(`https://${window.location.host}/${db}/report/7202?JSON_KV`)
        .then(response => response.json())
        .then(data => {
            allProductsReference = data;
            populateProductSelector();
        })
        .catch(error => console.error('Error loading products reference:', error));
}

/**
 * Extract unique directions from work types
 */
function extractDirectionsFromWorkTypes(workTypes) {
    const directionsSet = new Set();
    const workTypesMap = new Map();

    workTypes.forEach(wt => {
        const directionId = wt['Направление'];
        if (directionId) {
            directionsSet.add(directionId);
            if (!workTypesMap.has(directionId)) {
                workTypesMap.set(directionId, []);
            }
            workTypesMap.get(directionId).push(wt);
        }
    });

    dictionaries.directions = Array.from(directionsSet);
    dictionaries.workTypesMap = workTypesMap;
}

/**
 * Populate selector dropdowns for work type selection
 */
function populateSelectorDropdowns() {
    const directionSelect = document.getElementById('selectorDirection');
    if (!directionSelect) return;

    // Clear existing options except first
    while (directionSelect.options.length > 1) {
        directionSelect.remove(1);
    }

    // Get unique direction names from work types
    const directionNames = new Map();
    workTypesReference.forEach(wt => {
        const dirId = wt['Направление'];
        // For now, use direction ID as name (could be enhanced with a direction lookup)
        if (dirId && !directionNames.has(dirId)) {
            directionNames.set(dirId, dirId);
        }
    });

    // Add direction options
    directionNames.forEach((name, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = id;
        directionSelect.appendChild(option);
    });
}

/**
 * Populate a select element with options
 */
function populateSelect(selectId, data, labelField, idField) {
    const select = document.getElementById(selectId);
    if (!select) return;

    while (select.options.length > 1) {
        select.remove(1);
    }

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
                <span>Окончание: ${escapeHtml(project['Срок'] || '—')}</span> |
                <span>Объект: ${escapeHtml(project['Объект'] || '—')}</span>
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
 * Select a project and show detail view
 */
function selectProject(projectId) {
    // Reset UI state from previous project
    resetProjectUIState();

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

    // Store project info from the list
    projectInfo = selectedProject;

    // Hide project list
    document.getElementById('projectList').style.display = 'none';
    document.querySelector('.controls-row').style.display = 'none';

    // Show detail view
    document.getElementById('projectDetailView').classList.add('active');

    // Update header
    updateProjectHeader();

    // Load project data
    loadEstimateData(projectId);
    loadConstructionsData(projectId);
}

/**
 * Update project header with info
 */
function updateProjectHeader() {
    if (!projectInfo) return;

    // Title
    document.getElementById('projectDetailTitle').textContent = projectInfo['Проект'] || 'Без названия';

    // Edit link
    document.getElementById('projectEditLink').href = `https://${window.location.host}/${db}/edit_obj/${projectInfo['ПроектID']}`;

    // Calculate completeness (example: based on filled fields)
    const fields = ['Заказчик', 'Объект', 'Старт', 'Срок', 'Область', 'Город', 'Координаты'];
    let filledCount = 0;
    fields.forEach(f => {
        if (projectInfo[f] && projectInfo[f].trim() !== '') {
            filledCount++;
        }
    });
    const completeness = Math.round((filledCount / fields.length) * 100);

    const badge = document.getElementById('projectCompleteness');
    badge.textContent = `Заполненность: ${completeness}%`;
    badge.className = 'completeness-badge';
    if (completeness < 30) badge.classList.add('low');
    else if (completeness < 70) badge.classList.add('medium');
    else badge.classList.add('high');

    // Info table
    document.getElementById('infoClient').textContent = projectInfo['Заказчик'] || '-';
    document.getElementById('infoObject').textContent = projectInfo['Объект'] || '-';

    // Calculate duration in days
    let duration = '-';
    if (projectInfo['Старт'] && projectInfo['Срок']) {
        const start = parseDate(projectInfo['Старт']);
        const end = parseDate(projectInfo['Срок']);
        if (start && end) {
            const diffTime = end - start;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 0) {
                duration = diffDays;
            }
        }
    }
    document.getElementById('infoDuration').textContent = duration;

    document.getElementById('infoAdvance').textContent = projectInfo['Аванс, %'] || '-';

    // Location
    const location = [projectInfo['Область'], projectInfo['Город'], projectInfo['Адрес: Улица, дом']].filter(Boolean).join(', ');
    document.getElementById('infoLocation').textContent = location || '-';

    document.getElementById('infoCoordinates').textContent = projectInfo['Координаты'] || '-';
}

/**
 * Close project detail view
 */
function closeProjectDetail() {
    // Reset UI state
    resetProjectUIState();

    // Hide detail view
    document.getElementById('projectDetailView').classList.remove('active');

    // Show project list
    document.getElementById('projectList').style.display = '';
    document.querySelector('.controls-row').style.display = '';

    // Remove active class
    document.querySelectorAll('.project-item').forEach(item => {
        item.classList.remove('active');
    });

    selectedProject = null;
    projectInfo = null;
}

/**
 * Switch between tabs
 */
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.detail-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`.detail-tab[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

/**
 * Load estimate data
 */
function loadEstimateData(projectId) {
    fetch(`https://${window.location.host}/${db}/report/6631?JSON_KV&FR_ProjectID=${projectId}`)
        .then(response => response.json())
        .then(data => {
            estimateData = data;
            displayEstimateTable(data);
        })
        .catch(error => {
            console.error('Error loading estimate data:', error);
            estimateData = [];
            displayEstimateTable([]);
        });
}

/**
 * Display estimate table
 */
function displayEstimateTable(data) {
    const tbody = document.getElementById('estimateTableBody');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #6c757d; padding: 20px;">Нет данных сметы</td></tr>';
        document.getElementById('estimateTotalSum').textContent = '0.00';
        return;
    }

    // Sort by order
    const sortedData = [...data].sort((a, b) => {
        const orderA = parseInt(a['СметаOrder'] || 0);
        const orderB = parseInt(b['СметаOrder'] || 0);
        return orderA - orderB;
    });

    let totalSum = 0;

    tbody.innerHTML = sortedData.map((row, index) => {
        const quantity = parseFloat(row['К-во']) || 0;
        const price = parseFloat(row['Цена за ед.']) || 0;
        const sum = quantity * price;
        totalSum += sum;

        // Parse work types
        const workTypesIds = row['Виды работ'] ? row['Виды работ'].split(',').filter(Boolean) : [];
        const workTypesBadges = renderWorkTypesBadges(workTypesIds, row['СметаID']);

        // Check if this is a new row (name not filled yet)
        const isNewRow = row['isNew'] && !row['Смета'];
        const hiddenStyle = isNewRow ? 'style="visibility: hidden;"' : '';

        // Build units dropdown options (compare by ID for reliable selection)
        const unitOptions = dictionaries.units.map(u =>
            `<option value="${u['Ед.изм.ID']}" ${u['Ед.изм.ID'] == row['Ед.изм.ID'] ? 'selected' : ''}>${escapeHtml(u['Ед.изм.'])}</option>`
        ).join('');

        return `
            <tr data-estimate-id="${row['СметаID']}" data-order="${row['СметаOrder']}" draggable="true">
                <td class="row-number">${index + 1}</td>
                <td>
                    <input type="text" value="${escapeHtml(row['Смета'] || '')}"
                           onchange="updateEstimateField('${row['СметаID']}', 'name', this.value)"
                           onblur="handleEstimateNameBlur('${row['СметаID']}', this.value)">
                </td>
                <td ${hiddenStyle}>
                    <input type="number" value="${quantity || ''}" step="0.01"
                           onchange="updateEstimateField('${row['СметаID']}', 'quantity', this.value); recalculateEstimateSum('${row['СметаID']}')">
                </td>
                <td ${hiddenStyle}>
                    <select onchange="updateEstimateField('${row['СметаID']}', 'unit', this.value)">
                        <option value="">—</option>
                        ${unitOptions}
                    </select>
                </td>
                <td ${hiddenStyle}>
                    <input type="number" value="${price || ''}" step="0.01"
                           onchange="updateEstimateField('${row['СметаID']}', 'price', this.value); recalculateEstimateSum('${row['СметаID']}')">
                </td>
                <td class="sum-cell" data-sum="${sum}" ${hiddenStyle}>${sum > 0 ? sum.toFixed(2) : ''}</td>
                <td ${hiddenStyle}>
                    <div class="work-types-cell" data-estimate-id="${row['СметаID']}">
                        ${workTypesBadges}
                        <button class="add-work-type-btn" onclick="showWorkTypeSelector(event, '${row['СметаID']}')" title="Добавить вид работ">+</button>
                        ${workTypesIds.length > 0 ? `<button class="clear-work-types-btn" onclick="clearAllWorkTypes('${row['СметаID']}')" title="Удалить все виды работ">×</button>` : ''}
                    </div>
                </td>
                <td class="row-actions">
                    <button class="btn-delete-row" onclick="deleteEstimateRow('${row['СметаID']}')" title="Удалить">🗑</button>
                </td>
            </tr>
        `;
    }).join('');

    document.getElementById('estimateTotalSum').textContent = totalSum.toFixed(2);

    // Add drag handlers
    addEstimateDragHandlers();
}

/**
 * Render work types badges with grouping by direction
 */
function renderWorkTypesBadges(workTypeIds, estimateId) {
    if (!workTypeIds || workTypeIds.length === 0) return '';

    // Group work types by direction
    const grouped = new Map();

    workTypeIds.forEach(id => {
        const wt = workTypesReference.find(w => w['Вид работID'] === id);
        if (wt) {
            const dirId = wt['Направление'] || 'other';
            if (!grouped.has(dirId)) {
                grouped.set(dirId, []);
            }
            grouped.get(dirId).push(wt);
        }
    });

    // Render grouped badges
    let badges = '';
    grouped.forEach((workTypes, dirId) => {
        const workTypeNames = workTypes.map(wt => wt['Вид работ']).join(', ');
        const dirLabel = `${dirId}`;

        badges += `<span class="work-type-badge" title="${escapeHtml(workTypeNames)}">
            ${escapeHtml(dirLabel)}/${escapeHtml(workTypeNames)}
        </span>`;
    });

    return badges;
}

/**
 * Show work type selector
 */
function showWorkTypeSelector(event, estimateId) {
    event.stopPropagation();

    currentWorkTypeRow = estimateId;

    const selector = document.getElementById('workTypeSelector');
    const btn = event.target;
    const rect = btn.getBoundingClientRect();

    // Show selector first to get its dimensions
    selector.classList.remove('hidden');

    // Reset and populate work types
    document.getElementById('selectorDirection').value = '';
    document.getElementById('selectorWorkTypeSearch').value = '';
    populateWorkTypesList();

    // Calculate position ensuring selector stays within viewport
    const selectorRect = selector.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 20;

    let left = rect.left;
    let top = rect.bottom + 5;

    // Adjust horizontal position if going off-screen
    if (left + selectorRect.width > viewportWidth - margin) {
        left = viewportWidth - selectorRect.width - margin;
    }
    if (left < margin) {
        left = margin;
    }

    // Adjust vertical position if going off-screen
    if (top + selectorRect.height > viewportHeight - margin) {
        // Try to position above the button
        top = rect.top - selectorRect.height - 5;
        if (top < margin) {
            top = margin;
        }
    }

    selector.style.left = `${left}px`;
    selector.style.top = `${top}px`;
}

/**
 * Close work type selector
 */
function closeWorkTypeSelector() {
    document.getElementById('workTypeSelector').classList.add('hidden');
    currentWorkTypeRow = null;
}

/**
 * Handle direction change in selector
 */
function onSelectorDirectionChange() {
    populateWorkTypesList();
}

/**
 * Filter work types in selector
 */
function filterSelectorWorkTypes() {
    populateWorkTypesList();
}

/**
 * Populate work types list in selector
 */
function populateWorkTypesList() {
    const select = document.getElementById('selectorWorkType');
    const directionFilter = document.getElementById('selectorDirection').value;
    const searchTerm = document.getElementById('selectorWorkTypeSearch').value.toLowerCase();

    select.innerHTML = '';

    let filtered = workTypesReference;

    // Filter by direction
    if (directionFilter) {
        filtered = filtered.filter(wt => wt['Направление'] === directionFilter);
    }

    // Filter by search
    if (searchTerm) {
        filtered = filtered.filter(wt =>
            (wt['Вид работ'] || '').toLowerCase().includes(searchTerm)
        );
    }

    // Filter out already added work types for current estimate row
    if (currentWorkTypeRow) {
        const row = estimateData.find(r => r['СметаID'] === currentWorkTypeRow);
        if (row) {
            const existingWorkTypes = row['Виды работ'] ? row['Виды работ'].split(',').filter(Boolean) : [];
            filtered = filtered.filter(wt => !existingWorkTypes.includes(wt['Вид работID']));
        }
    }

    // Populate options
    filtered.forEach(wt => {
        const option = document.createElement('option');
        option.value = wt['Вид работID'];
        option.textContent = `${wt['Вид работ']} / ${wt['Направление'] || '?'}`;
        select.appendChild(option);
    });
}

/**
 * Add selected work type to estimate row
 */
function addSelectedWorkType() {
    const select = document.getElementById('selectorWorkType');
    const selectedId = select.value;

    if (!selectedId || !currentWorkTypeRow) {
        alert('Выберите вид работ');
        return;
    }

    // Find the estimate row
    const row = estimateData.find(r => r['СметаID'] === currentWorkTypeRow);
    if (!row) {
        closeWorkTypeSelector();
        return;
    }

    // Get current work types
    let currentWorkTypes = row['Виды работ'] ? row['Виды работ'].split(',').filter(Boolean) : [];

    // Check if already added
    if (currentWorkTypes.includes(selectedId)) {
        alert('Этот вид работ уже добавлен');
        return;
    }

    // Save to server via POST _m_set/{estimateId}?JSON&t6850={workTypeId}
    const estimateId = currentWorkTypeRow;
    const formData = new FormData();
    formData.append('_xsrf', xsrf);
    fetch(`https://${window.location.host}/${db}/_m_set/${estimateId}?JSON&t6850=${selectedId}`, {
        method: 'POST',
        credentials: 'include',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.obj) {
            // Store the created record ID for later deletion
            if (!row['workTypeRecordIds']) {
                row['workTypeRecordIds'] = {};
            }
            row['workTypeRecordIds'][selectedId] = data.obj;

            // Add new work type to local data
            currentWorkTypes.push(selectedId);
            row['Виды работ'] = currentWorkTypes.join(',');

            // Refresh display
            displayEstimateTable(estimateData);
            closeWorkTypeSelector();
        } else {
            console.error('Failed to add work type:', data);
            alert('Ошибка при добавлении вида работ');
        }
    })
    .catch(error => {
        console.error('Error adding work type:', error);
        alert('Ошибка при добавлении вида работ');
    });
}

/**
 * Remove work type from estimate row
 */
function removeWorkType(estimateId, workTypeIdsToRemove) {
    const row = estimateData.find(r => r['СметаID'] === estimateId);
    if (!row) return;

    const idsToRemove = workTypeIdsToRemove.split(',');
    let currentWorkTypes = row['Виды работ'] ? row['Виды работ'].split(',').filter(Boolean) : [];

    // Remove the work types
    currentWorkTypes = currentWorkTypes.filter(id => !idsToRemove.includes(id));
    row['Виды работ'] = currentWorkTypes.join(',');

    // Save to server
    saveEstimateWorkTypes(estimateId, row['Виды работ']);

    // Refresh display
    displayEstimateTable(estimateData);
}

/**
 * Clear all work types from estimate row
 */
function clearAllWorkTypes(estimateId) {
    const row = estimateData.find(r => r['СметаID'] === estimateId);
    if (!row) return;

    // Clear work types in local data
    row['Виды работ'] = '';

    // Send command to clear work types in DB: _m_set/{id}?JSON&t6850=%20
    const formData = new FormData();
    formData.append('_xsrf', xsrf);
    fetch(`https://${window.location.host}/${db}/_m_set/${estimateId}?JSON&t6850=%20`, {
        method: 'POST',
        credentials: 'include',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Cleared all work types:', data);
        // Refresh display
        displayEstimateTable(estimateData);
    })
    .catch(error => {
        console.error('Error clearing work types:', error);
    });
}

/**
 * Save estimate work types to server
 */
function saveEstimateWorkTypes(estimateId, workTypes) {
    // This would be an API call to save the work types
    // For now, just log
    console.log(`Saving work types for estimate ${estimateId}:`, workTypes);

    // TODO: Implement actual API call based on your backend
    // fetch(`https://${window.location.host}/${db}/_m_save`, { ... })
}

/**
 * Update estimate field
 */
function updateEstimateField(estimateId, field, value) {
    const row = estimateData.find(r => r['СметаID'] === estimateId);
    if (!row) return;

    // Skip if row is new (not yet saved to DB)
    if (row['isNew'] && field !== 'name') return;

    let apiParam = '';
    switch (field) {
        case 'name':
            row['Смета'] = value;
            apiParam = `t678=${encodeURIComponent(value)}`;
            break;
        case 'quantity':
            row['К-во'] = value;
            apiParam = `t1030=${encodeURIComponent(value)}`;
            break;
        case 'unit':
            row['Ед.изм.ID'] = value;
            const unit = dictionaries.units.find(u => u['Ед.изм.ID'] == value);
            if (unit) row['Ед.изм.'] = unit['Ед.изм.'];
            apiParam = `t1036=${encodeURIComponent(value)}`;
            break;
        case 'price':
            row['Цена за ед.'] = value;
            apiParam = `t6456=${encodeURIComponent(value)}`;
            break;
    }

    // Save to server if not a new row
    if (!row['isNew'] && apiParam) {
        const formData = new FormData();
        formData.append('_xsrf', xsrf);
        fetch(`https://${window.location.host}/${db}/_m_set/${estimateId}?JSON&${apiParam}`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            console.log(`Saved estimate field ${field}:`, data);
        })
        .catch(error => {
            console.error(`Error saving estimate field ${field}:`, error);
        });
    }
}

/**
 * Handle estimate name blur - create or delete row based on name
 */
function handleEstimateNameBlur(estimateId, value) {
    const row = estimateData.find(r => r['СметаID'] === estimateId);
    if (!row) return;

    // If this is a new row and name is filled, save to DB
    if (row['isNew'] && value && value.trim()) {
        const formData = new FormData();
        formData.append('_xsrf', xsrf);
        fetch(`https://${window.location.host}/${db}/_m_new/678?JSON&up=${selectedProject['ПроектID']}&t678=${encodeURIComponent(value)}`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.obj) {
                // Update local row with real ID
                row['СметаID'] = data.obj;
                row['isNew'] = false;
                row['Смета'] = value;
                // Refresh display to show all fields
                displayEstimateTable(estimateData);
            }
        })
        .catch(error => {
            console.error('Error creating estimate row:', error);
        });
    }
    // If existing row and name is cleared, delete the row
    else if (!row['isNew'] && (!value || !value.trim())) {
        deleteEstimateRowDirect(estimateId);
    }
}

/**
 * Delete estimate row directly without confirmation
 */
function deleteEstimateRowDirect(estimateId) {
    const row = estimateData.find(r => r['СметаID'] === estimateId);
    if (!row) return;

    // If it's a new row that hasn't been saved, just remove from local data
    if (row['isNew']) {
        estimateData = estimateData.filter(r => r['СметаID'] !== estimateId);
        displayEstimateTable(estimateData);
        return;
    }

    // Delete from server
    const formData = new FormData();
    formData.append('_xsrf', xsrf);
    fetch(`https://${window.location.host}/${db}/_m_del/${estimateId}?JSON`, {
        method: 'POST',
        credentials: 'include',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Deleted estimate row:', data);
        estimateData = estimateData.filter(r => r['СметаID'] !== estimateId);
        displayEstimateTable(estimateData);
    })
    .catch(error => {
        console.error('Error deleting estimate row:', error);
    });
}

/**
 * Recalculate estimate sum for a row
 */
function recalculateEstimateSum(estimateId) {
    const tr = document.querySelector(`tr[data-estimate-id="${estimateId}"]`);
    if (!tr) return;

    const quantityInput = tr.querySelector('td:nth-child(3) input');
    const priceInput = tr.querySelector('td:nth-child(5) input');
    const sumCell = tr.querySelector('.sum-cell');

    const quantity = parseFloat(quantityInput.value) || 0;
    const price = parseFloat(priceInput.value) || 0;
    const sum = quantity * price;

    sumCell.textContent = sum > 0 ? sum.toFixed(2) : '';
    sumCell.dataset.sum = sum;

    // Recalculate total
    recalculateEstimateTotal();
}

/**
 * Recalculate total sum for estimate
 */
function recalculateEstimateTotal() {
    let total = 0;
    document.querySelectorAll('#estimateTableBody .sum-cell').forEach(cell => {
        total += parseFloat(cell.dataset.sum) || 0;
    });
    document.getElementById('estimateTotalSum').textContent = total.toFixed(2);
}

/**
 * Add estimate drag handlers
 */
function addEstimateDragHandlers() {
    const rows = document.querySelectorAll('#estimateTableBody tr');
    rows.forEach(row => {
        row.addEventListener('dragstart', handleEstimateDragStart);
        row.addEventListener('dragover', handleEstimateDragOver);
        row.addEventListener('drop', handleEstimateDrop);
        row.addEventListener('dragend', handleEstimateDragEnd);
    });
}

let draggedEstimateRow = null;

function handleEstimateDragStart(e) {
    draggedEstimateRow = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleEstimateDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleEstimateDrop(e) {
    e.stopPropagation();

    if (draggedEstimateRow !== this) {
        const rect = this.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;

        if (e.clientY < midpoint) {
            this.parentNode.insertBefore(draggedEstimateRow, this);
        } else {
            this.parentNode.insertBefore(draggedEstimateRow, this.nextSibling);
        }

        // Update row numbers and save order
        updateEstimateRowNumbers();
        saveEstimateOrder();
    }

    return false;
}

function handleEstimateDragEnd(e) {
    this.classList.remove('dragging');
}

/**
 * Update row numbers after reordering
 */
function updateEstimateRowNumbers() {
    const rows = document.querySelectorAll('#estimateTableBody tr');
    rows.forEach((row, index) => {
        row.querySelector('.row-number').textContent = index + 1;
    });
}

/**
 * Save estimate order to server
 * Only saves the order of the dragged element, backend recalculates others
 */
function saveEstimateOrder() {
    if (!draggedEstimateRow) return;

    const rows = Array.from(document.querySelectorAll('#estimateTableBody tr'));
    const estimateId = draggedEstimateRow.dataset.estimateId;
    const newOrder = rows.indexOf(draggedEstimateRow) + 1;

    // Skip if it's a new row (not yet saved to DB)
    if (estimateId.startsWith('new_')) {
        console.log('Skipping order save for new row');
        return;
    }

    // Save order using _m_ord endpoint
    const formData = new FormData();
    formData.append('_xsrf', xsrf);
    formData.append('order', newOrder);

    fetch(`https://${window.location.host}/${db}/_m_ord/${estimateId}?JSON`, {
        method: 'POST',
        credentials: 'include',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Saved estimate order:', { id: estimateId, order: newOrder, response: data });
    })
    .catch(error => {
        console.error('Error saving estimate order:', error);
    });
}

/**
 * Add new estimate row
 */
function addEstimateRow() {
    if (!selectedProject) return;

    // Create a new placeholder row - will be saved to DB when name is filled
    const newRow = {
        'СметаID': 'new_' + Date.now(),
        'СметаOrder': (estimateData.length + 1).toString(),
        'Смета': '',
        'К-во': '',
        'Цена за ед.': '',
        'Ед.изм.': '',
        'Виды работ': '',
        'isNew': true  // Mark as new row
    };

    estimateData.push(newRow);
    displayEstimateTable(estimateData);

    // Focus on the name input of the new row
    setTimeout(() => {
        const newRowEl = document.querySelector(`tr[data-estimate-id="${newRow['СметаID']}"] input[type="text"]`);
        if (newRowEl) newRowEl.focus();
    }, 100);
}

/**
 * Delete estimate row
 */
function deleteEstimateRow(estimateId) {
    pendingDeleteEstimateRowId = estimateId;
    document.getElementById('deleteEstimateModalBackdrop').classList.add('show');
}

function closeDeleteEstimateModal() {
    document.getElementById('deleteEstimateModalBackdrop').classList.remove('show');
    pendingDeleteEstimateRowId = null;
}

function confirmDeleteEstimateRow() {
    if (!pendingDeleteEstimateRowId) {
        closeDeleteEstimateModal();
        return;
    }

    const estimateId = pendingDeleteEstimateRowId;
    const row = estimateData.find(r => r['СметаID'] === estimateId);

    // If it's a new row, just remove from local data
    if (row && row['isNew']) {
        estimateData = estimateData.filter(r => r['СметаID'] !== estimateId);
        displayEstimateTable(estimateData);
        closeDeleteEstimateModal();
        return;
    }

    // Delete from server
    const formData = new FormData();
    formData.append('_xsrf', xsrf);
    fetch(`https://${window.location.host}/${db}/_m_del/${estimateId}?JSON`, {
        method: 'POST',
        credentials: 'include',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Deleted estimate row:', data);
        estimateData = estimateData.filter(r => r['СметаID'] !== estimateId);
        displayEstimateTable(estimateData);
    })
    .catch(error => {
        console.error('Error deleting estimate row:', error);
        alert('Ошибка при удалении строки');
    })
    .finally(() => {
        closeDeleteEstimateModal();
    });
}

/**
 * Load constructions data with nested estimate positions and products
 */
function loadConstructionsData(projectId) {
    // Load all four datasets in parallel
    Promise.all([
        fetch(`https://${window.location.host}/${db}/report/6665?JSON_KV&FR_ProjectID=${projectId}`).then(r => r.json()),
        fetch(`https://${window.location.host}/${db}/report/7148?JSON_KV&FR_ProjectID=${projectId}`).then(r => r.json()),
        fetch(`https://${window.location.host}/${db}/report/6503?JSON_KV&FR_ProjectID=${projectId}`).then(r => r.json()),
        fetch(`https://${window.location.host}/${db}/report/5977?JSON_KV&FR_ProjectID=${projectId}`).then(r => r.json())
    ])
    .then(([constructions, estimatePositions, products, operations]) => {
        constructionsData = constructions || [];
        constructionEstimatePositions = estimatePositions || [];
        constructionProducts = products || [];
        operationsData = operations || [];

        // Debug logging to verify data is loaded
        console.log('Constructions loaded:', constructionsData.length, 'items');
        console.log('Estimate positions loaded:', constructionEstimatePositions.length, 'items');
        console.log('Products loaded:', constructionProducts.length, 'items');
        console.log('Operations loaded:', operationsData.length, 'items');

        if (constructionEstimatePositions.length > 0) {
            console.log('Sample estimate position:', constructionEstimatePositions[0]);
            console.log('Estimate position fields:', Object.keys(constructionEstimatePositions[0]));
        }

        if (constructionProducts.length > 0) {
            console.log('Sample product:', constructionProducts[0]);
            console.log('Product fields:', Object.keys(constructionProducts[0]));
        }

        if (operationsData.length > 0) {
            console.log('Sample operation:', operationsData[0]);
            console.log('Operation fields:', Object.keys(operationsData[0]));
        }

        displayConstructionsTable(constructionsData);
        updateOperationsButtons();
    })
    .catch(error => {
        console.error('Error loading constructions data:', error);
        constructionsData = [];
        constructionEstimatePositions = [];
        constructionProducts = [];
        operationsData = [];
        displayConstructionsTable([]);
    });
}

/**
 * Display constructions table with flattened rows using rowspan
 */
function displayConstructionsTable(data) {
    const tbody = document.getElementById('constructionsTableBody');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="23" class="no-data-cell">Нет данных о конструкциях</td></tr>';
        return;
    }

    // Sort by order
    const sortedData = [...data].sort((a, b) => {
        const orderA = parseInt(a['КонструкцияOrder'] || 0);
        const orderB = parseInt(b['КонструкцияOrder'] || 0);
        return orderA - orderB;
    });

    let html = '';

    sortedData.forEach((row, index) => {
        const constructionId = row['КонструкцияID'];

        // Get estimate positions for this construction
        const estimatePositions = constructionEstimatePositions.filter(
            ep => String(ep['КонструкцияID']) === String(constructionId)
        );

        // Build flat rows for this construction
        const flatRows = buildFlatConstructionRows(row, estimatePositions, index + 1);
        html += flatRows;
    });

    tbody.innerHTML = html;

    // Apply saved column visibility to newly rendered cells
    applyColumnVisibility();
    applyProductDetailsVisibility();

    // Populate filter options after table is rendered
    populateFilterOptions();

    // Restore collapsed estimate positions from cookies
    restoreCollapsedState();
}

/**
 * Build flat rows for a construction with rowspan for merged cells
 */
function buildFlatConstructionRows(construction, estimatePositions, rowNumber) {
    // Calculate total rows needed for this construction
    let totalRows = 0;
    const positionData = [];

    if (estimatePositions.length === 0) {
        // No estimate positions - single row with empty product cells
        totalRows = 1;
        positionData.push({ position: null, products: [], rowCount: 1 });
    } else {
        const constructionId = construction['КонструкцияID'];
        estimatePositions.forEach(pos => {
            const estimateId = pos['Позиция сметыID'];
            // Filter products by BOTH construction ID AND estimate position ID
            const products = constructionProducts.filter(p => {
                const productConstructionId = p['КонструкцияID'];
                const productPositionId = p['Позиция сметыID'] || p['Смета проектаID'];
                return String(productConstructionId) === String(constructionId) &&
                       String(productPositionId) === String(estimateId);
            });
            const rowCount = Math.max(1, products.length);
            totalRows += rowCount;
            positionData.push({ position: pos, products, rowCount });
        });
    }

    let html = '';
    let isFirstRowOfConstruction = true;

    positionData.forEach((pd, posIndex) => {
        const { position, products, rowCount } = pd;
        let isFirstRowOfPosition = true;

        if (products.length === 0) {
            // No products - single row with empty product cells
            html += '<tr>';

            // Construction cells (only on first row)
            if (isFirstRowOfConstruction) {
                const rs = totalRows > 1 ? `rowspan="${totalRows}"` : '';
                const cid = construction['КонструкцияID'];
                html += `<td class="row-number" ${rs}>${rowNumber}</td>`;
                html += `<td class="col-checkbox" ${rs}><input type="checkbox" class="compact-checkbox" data-type="construction" data-id="${cid}" onchange="updateBulkDeleteButtonVisibility()"></td>`;
                html += `<td class="construction-cell editable" ${rs} data-construction-id="${cid}" data-field="t6132" data-save-method="save" onclick="editConstructionCell(this)">${escapeHtml(construction['Конструкция'] || '—')}</td>`;
                html += `<td data-col="doc" ${rs}>${formatDocumentationLinks(construction['Документация по конструкции'], cid, 'construction')}</td>`;
                html += `<td class="construction-cell editable" data-col="zahvatka" ${rs} data-construction-id="${cid}" data-field="t6989" data-save-method="set" onclick="editConstructionCell(this)">${escapeHtml(construction['Захватка'] || '—')}</td>`;
                html += `<td class="construction-cell editable" data-col="osi" ${rs} data-construction-id="${cid}" data-field="t6991" data-save-method="set" onclick="editConstructionCell(this)">${escapeHtml(construction['Оси'] || '—')}</td>`;
                html += `<td class="construction-cell editable" data-col="vysotm" ${rs} data-construction-id="${cid}" data-field="t6993" data-save-method="set" onclick="editConstructionCell(this)">${escapeHtml(construction['Высотные отметки'] || '—')}</td>`;
                html += `<td class="construction-cell editable" data-col="etazh" ${rs} data-construction-id="${cid}" data-field="t6995" data-save-method="set" onclick="editConstructionCell(this)">${escapeHtml(construction['Этаж'] || '—')}</td>`;
                isFirstRowOfConstruction = false;
            }

            // Estimate position checkbox and cell (with tooltip showing position ID)
            const posId = position ? (position['Позиция сметыID'] || '?') : '';
            const constId = construction['КонструкцияID'];
            html += `<td class="col-checkbox"><input type="checkbox" class="compact-checkbox" data-type="estimate" data-id="${posId}" data-construction-id="${constId}" onchange="updateBulkAddIconVisibility(); updateBulkDeleteButtonVisibility()" ${position ? '' : 'disabled'}></td>`;
            html += `<td class="estimate-cell" title="Позиция сметыID: ${posId}">${position ? escapeHtml(position['Позиция сметы'] || '—') + `<span class="add-product-icon" onclick="showProductSelector(event, '${constId}', '${posId}')" title="Добавить изделие">+</span>` : '—'}</td>`;

            // Empty product checkbox and cells
            html += '<td class="col-checkbox"><input type="checkbox" class="compact-checkbox" data-type="product" disabled></td>';
            html += '<td class="product-cell">—</td>'; // Изделие
            html += '<td class="product-cell">—</td>'; // Маркировка
            html += '<td class="product-cell">—</td>'; // Докум.
            html += '<td class="product-cell" data-col="product-detail">—</td>'; // Выс.пола
            html += '<td class="product-cell" data-col="product-detail">—</td>'; // Длина
            html += '<td class="product-cell" data-col="product-detail">—</td>'; // Высота
            html += '<td class="product-cell" data-col="product-detail">—</td>'; // Периметр
            html += '<td class="product-cell" data-col="product-detail">—</td>'; // Площадь
            html += '<td class="product-cell" data-col="product-detail">—</td>'; // Вес м²
            html += '<td class="product-cell" data-col="product-detail">—</td>'; // Вес 1шт
            html += '<td class="product-cell">—</td>'; // Ед.изм.
            html += '<td class="product-cell">—</td>'; // Кол-во

            html += '</tr>';
        } else {
            // Has products - create row for each product
            products.forEach((prod, prodIndex) => {
                html += '<tr>';

                // Construction cells (only on first row of entire construction)
                if (isFirstRowOfConstruction) {
                    const rs = totalRows > 1 ? `rowspan="${totalRows}"` : '';
                    const cid = construction['КонструкцияID'];
                    html += `<td class="row-number" ${rs}>${rowNumber}</td>`;
                    html += `<td class="col-checkbox" ${rs}><input type="checkbox" class="compact-checkbox" data-type="construction" data-id="${cid}" onchange="updateBulkDeleteButtonVisibility()"></td>`;
                    html += `<td class="construction-cell editable" ${rs} data-construction-id="${cid}" data-field="t6132" data-save-method="save" onclick="editConstructionCell(this)">${escapeHtml(construction['Конструкция'] || '—')}</td>`;
                    html += `<td data-col="doc" ${rs}>${formatDocumentationLinks(construction['Документация по конструкции'], cid, 'construction')}</td>`;
                    html += `<td class="construction-cell editable" data-col="zahvatka" ${rs} data-construction-id="${cid}" data-field="t6989" data-save-method="set" onclick="editConstructionCell(this)">${escapeHtml(construction['Захватка'] || '—')}</td>`;
                    html += `<td class="construction-cell editable" data-col="osi" ${rs} data-construction-id="${cid}" data-field="t6991" data-save-method="set" onclick="editConstructionCell(this)">${escapeHtml(construction['Оси'] || '—')}</td>`;
                    html += `<td class="construction-cell editable" data-col="vysotm" ${rs} data-construction-id="${cid}" data-field="t6993" data-save-method="set" onclick="editConstructionCell(this)">${escapeHtml(construction['Высотные отметки'] || '—')}</td>`;
                    html += `<td class="construction-cell editable" data-col="etazh" ${rs} data-construction-id="${cid}" data-field="t6995" data-save-method="set" onclick="editConstructionCell(this)">${escapeHtml(construction['Этаж'] || '—')}</td>`;
                    isFirstRowOfConstruction = false;
                }

                // Estimate position checkbox and cell (only on first row of this position, with tooltip showing position ID)
                if (isFirstRowOfPosition) {
                    const positionId = position['Позиция сметыID'] || '?';
                    const constIdForIcon = construction['КонструкцияID'];
                    const rsPos = rowCount > 1 ? `rowspan="${rowCount}"` : '';
                    html += `<td class="col-checkbox" ${rsPos}><input type="checkbox" class="compact-checkbox" data-type="estimate" data-id="${positionId}" data-construction-id="${constIdForIcon}" onchange="updateBulkAddIconVisibility(); updateBulkDeleteButtonVisibility()"></td>`;
                    html += `<td class="estimate-cell" title="Позиция сметыID: ${positionId}" ${rsPos}>${escapeHtml(position['Позиция сметы'] || '—')}<span class="add-product-icon" onclick="showProductSelector(event, '${constIdForIcon}', '${positionId}')" title="Добавить изделие">+</span></td>`;
                    isFirstRowOfPosition = false;
                }

                // Product checkbox and cells (using field names from API with fallbacks)
                // First cell (Изделие) has tooltip showing which position this product belongs to
                const prodPositionId = prod['Позиция сметыID'] || prod['Смета проектаID'] || '?';
                // Use the position's estimate ID directly since we're already in that context
                // and products are filtered to belong to this specific position
                // Fixed: Check if position exists AND has the field (not just if position exists)
                const estimateId = (position && position['Позиция сметыID']) || prod['Позиция сметыID'] || prod['Смета проектаID'] || '';
                const prodId = prod['ИзделиеID'] || '?';
                const unitId = prod['Ед. изм ID'] || prod['ЕдИзмID'] || '';
                // Look up unit name from dictionaries
                const unit = unitId ? dictionaries.units.find(u => u['Ед.изм.ID'] == unitId) : null;
                const unitName = unit ? unit['Ед.изм.'] : (prod['Ед. изм'] || '—');
                html += `<td class="col-checkbox"><input type="checkbox" class="compact-checkbox" data-type="product" data-id="${prodId}" onchange="updateBulkDeleteButtonVisibility()"></td>`;
                html += `<td class="product-cell product-cell-with-operations" title="Позиция сметыID: ${prodPositionId}">
                    <span class="product-name">${escapeHtml(prod['Изделие'] || '—')}</span>
                    <button class="btn-view-operations"
                        data-product-id="${prodId}"
                        data-product-name="${escapeHtml(prod['Изделие'] || '')}"
                        data-construction="${escapeHtml(construction['Конструкция'] || '')}"
                        data-estimate-position="${escapeHtml(position['Позиция сметы'] || '')}"
                        data-estimate-position-id="${prodPositionId}"
                        data-estimate-id="${estimateId}"
                        data-zahvatka="${escapeHtml(construction['Захватка'] || '')}"
                        data-osi="${escapeHtml(construction['Оси'] || '')}"
                        data-vysotnie-otmetki="${escapeHtml(construction['Высотные отметки'] || '')}"
                        data-etazh="${escapeHtml(construction['Этаж'] || '')}"
                        data-markirovka="${escapeHtml(prod['Маркировка'] || '')}"
                        data-vysota-ot-pola="${escapeHtml(prod['Высота от пола мм'] || '')}"
                        data-dlina="${escapeHtml(prod['Длина, м'] || prod['Длина мм'] || '')}"
                        data-vysota="${escapeHtml(prod['Высота, м'] || prod['Высота мм'] || '')}"
                        data-ves-m2="${escapeHtml(prod['Вес на м2, кг'] || prod['Вес м2/кг'] || '')}"
                        data-ed-izm="${escapeHtml(unitName)}"
                        data-kolichestvo="${escapeHtml(prod['Количество'] || '')}"
                        onclick="showOperationsModal(event, this)"
                        title="Просмотр операций"
                        style="display: none;">
                        <span class="operations-count">0</span>
                    </button>
                </td>`;
                html += `<td class="product-cell editable" data-product-id="${prodId}" data-field="t6997" data-field-type="text" onclick="editProductCell(this)">${escapeHtml(prod['Маркировка'] || '—')}</td>`;
                html += `<td class="product-cell">${formatDocumentationLinks(prod['Документация'] || prod['Документация по изделию'] || prod['Вид документации'], prodId, 'product')}</td>`;
                html += `<td class="product-cell editable" data-col="product-detail" data-product-id="${prodId}" data-field="t6999" data-field-type="number" onclick="editProductCell(this)">${escapeHtml(prod['Высота от пола мм'] || '—')}</td>`;
                html += `<td class="product-cell editable" data-col="product-detail" data-product-id="${prodId}" data-field="t6136" data-field-type="number" onclick="editProductCell(this)">${escapeHtml(prod['Длина, м'] || prod['Длина мм'] || '—')}</td>`;
                html += `<td class="product-cell editable" data-col="product-detail" data-product-id="${prodId}" data-field="t6144" data-field-type="number" onclick="editProductCell(this)">${escapeHtml(prod['Высота, м'] || prod['Высота мм'] || '—')}</td>`;
                html += `<td class="product-cell editable" data-col="product-detail" data-product-id="${prodId}" data-field="t6140" data-field-type="number" onclick="editProductCell(this)">${escapeHtml(prod['Периметр'] || prod['Периметр м'] || '—')}</td>`;
                html += `<td class="product-cell editable" data-col="product-detail" data-product-id="${prodId}" data-field="t6142" data-field-type="number" onclick="editProductCell(this)">${escapeHtml(prod['Площадь, м2'] || prod['Площадь м2'] || '—')}</td>`;
                html += `<td class="product-cell editable" data-col="product-detail" data-product-id="${prodId}" data-field="t6146" data-field-type="number" onclick="editProductCell(this)">${escapeHtml(prod['Вес на м2, кг'] || prod['Вес м2/кг'] || '—')}</td>`;
                html += `<td class="product-cell editable" data-col="product-detail" data-product-id="${prodId}" data-field="t6138" data-field-type="number" onclick="editProductCell(this)">${escapeHtml(prod['Вес, кг'] || prod['Вес одной'] || '—')}</td>`;
                html += `<td class="product-cell editable" data-product-id="${prodId}" data-field="t7238" data-field-type="select" data-current-id="${unitId}" onclick="editProductCell(this)">${escapeHtml(unitName)}</td>`;
                html += `<td class="product-cell editable" data-product-id="${prodId}" data-field="t7237" data-field-type="number" onclick="editProductCell(this)">${escapeHtml(prod['Количество'] || '—')}</td>`;

                html += '</tr>';
            });
        }
    });

    return html;
}

/**
 * Update construction field
 */
function updateConstructionField(constructionId, field, value) {
    const row = constructionsData.find(r => r['КонструкцияID'] === constructionId);
    if (!row) return;

    switch (field) {
        case 'name':
            row['Конструкция'] = value;
            break;
    }

    // TODO: Save to server
    console.log(`Updating construction ${constructionId}, ${field}:`, value);
}

/**
 * Add constructions drag handlers
 */
function addConstructionsDragHandlers() {
    const rows = document.querySelectorAll('#constructionsTableBody tr');
    rows.forEach(row => {
        row.addEventListener('dragstart', handleConstructionDragStart);
        row.addEventListener('dragover', handleConstructionDragOver);
        row.addEventListener('drop', handleConstructionDrop);
        row.addEventListener('dragend', handleConstructionDragEnd);
    });
}

let draggedConstructionRow = null;

function handleConstructionDragStart(e) {
    draggedConstructionRow = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleConstructionDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleConstructionDrop(e) {
    e.stopPropagation();

    if (draggedConstructionRow !== this) {
        const rect = this.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;

        if (e.clientY < midpoint) {
            this.parentNode.insertBefore(draggedConstructionRow, this);
        } else {
            this.parentNode.insertBefore(draggedConstructionRow, this.nextSibling);
        }

        // Update row numbers and save order
        updateConstructionRowNumbers();
        saveConstructionOrder();
    }

    return false;
}

function handleConstructionDragEnd(e) {
    this.classList.remove('dragging');
}

/**
 * Update row numbers after reordering
 */
function updateConstructionRowNumbers() {
    const rows = document.querySelectorAll('#constructionsTableBody tr');
    rows.forEach((row, index) => {
        row.querySelector('.row-number').textContent = index + 1;
    });
}

/**
 * Save construction order to server
 */
function saveConstructionOrder() {
    const rows = document.querySelectorAll('#constructionsTableBody tr');
    const orders = [];

    rows.forEach((row, index) => {
        const constructionId = row.dataset.constructionId;
        orders.push({ id: constructionId, order: index + 1 });
    });

    // TODO: Implement actual API call
    console.log('Saving construction order:', orders);
}

/**
 * Add new construction row (legacy function)
 */
function addConstructionRow() {
    promptAddConstruction();
}

/**
 * Show modal for adding construction(s)
 */
function promptAddConstruction() {
    if (!selectedProject) {
        alert('Выберите проект');
        return;
    }

    // Clear previous input
    document.getElementById('constructionNamesInput').value = '';

    // Show modal
    document.getElementById('addConstructionModalBackdrop').classList.add('show');

    // Focus on textarea
    setTimeout(() => {
        document.getElementById('constructionNamesInput').focus();
    }, 100);
}

/**
 * Close add construction modal
 */
function closeAddConstructionModal() {
    document.getElementById('addConstructionModalBackdrop').classList.remove('show');
}

/**
 * Create a single construction via API
 */
function createSingleConstruction(projectId, constructionName) {
    const url = `https://${window.location.host}/${db}/_m_new/6132?JSON&up=${projectId}`;

    const formData = new FormData();
    formData.append('t6132', constructionName.trim());
    if (typeof xsrf !== 'undefined' && xsrf) {
        formData.append('_xsrf', xsrf);
    }

    return fetch(url, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.obj) {
            return { success: true, name: constructionName };
        } else {
            return { success: false, name: constructionName, error: 'API returned no object' };
        }
    })
    .catch(error => {
        console.error('Error creating construction:', error);
        return { success: false, name: constructionName, error: error.message };
    });
}

/**
 * Process construction names from textarea and insert them one by one
 */
async function processBatchConstructions(event) {
    event.preventDefault();

    const projectId = selectedProject['ПроектID'];
    const inputText = document.getElementById('constructionNamesInput').value;

    // Parse input: split by newlines and filter out empty/whitespace-only lines
    const lines = inputText.split('\n');
    const constructionNames = lines
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (constructionNames.length === 0) {
        alert('Введите хотя бы одно название конструкции');
        return;
    }

    // Close the add construction modal
    closeAddConstructionModal();

    // Show progress modal
    const progressBackdrop = document.getElementById('constructionProgressBackdrop');
    const progressCounter = document.getElementById('constructionProgressCounter');
    progressBackdrop.classList.add('show');

    const totalCount = constructionNames.length;
    let successCount = 0;
    let failedConstructions = [];

    // Insert constructions one by one
    for (let i = 0; i < constructionNames.length; i++) {
        const name = constructionNames[i];
        const currentIndex = i + 1;

        // Update progress counter
        progressCounter.textContent = `${currentIndex} из ${totalCount}`;

        // Insert construction and wait for response
        const result = await createSingleConstruction(projectId, name);

        if (result.success) {
            successCount++;
        } else {
            failedConstructions.push(`${name}: ${result.error}`);
        }
    }

    // Hide progress modal
    progressBackdrop.classList.remove('show');

    // Reload constructions table to show the new rows
    loadConstructionsData(projectId);

    // Show result message
    if (failedConstructions.length === 0) {
        alert(`Успешно добавлено конструкций: ${successCount}`);
    } else {
        const failedList = failedConstructions.join('\n');
        alert(`Успешно добавлено: ${successCount}\nОшибки (${failedConstructions.length}):\n${failedList}`);
    }
}

// Attach form submit handler when DOM is ready
(function() {
    function attachConstructionFormHandler() {
        const addConstructionForm = document.getElementById('addConstructionForm');
        if (addConstructionForm) {
            addConstructionForm.addEventListener('submit', processBatchConstructions);
        }
    }

    // Try to attach immediately if DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachConstructionFormHandler);
    } else {
        attachConstructionFormHandler();
    }
})();

/**
 * Delete construction row
 */
function deleteConstructionRow(constructionId) {
    pendingDeleteConstructionRowId = constructionId;
    document.getElementById('deleteConstructionModalBackdrop').classList.add('show');
}

function closeDeleteConstructionModal() {
    document.getElementById('deleteConstructionModalBackdrop').classList.remove('show');
    pendingDeleteConstructionRowId = null;
}

function confirmDeleteConstructionRow() {
    if (!pendingDeleteConstructionRowId) {
        closeDeleteConstructionModal();
        return;
    }

    // TODO: Implement API call to delete
    console.log('Deleting construction row:', pendingDeleteConstructionRowId);

    // Remove from local data
    constructionsData = constructionsData.filter(r => r['КонструкцияID'] !== pendingDeleteConstructionRowId);
    displayConstructionsTable(constructionsData);

    closeDeleteConstructionModal();
}

/**
 * Show edit project modal
 */
function showEditProjectModal() {
    if (!selectedProject) return;

    document.getElementById('projectModalTitle').textContent = 'Редактировать проект';
    document.getElementById('projectId').value = selectedProject['ПроектID'];
    document.getElementById('projectName').value = selectedProject['Проект'] || '';
    document.getElementById('projectDescription').value = selectedProject['Описание'] || '';

    // Find and set client
    const clientId = dictionaries.clients.find(c => c['Заказчик'] === selectedProject['Заказчик'])?.['ЗаказчикID'];
    document.getElementById('projectClient').value = clientId || '';

    // Find and set object
    const objectId = dictionaries.objects.find(o => o['Объект'] === selectedProject['Объект'])?.['Объект ID'];
    document.getElementById('projectObject').value = objectId || '';

    // Set dates
    if (selectedProject['Старт']) {
        const startDate = parseDate(selectedProject['Старт']);
        if (startDate) {
            document.getElementById('projectStart').value = startDate.toISOString().split('T')[0];
        }
    }

    if (selectedProject['Срок']) {
        const endDate = parseDate(selectedProject['Срок']);
        if (endDate) {
            document.getElementById('projectDeadline').value = endDate.toISOString().split('T')[0];
        }
    }

    // Calculate duration
    if (selectedProject['Старт'] && selectedProject['Срок']) {
        const start = parseDate(selectedProject['Старт']);
        const end = parseDate(selectedProject['Срок']);
        if (start && end) {
            const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            document.getElementById('projectDuration').value = diffDays >= 0 ? diffDays : '';
        }
    }

    document.getElementById('projectModalBackdrop').classList.add('show');
}

function closeProjectModal() {
    document.getElementById('projectModalBackdrop').classList.remove('show');
}

/**
 * Setup form handlers
 */
function setupFormHandlers() {
    // Project form
    const projectForm = document.getElementById('projectForm');
    if (projectForm) {
        projectForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveProject();
        });
    }

    // Client form
    const clientForm = document.getElementById('clientForm');
    if (clientForm) {
        clientForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveClient();
        });
    }

    // Object form
    const objectForm = document.getElementById('objectForm');
    if (objectForm) {
        objectForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveObject();
        });
    }

    // Create Operation form
    const createOperationForm = document.getElementById('createOperationForm');
    if (createOperationForm) {
        createOperationForm.addEventListener('submit', saveNewOperation);
    }

    // Duration calculation
    const startInput = document.getElementById('projectStart');
    const durationInput = document.getElementById('projectDuration');
    const deadlineInput = document.getElementById('projectDeadline');

    if (startInput && durationInput && deadlineInput) {
        startInput.addEventListener('change', calculateEndDateFromDuration);
        durationInput.addEventListener('input', calculateEndDateFromDuration);
        deadlineInput.addEventListener('change', calculateDurationFromEndDate);
    }
}

function calculateEndDateFromDuration() {
    const startDate = document.getElementById('projectStart').value;
    const duration = parseInt(document.getElementById('projectDuration').value);

    if (startDate && duration && duration > 0) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(end.getDate() + duration);
        document.getElementById('projectDeadline').value = end.toISOString().split('T')[0];
    }
}

function calculateDurationFromEndDate() {
    const startDate = document.getElementById('projectStart').value;
    const endDate = document.getElementById('projectDeadline').value;

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
            document.getElementById('projectDuration').value = diffDays;
        }
    }
}

/**
 * Save project
 */
function saveProject() {
    const projectId = document.getElementById('projectId').value;
    const name = document.getElementById('projectName').value;
    const description = document.getElementById('projectDescription').value;
    const clientId = document.getElementById('projectClient').value;
    const objectId = document.getElementById('projectObject').value;
    const startDate = document.getElementById('projectStart').value;
    const deadline = document.getElementById('projectDeadline').value;

    // TODO: Implement actual API call
    console.log('Saving project:', { projectId, name, description, clientId, objectId, startDate, deadline });

    // Update local data
    if (selectedProject) {
        selectedProject['Проект'] = name;
        selectedProject['Описание'] = description;
        selectedProject['Заказчик'] = dictionaries.clients.find(c => c['ЗаказчикID'] === clientId)?.['Заказчик'] || '';
        selectedProject['Объект'] = dictionaries.objects.find(o => o['Объект ID'] === objectId)?.['Объект'] || '';
        selectedProject['Старт'] = startDate;
        selectedProject['Срок'] = deadline;

        projectInfo = selectedProject;
        updateProjectHeader();
    }

    closeProjectModal();
    alert('Проект сохранен');
}

/**
 * Show add client modal
 */
function showAddClientModal() {
    document.getElementById('clientName').value = '';
    document.getElementById('clientModalBackdrop').classList.add('show');
}

function closeClientModal() {
    document.getElementById('clientModalBackdrop').classList.remove('show');
}

function saveClient() {
    const name = document.getElementById('clientName').value;

    // TODO: Implement actual API call
    console.log('Saving client:', name);

    closeClientModal();
    alert('Заказчик добавлен');
}

/**
 * Show add object modal
 */
function showAddObjectModal() {
    document.getElementById('objectName').value = '';
    document.getElementById('objectCoordinates').value = '';
    document.getElementById('objectModalBackdrop').classList.add('show');
}

function closeObjectModal() {
    document.getElementById('objectModalBackdrop').classList.remove('show');
}

function saveObject() {
    const name = document.getElementById('objectName').value;
    const coordinates = document.getElementById('objectCoordinates').value;

    // TODO: Implement actual API call
    console.log('Saving object:', { name, coordinates });

    closeObjectModal();
    alert('Объект добавлен');
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Parse date string in DD.MM.YYYY format (or fallback to standard Date parsing)
 */
function parseDate(dateStr) {
    if (!dateStr) return null;

    // Check if date is in DD.MM.YYYY format
    const ddmmyyyyMatch = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (ddmmyyyyMatch) {
        const [, day, month, year] = ddmmyyyyMatch;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // Fallback to standard Date parsing
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Cookie helper functions for work type selector size
 */
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) === 0) {
            return c.substring(nameEQ.length);
        }
    }
    return null;
}

/**
 * Initialize work type selector size from cookies
 */
function initWorkTypeSelectorSize() {
    const selector = document.getElementById('workTypeSelector');
    if (!selector) return;

    const savedWidth = getCookie('workTypeSelectorWidth');
    const savedHeight = getCookie('workTypeSelectorHeight');

    if (savedWidth) {
        selector.style.width = savedWidth + 'px';
    }
    if (savedHeight) {
        selector.style.height = savedHeight + 'px';
    }

    // Save size on resize
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            if (!selector.classList.contains('hidden')) {
                setCookie('workTypeSelectorWidth', entry.contentRect.width, 365);
                setCookie('workTypeSelectorHeight', entry.contentRect.height, 365);
            }
        }
    });
    resizeObserver.observe(selector);
}

/**
 * Column visibility management for Constructions table
 */
const HIDEABLE_COLUMNS = ['doc', 'zahvatka', 'osi', 'vysotm', 'etazh'];
const COLUMN_VISIBILITY_KEY = 'constructionsColumnVisibility';

/**
 * Toggle visibility of a single column
 */
function toggleColumn(colName, visible) {
    // Update header
    const headerCell = document.querySelector(`.constructions-table th[data-col="${colName}"]`);
    if (headerCell) {
        headerCell.classList.toggle('col-hidden', !visible);
    }

    // Update body cells
    document.querySelectorAll(`.constructions-table td[data-col="${colName}"]`).forEach(cell => {
        cell.classList.toggle('col-hidden', !visible);
    });

    // Save to localStorage
    saveColumnVisibility();

    // Update "All" checkbox state
    updateToggleAllCheckbox();
}

/**
 * Toggle all hideable columns at once
 */
function toggleAllHideableColumns(visible) {
    HIDEABLE_COLUMNS.forEach(colName => {
        // Update checkbox
        const checkbox = document.querySelector(`.column-controls input[data-col="${colName}"]`);
        if (checkbox) {
            checkbox.checked = visible;
        }

        // Update header
        const headerCell = document.querySelector(`.constructions-table th[data-col="${colName}"]`);
        if (headerCell) {
            headerCell.classList.toggle('col-hidden', !visible);
        }

        // Update body cells
        document.querySelectorAll(`.constructions-table td[data-col="${colName}"]`).forEach(cell => {
            cell.classList.toggle('col-hidden', !visible);
        });
    });

    // Save to localStorage
    saveColumnVisibility();
}

/**
 * Update the "All" checkbox based on individual checkbox states
 */
function updateToggleAllCheckbox() {
    const allCheckbox = document.getElementById('toggleAllHideable');
    if (!allCheckbox) return;

    const allChecked = HIDEABLE_COLUMNS.every(colName => {
        const checkbox = document.querySelector(`.column-controls input[data-col="${colName}"]`);
        return checkbox && checkbox.checked;
    });

    const noneChecked = HIDEABLE_COLUMNS.every(colName => {
        const checkbox = document.querySelector(`.column-controls input[data-col="${colName}"]`);
        return checkbox && !checkbox.checked;
    });

    allCheckbox.checked = allChecked;
    allCheckbox.indeterminate = !allChecked && !noneChecked;
}

/**
 * Save column visibility to localStorage
 */
function saveColumnVisibility() {
    const visibility = {};
    HIDEABLE_COLUMNS.forEach(colName => {
        const checkbox = document.querySelector(`.column-controls input[data-col="${colName}"]`);
        visibility[colName] = checkbox ? checkbox.checked : true;
    });
    localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(visibility));
}

/**
 * Load column visibility from localStorage and apply
 */
function loadColumnVisibility() {
    const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    if (!saved) return;

    try {
        const visibility = JSON.parse(saved);
        HIDEABLE_COLUMNS.forEach(colName => {
            if (visibility.hasOwnProperty(colName)) {
                const visible = visibility[colName];

                // Update checkbox
                const checkbox = document.querySelector(`.column-controls input[data-col="${colName}"]`);
                if (checkbox) {
                    checkbox.checked = visible;
                }

                // Update header
                const headerCell = document.querySelector(`.constructions-table th[data-col="${colName}"]`);
                if (headerCell) {
                    headerCell.classList.toggle('col-hidden', !visible);
                }
            }
        });

        // Update "All" checkbox state
        updateToggleAllCheckbox();
    } catch (e) {
        console.error('Error loading column visibility:', e);
    }
}

/**
 * Apply column visibility to newly rendered table body
 */
function applyColumnVisibility() {
    const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY);
    if (!saved) return;

    try {
        const visibility = JSON.parse(saved);
        HIDEABLE_COLUMNS.forEach(colName => {
            if (visibility.hasOwnProperty(colName) && !visibility[colName]) {
                document.querySelectorAll(`.constructions-table td[data-col="${colName}"]`).forEach(cell => {
                    cell.classList.add('col-hidden');
                });
            }
        });
    } catch (e) {
        console.error('Error applying column visibility:', e);
    }
}

/**
 * Toggle all checkboxes in a column by data-type
 */
function toggleColumnCheckboxes(type, checked) {
    const checkboxes = document.querySelectorAll(`.constructions-table input.compact-checkbox[data-type="${type}"]:not(:disabled)`);
    checkboxes.forEach(cb => {
        cb.checked = checked;
    });
    // Update bulk add icon visibility for estimate checkboxes
    if (type === 'estimate') {
        updateBulkAddIconVisibility();
    }
    // Update bulk delete button visibility
    updateBulkDeleteButtonVisibility();
}

/**
 * Update visibility of bulk add product icon based on checked estimate checkboxes
 */
function updateBulkAddIconVisibility() {
    const allCheckedEstimates = document.querySelectorAll('.constructions-table input.compact-checkbox[data-type="estimate"]:checked');
    // Count only checkboxes in visible rows
    let visibleCheckedCount = 0;
    allCheckedEstimates.forEach(cb => {
        const row = cb.closest('tr');
        if (row && row.style.display !== 'none') {
            visibleCheckedCount++;
        }
    });

    const icon = document.getElementById('bulkAddProductIcon');
    if (icon) {
        if (visibleCheckedCount > 0) {
            icon.classList.add('visible');
        } else {
            icon.classList.remove('visible');
        }
    }
}

/**
 * Show product selector for bulk adding products to selected estimate positions
 */
function showBulkProductSelector(event) {
    event.stopPropagation();

    // Get all checked estimate checkboxes
    const checkedEstimates = document.querySelectorAll('.constructions-table input.compact-checkbox[data-type="estimate"]:checked');
    if (checkedEstimates.length === 0) {
        alert('Выберите хотя бы одну позицию сметы');
        return;
    }

    // Store context for bulk addition
    currentProductAddContext = {
        isBulk: true,
        positions: Array.from(checkedEstimates).map(cb => ({
            constructionId: cb.dataset.constructionId,
            estimatePositionId: cb.dataset.id
        }))
    };

    const selector = document.getElementById('productSelector');
    if (!selector) return;

    populateProductSelector();

    // Position selector near the icon
    const rect = event.target.getBoundingClientRect();
    selector.style.left = `${rect.left}px`;
    selector.style.top = `${rect.bottom + 5}px`;
    selector.classList.remove('hidden');

    // Focus search
    const searchInput = document.getElementById('productSelectorSearch');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
}

/**
 * Product details column visibility management
 */
const PRODUCT_DETAILS_KEY = 'productDetailsVisible';

/**
 * Toggle product details columns visibility
 */
function toggleProductDetailsColumns(visible) {
    // Update header cells
    document.querySelectorAll('.constructions-table th[data-col="product-detail"]').forEach(cell => {
        cell.classList.toggle('col-hidden', !visible);
    });

    // Update body cells
    document.querySelectorAll('.constructions-table td[data-col="product-detail"]').forEach(cell => {
        cell.classList.toggle('col-hidden', !visible);
    });

    // Save to localStorage
    localStorage.setItem(PRODUCT_DETAILS_KEY, visible ? 'true' : 'false');
}

/**
 * Initialize product details visibility from localStorage
 */
function initializeProductDetailsVisibility() {
    const saved = localStorage.getItem(PRODUCT_DETAILS_KEY);
    const visible = saved !== 'false'; // Default to visible

    // Update checkbox
    const checkbox = document.getElementById('toggleProductDetails');
    if (checkbox) {
        checkbox.checked = visible;
    }

    // Apply visibility
    if (!visible) {
        document.querySelectorAll('.constructions-table th[data-col="product-detail"]').forEach(cell => {
            cell.classList.add('col-hidden');
        });
        document.querySelectorAll('.constructions-table td[data-col="product-detail"]').forEach(cell => {
            cell.classList.add('col-hidden');
        });
    }
}

/**
 * Apply product details visibility to newly rendered table body
 */
function applyProductDetailsVisibility() {
    const saved = localStorage.getItem(PRODUCT_DETAILS_KEY);
    if (saved === 'false') {
        document.querySelectorAll('.constructions-table td[data-col="product-detail"]').forEach(cell => {
            cell.classList.add('col-hidden');
        });
    }
}

/**
 * Populate the product selector dropdown
 */
function populateProductSelector() {
    const select = document.getElementById('productSelectorList');
    if (!select) return;

    select.innerHTML = '';
    allProductsReference.forEach(product => {
        const option = document.createElement('option');
        option.value = product['ИзделиеID'] || product['ID'] || '';
        option.textContent = product['Изделие'] || product['Название'] || 'Без названия';
        option.dataset.name = (product['Изделие'] || '').toLowerCase();
        select.appendChild(option);
    });
}

/**
 * Show the product selector at the click position
 */
function showProductSelector(event, constructionId, estimatePositionId) {
    event.stopPropagation();

    currentProductAddContext = {
        constructionId: constructionId,
        estimatePositionId: estimatePositionId
    };

    const selector = document.getElementById('productSelector');
    if (!selector) return;

    // Reset search and show first to get proper dimensions
    const searchInput = document.getElementById('productSelectorSearch');
    if (searchInput) searchInput.value = '';
    filterProductSelector();
    selector.classList.remove('hidden');

    // Position near the click, ensuring it stays within viewport
    const rect = event.target.getBoundingClientRect();
    selector.style.position = 'fixed';

    // Get selector dimensions (after making it visible)
    const selectorRect = selector.getBoundingClientRect();
    const selectorWidth = selectorRect.width || 300; // fallback to min-width
    const selectorHeight = selectorRect.height || 400; // estimated height

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate horizontal position (prefer right of button, fall back to left)
    let left = rect.right + 5;
    if (left + selectorWidth > viewportWidth) {
        // Not enough space on right, try left side
        left = rect.left - selectorWidth - 5;
        if (left < 0) {
            // Not enough space on either side, align to right edge of viewport
            left = viewportWidth - selectorWidth - 10;
        }
    }

    // Calculate vertical position (align with button top, adjust if needed)
    let top = rect.top;
    if (top + selectorHeight > viewportHeight) {
        // Not enough space below, align to bottom of viewport
        top = viewportHeight - selectorHeight - 10;
        if (top < 0) {
            // Selector taller than viewport, align to top
            top = 10;
        }
    }

    // Ensure minimum margins
    left = Math.max(10, Math.min(left, viewportWidth - selectorWidth - 10));
    top = Math.max(10, Math.min(top, viewportHeight - selectorHeight - 10));

    selector.style.left = `${left}px`;
    selector.style.top = `${top}px`;

    // Focus search input
    if (searchInput) searchInput.focus();
}

/**
 * Close the product selector
 */
function closeProductSelector() {
    const selector = document.getElementById('productSelector');
    if (selector) {
        selector.classList.add('hidden');
    }
    currentProductAddContext = null;
}

/**
 * Filter products in the selector based on search input
 */
function filterProductSelector() {
    const searchInput = document.getElementById('productSelectorSearch');
    const select = document.getElementById('productSelectorList');
    if (!searchInput || !select) return;

    const searchTerm = searchInput.value.toLowerCase();

    Array.from(select.options).forEach(option => {
        const name = option.dataset.name || option.textContent.toLowerCase();
        option.style.display = name.includes(searchTerm) ? '' : 'none';
    });
}

/**
 * Add the selected product to the construction/estimate position
 */
function addSelectedProduct() {
    const select = document.getElementById('productSelectorList');
    if (!select || !select.value || !currentProductAddContext) {
        alert('Выберите изделие из списка');
        return;
    }

    const productId = select.value;
    const productName = select.options[select.selectedIndex]?.textContent || '';

    // Handle bulk addition
    if (currentProductAddContext.isBulk && currentProductAddContext.positions) {
        addProductToMultiplePositions(productId, productName, currentProductAddContext.positions);
        return;
    }

    const { constructionId, estimatePositionId } = currentProductAddContext;

    // Create product via API: POST _m_new/6133?JSON&up={КонструкцияID}&t7009={Позиция сметыID}
    const url = `https://${window.location.host}/${db}/_m_new/6133?JSON&up=${constructionId}&t7009=${estimatePositionId}`;

    // Build request body with XSRF token and product name
    let body = `6133=${productId}&t6133=${encodeURIComponent(productName)}`;
    if (typeof xsrf !== 'undefined' && xsrf) {
        body += `&_xsrf=${encodeURIComponent(xsrf)}`;
    }

    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
    })
    .then(response => response.json())
    .then(data => {
        if (data.obj) {
            closeProductSelector();
            // Reload constructions data to refresh the table
            if (selectedProject) {
                loadConstructionsData(selectedProject['ПроектID']);
            }
        } else {
            alert('Ошибка при добавлении изделия');
        }
    })
    .catch(error => {
        console.error('Error adding product:', error);
        alert('Ошибка при добавлении изделия: ' + error.message);
    });
}

/**
 * Add product to multiple estimate positions (bulk add)
 */
async function addProductToMultiplePositions(productId, productName, positions) {
    closeProductSelector();

    let successCount = 0;
    let errorCount = 0;

    for (const pos of positions) {
        const { constructionId, estimatePositionId } = pos;
        if (!constructionId || !estimatePositionId) {
            errorCount++;
            continue;
        }

        const url = `https://${window.location.host}/${db}/_m_new/6133?JSON&up=${constructionId}&t7009=${estimatePositionId}`;

        let body = `6133=${productId}&t6133=${encodeURIComponent(productName)}`;
        if (typeof xsrf !== 'undefined' && xsrf) {
            body += `&_xsrf=${encodeURIComponent(xsrf)}`;
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body
            });
            const data = await response.json();
            if (data.obj) {
                successCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            console.error('Error adding product:', error);
            errorCount++;
        }
    }

    // Uncheck all estimate checkboxes and hide icon
    document.querySelectorAll('.constructions-table input.compact-checkbox[data-type="estimate"]:checked').forEach(cb => {
        cb.checked = false;
    });
    const headerCheckbox = document.getElementById('checkAllEstimates');
    if (headerCheckbox) {
        headerCheckbox.checked = false;
    }
    updateBulkAddIconVisibility();

    // Reload constructions data
    if (selectedProject) {
        loadConstructionsData(selectedProject['ПроектID']);
    }

    if (errorCount > 0) {
        alert(`Добавлено: ${successCount}, ошибок: ${errorCount}`);
    }
}

/**
 * Update bulk delete button visibility based on checked checkboxes
 */
function updateBulkDeleteButtonVisibility() {
    const checkedItems = getSelectedItemsForDeletion();
    const btn = document.getElementById('btnBulkDelete');
    const countSpan = document.getElementById('bulkDeleteCount');

    if (btn && countSpan) {
        if (checkedItems.length > 0) {
            btn.classList.add('visible');
            countSpan.textContent = `Удалить (${checkedItems.length})`;
        } else {
            btn.classList.remove('visible');
            countSpan.textContent = 'Удалить';
        }
    }

    // Also update bulk add operations icon visibility when product checkboxes change
    updateBulkAddOperationsIconVisibility();

    // Update bulk hide button visibility
    updateBulkHideButtonVisibility();
}

/**
 * Update bulk hide button visibility based on checked estimate checkboxes
 */
function updateBulkHideButtonVisibility() {
    const checkedEstimates = document.querySelectorAll('.constructions-table input.compact-checkbox[data-type="estimate"]:checked');
    const btn = document.getElementById('btnBulkHide');
    const countSpan = document.getElementById('bulkHideCount');

    if (btn && countSpan) {
        if (checkedEstimates.length > 0) {
            btn.classList.add('visible');
            countSpan.textContent = `Скрыть (${checkedEstimates.length})`;
        } else {
            btn.classList.remove('visible');
            countSpan.textContent = 'Скрыть';
        }
    }
}

/**
 * Hide selected estimate position rows (collapse to 6px)
 */
function hideSelectedEstimates() {
    const checkedEstimates = document.querySelectorAll('.constructions-table input.compact-checkbox[data-type="estimate"]:checked');

    if (checkedEstimates.length === 0) {
        return;
    }

    const tbody = document.querySelector('.constructions-table tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const collapsedPairs = [];

    checkedEstimates.forEach(checkbox => {
        const estimateId = checkbox.getAttribute('data-id');
        const constructionId = checkbox.getAttribute('data-construction-id');
        const pairKey = `${constructionId}-${estimateId}`;
        collapsedPairs.push(pairKey);

        // Find the row with this estimate checkbox
        let startRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            const rowEstCheckbox = rows[i].querySelector(`input.compact-checkbox[data-type="estimate"][data-id="${estimateId}"][data-construction-id="${constructionId}"]`);
            if (rowEstCheckbox) {
                startRowIndex = i;
                break;
            }
        }

        if (startRowIndex === -1) return;

        // Collapse the estimate row and all product rows that follow until we hit a new estimate or construction
        for (let i = startRowIndex; i < rows.length; i++) {
            const row = rows[i];

            // Check if this row starts a new construction
            const hasConstructionCheckbox = row.querySelector('input.compact-checkbox[data-type="construction"]');
            if (hasConstructionCheckbox && i > startRowIndex) {
                // Hit a new construction, stop
                break;
            }

            // Check if this row starts a new estimate position
            const hasEstimateCheckbox = row.querySelector('input.compact-checkbox[data-type="estimate"]');
            if (hasEstimateCheckbox && i > startRowIndex) {
                // Hit a new estimate position, stop
                break;
            }

            // Skip rows with products (cells with class product-cell-with-operations)
            const hasProduct = row.querySelector('.product-cell-with-operations');
            if (hasProduct) {
                continue;
            }

            // This row belongs to our estimate position, collapse it
            row.classList.add('estimate-collapsed');
            row.setAttribute('data-collapsed-estimate', pairKey);
            row.setAttribute('data-collapsed-construction', constructionId);

            // Add click handler to expand
            row.onclick = function(event) {
                // Prevent triggering on checkbox clicks
                if (event.target.type === 'checkbox') {
                    return;
                }
                expandCollapsedRow(this);
            };
        }

        // Uncheck the checkbox
        checkbox.checked = false;
    });

    // Save collapsed state to cookies
    saveCollapsedState(collapsedPairs);

    // Update button visibility
    updateBulkDeleteButtonVisibility();
    updateBulkHideButtonVisibility();
}

/**
 * Expand a collapsed row
 */
function expandCollapsedRow(row) {
    const pairKey = row.getAttribute('data-collapsed-estimate');
    if (!pairKey) return;

    // Find all rows with the same construction-estimate pair
    const tbody = row.closest('tbody');
    const collapsedRows = tbody.querySelectorAll(`tr[data-collapsed-estimate="${pairKey}"]`);

    collapsedRows.forEach(r => {
        r.classList.remove('estimate-collapsed');
        r.removeAttribute('data-collapsed-estimate');
        r.removeAttribute('data-collapsed-construction');
        r.onclick = null;
    });

    // Update collapsed state in cookies
    const collapsedPairs = getCollapsedEstimates().filter(pair => pair !== pairKey);
    saveCollapsedState(collapsedPairs);
}

/**
 * Save collapsed construction-estimate pairs to cookies
 */
function saveCollapsedState(collapsedPairs) {
    const projectId = selectedProject ? selectedProject['ПроектID'] : '';
    if (!projectId) return;

    const cookieName = `collapsed_estimates_${projectId}`;
    const cookieValue = JSON.stringify(collapsedPairs);
    const expires = new Date();
    expires.setTime(expires.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year

    document.cookie = `${cookieName}=${encodeURIComponent(cookieValue)}; expires=${expires.toUTCString()}; path=/`;
}

/**
 * Get collapsed construction-estimate pairs from cookies
 */
function getCollapsedEstimates() {
    const projectId = selectedProject ? selectedProject['ПроектID'] : '';
    if (!projectId) return [];

    const cookieName = `collapsed_estimates_${projectId}`;
    const cookies = document.cookie.split(';');

    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === cookieName) {
            try {
                return JSON.parse(decodeURIComponent(value));
            } catch (e) {
                console.error('Error parsing collapsed estimates cookie:', e);
                return [];
            }
        }
    }

    return [];
}

/**
 * Restore collapsed estimate positions from cookies
 */
function restoreCollapsedState() {
    const collapsedPairs = getCollapsedEstimates();
    if (collapsedPairs.length === 0) return;

    const tbody = document.querySelector('.constructions-table tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));

    collapsedPairs.forEach(pairKey => {
        // Parse the construction-estimate pair
        const [constructionId, estimateId] = pairKey.split('-');

        // Find the row with this specific construction-estimate checkbox
        let startRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            const rowEstCheckbox = rows[i].querySelector(`input.compact-checkbox[data-type="estimate"][data-id="${estimateId}"][data-construction-id="${constructionId}"]`);
            if (rowEstCheckbox) {
                startRowIndex = i;
                break;
            }
        }

        if (startRowIndex === -1) return;

        // Collapse the estimate row and all product rows that follow until we hit a new estimate or construction
        for (let i = startRowIndex; i < rows.length; i++) {
            const row = rows[i];

            // Check if this row starts a new construction
            const hasConstructionCheckbox = row.querySelector('input.compact-checkbox[data-type="construction"]');
            if (hasConstructionCheckbox && i > startRowIndex) {
                // Hit a new construction, stop
                break;
            }

            // Check if this row starts a new estimate position
            const hasEstimateCheckbox = row.querySelector('input.compact-checkbox[data-type="estimate"]');
            if (hasEstimateCheckbox && i > startRowIndex) {
                // Hit a new estimate position, stop
                break;
            }

            // Skip rows with products (cells with class product-cell-with-operations)
            const hasProduct = row.querySelector('.product-cell-with-operations');
            if (hasProduct) {
                continue;
            }

            // This row belongs to our estimate position, collapse it
            row.classList.add('estimate-collapsed');
            row.setAttribute('data-collapsed-estimate', pairKey);
            row.setAttribute('data-collapsed-construction', constructionId);

            // Add click handler to expand
            row.onclick = function(event) {
                if (event.target.type === 'checkbox') {
                    return;
                }
                expandCollapsedRow(this);
            };
        }
    });
}

/**
 * Get all selected items for deletion from constructions table
 * Returns array of {type, id} objects
 */
function getSelectedItemsForDeletion() {
    const items = [];

    // Get checked construction checkboxes (only from visible rows)
    document.querySelectorAll('.constructions-table input.compact-checkbox[data-type="construction"]:checked').forEach(cb => {
        const row = cb.closest('tr');
        if (row && row.style.display !== 'none') {
            const id = cb.dataset.id;
            if (id) {
                items.push({ type: 'construction', id: id });
            }
        }
    });

    // Get checked estimate checkboxes (only from visible rows)
    document.querySelectorAll('.constructions-table input.compact-checkbox[data-type="estimate"]:checked').forEach(cb => {
        const row = cb.closest('tr');
        if (row && row.style.display !== 'none') {
            const id = cb.dataset.id;
            if (id) {
                items.push({ type: 'estimate', id: id });
            }
        }
    });

    // Get checked product checkboxes (only from visible rows)
    document.querySelectorAll('.constructions-table input.compact-checkbox[data-type="product"]:checked').forEach(cb => {
        const row = cb.closest('tr');
        if (row && row.style.display !== 'none') {
            const id = cb.dataset.id;
            if (id) {
                items.push({ type: 'product', id: id });
            }
        }
    });

    return items;
}

/**
 * Show bulk delete confirmation modal
 */
function showBulkDeleteConfirmation() {
    const items = getSelectedItemsForDeletion();
    if (items.length === 0) {
        alert('Выберите объекты для удаления');
        return;
    }

    const message = document.getElementById('bulkDeleteMessage');
    if (message) {
        message.textContent = `Удалить ${items.length} объектов?`;
    }

    document.getElementById('bulkDeleteModalBackdrop').classList.add('show');
}

/**
 * Close bulk delete modal
 */
function closeBulkDeleteModal() {
    document.getElementById('bulkDeleteModalBackdrop').classList.remove('show');
}

/**
 * Close bulk delete progress modal
 */
function closeBulkDeleteProgressModal() {
    document.getElementById('bulkDeleteProgressBackdrop').classList.remove('show');
}

/**
 * Confirm and execute bulk deletion
 */
async function confirmBulkDelete() {
    closeBulkDeleteModal();

    const items = getSelectedItemsForDeletion();
    if (items.length === 0) {
        return;
    }

    // Show progress modal
    document.getElementById('bulkDeleteProgressBackdrop').classList.add('show');
    const counter = document.getElementById('deleteProgressCounter');

    let deletedCount = 0;
    let errorOccurred = false;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Update progress counter
        if (counter) {
            counter.textContent = `${i + 1} из ${items.length}`;
        }

        try {
            const formData = new FormData();
            formData.append('_xsrf', xsrf);

            const response = await fetch(`https://${window.location.host}/${db}/_m_del/${item.id}?JSON`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            // Check if response is valid JSON
            const text = await response.text();
            try {
                const data = JSON.parse(text);
                deletedCount++;
                console.log(`Deleted ${item.type} ${item.id}:`, data);
            } catch (parseError) {
                console.error(`Invalid JSON response for ${item.type} ${item.id}:`, text);
                errorOccurred = true;
                break; // Stop deletion if invalid JSON received
            }
        } catch (error) {
            console.error(`Error deleting ${item.type} ${item.id}:`, error);
            errorOccurred = true;
            break; // Stop deletion on error
        }
    }

    // Close progress modal
    closeBulkDeleteProgressModal();

    // Uncheck all checkboxes
    document.querySelectorAll('.constructions-table input.compact-checkbox:checked').forEach(cb => {
        cb.checked = false;
    });

    // Reset header checkboxes
    ['checkAllConstructions', 'checkAllEstimates', 'checkAllProducts'].forEach(id => {
        const cb = document.getElementById(id);
        if (cb) cb.checked = false;
    });

    // Update button visibility
    updateBulkDeleteButtonVisibility();
    updateBulkAddIconVisibility();

    // Reload data
    if (selectedProject) {
        loadConstructionsData(selectedProject['ПроектID']);
    }

    // Show result message
    if (errorOccurred) {
        alert(`Удалено ${deletedCount} из ${items.length} объектов. Удаление прервано из-за ошибки.`);
    } else if (deletedCount > 0) {
        console.log(`Успешно удалено ${deletedCount} объектов`);
    }
}

/**
 * Reset all UI control states when switching projects
 * Clears checkboxes, hides buttons, closes modals/selectors
 */
function resetProjectUIState() {
    // Reset bulk delete button
    const btnBulkDelete = document.getElementById('btnBulkDelete');
    if (btnBulkDelete) {
        btnBulkDelete.classList.remove('visible');
    }
    const bulkDeleteCount = document.getElementById('bulkDeleteCount');
    if (bulkDeleteCount) {
        bulkDeleteCount.textContent = 'Удалить';
    }

    // Reset bulk add product icon
    const bulkAddProductIcon = document.getElementById('bulkAddProductIcon');
    if (bulkAddProductIcon) {
        bulkAddProductIcon.classList.remove('visible');
    }

    // Uncheck all checkboxes in constructions table
    document.querySelectorAll('.constructions-table input.compact-checkbox:checked').forEach(cb => {
        cb.checked = false;
    });

    // Reset header checkboxes
    ['checkAllConstructions', 'checkAllEstimates', 'checkAllProducts'].forEach(id => {
        const cb = document.getElementById(id);
        if (cb) cb.checked = false;
    });

    // Close work type selector if open
    const workTypeSelector = document.getElementById('workTypeSelector');
    if (workTypeSelector && !workTypeSelector.classList.contains('hidden')) {
        workTypeSelector.classList.add('hidden');
    }
    currentWorkTypeRow = null;

    // Close product selector if open
    const productSelector = document.getElementById('productSelector');
    if (productSelector && !productSelector.classList.contains('hidden')) {
        productSelector.classList.add('hidden');
    }
    currentProductAddContext = null;

    // Close any open modals
    const modals = [
        'projectModalBackdrop',
        'deleteEstimateModalBackdrop',
        'deleteConstructionModalBackdrop',
        'clientModalBackdrop',
        'objectModalBackdrop',
        'bulkDeleteModalBackdrop',
        'bulkDeleteProgressBackdrop',
        'addDocumentationModalBackdrop'
    ];
    modals.forEach(id => {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('show');
        }
    });

    // Reset pending delete IDs
    pendingDeleteEstimateRowId = null;
    pendingDeleteConstructionRowId = null;
}

/**
 * Edit product cell inline
 * @param {HTMLElement} cell - The cell element to edit
 */
function editProductCell(cell) {
    // Don't edit if already in editing mode
    if (cell.classList.contains('editing')) {
        return;
    }

    const productId = cell.dataset.productId;
    const field = cell.dataset.field;
    const fieldType = cell.dataset.fieldType;
    const currentValue = cell.textContent.trim();
    const displayValue = currentValue === '—' ? '' : currentValue;

    // Add editing class
    cell.classList.add('editing');

    // Create input element based on field type
    let inputElement;

    if (fieldType === 'select' && field === 't7238') {
        // Unit select dropdown
        inputElement = document.createElement('select');
        inputElement.innerHTML = '<option value="">—</option>';

        // Populate with units from dictionaries
        if (dictionaries.units && dictionaries.units.length > 0) {
            const currentId = cell.dataset.currentId || '';
            dictionaries.units.forEach(unit => {
                const option = document.createElement('option');
                option.value = unit['Ед.изм.ID'] || '';
                option.textContent = unit['Ед.изм.'] || '';
                if (option.value == currentId) {
                    option.selected = true;
                }
                inputElement.appendChild(option);
            });
        }
    } else if (fieldType === 'number') {
        inputElement = document.createElement('input');
        inputElement.type = 'number';
        inputElement.step = 'any';
        inputElement.value = displayValue;
    } else {
        inputElement = document.createElement('input');
        inputElement.type = 'text';
        inputElement.value = displayValue;
    }

    // Store original value for cancel
    inputElement.dataset.originalValue = currentValue;
    inputElement.dataset.productId = productId;
    inputElement.dataset.field = field;

    // Flag to prevent double-saving
    let isSaving = false;

    // Handle blur - save and close
    inputElement.addEventListener('blur', function() {
        if (!isSaving) {
            isSaving = true;
            saveProductCellEdit(cell, this);
        }
    });

    // Handle keydown - Enter to save, Escape to cancel, Tab/Shift+Tab to navigate
    inputElement.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelProductCellEdit(cell, this);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            // Set flag to prevent blur handler from double-saving
            isSaving = true;
            // Save current cell
            saveProductCellEdit(cell, this);
            // Navigate to next/previous editable cell
            const nextCell = findAdjacentEditableProductCell(cell, e.shiftKey ? 'prev' : 'next');
            if (nextCell) {
                editProductCell(nextCell);
            }
        }
    });

    // Prevent click from bubbling
    inputElement.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    // Replace cell content with input
    cell.textContent = '';
    cell.appendChild(inputElement);

    // Focus and select
    inputElement.focus();
    if (inputElement.select) {
        inputElement.select();
    }
}

/**
 * Save product cell edit
 * @param {HTMLElement} cell - The cell element
 * @param {HTMLElement} input - The input element
 */
function saveProductCellEdit(cell, input) {
    const productId = input.dataset.productId;
    const field = input.dataset.field;
    const originalValue = input.dataset.originalValue;
    let newValue = input.value.trim();
    let displayValue = newValue || '—';

    // For select, get the selected option text for display
    if (input.tagName === 'SELECT') {
        const selectedOption = input.options[input.selectedIndex];
        displayValue = selectedOption && selectedOption.value ? selectedOption.textContent : '—';
        // Update current-id for future edits
        cell.dataset.currentId = newValue;
    }

    // Remove editing class and restore cell
    cell.classList.remove('editing');
    cell.textContent = displayValue;

    // Only save if value changed
    if (newValue !== originalValue && !(newValue === '' && originalValue === '—')) {
        // Save to server
        saveProductField(productId, field, newValue);
    }
}

/**
 * Cancel product cell edit
 * @param {HTMLElement} cell - The cell element
 * @param {HTMLElement} input - The input element
 */
function cancelProductCellEdit(cell, input) {
    const originalValue = input.dataset.originalValue;

    // Remove editing class and restore original value
    cell.classList.remove('editing');
    cell.textContent = originalValue;
}

/**
 * Save product field to server
 * @param {string} productId - The product ID
 * @param {string} field - The field parameter (e.g., t6138)
 * @param {string} value - The new value
 */
function saveProductField(productId, field, value) {
    const formData = new FormData();
    formData.append('_xsrf', xsrf);

    const url = `https://${window.location.host}/${db}/_m_set/${productId}?JSON&${field}=${encodeURIComponent(value)}`;

    fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log(`Saved product field ${field} for ${productId}:`, data);
        // Update button data attributes and color after successful save
        updateOperationsButtonDataAndColor(productId, field, value);
    })
    .catch(error => {
        console.error(`Error saving product field ${field}:`, error);
        alert('Ошибка при сохранении');
    });
}

/**
 * Find adjacent editable product cell for Tab navigation
 * @param {HTMLElement} currentCell - The current cell element
 * @param {string} direction - 'next' or 'prev'
 * @returns {HTMLElement|null} - The adjacent editable cell or null
 */
function findAdjacentEditableProductCell(currentCell, direction) {
    // Get all editable product cells in the table
    const table = currentCell.closest('table');
    if (!table) return null;

    const editableCells = Array.from(table.querySelectorAll('.product-cell.editable'));
    if (editableCells.length === 0) return null;

    // Find current cell index
    const currentIndex = editableCells.indexOf(currentCell);
    if (currentIndex === -1) return null;

    // Calculate next index based on direction
    let nextIndex;
    if (direction === 'next') {
        nextIndex = currentIndex + 1;
        if (nextIndex >= editableCells.length) {
            nextIndex = 0; // Wrap to first cell
        }
    } else {
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
            nextIndex = editableCells.length - 1; // Wrap to last cell
        }
    }

    return editableCells[nextIndex];
}

/**
 * Edit construction cell inline
 * @param {HTMLElement} cell - The cell element to edit
 */
function editConstructionCell(cell) {
    // Don't edit if already in editing mode
    if (cell.classList.contains('editing')) {
        return;
    }

    const constructionId = cell.dataset.constructionId;
    const field = cell.dataset.field;
    const saveMethod = cell.dataset.saveMethod; // 'save' or 'set'
    const currentValue = cell.textContent.trim();
    const displayValue = currentValue === '—' ? '' : currentValue;

    // Add editing class
    cell.classList.add('editing');

    // Create input element
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    inputElement.value = displayValue;

    // Store original value for cancel
    inputElement.dataset.originalValue = currentValue;
    inputElement.dataset.constructionId = constructionId;
    inputElement.dataset.field = field;
    inputElement.dataset.saveMethod = saveMethod;

    // Handle blur - save and close
    inputElement.addEventListener('blur', function() {
        saveConstructionCellEdit(cell, this);
    });

    // Handle keydown - Enter to save, Escape to cancel
    inputElement.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelConstructionCellEdit(cell, this);
        }
    });

    // Prevent click from bubbling
    inputElement.addEventListener('click', function(e) {
        e.stopPropagation();
    });

    // Replace cell content with input
    cell.textContent = '';
    cell.appendChild(inputElement);

    // Focus and select
    inputElement.focus();
    inputElement.select();
}

/**
 * Save construction cell edit
 * @param {HTMLElement} cell - The cell element
 * @param {HTMLElement} input - The input element
 */
function saveConstructionCellEdit(cell, input) {
    const constructionId = input.dataset.constructionId;
    const field = input.dataset.field;
    const saveMethod = input.dataset.saveMethod;
    const originalValue = input.dataset.originalValue;
    const newValue = input.value.trim();
    const displayValue = newValue || '—';

    // Remove editing class and restore cell
    cell.classList.remove('editing');
    cell.textContent = displayValue;

    // Only save if value changed
    if (newValue !== originalValue && !(newValue === '' && originalValue === '—')) {
        // Save to server
        saveConstructionField(constructionId, field, newValue, saveMethod);
    }
}

/**
 * Cancel construction cell edit
 * @param {HTMLElement} cell - The cell element
 * @param {HTMLElement} input - The input element
 */
function cancelConstructionCellEdit(cell, input) {
    const originalValue = input.dataset.originalValue;

    // Remove editing class and restore original value
    cell.classList.remove('editing');
    cell.textContent = originalValue;
}

/**
 * Save construction field to server
 * @param {string} constructionId - The construction ID
 * @param {string} field - The field parameter (e.g., t6132)
 * @param {string} value - The new value
 * @param {string} saveMethod - 'save' for _m_save, 'set' for _m_set
 */
function saveConstructionField(constructionId, field, value, saveMethod) {
    const formData = new FormData();
    formData.append('_xsrf', xsrf);

    // Use _m_save for t6132 (Конструкция), _m_set for others
    const endpoint = saveMethod === 'save' ? '_m_save' : '_m_set';
    const url = `https://${window.location.host}/${db}/${endpoint}/${constructionId}?JSON&${field}=${encodeURIComponent(value)}`;

    fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log(`Saved construction field ${field} for ${constructionId}:`, data);
        // Update button data attributes and color after successful save
        updateOperationsButtonsForConstruction(constructionId, field, value);
    })
    .catch(error => {
        console.error(`Error saving construction field ${field}:`, error);
        alert('Ошибка при сохранении');
    });
}

/**
 * Update operations button data attributes and color for a specific product
 * @param {string} productId - The product ID
 * @param {string} field - The field parameter (e.g., t6997)
 * @param {string} value - The new value
 */
function updateOperationsButtonDataAndColor(productId, field, value) {
    // Find all buttons for this product
    const buttons = document.querySelectorAll(`.btn-view-operations[data-product-id="${productId}"]`);

    if (buttons.length === 0) {
        return;
    }

    // Map field IDs to data attribute names
    const fieldToDataAttr = {
        't6997': 'data-markirovka',       // Маркировка
        't6999': 'data-vysota-ot-pola',   // Высота от пола мм
        't6136': 'data-dlina',            // Длина
        't6144': 'data-vysota',           // Высота
        't6146': 'data-ves-m2',           // Вес м2/кг
        't7238': 'data-ed-izm',           // Ед. изм
        't7237': 'data-kolichestvo'       // Количество
    };

    const dataAttr = fieldToDataAttr[field];
    if (!dataAttr) {
        return; // Not a field we track on the button
    }

    // Update each button's data attribute and color
    buttons.forEach(button => {
        button.setAttribute(dataAttr, value);

        // Get operations for this button and update color
        const productIdFromButton = button.getAttribute('data-product-id');
        if (productIdFromButton) {
            const operations = operationsData.filter(op => String(op['ИзделиеID']) === String(productIdFromButton));
            const colorData = determineButtonColor(button, operations);
            button.style.background = colorData.background;
            button.title = colorData.title;
        }
    });
}

/**
 * Update operations buttons for all products in a construction when construction field changes
 * @param {string} constructionId - The construction ID
 * @param {string} field - The field parameter (e.g., t6989)
 * @param {string} value - The new value
 */
function updateOperationsButtonsForConstruction(constructionId, field, value) {
    // Map field IDs to data attribute names
    const fieldToDataAttr = {
        't6989': 'data-zahvatka',         // Захватка
        't6991': 'data-osi',              // Оси
        't6993': 'data-vysotnie-otmetki', // Высотные отметки
        't6995': 'data-etazh'             // Этаж
    };

    const dataAttr = fieldToDataAttr[field];
    if (!dataAttr) {
        return; // Not a field we track on the button
    }

    // Find all buttons in rows that belong to this construction
    // The construction ID is stored in construction cells, we need to find products in the same construction
    const constructionRow = document.querySelector(`[data-construction-id="${constructionId}"]`);
    if (!constructionRow) {
        return;
    }

    // Get the table and find all rows with buttons that share the same construction
    const table = constructionRow.closest('table');
    if (!table) {
        return;
    }

    // Find all product rows within this construction by traversing table rows
    // We need a different approach: find all buttons and check if they're in the construction's scope
    // Since the construction data is in data attributes of the button itself, we can search for buttons
    // that have matching construction-related data (though this is not stored on button directly)

    // Better approach: Find the construction cell, then traverse sibling rows until we hit another construction
    const allButtons = table.querySelectorAll('.btn-view-operations');

    allButtons.forEach(button => {
        // Check if this button's row is part of this construction
        // We can check by looking at the construction-cell in the same row or previous rows
        const buttonRow = button.closest('tr');
        if (!buttonRow) return;

        // Find the construction cell in this row or in a previous row with rowspan
        let constructionCell = buttonRow.querySelector(`[data-construction-id="${constructionId}"]`);

        // If not in current row, check if we're within the rowspan of a previous construction cell
        if (!constructionCell) {
            // Look backwards in the table to find the construction this row belongs to
            let currentRow = buttonRow;
            while (currentRow.previousElementSibling) {
                currentRow = currentRow.previousElementSibling;
                const cellInPrevRow = currentRow.querySelector('[data-construction-id]');
                if (cellInPrevRow) {
                    // Check if this cell has rowspan that covers our button's row
                    const rowspan = parseInt(cellInPrevRow.getAttribute('rowspan') || '1');
                    const prevRowIndex = Array.from(table.querySelectorAll('tbody tr')).indexOf(currentRow);
                    const buttonRowIndex = Array.from(table.querySelectorAll('tbody tr')).indexOf(buttonRow);

                    if (prevRowIndex >= 0 && buttonRowIndex >= 0 &&
                        buttonRowIndex < prevRowIndex + rowspan) {
                        if (cellInPrevRow.getAttribute('data-construction-id') === constructionId) {
                            constructionCell = cellInPrevRow;
                        }
                    }
                    break; // Stop at first construction cell we find
                }
            }
        }

        // If this button belongs to this construction, update it
        if (constructionCell) {
            button.setAttribute(dataAttr, value);

            // Get operations for this button and update color
            const productId = button.getAttribute('data-product-id');
            if (productId && operationsData) {
                const operations = operationsData.filter(op => String(op['ИзделиеID']) === String(productId));
                const colorData = determineButtonColor(button, operations);
                button.style.background = colorData.background;
                button.title = colorData.title;
            }
        }
    });
}

// Current documentation add context
let currentDocAddContext = null; // {parentId, parentType}

/**
 * Safely decode URL-encoded characters, handling partially or incorrectly encoded URLs
 * @param {string} str - The string to decode
 * @returns {string} - Decoded string (partial decoding if some sequences are invalid)
 */
function safeDecodeURIComponent(str) {
    // First, try standard decoding
    try {
        return decodeURIComponent(str);
    } catch (e) {
        // If standard decoding fails, decode only valid percent-encoded sequences
        // This handles cases where the URL is partially encoded or has invalid sequences
        try {
            return str.replace(/%[0-9A-Fa-f]{2}/g, (match) => {
                try {
                    return decodeURIComponent(match);
                } catch {
                    return match; // Keep the original if it can't be decoded
                }
            });
        } catch {
            // If even selective decoding fails, return the original string
            return str;
        }
    }
}

/**
 * Format link text for display in badge
 * Shows last 5 characters before last dot + extension, or last 16 characters if no extension
 * @param {string} url - The URL to format
 * @returns {string} - Formatted short text
 */
function formatLinkText(url) {
    if (!url) return '';

    // Trim whitespace
    url = url.trim();

    // Decode URL-encoded characters safely (handles mixed/partial encoding)
    url = safeDecodeURIComponent(url);

    // Find last dot position
    const lastDotIndex = url.lastIndexOf('.');

    if (lastDotIndex > 0 && lastDotIndex < url.length - 1) {
        // Has extension
        const extension = url.substring(lastDotIndex); // includes the dot
        const beforeDot = url.substring(0, lastDotIndex);

        // Get last 5 characters before the dot
        const shortPart = beforeDot.length > 5 ? beforeDot.substring(beforeDot.length - 5) : beforeDot;
        const result = shortPart + extension;

        // If result is longer than 16 characters, just use last 16
        if (result.length > 16) {
            return url.substring(url.length - 16);
        }
        return result;
    } else {
        // No extension or unusual format - use last 16 characters
        return url.length > 16 ? url.substring(url.length - 16) : url;
    }
}

/**
 * Format documentation links as clickable badges with add icon
 * @param {string} docString - Comma-separated list of documentation links
 * @param {string} parentId - ID of parent (Construction or Product)
 * @param {string} parentType - Type: 'construction' or 'product'
 * @returns {string} - HTML string with badges and add icon
 */
function formatDocumentationLinks(docString, parentId, parentType) {
    let html = '<div class="doc-links-container">';

    // Parse and display existing links
    if (docString && docString.trim() && docString.trim() !== '—') {
        const links = docString.split(',').map(l => l.trim()).filter(l => l.length > 0);

        links.forEach(link => {
            const displayText = escapeHtml(formatLinkText(link));
            const fullUrl = escapeHtml(link);
            html += `<a href="${fullUrl}" target="_blank" class="doc-link-badge" title="${fullUrl}">${displayText}</a>`;
        });
    }

    // Add icon to add new documentation
    html += `<span class="add-doc-icon" onclick="showAddDocumentationModal('${parentId}', '${parentType}')" title="Добавить документацию">+</span>`;

    html += '</div>';
    return html;
}

/**
 * Show modal to add documentation link
 * @param {string} parentId - ID of parent object
 * @param {string} parentType - 'construction' or 'product'
 */
function showAddDocumentationModal(parentId, parentType) {
    currentDocAddContext = { parentId, parentType };

    // Clear input fields
    document.getElementById('docLinkInput').value = '';
    document.getElementById('docDescriptionInput').value = '';

    // Show modal
    document.getElementById('addDocumentationModalBackdrop').classList.add('show');

    // Focus on link input
    setTimeout(() => {
        document.getElementById('docLinkInput').focus();
    }, 100);
}

/**
 * Close add documentation modal
 */
function closeAddDocumentationModal() {
    document.getElementById('addDocumentationModalBackdrop').classList.remove('show');
    currentDocAddContext = null;
}

/**
 * Save new documentation link to database
 */
function saveDocumentation() {
    if (!currentDocAddContext) {
        console.error('No documentation context set');
        return;
    }

    const link = document.getElementById('docLinkInput').value.trim();
    const description = document.getElementById('docDescriptionInput').value.trim();

    if (!link) {
        alert('Введите ссылку на документацию');
        return;
    }

    const { parentId, parentType } = currentDocAddContext;

    // Build URL: POST _m_new/6147?JSON&up={parentId}
    let url = `https://${window.location.host}/${db}/_m_new/6147?JSON&up=${parentId}`;
    url += `&t6147=${encodeURIComponent(link)}`;
    if (description) {
        url += `&t6149=${encodeURIComponent(description)}`;
    }

    const formData = new FormData();
    formData.append('_xsrf', xsrf);

    fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Documentation saved:', data);
        closeAddDocumentationModal();

        // Reload the constructions data to show the new documentation
        if (selectedProject) {
            loadConstructionsData(selectedProject['ПроектID']);
        }
    })
    .catch(error => {
        console.error('Error saving documentation:', error);
        alert('Ошибка при сохранении документации');
    });
}

// ============================================================================
// FILTER FUNCTIONALITY FOR CONSTRUCTIONS TABLE
// ============================================================================

// Global state for filters
let estimateFilterState = {
    selectedValues: new Set(),
    allValues: []
};

let productFilterState = {
    selectedValues: new Set(),
    allValues: []
};

// Populate filter options when table is loaded
function populateFilterOptions() {
    populateEstimateFilterOptions();
    populateProductFilterOptions();
}

// Populate estimate filter options
function populateEstimateFilterOptions() {
    const estimateValues = new Set();

    // Collect all unique estimate position values
    document.querySelectorAll('.constructions-table td.estimate-cell').forEach(cell => {
        const text = cell.textContent.trim().replace(/\+$/, '').trim(); // Remove the + icon
        if (text && text !== '—') {
            estimateValues.add(text);
        }
    });

    estimateFilterState.allValues = Array.from(estimateValues).sort();
    renderEstimateFilterOptions();
}

// Populate product filter options
function populateProductFilterOptions() {
    const productValues = new Set();

    // Collect all unique product values from the specific product name column
    // The product name cell is the first td.product-cell that has a title attribute with "Позиция сметыID"
    document.querySelectorAll('.constructions-table tbody tr').forEach(row => {
        // Find the product name cell: it's the first product-cell with a title containing "Позиция сметыID"
        const productNameCell = row.querySelector('td.product-cell[title^="Позиция сметыID"]');
        if (productNameCell) {
            // Extract text from the .product-name span, not the entire cell (which includes operations button)
            const productNameSpan = productNameCell.querySelector('.product-name');
            const text = productNameSpan ? productNameSpan.textContent.trim() : productNameCell.textContent.trim();
            // Only add valid product names (not empty, not dash)
            if (text && text !== '—') {
                productValues.add(text);
            }
        }
    });

    productFilterState.allValues = Array.from(productValues).sort();
    renderProductFilterOptions();
}

// Render estimate filter options
function renderEstimateFilterOptions() {
    const container = document.getElementById('estimateFilterOptions');
    if (!container) return;

    container.innerHTML = '';

    estimateFilterState.allValues.forEach(value => {
        const option = document.createElement('div');
        option.className = 'filter-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = estimateFilterState.selectedValues.has(value);
        checkbox.onchange = () => toggleEstimateValue(value);

        const label = document.createElement('span');
        label.className = 'filter-option-label';
        label.textContent = value;
        label.onclick = () => {
            checkbox.checked = !checkbox.checked;
            toggleEstimateValue(value);
        };

        option.appendChild(checkbox);
        option.appendChild(label);
        container.appendChild(option);
    });
}

// Render product filter options
function renderProductFilterOptions() {
    const container = document.getElementById('productFilterOptions');
    if (!container) return;

    container.innerHTML = '';

    productFilterState.allValues.forEach(value => {
        const option = document.createElement('div');
        option.className = 'filter-option';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = productFilterState.selectedValues.has(value);
        checkbox.onchange = () => toggleProductValue(value);

        const label = document.createElement('span');
        label.className = 'filter-option-label';
        label.textContent = value;
        label.onclick = () => {
            checkbox.checked = !checkbox.checked;
            toggleProductValue(value);
        };

        option.appendChild(checkbox);
        option.appendChild(label);
        container.appendChild(option);
    });
}

// Toggle estimate filter value
function toggleEstimateValue(value) {
    if (estimateFilterState.selectedValues.has(value)) {
        estimateFilterState.selectedValues.delete(value);
    } else {
        estimateFilterState.selectedValues.add(value);
    }

    renderEstimateFilterOptions();
    applyFilters();
    updateFilterIcons();
}

// Toggle product filter value
function toggleProductValue(value) {
    if (productFilterState.selectedValues.has(value)) {
        productFilterState.selectedValues.delete(value);
    } else {
        productFilterState.selectedValues.add(value);
    }

    renderProductFilterOptions();
    applyFilters();
    updateFilterIcons();
}

// Toggle estimate filter dropdown
function toggleEstimateFilter(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('estimateFilterDropdown');
    const productDropdown = document.getElementById('productFilterDropdown');

    // Close product dropdown if open
    if (productDropdown) {
        productDropdown.style.display = 'none';
    }

    if (dropdown) {
        const isVisible = dropdown.style.display !== 'none';
        dropdown.style.display = isVisible ? 'none' : 'block';

        if (!isVisible) {
            // Focus search input when opening
            setTimeout(() => {
                const searchInput = document.getElementById('estimateFilterSearch');
                if (searchInput) searchInput.focus();
            }, 100);
        }
    }
}

// Toggle product filter dropdown
function toggleProductFilter(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('productFilterDropdown');
    const estimateDropdown = document.getElementById('estimateFilterDropdown');

    // Close estimate dropdown if open
    if (estimateDropdown) {
        estimateDropdown.style.display = 'none';
    }

    if (dropdown) {
        const isVisible = dropdown.style.display !== 'none';
        dropdown.style.display = isVisible ? 'none' : 'block';

        if (!isVisible) {
            // Focus search input when opening
            setTimeout(() => {
                const searchInput = document.getElementById('productFilterSearch');
                if (searchInput) searchInput.focus();
            }, 100);
        }
    }
}

// Filter estimate options based on search
function filterEstimateOptions() {
    const searchInput = document.getElementById('estimateFilterSearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const options = document.querySelectorAll('#estimateFilterOptions .filter-option');

    options.forEach(option => {
        const label = option.querySelector('.filter-option-label');
        const text = label ? label.textContent.toLowerCase() : '';
        option.style.display = text.includes(searchTerm) ? 'flex' : 'none';
    });
}

// Filter product options based on search
function filterProductOptions() {
    const searchInput = document.getElementById('productFilterSearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const options = document.querySelectorAll('#productFilterOptions .filter-option');

    options.forEach(option => {
        const label = option.querySelector('.filter-option-label');
        const text = label ? label.textContent.toLowerCase() : '';
        option.style.display = text.includes(searchTerm) ? 'flex' : 'none';
    });
}

// Clear estimate filter
function clearEstimateFilter() {
    estimateFilterState.selectedValues.clear();
    renderEstimateFilterOptions();
    applyFilters();
    updateFilterIcons();

    // Clear search input
    const searchInput = document.getElementById('estimateFilterSearch');
    if (searchInput) {
        searchInput.value = '';
        filterEstimateOptions();
    }
}

// Clear product filter
function clearProductFilter() {
    productFilterState.selectedValues.clear();
    renderProductFilterOptions();
    applyFilters();
    updateFilterIcons();

    // Clear search input
    const searchInput = document.getElementById('productFilterSearch');
    if (searchInput) {
        searchInput.value = '';
        filterProductOptions();
    }
}

// Apply filters to table rows
function applyFilters() {
    const tbody = document.querySelector('.constructions-table tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));

    // Trace filter state
    console.group('🔍 Фильтрация таблицы');
    console.log('Фильтр по Позиция сметы:', estimateFilterState.selectedValues.size > 0
        ? Array.from(estimateFilterState.selectedValues).join(', ')
        : '(не активен)');
    console.log('Фильтр по Изделие:', productFilterState.selectedValues.size > 0
        ? Array.from(productFilterState.selectedValues).join(', ')
        : '(не активен)');
    console.log('Всего строк в таблице:', rows.length);

    // Track current estimate position value for rows without estimate cells (rowspan handling)
    let currentEstimateValue = null;
    let currentConstructionVisible = true;
    let visibleRowCount = 0;
    let hiddenRowCount = 0;

    rows.forEach((row, rowIndex) => {
        let shouldShowRow = true;

        // Check if this row starts a new construction
        const hasConstructionCell = row.querySelector('td.construction-cell');
        if (hasConstructionCell) {
            currentConstructionVisible = true; // Reset for new construction
        }

        // Check estimate filter
        const estimateCell = row.querySelector('td.estimate-cell');
        if (estimateCell) {
            // This row has an estimate cell, extract and remember its value
            const estimateText = estimateCell.textContent.trim().replace(/\+$/, '').trim();
            currentEstimateValue = estimateText;

            if (estimateFilterState.selectedValues.size > 0) {
                shouldShowRow = shouldShowRow && estimateFilterState.selectedValues.has(estimateText);
            }
        } else {
            // This row doesn't have an estimate cell (part of rowspan)
            // Use the current estimate value from the previous row with an estimate cell
            if (estimateFilterState.selectedValues.size > 0 && currentEstimateValue) {
                shouldShowRow = shouldShowRow && estimateFilterState.selectedValues.has(currentEstimateValue);
            }
        }

        // Check product filter
        if (productFilterState.selectedValues.size > 0) {
            const productCell = row.querySelector('td.product-cell[title^="Позиция сметыID"]');
            if (productCell) {
                // Extract text from the .product-name span, not the entire cell (which includes operations button)
                const productNameSpan = productCell.querySelector('.product-name');
                const productText = productNameSpan ? productNameSpan.textContent.trim() : productCell.textContent.trim();
                // Only filter if there's an actual product (not "—")
                if (productText && productText !== '—') {
                    shouldShowRow = shouldShowRow && productFilterState.selectedValues.has(productText);
                } else {
                    // Rows without products (showing "—") should be hidden when product filter is active
                    shouldShowRow = false;
                }
            } else {
                // No product cell - this might be a construction-only row or position-only row
                // Hide it when product filter is active
                shouldShowRow = false;
            }
        }

        // Apply visibility
        if (shouldShowRow) {
            row.style.display = '';
            currentConstructionVisible = true;
            visibleRowCount++;
        } else {
            row.style.display = 'none';
            hiddenRowCount++;

            // Reset checkboxes on hidden rows
            const checkboxes = row.querySelectorAll('input.compact-checkbox[data-type]');
            checkboxes.forEach(cb => {
                cb.checked = false;
            });
        }
    });

    console.log(`Результат первого прохода: ${visibleRowCount} видимых, ${hiddenRowCount} скрытых`);


    // Second pass: ensure rows with rowspan cells remain visible if they have visible children
    // This prevents table structure from breaking when first row of a rowspan group is hidden
    rows.forEach((row, rowIndex) => {
        if (row.style.display === 'none') {
            // Check if this hidden row has construction cells with rowspan
            // Construction cells are critical for table structure, so we must keep them visible
            const constructionCells = row.querySelectorAll('td.construction-cell[rowspan], td.construction-cell[data-original-rowspan], td.row-number[rowspan], td.row-number[data-original-rowspan], td.col-checkbox[rowspan], td.col-checkbox[data-original-rowspan]');

            if (constructionCells.length > 0) {
                // Check if there are visible rows in the rowspan range for any of these cells
                let shouldKeepVisible = false;

                constructionCells.forEach(cell => {
                    const rowspan = parseInt(cell.getAttribute('data-original-rowspan') || cell.getAttribute('rowspan') || '1');

                    // Check if there are visible rows in the range after this row
                    for (let i = rowIndex + 1; i < rowIndex + rowspan && i < rows.length; i++) {
                        if (rows[i].style.display !== 'none') {
                            shouldKeepVisible = true;
                            break;
                        }
                    }
                });

                if (shouldKeepVisible) {
                    // Keep this row visible to preserve rowspan structure for construction cells
                    row.style.display = '';
                }
            }

            // Also check for estimate cells with rowspan
            // These need special handling to avoid showing filtered-out estimates
            if (row.style.display === 'none') {
                const estimateCells = row.querySelectorAll('td.estimate-cell[rowspan], td.estimate-cell[data-original-rowspan], td.col-checkbox[data-type="estimate"][rowspan], td.col-checkbox[data-type="estimate"][data-original-rowspan]');

                if (estimateCells.length > 0) {
                    let shouldKeepVisible = false;

                    estimateCells.forEach(cell => {
                        const rowspan = parseInt(cell.getAttribute('data-original-rowspan') || cell.getAttribute('rowspan') || '1');

                        // Check if there are visible rows in the range after this row
                        for (let i = rowIndex + 1; i < rowIndex + rowspan && i < rows.length; i++) {
                            if (rows[i].style.display !== 'none') {
                                shouldKeepVisible = true;
                                break;
                            }
                        }
                    });

                    if (shouldKeepVisible) {
                        // Keep this row visible to preserve rowspan structure for estimate cells
                        row.style.display = '';
                    }
                }
            }
        }
    });

    // Adjust rowspans after filtering
    adjustRowspansAfterFilter();

    // Update bulk delete and add buttons visibility after filtering
    updateBulkDeleteButtonVisibility();
    updateBulkAddIconVisibility();

    // Count final visible rows
    const finalVisibleRows = rows.filter(r => r.style.display !== 'none').length;
    console.log(`Итого после второго прохода и настройки rowspan: ${finalVisibleRows} видимых строк`);
    console.groupEnd();
}

// Adjust rowspan values for cells after filtering to account for hidden rows
function adjustRowspansAfterFilter() {
    const tbody = document.querySelector('.constructions-table tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));

    // Check if any filters are active
    const hasActiveFilters = estimateFilterState.selectedValues.size > 0 || productFilterState.selectedValues.size > 0;

    // If no filters are active, restore all original rowspans
    if (!hasActiveFilters) {
        rows.forEach(row => {
            const cells = row.querySelectorAll('td[data-original-rowspan]');
            cells.forEach(cell => {
                const originalRowspan = cell.getAttribute('data-original-rowspan');
                if (originalRowspan && originalRowspan !== '1') {
                    cell.setAttribute('rowspan', originalRowspan);
                } else {
                    cell.removeAttribute('rowspan');
                }
                cell.style.display = '';
            });
        });
        return;
    }

    // Process ALL rows (including hidden ones) when filters are active
    rows.forEach((row, rowIndex) => {
        // Find cells with rowspan or data-original-rowspan in this row
        const cellsWithRowspan = row.querySelectorAll('td[rowspan], td[data-original-rowspan]');

        cellsWithRowspan.forEach(cell => {
            // Store original rowspan on first encounter
            if (!cell.hasAttribute('data-original-rowspan')) {
                const currentRowspan = cell.getAttribute('rowspan');
                if (currentRowspan) {
                    cell.setAttribute('data-original-rowspan', currentRowspan);
                }
            }

            const originalRowspan = parseInt(cell.getAttribute('data-original-rowspan') || '1');
            if (originalRowspan === 1) return;

            // Count visible rows in the original rowspan range starting from this row
            let visibleCount = 0;
            for (let i = rowIndex; i < rowIndex + originalRowspan && i < rows.length; i++) {
                if (rows[i].style.display !== 'none') {
                    visibleCount++;
                }
            }

            // If the current row (with the rowspan cell) is hidden
            if (row.style.display === 'none') {
                // Hide the cell if all rows in its span are hidden
                if (visibleCount === 0) {
                    cell.style.display = 'none';
                } else {
                    // The cell is in a hidden row but spans into visible rows
                    // This shouldn't normally happen due to the visibility logic in applyFilters
                    // But if it does, we should hide this cell as it's in a hidden row
                    cell.style.display = 'none';
                }
            } else {
                // Current row is visible
                cell.style.display = '';

                // Update rowspan based on visible rows
                if (visibleCount > 1) {
                    cell.setAttribute('rowspan', visibleCount);
                } else if (visibleCount === 1) {
                    cell.removeAttribute('rowspan');
                } else {
                    // No visible rows in span - shouldn't happen if row itself is visible
                    cell.removeAttribute('rowspan');
                }
            }
        });
    });
}

// Update filter icon appearance
function updateFilterIcons() {
    const estimateIcon = document.querySelector('.col-estimate .filter-icon');
    const productIcon = document.querySelector('.col-product .filter-icon');

    if (estimateIcon) {
        if (estimateFilterState.selectedValues.size > 0) {
            estimateIcon.classList.add('active');
        } else {
            estimateIcon.classList.remove('active');
        }
    }

    if (productIcon) {
        if (productFilterState.selectedValues.size > 0) {
            productIcon.classList.add('active');
        } else {
            productIcon.classList.remove('active');
        }
    }
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(event) {
    const estimateDropdown = document.getElementById('estimateFilterDropdown');
    const productDropdown = document.getElementById('productFilterDropdown');

    // Close estimate dropdown if clicking outside
    if (estimateDropdown && estimateDropdown.style.display !== 'none') {
        const estimateFilterIcon = document.querySelector('.col-estimate .filter-icon');
        if (!estimateDropdown.contains(event.target) && event.target !== estimateFilterIcon) {
            estimateDropdown.style.display = 'none';
        }
    }

    // Close product dropdown if clicking outside
    if (productDropdown && productDropdown.style.display !== 'none') {
        const productFilterIcon = document.querySelector('.col-product .filter-icon');
        if (!productDropdown.contains(event.target) && event.target !== productFilterIcon) {
            productDropdown.style.display = 'none';
        }
    }
});

/**
 * Determine button color based on field validation and approval status
 * Returns an object with background color and explanation
 */
function determineButtonColor(button, operations) {
    // Check required fields
    // Field values are stored in data attributes (empty string if not filled)
    const zahvatka = button.getAttribute('data-zahvatka') || '';
    const osi = button.getAttribute('data-osi') || '';
    const vysotnieOtmetki = button.getAttribute('data-vysotnie-otmetki') || '';
    const etazh = button.getAttribute('data-etazh') || '';
    const markirovka = button.getAttribute('data-markirovka') || '';
    const vysotaOtPola = button.getAttribute('data-vysota-ot-pola') || '';
    const dlina = button.getAttribute('data-dlina') || '';
    const vysota = button.getAttribute('data-vysota') || '';
    const vesM2 = button.getAttribute('data-ves-m2') || '';
    const edIzm = button.getAttribute('data-ed-izm') || '';
    const kolichestvo = button.getAttribute('data-kolichestvo') || '';

    // Check if all required fields are filled
    // Note: For "Высотные отметки OR Этаж", at least one must be filled
    const isEmDash = (val) => val === '—' || val.trim() === '';

    const missingFields = [];
    if (isEmDash(zahvatka)) missingFields.push('Захватка');
    if (isEmDash(osi)) missingFields.push('Оси');
    if (isEmDash(vysotnieOtmetki) && isEmDash(etazh)) missingFields.push('Высотные отметки или Этаж');
    if (isEmDash(markirovka)) missingFields.push('Маркировка');
    if (isEmDash(vysotaOtPola)) missingFields.push('Высота от пола мм');
    if (isEmDash(dlina)) missingFields.push('Длина');
    if (isEmDash(vysota)) missingFields.push('Высота');
    if (isEmDash(vesM2)) missingFields.push('Вес м2/кг');
    if (isEmDash(edIzm)) missingFields.push('Ед. изм');
    if (isEmDash(kolichestvo)) missingFields.push('Количество');

    // If any required fields are missing, return light gray
    if (missingFields.length > 0) {
        return {
            background: '#d3d3d3', // light gray
            title: `Не заполнены обязательные поля: ${missingFields.join(', ')}`
        };
    }

    // All required fields are filled, check approval status (Согласование)
    if (operations.length === 0) {
        // No operations, default blue
        return {
            background: '#007bff', // blue (синий)
            title: 'Просмотр операций'
        };
    }

    // Count approval statuses
    let allApproved = true;
    let hasRejected = false;
    let hasUnderApproval = false;

    operations.forEach(op => {
        const approval = op['Согласование'] || '';
        if (approval === 'Согласовано') {
            // This one is approved, continue checking
        } else if (approval === 'Отклонено') {
            hasRejected = true;
            allApproved = false;
        } else if (approval === 'На согласовании') {
            hasUnderApproval = true;
            allApproved = false;
        } else {
            // Any other status (including empty) means not all approved
            allApproved = false;
        }
    });

    // Determine color based on approval status priority:
    // 1. If any rejected -> Orange
    // 2. If any under approval -> Light blue (голубой)
    // 3. If all approved -> Light green
    // 4. Otherwise -> Blue (синий)
    if (hasRejected) {
        return {
            background: '#ff8c00', // orange
            title: 'Есть отклоненные операции'
        };
    } else if (hasUnderApproval) {
        return {
            background: '#87ceeb', // light blue (голубой)
            title: 'Есть операции на согласовании'
        };
    } else if (allApproved && operations.length > 0) {
        return {
            background: '#90ee90', // light green
            title: 'Все операции согласованы'
        };
    } else {
        return {
            background: '#007bff', // blue (синий)
            title: 'Просмотр операций'
        };
    }
}

/**
 * Update operations buttons count and visibility
 */
function updateOperationsButtons() {
    // Count operations per product
    const operationsByProduct = new Map();
    operationsData.forEach(op => {
        const productId = op['ИзделиеID'];
        if (productId) {
            if (!operationsByProduct.has(productId)) {
                operationsByProduct.set(productId, []);
            }
            operationsByProduct.get(productId).push(op);
        }
    });

    // Update all operation buttons
    document.querySelectorAll('.btn-view-operations').forEach(button => {
        const productId = button.getAttribute('data-product-id');
        const operations = operationsByProduct.get(productId) || [];
        const count = operations.length;

        const countSpan = button.querySelector('.operations-count');
        if (countSpan) {
            countSpan.textContent = count;
        }

        // Determine button color based on field validation and approval status
        const colorInfo = determineButtonColor(button, operations);
        button.style.background = colorInfo.background;
        button.title = colorInfo.title;

        // Always show button if product is specified (even with 0 operations)
        button.style.display = 'inline-flex';
    });
}

/**
 * Show operations modal for a product
 */
function showOperationsModal(event, button) {
    event.stopPropagation();

    const productId = button.getAttribute('data-product-id');
    const productName = button.getAttribute('data-product-name');
    const construction = button.getAttribute('data-construction');
    const estimatePosition = button.getAttribute('data-estimate-position');
    const estimatePositionId = button.getAttribute('data-estimate-position-id');
    const estimateId = button.getAttribute('data-estimate-id');

    currentOperationsProductId = productId;
    currentOperationsContext = {
        productId: productId,
        productName: productName,
        estimatePositionId: estimatePositionId,
        estimateId: estimateId
    };

    // Filter operations for this product
    const productOperations = operationsData.filter(op => String(op['ИзделиеID']) === String(productId));

    // Update modal title
    const modalTitle = document.getElementById('operationsModalTitle');
    if (modalTitle) {
        modalTitle.textContent = `Операции: ${productName}`;
    }

    const modalSubtitle = document.getElementById('operationsModalSubtitle');
    if (modalSubtitle) {
        modalSubtitle.textContent = `Конструкция: ${construction} | Позиция сметы: ${estimatePosition}`;
    }

    // Populate operations list
    displayOperationsList(productOperations);

    // Hide "Send for approval" button if required fields are not filled (button is gray)
    const sendApprovalButton = document.getElementById('btnSendForApproval');
    if (sendApprovalButton) {
        const buttonBgColor = button.style.backgroundColor || window.getComputedStyle(button).backgroundColor;
        // Check if button is gray (rgb(211, 211, 211) is #d3d3d3)
        const isGrayButton = buttonBgColor === 'rgb(211, 211, 211)' || buttonBgColor === '#d3d3d3';
        sendApprovalButton.style.display = isGrayButton ? 'none' : 'inline-block';
    }

    // Show modal
    const modal = document.getElementById('operationsModalBackdrop');
    if (modal) {
        modal.style.display = 'flex';
    }
}

/**
 * Display operations list in modal
 */
function displayOperationsList(operations) {
    const tbody = document.getElementById('operationsListBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (operations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #999;">Операции не найдены</td></tr>';
        updateOperationsDeleteButton();
        return;
    }

    operations.forEach((op, index) => {
        const operationId = op['ОперацияID'] || op['ОперацииID'];
        const operationName = op['Операция'] || '—';
        const workTypeId = op['Вид работID'] || '';
        const approvalStatus = op['Согласование'] || '';

        // Find work type info from reference
        let workTypeName = '—';
        let directionName = '—';

        if (workTypeId && workTypesReference) {
            const workType = workTypesReference.find(wt => String(wt['Вид работID']) === String(workTypeId));
            if (workType) {
                workTypeName = workType['Вид работ'] || '—';
                directionName = workType['Направление'] || '—';
            }
        }

        // Determine row styling based on approval status
        const isRejected = approvalStatus === 'Отклонено';
        const isApproved = approvalStatus === 'Согласовано';
        const rowStyle = isRejected ? 'background-color: #FFB200; color: white;' : '';

        // Checkbox: disabled and hidden for approved operations
        const checkboxHtml = isApproved
            ? '<input type="checkbox" class="compact-checkbox operation-checkbox" disabled style="visibility: hidden;" data-operation-id="' + operationId + '">'
            : '<input type="checkbox" class="compact-checkbox operation-checkbox" data-operation-id="' + operationId + '" onchange="updateOperationsDeleteButton()">';

        // Delete button: hidden for approved operations
        const deleteButtonHtml = isApproved
            ? ''
            : '<button class="btn-delete-operation" onclick="deleteOperation(\'' + operationId + '\')" title="Удалить операцию"><span class="delete-icon">🗑</span></button>';

        const tr = document.createElement('tr');
        tr.style.cssText = rowStyle;
        tr.innerHTML = `
            <td class="col-checkbox">
                ${checkboxHtml}
            </td>
            <td class="operation-number">${index + 1}</td>
            <td class="operation-name">
                <div class="operation-name-main">${escapeHtml(operationName)}</div>
                <div class="operation-name-sub">${escapeHtml(directionName)} | ${escapeHtml(workTypeName)}</div>
            </td>
            <td class="operation-actions">
                ${deleteButtonHtml}
            </td>
        `;
        tbody.appendChild(tr);
    });

    updateOperationsDeleteButton();
}

/**
 * Update operations delete button visibility and count
 */
function updateOperationsDeleteButton() {
    const checkboxes = document.querySelectorAll('.operation-checkbox:checked');
    const count = checkboxes.length;
    const deleteButton = document.getElementById('btnDeleteSelectedOperations');

    if (deleteButton) {
        if (count > 0) {
            deleteButton.style.display = 'inline-block';
            const countSpan = document.getElementById('deleteOperationsCount');
            if (countSpan) {
                countSpan.textContent = `Удалить (${count})`;
            }
        } else {
            deleteButton.style.display = 'none';
        }
    }
}

/**
 * Toggle all operations checkboxes
 */
function toggleAllOperations(checked) {
    document.querySelectorAll('.operation-checkbox').forEach(cb => {
        cb.checked = checked;
    });
    updateOperationsDeleteButton();
}

/**
 * Delete selected operations
 */
function deleteSelectedOperations() {
    const checkboxes = document.querySelectorAll('.operation-checkbox:checked');
    if (checkboxes.length === 0) return;

    if (!confirm(`Вы уверены, что хотите удалить выбранные операции (${checkboxes.length})?`)) {
        return;
    }

    const operationIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-operation-id'));

    // Delete operations sequentially
    deleteOperationsSequentially(operationIds, 0);
}

/**
 * Send operations for approval
 */
async function sendOperationsForApproval() {
    // Get checked operations (excluding disabled ones for approved operations)
    const checkedCheckboxes = document.querySelectorAll('.operation-checkbox:checked:not(:disabled)');

    // Determine which operations to send
    let operationsToSend;
    if (checkedCheckboxes.length > 0) {
        // Send only checked operations
        operationsToSend = Array.from(checkedCheckboxes).map(cb => ({
            id: cb.getAttribute('data-operation-id'),
            checkbox: cb
        }));
    } else {
        // Send all operations (excluding disabled ones for approved operations)
        const allCheckboxes = document.querySelectorAll('.operation-checkbox:not(:disabled)');
        operationsToSend = Array.from(allCheckboxes).map(cb => ({
            id: cb.getAttribute('data-operation-id'),
            checkbox: cb
        }));
    }

    if (operationsToSend.length === 0) {
        alert('Нет операций для отправки на согласование');
        return;
    }

    // Show confirmation dialog
    const confirmMessage = `Вы хотите отправить операции на согласование заказчику?${checkedCheckboxes.length > 0 ? ` (${checkedCheckboxes.length} операций)` : ` (все ${operationsToSend.length} операций)`}`;
    if (!confirm(confirmMessage)) {
        return;
    }

    // Hide operations modal and show progress modal
    const operationsModal = document.getElementById('operationsModalBackdrop');
    const progressModal = document.getElementById('approvalProgressModalBackdrop');
    const progressMessage = document.getElementById('approvalProgressMessage');
    const progressBar = document.getElementById('approvalProgressBar');

    if (operationsModal) {
        operationsModal.style.display = 'none';
    }

    if (progressModal) {
        progressModal.style.display = 'flex';
    }

    let completed = 0;
    const total = operationsToSend.length;
    const successfulIds = [];

    // Update progress
    function updateProgress() {
        if (progressMessage) {
            progressMessage.textContent = `Отправлено ${completed} из ${total}`;
        }
        if (progressBar) {
            const percentage = (completed / total) * 100;
            progressBar.style.width = `${percentage}%`;
        }
    }

    updateProgress();

    // Send for approval sequentially
    for (const operation of operationsToSend) {
        try {
            const url = `https://${window.location.host}/${db}/_m_set/${operation.id}?JSON&t7447=7448`;

            const formData = new URLSearchParams();
            formData.append('_xsrf', xsrf);

            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData.toString()
            });

            if (!response.ok) {
                console.error(`HTTP error sending operation ${operation.id} for approval: ${response.status}`);
            } else {
                const result = await response.json();
                if (result.error) {
                    console.error(`Error sending operation ${operation.id} for approval:`, result.error);
                    alert(`Ошибка: ${result.error}`);
                } else {
                    successfulIds.push(operation.id);
                }
            }
        } catch (error) {
            console.error(`Error sending operation ${operation.id} for approval:`, error);
        }

        completed++;
        updateProgress();
    }

    // Close progress modal
    if (progressModal) {
        progressModal.style.display = 'none';
    }

    // Hide checkboxes and delete buttons for successful operations
    successfulIds.forEach(operationId => {
        const checkbox = document.querySelector(`.operation-checkbox[data-operation-id="${operationId}"]`);
        const deleteButton = checkbox ? checkbox.closest('tr').querySelector('.btn-delete-operation') : null;

        if (checkbox) {
            checkbox.style.visibility = 'hidden';
        }
        if (deleteButton) {
            deleteButton.style.visibility = 'hidden';
        }
    });

    // Reload operations data
    await reloadOperationsData();

    // Show operations modal again
    if (operationsModal) {
        operationsModal.style.display = 'flex';
    }

    if (successfulIds.length === total) {
        alert(`Все операции (${total}) успешно отправлены на согласование`);
    } else if (successfulIds.length > 0) {
        alert(`Отправлено ${successfulIds.length} из ${total} операций`);
    } else {
        alert('Не удалось отправить операции на согласование');
    }
}

/**
 * Delete operations sequentially (one by one)
 */
function deleteOperationsSequentially(operationIds, index) {
    if (index >= operationIds.length) {
        // All operations deleted, reload data
        console.log('All operations deleted successfully');
        reloadOperationsData();
        return;
    }

    const operationId = operationIds[index];
    deleteOperationById(operationId)
        .then(() => {
            console.log(`Operation ${operationId} deleted (${index + 1}/${operationIds.length})`);
            // Delete next operation
            deleteOperationsSequentially(operationIds, index + 1);
        })
        .catch(error => {
            console.error(`Error deleting operation ${operationId}:`, error);
            alert(`Ошибка при удалении операции ${operationId}`);
            // Continue with next operation
            deleteOperationsSequentially(operationIds, index + 1);
        });
}

/**
 * Delete single operation
 */
function deleteOperation(operationId) {
    deleteOperationById(operationId)
        .then(() => {
            console.log(`Operation ${operationId} deleted`);
            reloadOperationsData();
        })
        .catch(error => {
            console.error(`Error deleting operation ${operationId}:`, error);
            // Display the error message from server or a default message
            alert(error.message || 'Ошибка при удалении операции');
        });
}

/**
 * Delete operation by ID via API
 */
function deleteOperationById(operationId) {
    const formData = new FormData();
    if (typeof xsrf !== 'undefined' && xsrf) {
        formData.append('_xsrf', xsrf);
    }

    return fetch(`https://${window.location.host}/${db}/_m_del/${operationId}?JSON`, {
        method: 'POST',
        credentials: 'include',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Check if response contains an error field
        if (data && Array.isArray(data) && data.length > 0 && data[0].error) {
            throw new Error(data[0].error);
        }
        if (data && data.error) {
            throw new Error(data.error);
        }
        return data;
    });
}

/**
 * Reload operations data after deletion
 */
function reloadOperationsData() {
    const projectId = selectedProject ? selectedProject['ПроектID'] : null;
    if (!projectId) return;

    // Reload operations data
    fetch(`https://${window.location.host}/${db}/report/5977?JSON_KV&FR_ProjectID=${projectId}`)
        .then(r => r.json())
        .then(operations => {
            operationsData = operations || [];
            updateOperationsButtons();

            // If modal is open, refresh it
            if (currentOperationsProductId) {
                const productOperations = operationsData.filter(op =>
                    String(op['ИзделиеID']) === String(currentOperationsProductId)
                );
                displayOperationsList(productOperations);
            }
        })
        .catch(error => {
            console.error('Error reloading operations:', error);
        });
}

/**
 * Close operations modal
 */
function closeOperationsModal() {
    const modal = document.getElementById('operationsModalBackdrop');
    if (modal) {
        modal.style.display = 'none';
    }
    currentOperationsProductId = null;

    // Uncheck all checkboxes
    document.querySelectorAll('.operation-checkbox').forEach(cb => cb.checked = false);
    const selectAllCheckbox = document.getElementById('checkAllOperations');
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = false;
    }
}

/**
 * Open the Add Operations modal
 */
async function openAddOperationsModal() {
    if (!currentOperationsContext) {
        console.error('No current operations context');
        return;
    }

    const modal = document.getElementById('addOperationsModalBackdrop');
    const loading = document.getElementById('addOperationsLoading');
    const content = document.getElementById('addOperationsContent');
    const subtitle = document.getElementById('addOperationsModalSubtitle');

    if (!modal) return;

    // Show modal with loading state
    modal.style.display = 'flex';
    loading.style.display = 'block';
    content.style.display = 'none';

    // Update subtitle
    if (subtitle) {
        subtitle.textContent = `Изделие: ${currentOperationsContext.productName}`;
    }

    try {
        // Fetch available operations from API
        const url = `https://${window.location.host}/${db}/report/7273?JSON_KV&FR_SID=${currentOperationsContext.estimatePositionId}&IID=${currentOperationsContext.productId}`;

        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const availableOperations = await response.json();

        // Filter out operations that already exist for this product
        const existingOperations = operationsData
            .filter(op => String(op['ИзделиеID']) === String(currentOperationsContext.productId))
            .map(op => String(op['ОперацииID']));

        const newOperations = availableOperations.filter(op =>
            !existingOperations.includes(String(op['ОперацииID']))
        );

        // Display the new operations
        displayNewOperationsList(newOperations);

        // Show content, hide loading
        loading.style.display = 'none';
        content.style.display = 'block';

    } catch (error) {
        console.error('Error fetching available operations:', error);
        alert('Ошибка при загрузке доступных операций');
        closeAddOperationsModal();
    }
}

/**
 * Display list of new operations to add
 */
function displayNewOperationsList(operations) {
    const tbody = document.getElementById('newOperationsListBody');
    const btnConfirm = document.getElementById('btnConfirmAddOperations');

    if (!tbody) return;

    tbody.innerHTML = '';

    if (operations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">Нет доступных операций для добавления</td></tr>';
        if (btnConfirm) {
            btnConfirm.disabled = true;
        }
        return;
    }

    operations.forEach((op, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="col-checkbox">
                <input type="checkbox" class="compact-checkbox new-operation-checkbox"
                       data-operation-id="${op['ОперацииID']}"
                       data-operation-name="${escapeHtml(op['Операции'])}"
                       checked
                       onchange="updateAddOperationsButton()">
            </td>
            <td class="col-number">${index + 1}</td>
            <td class="col-operation-name">${escapeHtml(op['Операции'])}</td>
        `;
        tbody.appendChild(row);
    });

    // Enable the Add button
    if (btnConfirm) {
        btnConfirm.disabled = false;
    }
}

/**
 * Toggle all new operations checkboxes
 */
function toggleAllNewOperations(checked) {
    document.querySelectorAll('.new-operation-checkbox').forEach(cb => {
        cb.checked = checked;
    });
    updateAddOperationsButton();
}

/**
 * Invert operation selection
 */
function invertOperationSelection() {
    document.querySelectorAll('.new-operation-checkbox').forEach(cb => {
        cb.checked = !cb.checked;
    });

    // Update the "check all" checkbox state
    const checkAll = document.getElementById('checkAllNewOperations');
    if (checkAll) {
        const allChecked = Array.from(document.querySelectorAll('.new-operation-checkbox'))
            .every(cb => cb.checked);
        checkAll.checked = allChecked;
    }

    updateAddOperationsButton();
}

/**
 * Update the Add button state based on selection
 */
function updateAddOperationsButton() {
    const btnConfirm = document.getElementById('btnConfirmAddOperations');
    const checkedCount = document.querySelectorAll('.new-operation-checkbox:checked').length;

    if (btnConfirm) {
        btnConfirm.disabled = checkedCount === 0;
    }
}

/**
 * Confirm and add selected operations
 */
async function confirmAddOperations() {
    // Check if we're in bulk mode
    if (bulkOperationsContext) {
        return await confirmBulkAddOperations();
    }

    if (!currentOperationsContext) {
        console.error('No current operations context');
        return;
    }

    const checkboxes = document.querySelectorAll('.new-operation-checkbox:checked');
    if (checkboxes.length === 0) return;

    const operations = Array.from(checkboxes).map(cb => ({
        id: cb.getAttribute('data-operation-id'),
        name: cb.getAttribute('data-operation-name')
    }));

    // Close add operations modal
    closeAddOperationsModal();

    // Show progress modal
    const progressModal = document.getElementById('progressModalBackdrop');
    const progressMessage = document.getElementById('progressMessage');
    const progressBar = document.getElementById('progressBar');

    if (progressModal) {
        progressModal.style.display = 'flex';
    }

    let completed = 0;
    const total = operations.length;

    // Add operations sequentially
    for (const operation of operations) {
        try {
            const url = `https://${window.location.host}/${db}/_m_new/695?JSON&up=${currentOperationsContext.productId}`;

            const formData = new URLSearchParams();
            formData.append('t695', operation.name);
            formData.append('t702', operation.id);
            formData.append('_xsrf', xsrf);

            const response = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData.toString()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            completed++;

            // Update progress
            if (progressMessage) {
                progressMessage.textContent = `Добавлено ${completed} из ${total}`;
            }
            if (progressBar) {
                const percentage = (completed / total) * 100;
                progressBar.style.width = `${percentage}%`;
            }

        } catch (error) {
            console.error(`Error adding operation ${operation.name}:`, error);
            alert(`Ошибка при добавлении операции "${operation.name}"`);
            break;
        }
    }

    // Close progress modal after a short delay
    setTimeout(() => {
        if (progressModal) {
            progressModal.style.display = 'none';
        }

        // Reset progress
        if (progressMessage) {
            progressMessage.textContent = 'Добавлено 0 из 0';
        }
        if (progressBar) {
            progressBar.style.width = '0%';
        }

        // Reload operations data
        reloadOperationsData();
    }, 1000);
}

/**
 * Close the Add Operations modal
 */
function closeAddOperationsModal() {
    const modal = document.getElementById('addOperationsModalBackdrop');
    if (modal) {
        modal.style.display = 'none';
    }

    // Clear the list
    const tbody = document.getElementById('newOperationsListBody');
    if (tbody) {
        tbody.innerHTML = '';
    }

    // Reset check all checkbox
    const checkAll = document.getElementById('checkAllNewOperations');
    if (checkAll) {
        checkAll.checked = true;
    }
}

// Override toggleColumnCheckboxes to only affect visible rows
const originalToggleColumnCheckboxes = window.toggleColumnCheckboxes;
window.toggleColumnCheckboxes = function(type, checked) {
    const checkboxes = document.querySelectorAll(`.constructions-table input.compact-checkbox[data-type="${type}"]:not(:disabled)`);
    checkboxes.forEach(cb => {
        // Only toggle checkboxes in visible rows
        const row = cb.closest('tr');
        if (row && row.style.display !== 'none') {
            cb.checked = checked;
        }
    });
    updateBulkAddIconVisibility();
    updateBulkDeleteButtonVisibility();
};

/**
 * Open the Create Operation modal
 */
async function openCreateOperationModal() {
    if (!currentOperationsContext) {
        console.error('No current operations context');
        return;
    }

    const modal = document.getElementById('createOperationModalBackdrop');
    if (!modal) return;

    // Reset form
    document.getElementById('createOperationForm').reset();

    // Populate product dropdown
    const productSelect = document.getElementById('operationProduct');
    productSelect.innerHTML = '<option value="">Пустое значение</option>';

    // Add current product as selected option
    if (currentOperationsContext.productId && currentOperationsContext.productName) {
        const option = document.createElement('option');
        option.value = currentOperationsContext.productId;
        option.textContent = currentOperationsContext.productName;
        option.selected = true;
        productSelect.appendChild(option);
    }

    // Fetch and populate work types from API
    try {
        const url = `https://${window.location.host}/${db}/report/6631?JSON_KV&FR_ProjectID=${projectInfo['ПроектID']}`;
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const workTypes = await response.json();

        // Debug logging
        console.log('=== Debug: openCreateOperationModal ===');
        console.log('currentOperationsContext:', currentOperationsContext);
        console.log('currentOperationsContext.estimateId:', currentOperationsContext.estimateId);
        console.log('estimateId type:', typeof currentOperationsContext.estimateId);
        console.log('estimateId is empty?:', !currentOperationsContext.estimateId);
        console.log('Total estimates from API:', workTypes.length);
        console.log('All estimates data:', workTypes);

        // Populate work types dropdown
        const workTypesSelect = document.getElementById('operationWorkTypes');
        workTypesSelect.innerHTML = '';

        // Get unique work types from the current estimate only
        const uniqueWorkTypes = new Map();

        // Filter to only work types from the current estimate (if estimateId is available and not empty)
        // Note: estimateId comes from product's Позиция сметыID field and should match estimate's СметаID field
        const hasEstimateId = currentOperationsContext.estimateId && String(currentOperationsContext.estimateId).trim() !== '';
        console.log('hasEstimateId:', hasEstimateId);
        console.log('estimateId value:', currentOperationsContext.estimateId);
        console.log('estimateId as string:', String(currentOperationsContext.estimateId));
        console.log('estimateId trimmed:', String(currentOperationsContext.estimateId).trim());

        const relevantEstimates = hasEstimateId
            ? workTypes.filter(estimate => {
                const estimateIdStr = String(estimate['СметаID']);
                const contextIdStr = String(currentOperationsContext.estimateId);
                const match = estimateIdStr === contextIdStr;
                console.log('Checking estimate:', estimate['Смета'],
                    'СметаID:', estimate['СметаID'], '(str:', estimateIdStr, ')',
                    'currentEstimateId:', currentOperationsContext.estimateId, '(str:', contextIdStr, ')',
                    'match:', match);
                return match;
            })
            : workTypes;

        console.log('Total workTypes rows:', workTypes.length);
        console.log('Filter active (hasEstimateId):', hasEstimateId);
        if (!hasEstimateId) {
            console.warn('WARNING: No estimateId, showing ALL work types from ALL estimates!');
        }

        console.log('Filtered relevantEstimates count:', relevantEstimates.length);
        console.log('Filtered relevantEstimates:', relevantEstimates);

        relevantEstimates.forEach(estimate => {
            if (estimate['Виды работ']) {
                const workTypeIds = estimate['Виды работ'].split(',').filter(Boolean);
                console.log('Estimate:', estimate['Смета'], 'СметаID:', estimate['СметаID'], 'Work type IDs:', workTypeIds);
                workTypeIds.forEach(id => {
                    // Find the work type name from workTypesReference
                    const workType = workTypesReference.find(wt => String(wt['Вид работID']) === String(id));
                    if (workType && !uniqueWorkTypes.has(id)) {
                        uniqueWorkTypes.set(id, workType['Вид работ']);
                    }
                });
            }
        });

        console.log('Final uniqueWorkTypes:', Array.from(uniqueWorkTypes.entries()));
        console.log('=== End Debug ===');

        // Add options to select
        uniqueWorkTypes.forEach((name, id) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = name;
            workTypesSelect.appendChild(option);
        });

        // If only one work type, select it
        if (uniqueWorkTypes.size === 1) {
            workTypesSelect.selectedIndex = 0;
        }

        // Show modal
        modal.style.display = 'flex';

    } catch (error) {
        console.error('Error loading work types:', error);
        alert('Ошибка при загрузке видов работ');
    }
}

/**
 * Close the Create Operation modal
 */
function closeCreateOperationModal() {
    const modal = document.getElementById('createOperationModalBackdrop');
    if (modal) {
        modal.style.display = 'none';
    }

    // Reset form
    const form = document.getElementById('createOperationForm');
    if (form) {
        form.reset();
    }
}

/**
 * Save new operation
 */
async function saveNewOperation(event) {
    event.preventDefault();

    if (!currentOperationsContext) {
        console.error('No current operations context');
        return;
    }

    const name = document.getElementById('operationName').value.trim();
    const productId = document.getElementById('operationProduct').value;
    const workTypesSelect = document.getElementById('operationWorkTypes');
    const description = document.getElementById('operationDescription').value.trim();

    // Validate required fields
    if (!name) {
        alert('Пожалуйста, введите название операции');
        return;
    }

    if (!description) {
        alert('Пожалуйста, введите описание');
        return;
    }

    // Get selected work types
    const selectedWorkTypes = Array.from(workTypesSelect.selectedOptions).map(opt => opt.value);

    if (selectedWorkTypes.length === 0) {
        alert('Пожалуйста, выберите хотя бы один вид работ');
        return;
    }

    try {
        // Build URL with parameters
        const url = `https://${window.location.host}/${db}/_m_new/700?JSON`;

        // Build form data
        const formData = new URLSearchParams();
        formData.append('_xsrf', xsrf); // XSRF token
        formData.append('t700', name); // Operation name
        if (productId) {
            formData.append('t6700', productId); // Product ID (optional)
        }
        formData.append('t5244', selectedWorkTypes.join(',')); // Work types (comma-separated)
        formData.append('t1043', description); // Description

        const response = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Close modal
        closeCreateOperationModal();

        // Show success message
        alert('Операция успешно создана');

        // Reload operations data if we're viewing the same product
        if (currentOperationsContext.productId === productId || !productId) {
            reloadOperationsData();
        }

    } catch (error) {
        console.error('Error saving operation:', error);
        alert('Ошибка при сохранении операции');
    }
}

/**
 * Update visibility of bulk add operations button based on checked product checkboxes
 */
function updateBulkAddOperationsIconVisibility() {
    const allCheckedProducts = document.querySelectorAll('.constructions-table input.compact-checkbox[data-type="product"]:checked');
    // Count only checkboxes in visible rows
    let visibleCheckedCount = 0;
    allCheckedProducts.forEach(cb => {
        const row = cb.closest('tr');
        if (row && row.style.display !== 'none') {
            visibleCheckedCount++;
        }
    });

    const icon = document.getElementById('bulkAddOperationsIcon');
    if (icon) {
        if (visibleCheckedCount > 0) {
            icon.classList.add('visible');
        } else {
            icon.classList.remove('visible');
        }
    }
}

// Context for bulk operations assignment
let bulkOperationsContext = null;

/**
 * Show bulk operations modal for selected products
 */
async function showBulkOperationsModal(event) {
    event.stopPropagation();

    // Get all checked product checkboxes
    const checkedProducts = document.querySelectorAll('.constructions-table input.compact-checkbox[data-type="product"]:checked');
    if (checkedProducts.length === 0) {
        alert('Выберите хотя бы одно изделие');
        return;
    }

    // Collect product IDs and estimate position IDs
    const products = [];
    const estimatePositionIds = new Set();

    checkedProducts.forEach(cb => {
        const row = cb.closest('tr');
        if (row && row.style.display !== 'none') {
            const productId = cb.dataset.id;
            // Find estimate position ID from the row (it's in the estimate position cell's title attribute)
            const estimateCells = row.querySelectorAll('td.estimate-cell');
            estimateCells.forEach(cell => {
                const title = cell.getAttribute('title');
                if (title) {
                    const match = title.match(/Позиция сметыID: (\d+)/);
                    if (match && match[1]) {
                        estimatePositionIds.add(match[1]);
                    }
                }
            });

            if (productId) {
                products.push({ productId });
            }
        }
    });

    if (products.length === 0) {
        alert('Не удалось определить выбранные изделия');
        return;
    }

    // Store bulk operations context
    bulkOperationsContext = {
        products: products,
        estimatePositionIds: Array.from(estimatePositionIds)
    };

    // Show modal with loading state
    const modal = document.getElementById('addOperationsModalBackdrop');
    const loading = document.getElementById('addOperationsLoading');
    const content = document.getElementById('addOperationsContent');
    const subtitle = document.getElementById('addOperationsModalSubtitle');
    const title = document.getElementById('addOperationsModalTitle');

    if (!modal) {
        console.error('Bulk operations modal not found');
        return;
    }

    modal.style.display = 'flex';
    loading.style.display = 'block';
    content.style.display = 'none';

    // Update title and subtitle
    if (title) {
        title.textContent = 'Добавление операций';
    }
    if (subtitle) {
        subtitle.textContent = `Выбрано изделий: ${products.length}`;
    }

    try {
        // Fetch available operations from API
        // Build FR_SID parameter (comma-separated estimate position IDs)
        const frSid = bulkOperationsContext.estimatePositionIds.join(',');
        // Build IID parameter (comma-separated product IDs)
        const iid = products.map(p => p.productId).join(',');

        const url = `https://${window.location.host}/${db}/report/7273?JSON_KV&FR_SID=${frSid}&IID=${iid}`;

        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const availableOperations = await response.json();

        // Get all existing operations for all selected products
        const existingOperationsIds = new Set();
        products.forEach(product => {
            const productOps = operationsData.filter(op => String(op['ИзделиеID']) === String(product.productId));
            productOps.forEach(op => {
                const opId = op['ОперацииID'] || op['ОперацияID'];
                if (opId) {
                    existingOperationsIds.add(String(opId));
                }
            });
        });

        // Filter out operations that already exist for any selected product
        const newOperations = availableOperations.filter(op =>
            !existingOperationsIds.has(String(op['ОперацииID']))
        );

        // Display the new operations
        displayBulkOperationsList(newOperations);

        // Show content, hide loading
        loading.style.display = 'none';
        content.style.display = 'block';

    } catch (error) {
        console.error('Error fetching available operations:', error);
        alert('Ошибка при загрузке доступных операций');
        closeBulkOperationsModal();
    }
}

/**
 * Display list of operations for bulk assignment
 */
function displayBulkOperationsList(operations) {
    const tbody = document.getElementById('newOperationsListBody');
    const btnConfirm = document.getElementById('btnConfirmAddOperations');

    if (!tbody) return;

    tbody.innerHTML = '';

    if (operations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">Нет доступных операций для добавления</td></tr>';
        if (btnConfirm) {
            btnConfirm.disabled = true;
        }
        return;
    }

    operations.forEach((op, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="col-checkbox">
                <input type="checkbox" class="compact-checkbox new-operation-checkbox"
                       data-operation-id="${op['ОперацииID']}"
                       data-operation-name="${escapeHtml(op['Операции'])}"
                       data-product-type="${op['Изделие (тип)'] || ''}"
                       checked
                       onchange="updateAddOperationsButton()">
            </td>
            <td class="col-number">${index + 1}</td>
            <td class="col-operation-name">${escapeHtml(op['Операции'])}</td>
        `;
        tbody.appendChild(row);
    });

    // Enable the Add button
    if (btnConfirm) {
        btnConfirm.disabled = false;
    }
}

/**
 * Close bulk operations modal
 */
function closeBulkOperationsModal() {
    const modal = document.getElementById('addOperationsModalBackdrop');
    if (modal) {
        modal.style.display = 'none';
    }

    // Clear context
    bulkOperationsContext = null;

    // Clear the list
    const tbody = document.getElementById('newOperationsListBody');
    if (tbody) {
        tbody.innerHTML = '';
    }

    // Reset check all checkbox
    const checkAll = document.getElementById('checkAllNewOperations');
    if (checkAll) {
        checkAll.checked = true;
    }
}

/**
 * Confirm and add selected operations to all selected products
 */
async function confirmBulkAddOperations() {
    if (!bulkOperationsContext) {
        console.error('No bulk operations context');
        return;
    }

    const checkboxes = document.querySelectorAll('.new-operation-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('Выберите хотя бы одну операцию');
        return;
    }

    const operations = Array.from(checkboxes).map(cb => ({
        id: cb.getAttribute('data-operation-id'),
        name: cb.getAttribute('data-operation-name'),
        productType: cb.getAttribute('data-product-type') || ''
    }));

    // CRITICAL FIX for issue #328: Save products BEFORE closing modal
    // closeBulkOperationsModal() sets bulkOperationsContext = null,
    // so we must extract products first
    const products = bulkOperationsContext.products;

    // Safety check: Ensure products array exists
    if (!products || !Array.isArray(products) || products.length === 0) {
        console.error('No products in bulk operations context');
        alert('Ошибка: не найдены выбранные изделия');
        return;
    }

    // Close add operations modal
    closeBulkOperationsModal();

    // Show progress modal
    const progressModal = document.getElementById('progressModalBackdrop');
    const progressMessage = document.getElementById('progressMessage');
    const progressBar = document.getElementById('progressBar');

    if (progressModal) {
        progressModal.style.display = 'flex';
    }
    let completed = 0;
    const totalOperations = operations.length * products.length;

    // For each product, add each operation
    for (const product of products) {
        // Get product details to check type
        const productData = constructionProducts.find(p => String(p['ИзделиеID']) === String(product.productId));
        const productTypeId = productData ? (productData['Изделие'] || '') : '';

        // Get existing operations for this product
        const existingOps = operationsData
            .filter(op => String(op['ИзделиеID']) === String(product.productId))
            .map(op => String(op['ОперацииID'] || op['ОперацияID']));

        for (const operation of operations) {
            // Skip if operation already exists for this product
            if (existingOps.includes(String(operation.id))) {
                completed++;
                // Update progress
                if (progressMessage) {
                    progressMessage.textContent = `Добавлено ${completed} из ${totalOperations}`;
                }
                if (progressBar) {
                    const percentage = (completed / totalOperations) * 100;
                    progressBar.style.width = `${percentage}%`;
                }
                continue;
            }

            // Filter: only add if product type matches or operation has empty product type
            if (operation.productType && operation.productType !== productTypeId) {
                completed++;
                // Update progress
                if (progressMessage) {
                    progressMessage.textContent = `Добавлено ${completed} из ${totalOperations}`;
                }
                if (progressBar) {
                    const percentage = (completed / totalOperations) * 100;
                    progressBar.style.width = `${percentage}%`;
                }
                continue;
            }

            try {
                const url = `https://${window.location.host}/${db}/_m_new/695?JSON&up=${product.productId}`;

                const formData = new URLSearchParams();
                formData.append('t695', operation.name);
                formData.append('t702', operation.id);
                formData.append('_xsrf', xsrf);

                const response = await fetch(url, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: formData.toString()
                });

                if (!response.ok) {
                    console.error(`HTTP error adding operation to product ${product.productId}: ${response.status}`);
                }

                completed++;

                // Update progress
                if (progressMessage) {
                    progressMessage.textContent = `Добавлено ${completed} из ${totalOperations}`;
                }
                if (progressBar) {
                    const percentage = (completed / totalOperations) * 100;
                    progressBar.style.width = `${percentage}%`;
                }

            } catch (error) {
                console.error(`Error adding operation ${operation.name} to product ${product.productId}:`, error);
                completed++;
            }
        }
    }

    // Close progress modal after a short delay
    setTimeout(() => {
        if (progressModal) {
            progressModal.style.display = 'none';
        }

        // Reset progress
        if (progressMessage) {
            progressMessage.textContent = 'Добавлено 0 из 0';
        }
        if (progressBar) {
            progressBar.style.width = '0%';
        }

        // Uncheck all product checkboxes and hide the button
        document.querySelectorAll('.constructions-table input.compact-checkbox[data-type="product"]:checked').forEach(cb => {
            cb.checked = false;
        });
        const headerCheckbox = document.getElementById('checkAllProducts');
        if (headerCheckbox) {
            headerCheckbox.checked = false;
        }
        updateBulkAddOperationsIconVisibility();
        updateBulkDeleteButtonVisibility();

        // Reload operations data
        if (selectedProject) {
            loadConstructionsData(selectedProject['ПроектID']);
        }
    }, 1000);
}
