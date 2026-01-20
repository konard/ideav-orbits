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

    // Position selector near the button
    selector.style.left = `${rect.left}px`;
    selector.style.top = `${rect.bottom + 5}px`;
    selector.classList.remove('hidden');

    // Reset and populate work types
    document.getElementById('selectorDirection').value = '';
    document.getElementById('selectorWorkTypeSearch').value = '';
    populateWorkTypesList();
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
    // Load all three datasets in parallel
    Promise.all([
        fetch(`https://${window.location.host}/${db}/report/6665?JSON_KV&FR_ProjectID=${projectId}`).then(r => r.json()),
        fetch(`https://${window.location.host}/${db}/report/7148?JSON_KV&FR_ProjectID=${projectId}`).then(r => r.json()),
        fetch(`https://${window.location.host}/${db}/report/6503?JSON_KV&FR_ProjectID=${projectId}`).then(r => r.json())
    ])
    .then(([constructions, estimatePositions, products]) => {
        constructionsData = constructions || [];
        constructionEstimatePositions = estimatePositions || [];
        constructionProducts = products || [];

        // Debug logging to verify data is loaded
        console.log('Constructions loaded:', constructionsData.length, 'items');
        console.log('Estimate positions loaded:', constructionEstimatePositions.length, 'items');
        console.log('Products loaded:', constructionProducts.length, 'items');

        if (constructionEstimatePositions.length > 0) {
            console.log('Sample estimate position:', constructionEstimatePositions[0]);
            console.log('Estimate position fields:', Object.keys(constructionEstimatePositions[0]));
        }

        if (constructionProducts.length > 0) {
            console.log('Sample product:', constructionProducts[0]);
            console.log('Product fields:', Object.keys(constructionProducts[0]));
        }

        displayConstructionsTable(constructionsData);
    })
    .catch(error => {
        console.error('Error loading constructions data:', error);
        constructionsData = [];
        constructionEstimatePositions = [];
        constructionProducts = [];
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
                html += `<td class="row-number" ${rs}>${rowNumber}</td>`;
                html += `<td class="col-checkbox" ${rs}><input type="checkbox" class="compact-checkbox" data-type="construction" data-id="${construction['КонструкцияID']}"></td>`;
                html += `<td ${rs}>${escapeHtml(construction['Конструкция'] || '—')}</td>`;
                html += `<td data-col="doc" ${rs}>${escapeHtml(construction['Документация по конструкции'] || '—')}</td>`;
                html += `<td data-col="zahvatka" ${rs}>${escapeHtml(construction['Захватка'] || '—')}</td>`;
                html += `<td data-col="osi" ${rs}>${escapeHtml(construction['Оси'] || '—')}</td>`;
                html += `<td data-col="vysotm" ${rs}>${escapeHtml(construction['Высотные отметки'] || '—')}</td>`;
                html += `<td data-col="etazh" ${rs}>${escapeHtml(construction['Этаж'] || '—')}</td>`;
                isFirstRowOfConstruction = false;
            }

            // Estimate position checkbox and cell (with tooltip showing position ID)
            const posId = position ? (position['Позиция сметыID'] || '?') : '';
            const constId = construction['КонструкцияID'];
            html += `<td class="col-checkbox"><input type="checkbox" class="compact-checkbox" data-type="estimate" data-id="${posId}" data-construction-id="${constId}" onchange="updateBulkAddIconVisibility()" ${position ? '' : 'disabled'}></td>`;
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
                    html += `<td class="row-number" ${rs}>${rowNumber}</td>`;
                    html += `<td class="col-checkbox" ${rs}><input type="checkbox" class="compact-checkbox" data-type="construction" data-id="${construction['КонструкцияID']}"></td>`;
                    html += `<td ${rs}>${escapeHtml(construction['Конструкция'] || '—')}</td>`;
                    html += `<td data-col="doc" ${rs}>${escapeHtml(construction['Документация по конструкции'] || '—')}</td>`;
                    html += `<td data-col="zahvatka" ${rs}>${escapeHtml(construction['Захватка'] || '—')}</td>`;
                    html += `<td data-col="osi" ${rs}>${escapeHtml(construction['Оси'] || '—')}</td>`;
                    html += `<td data-col="vysotm" ${rs}>${escapeHtml(construction['Высотные отметки'] || '—')}</td>`;
                    html += `<td data-col="etazh" ${rs}>${escapeHtml(construction['Этаж'] || '—')}</td>`;
                    isFirstRowOfConstruction = false;
                }

                // Estimate position checkbox and cell (only on first row of this position, with tooltip showing position ID)
                if (isFirstRowOfPosition) {
                    const positionId = position['Позиция сметыID'] || '?';
                    const constIdForIcon = construction['КонструкцияID'];
                    const rsPos = rowCount > 1 ? `rowspan="${rowCount}"` : '';
                    html += `<td class="col-checkbox" ${rsPos}><input type="checkbox" class="compact-checkbox" data-type="estimate" data-id="${positionId}" data-construction-id="${constIdForIcon}" onchange="updateBulkAddIconVisibility()"></td>`;
                    html += `<td class="estimate-cell" title="Позиция сметыID: ${positionId}" ${rsPos}>${escapeHtml(position['Позиция сметы'] || '—')}<span class="add-product-icon" onclick="showProductSelector(event, '${constIdForIcon}', '${positionId}')" title="Добавить изделие">+</span></td>`;
                    isFirstRowOfPosition = false;
                }

                // Product checkbox and cells (using field names from API with fallbacks)
                // First cell (Изделие) has tooltip showing which position this product belongs to
                const prodPositionId = prod['Позиция сметыID'] || prod['Смета проектаID'] || '?';
                const prodId = prod['ИзделиеID'] || '?';
                html += `<td class="col-checkbox"><input type="checkbox" class="compact-checkbox" data-type="product" data-id="${prodId}"></td>`;
                html += `<td class="product-cell" title="Позиция сметыID: ${prodPositionId}">${escapeHtml(prod['Изделие'] || '—')}</td>`;
                html += `<td class="product-cell">${escapeHtml(prod['Маркировка'] || '—')}</td>`;
                html += `<td class="product-cell">${escapeHtml(prod['Документация'] || prod['Документация по изделию'] || prod['Вид документации'] || '—')}</td>`;
                html += `<td class="product-cell" data-col="product-detail">${escapeHtml(prod['Высота от пола мм'] || '—')}</td>`;
                html += `<td class="product-cell" data-col="product-detail">${escapeHtml(prod['Длина, м'] || prod['Длина мм'] || '—')}</td>`;
                html += `<td class="product-cell" data-col="product-detail">${escapeHtml(prod['Высота, м'] || prod['Высота мм'] || '—')}</td>`;
                html += `<td class="product-cell" data-col="product-detail">${escapeHtml(prod['Периметр'] || prod['Периметр м'] || '—')}</td>`;
                html += `<td class="product-cell" data-col="product-detail">${escapeHtml(prod['Площадь, м2'] || prod['Площадь м2'] || '—')}</td>`;
                html += `<td class="product-cell" data-col="product-detail">${escapeHtml(prod['Вес на м2, кг'] || prod['Вес м2/кг'] || '—')}</td>`;
                html += `<td class="product-cell" data-col="product-detail">${escapeHtml(prod['Вес, кг'] || prod['Вес одной'] || '—')}</td>`;
                html += `<td class="product-cell">${escapeHtml(prod['Ед. изм'] || '—')}</td>`;
                html += `<td class="product-cell">${escapeHtml(prod['Количество'] || '—')}</td>`;

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
 * Add new construction row
 */
function addConstructionRow() {
    if (!selectedProject) return;

    // TODO: Implement API call to create new construction row
    console.log('Adding new construction row for project:', selectedProject['ПроектID']);

    // For now, add a placeholder row
    const newRow = {
        'КонструкцияID': 'new_' + Date.now(),
        'КонструкцияOrder': (constructionsData.length + 1).toString(),
        'Конструкция': '',
        'Шаблон': ''
    };

    constructionsData.push(newRow);
    displayConstructionsTable(constructionsData);
}

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
}

/**
 * Update visibility of bulk add product icon based on checked estimate checkboxes
 */
function updateBulkAddIconVisibility() {
    const checkedEstimates = document.querySelectorAll('.constructions-table input.compact-checkbox[data-type="estimate"]:checked');
    const icon = document.getElementById('bulkAddProductIcon');
    if (icon) {
        if (checkedEstimates.length > 0) {
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

    // Position near the click
    const rect = event.target.getBoundingClientRect();
    selector.style.position = 'fixed';
    selector.style.left = `${rect.right + 5}px`;
    selector.style.top = `${rect.top}px`;

    // Reset search and show
    const searchInput = document.getElementById('productSelectorSearch');
    if (searchInput) searchInput.value = '';
    filterProductSelector();

    selector.classList.remove('hidden');

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

    // Handle bulk addition
    if (currentProductAddContext.isBulk && currentProductAddContext.positions) {
        addProductToMultiplePositions(productId, currentProductAddContext.positions);
        return;
    }

    const { constructionId, estimatePositionId } = currentProductAddContext;

    // Create product via API: POST _m_new/6133?JSON&up={КонструкцияID}&t7009={Позиция сметыID}
    const url = `https://${window.location.host}/${db}/_m_new/6133?JSON&up=${constructionId}&t7009=${estimatePositionId}`;

    // Build request body with XSRF token
    let body = `6133=${productId}`;
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
async function addProductToMultiplePositions(productId, positions) {
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

        let body = `6133=${productId}`;
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
