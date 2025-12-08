/**
 * Project Workspace - Management console for active projects
 *
 * This script:
 * 1. Fetches all projects with status "В работе" (ID: 810)
 * 2. Displays them in a table: Project | Client | Start | Deadline | Object
 * 3. Provides "View" button for each project to see execution plan
 * 4. Shows execution plan with "Clear Planning" and "Plan" buttons
 */

(function() {
    'use strict';

    // Global variables (expected to be available on the page)
    // db - database name
    // xsrf - XSRF token for POST requests

    const CONFIG = {
        // API endpoints
        projectListReportId: 4472, // Projects list with filters
        executionPlanReportId: 4363, // Execution plan for specific project
        cleanupReportId: 2310, // Cleanup project data

        // Status ID for active projects
        activeStatusId: 810, // "В работе"

        // Default project ID for testing (from issue example)
        defaultProjectId: 2614,

        // Project table configuration (will be fetched dynamically)
        projectTableId: null,
        projectMetadata: null
    };

    // Current state
    let currentView = 'list'; // 'list' or 'details'
    let currentProjectId = null;
    let currentProjectName = null;
    let isCleanupInProgress = false;

    /**
     * Build API URL with host and database
     */
    function buildApiUrl(path) {
        const host = window.location.hostname;
        const dbName = window.db || 'orbits';
        return `https://${host}/${dbName}${path}`;
    }

    /**
     * Fetch JSON data from API
     */
    async function fetchJson(url) {
        try {
            console.log(`[Workspace] Fetching from URL: ${url}`);
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`[Workspace] HTTP error! status: ${response.status}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log(`[Workspace] ✓ Received ${Array.isArray(data) ? data.length + ' items' : 'data'}`);
            return data;
        } catch (error) {
            console.error('[Workspace] ✗ Error fetching data:', error);
            throw error;
        }
    }

    /**
     * Fetch Project table metadata
     */
    async function fetchProjectMetadata() {
        console.log('[Workspace] --- Fetching Project table metadata ---');

        try {
            // First, get list of tables to find Project table ID
            const dictUrl = buildApiUrl('/apix/dict?JSON=1');
            const tables = await fetchJson(dictUrl);

            // Find Project table
            let projectTableId = null;
            for (const [id, name] of Object.entries(tables)) {
                if (name === 'Проект') {
                    projectTableId = id;
                    console.log(`[Workspace] Found Project table: ID = ${id}`);
                    break;
                }
            }

            if (!projectTableId) {
                throw new Error('Project table not found');
            }

            // Get metadata
            const metadataUrl = buildApiUrl(`/apix/metadata/${projectTableId}?JSON=1`);
            const metadata = await fetchJson(metadataUrl);

            CONFIG.projectTableId = projectTableId;
            CONFIG.projectMetadata = metadata[0];

            console.log(`[Workspace] ✓ Project table metadata loaded (${CONFIG.projectMetadata.reqs.length} fields)`);
            return metadata[0];

        } catch (error) {
            console.error('[Workspace] ✗ Error fetching project metadata:', error);
            throw error;
        }
    }

    /**
     * Fetch reference field options
     */
    async function fetchReferenceOptions(fieldId) {
        const url = buildApiUrl(`/apix/_ref_reqs/${fieldId}?JSON=1`);
        return await fetchJson(url);
    }

    /**
     * Save data via POST request
     */
    async function saveData(itemId, fieldCode, value) {
        const url = buildApiUrl(`/_m_set/${itemId}?JSON=1`);
        const xsrfToken = window.xsrf || '';

        const formData = new URLSearchParams();
        formData.append(fieldCode, value);
        formData.append('_xsrf', xsrfToken);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`[Workspace] Error saving data for item ${itemId}:`, error);
            throw error;
        }
    }

    /**
     * Create new project record
     */
    async function createNewProject(projectData) {
        console.log('[Workspace] --- Creating new project ---');
        console.log('[Workspace] Project data:', projectData);

        const url = buildApiUrl(`/apix/_m_new/${CONFIG.projectTableId}?JSON=1`);
        const xsrfToken = window.xsrf || '';

        const formData = new URLSearchParams();
        formData.append('up', '1'); // Parent object (root level)
        formData.append('_xsrf', xsrfToken);

        // Add project name (main field)
        formData.append(`t${CONFIG.projectTableId}`, projectData.name);

        // Add other fields
        const metadata = CONFIG.projectMetadata;
        metadata.reqs.forEach(field => {
            const fieldName = field.val;
            let value = null;

            // Map field names to data
            if (fieldName.includes('Описание') && projectData.description) {
                value = projectData.description;
            } else if (fieldName.includes('Заказчик') && projectData.client) {
                value = projectData.client;
            } else if (fieldName.includes('Статус') && projectData.status) {
                value = projectData.status;
            } else if (fieldName.includes('Дата') && !fieldName.includes('подтверж') && projectData.date) {
                value = projectData.date;
            } else if (fieldName.includes('Старт') && projectData.start) {
                value = projectData.start;
            } else if (fieldName.includes('Срок') && projectData.deadline) {
                value = projectData.deadline;
            } else if (fieldName.includes('Бюджет') && projectData.budget) {
                value = projectData.budget;
            } else if (fieldName.includes('Родительский') && projectData.parentProject) {
                value = projectData.parentProject;
            } else if (fieldName.includes('Объект') && projectData.object) {
                value = projectData.object;
            } else if (fieldName.includes('Шаблон') && projectData.template) {
                value = projectData.template;
            }

            if (value !== null && value !== '') {
                formData.append(`t${field.id}`, value);
                console.log(`[Workspace]   Field ${fieldName} (t${field.id}) = ${value}`);
            }
        });

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString()
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('[Workspace] ✓ Project created:', result);
            return result;

        } catch (error) {
            console.error('[Workspace] ✗ Error creating project:', error);
            throw error;
        }
    }

    /**
     * Fetch all active projects (status "В работе")
     */
    async function fetchActiveProjects() {
        console.log('[Workspace] --- Step 1: Fetching active projects ---');

        // Use the report with filter for project ID (we'll get all by not specifying FR_ПроектID)
        // According to issue: https://{host}/{db}/report/4363?FR_ПроектID=2614
        const url = buildApiUrl(`/report/${CONFIG.projectListReportId}?JSON_KV`);
        const data = await fetchJson(url);

        // Filter only active projects with status "В работе"
        const activeProjects = data.filter(item =>
            item['Статус проекта'] === 'В работе'
        );

        console.log(`[Workspace] Found ${activeProjects.length} active projects`);

        // Group by project ID to get unique projects
        const projectsMap = new Map();
        activeProjects.forEach(item => {
            const projectId = item['ПроектID'];
            if (!projectsMap.has(projectId)) {
                projectsMap.set(projectId, {
                    id: projectId,
                    name: item['Проект'],
                    client: item['Заказчик'] || '-',
                    start: item['Старт'] || '-',
                    deadline: item['Срок'] || '-',
                    object: item['Объект'] || '-'
                });
            }
        });

        return Array.from(projectsMap.values());
    }

    /**
     * Fetch execution plan for a specific project
     */
    async function fetchExecutionPlan(projectId) {
        console.log(`[Workspace] --- Fetching execution plan for project ${projectId} ---`);

        const url = buildApiUrl(`/report/${CONFIG.executionPlanReportId}?FR_ПроектID=${projectId}&JSON_KV`);
        const data = await fetchJson(url);

        console.log(`[Workspace] Found ${data.length} items in execution plan`);
        return data;
    }

    /**
     * Clean up project data
     */
    async function cleanupProject(projectId) {
        if (!projectId) {
            throw new Error('Project ID is required for cleanup');
        }

        console.log(`[Workspace] --- Cleaning up project ${projectId} ---`);
        const url = buildApiUrl(`/report/${CONFIG.cleanupReportId}?FR_ProjID=${projectId}`);

        try {
            const response = await fetch(url);

            if (!response.ok) {
                console.error(`[Workspace] HTTP error! status: ${response.status}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // The cleanup report might return JSON or HTML
            const contentType = response.headers.get('content-type');
            let result;

            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
                console.log(`[Workspace] ✓ Cleanup completed (JSON response)`);
            } else {
                result = await response.text();
                console.log(`[Workspace] ✓ Cleanup completed (text response)`);
            }

            return result;
        } catch (error) {
            console.error('[Workspace] ✗ Error during cleanup:', error);
            throw error;
        }
    }

    /**
     * Navigate to planning page
     */
    function navigateToPlanning(projectId) {
        const host = window.location.hostname;
        const dbName = window.db || 'orbits';
        const url = `https://${host}/${dbName}/assignment?FR_ProjID=${projectId}`;

        console.log(`[Workspace] Navigating to planning page: ${url}`);
        window.location.href = url;
    }

    /**
     * Show Add Project modal
     */
    async function showAddProjectModal() {
        console.log('[Workspace] Showing Add Project modal...');

        try {
            // Ensure metadata is loaded
            if (!CONFIG.projectMetadata) {
                await fetchProjectMetadata();
            }

            const metadata = CONFIG.projectMetadata;

            // Find field IDs
            const statusField = metadata.reqs.find(f => f.val.includes('Статус'));
            const templateField = metadata.reqs.find(f => f.val.includes('Шаблон'));
            const parentField = metadata.reqs.find(f => f.val.includes('Родительский'));

            // Fetch reference options
            let statusOptions = {};
            let allProjects = {};
            let templateProjects = {};

            if (statusField && statusField.ref) {
                statusOptions = await fetchReferenceOptions(statusField.id);
                console.log('[Workspace] Status options loaded:', statusOptions);
            }

            if (templateField && templateField.ref) {
                allProjects = await fetchReferenceOptions(templateField.id);
                console.log('[Workspace] All projects loaded for template field');
            }

            // Filter template projects (where parent = "Типовой проект")
            if (parentField && parentField.ref) {
                // Get all projects with their parent info
                const projectsUrl = buildApiUrl(`/apix/object/${templateField.ref}?JSON_DATA=1`);
                const projectsData = await fetchJson(projectsUrl);

                // Get parent projects list to find "Типовой проект" ID
                const parentOptions = await fetchReferenceOptions(parentField.id);
                let typicalProjectId = null;
                for (const [id, name] of Object.entries(parentOptions)) {
                    if (name === 'Типовой проект') {
                        typicalProjectId = id;
                        break;
                    }
                }

                console.log('[Workspace] Типовой проект ID:', typicalProjectId);

                // Filter projects where parent = "Типовой проект"
                if (typicalProjectId && projectsData) {
                    const parentFieldIndex = metadata.reqs.findIndex(f => f.id === parentField.id);

                    projectsData.forEach(project => {
                        const parentValue = project.r[parentFieldIndex];
                        if (parentValue == typicalProjectId) {
                            const projectId = project.i;
                            const projectName = allProjects[projectId];
                            if (projectName) {
                                templateProjects[projectId] = projectName;
                            }
                        }
                    });

                    console.log('[Workspace] Filtered template projects:', templateProjects);
                }
            }

            // Get today's date in dd.mm.yyyy format
            const today = new Date();
            const todayStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;

            // Find "План" status ID
            let planStatusId = '';
            for (const [id, name] of Object.entries(statusOptions)) {
                if (name === 'План') {
                    planStatusId = id;
                    break;
                }
            }

            // Render modal
            const modalHtml = `
                <div class="modal-overlay" id="addProjectModal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>Добавить проект</h3>
                            <button class="modal-close" id="closeModal">&times;</button>
                        </div>
                        <div class="modal-body">
                            <form id="addProjectForm">
                                <div class="form-group">
                                    <label for="projectName">Проект *</label>
                                    <input type="text" id="projectName" name="name" required>
                                </div>

                                <div class="form-group">
                                    <label for="projectDescription">Описание</label>
                                    <textarea id="projectDescription" name="description" rows="3"></textarea>
                                </div>

                                <div class="form-group">
                                    <label for="projectClient">Заказчик</label>
                                    <input type="text" id="projectClient" name="client">
                                </div>

                                <div class="form-group">
                                    <label for="projectStatus">Статус проекта *</label>
                                    <select id="projectStatus" name="status" required>
                                        <option value="">-- Выберите статус --</option>
                                        ${Object.entries(statusOptions).map(([id, name]) =>
                                            `<option value="${id}" ${id === planStatusId ? 'selected' : ''}>${name}</option>`
                                        ).join('')}
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label for="projectDate">Дата *</label>
                                    <input type="text" id="projectDate" name="date" value="${todayStr}" required placeholder="дд.мм.гггг">
                                </div>

                                <div class="form-group">
                                    <label for="projectStart">Старт</label>
                                    <input type="text" id="projectStart" name="start" placeholder="дд.мм.гггг">
                                </div>

                                <div class="form-group">
                                    <label for="projectDeadline">Срок</label>
                                    <input type="text" id="projectDeadline" name="deadline" placeholder="дд.мм.гггг">
                                </div>

                                <div class="form-group">
                                    <label for="projectBudget">Бюджет</label>
                                    <input type="text" id="projectBudget" name="budget">
                                </div>

                                <div class="form-group">
                                    <label for="projectParent">Родительский проект</label>
                                    <select id="projectParent" name="parentProject">
                                        <option value="">-- Не выбрано --</option>
                                        ${Object.entries(allProjects).map(([id, name]) =>
                                            `<option value="${id}">${name}</option>`
                                        ).join('')}
                                    </select>
                                </div>

                                <div class="form-group">
                                    <label for="projectObject">Объект</label>
                                    <input type="text" id="projectObject" name="object">
                                </div>

                                <div class="form-group">
                                    <label for="projectTemplate">Шаблон Проекта</label>
                                    <select id="projectTemplate" name="template">
                                        <option value="">-- Не выбрано --</option>
                                        ${Object.entries(templateProjects).map(([id, name]) =>
                                            `<option value="${id}">${name}</option>`
                                        ).join('')}
                                    </select>
                                    <small>Только проекты с родителем "Типовой проект"</small>
                                </div>

                                <div class="form-actions">
                                    <button type="submit" class="btn-primary">Создать проект</button>
                                    <button type="button" class="btn-secondary" id="cancelButton">Отмена</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            // Add modal to document
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Add event listeners
            const modal = document.getElementById('addProjectModal');
            const closeBtn = document.getElementById('closeModal');
            const cancelBtn = document.getElementById('cancelButton');
            const form = document.getElementById('addProjectForm');

            const closeModal = () => {
                modal.remove();
            };

            closeBtn.addEventListener('click', closeModal);
            cancelBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal();
                }
            });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const formData = new FormData(form);
                const projectData = {};
                for (const [key, value] of formData.entries()) {
                    projectData[key] = value;
                }

                try {
                    // Disable form during submission
                    const submitBtn = form.querySelector('button[type="submit"]');
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Создание...';

                    // Create project
                    await createNewProject(projectData);

                    // Close modal
                    closeModal();

                    // Show success message
                    alert('Проект успешно создан!');

                    // Reload projects list
                    await showProjectsList();

                } catch (error) {
                    alert('Ошибка при создании проекта: ' + error.message);

                    // Re-enable form
                    const submitBtn = form.querySelector('button[type="submit"]');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Создать проект';
                }
            });

            console.log('[Workspace] ✓ Add Project modal rendered');

        } catch (error) {
            console.error('[Workspace] Error showing Add Project modal:', error);
            alert('Ошибка при загрузке формы: ' + error.message);
        }
    }

    /**
     * Render projects list table
     */
    function renderProjectsList(projects) {
        console.log('[Workspace] Rendering projects list...');

        const container = document.querySelector('.content');
        if (!container) {
            console.error('[Workspace] .content container not found');
            return;
        }

        let html = `
            <div class="workspace-container">
                <div class="workspace-header">
                    <div>
                        <h2>Рабочее место управления проектами</h2>
                        <p>Проекты в статусе "В работе"</p>
                    </div>
                    <div>
                        <button class="btn-add-project" id="btnAddProject">+ Добавить проект</button>
                    </div>
                </div>

                <table class="projects-table">
                    <thead>
                        <tr>
                            <th>Проект</th>
                            <th>Заказчик</th>
                            <th>Старт</th>
                            <th>Срок</th>
                            <th>Объект</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (projects.length === 0) {
            html += `
                        <tr>
                            <td colspan="6" style="text-align: center; padding: 20px;">
                                Нет проектов в статусе "В работе"
                            </td>
                        </tr>
            `;
        } else {
            projects.forEach(project => {
                html += `
                        <tr>
                            <td>${escapeHtml(project.name)}</td>
                            <td>${escapeHtml(project.client)}</td>
                            <td>${escapeHtml(project.start)}</td>
                            <td>${escapeHtml(project.deadline)}</td>
                            <td>${escapeHtml(project.object)}</td>
                            <td>
                                <button class="btn-view" data-project-id="${project.id}" data-project-name="${escapeHtml(project.name)}">
                                    Посмотреть
                                </button>
                            </td>
                        </tr>
                `;
            });
        }

        html += `
                    </tbody>
                </table>
            </div>

            <style>
                .workspace-container {
                    padding: 20px;
                }

                .workspace-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 20px;
                }

                .workspace-header h2 {
                    margin: 0 0 10px 0;
                }

                .workspace-header p {
                    margin: 0;
                }

                .btn-add-project {
                    padding: 10px 20px;
                    cursor: pointer;
                    border: 1px solid #28a745;
                    background-color: #28a745;
                    color: white;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: bold;
                }

                .btn-add-project:hover {
                    background-color: #218838;
                    border-color: #1e7e34;
                }

                .projects-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }

                .projects-table th,
                .projects-table td {
                    border: 1px solid #ddd;
                    padding: 12px;
                    text-align: left;
                }

                .projects-table th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                }

                .projects-table tr:hover {
                    background-color: #f5f5f5;
                }

                .btn-view,
                .btn-back,
                .btn-cleanup,
                .btn-plan {
                    padding: 8px 16px;
                    cursor: pointer;
                    border: 1px solid #007bff;
                    background-color: #007bff;
                    color: white;
                    border-radius: 4px;
                    font-size: 14px;
                }

                .btn-view:hover,
                .btn-back:hover,
                .btn-cleanup:hover,
                .btn-plan:hover {
                    background-color: #0056b3;
                    border-color: #0056b3;
                }

                .btn-cleanup {
                    background-color: #dc3545;
                    border-color: #dc3545;
                    margin-right: 10px;
                }

                .btn-cleanup:hover:not(:disabled) {
                    background-color: #c82333;
                    border-color: #bd2130;
                }

                .btn-cleanup:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .btn-plan {
                    background-color: #28a745;
                    border-color: #28a745;
                }

                .btn-plan:hover {
                    background-color: #218838;
                    border-color: #1e7e34;
                }

                .btn-back {
                    background-color: #6c757d;
                    border-color: #6c757d;
                    margin-bottom: 20px;
                }

                .btn-back:hover {
                    background-color: #5a6268;
                    border-color: #545b62;
                }

                .actions-panel {
                    margin: 20px 0;
                    padding: 15px;
                    background-color: #f8f9fa;
                    border-radius: 4px;
                }

                .execution-plan-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }

                .execution-plan-table th,
                .execution-plan-table td {
                    border: 1px solid #ddd;
                    padding: 10px;
                    text-align: left;
                }

                .execution-plan-table th {
                    background-color: #e9ecef;
                    font-weight: bold;
                    font-size: 13px;
                }

                .execution-plan-table tr:nth-child(even) {
                    background-color: #f8f9fa;
                }

                /* Modal styles */
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }

                .modal-content {
                    background-color: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
                    width: 90%;
                    max-width: 600px;
                    max-height: 90vh;
                    overflow-y: auto;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid #ddd;
                }

                .modal-header h3 {
                    margin: 0;
                }

                .modal-close {
                    background: none;
                    border: none;
                    font-size: 28px;
                    cursor: pointer;
                    color: #999;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    line-height: 1;
                }

                .modal-close:hover {
                    color: #333;
                }

                .modal-body {
                    padding: 20px;
                }

                .form-group {
                    margin-bottom: 15px;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                    color: #333;
                }

                .form-group input[type="text"],
                .form-group textarea,
                .form-group select {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                    box-sizing: border-box;
                }

                .form-group textarea {
                    resize: vertical;
                }

                .form-group small {
                    display: block;
                    margin-top: 5px;
                    color: #666;
                    font-size: 12px;
                }

                .form-actions {
                    display: flex;
                    gap: 10px;
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                }

                .btn-primary,
                .btn-secondary {
                    padding: 10px 20px;
                    border-radius: 4px;
                    font-size: 14px;
                    cursor: pointer;
                    border: none;
                }

                .btn-primary {
                    background-color: #007bff;
                    color: white;
                }

                .btn-primary:hover:not(:disabled) {
                    background-color: #0056b3;
                }

                .btn-primary:disabled {
                    background-color: #ccc;
                    cursor: not-allowed;
                }

                .btn-secondary {
                    background-color: #6c757d;
                    color: white;
                }

                .btn-secondary:hover {
                    background-color: #5a6268;
                }
            </style>
        `;

        container.innerHTML = html;

        // Add event listeners to "View" buttons
        const viewButtons = container.querySelectorAll('.btn-view');
        viewButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const projectId = button.getAttribute('data-project-id');
                const projectName = button.getAttribute('data-project-name');
                await showProjectDetails(projectId, projectName);
            });
        });

        // Add event listener to "Add Project" button
        const addButton = document.getElementById('btnAddProject');
        if (addButton) {
            addButton.addEventListener('click', async () => {
                await showAddProjectModal();
            });
        }

        console.log('[Workspace] ✓ Projects list rendered');
    }

    /**
     * Show project details with execution plan
     */
    async function showProjectDetails(projectId, projectName) {
        console.log(`[Workspace] Showing details for project ${projectId}`);

        currentView = 'details';
        currentProjectId = projectId;
        currentProjectName = projectName;

        try {
            const executionPlan = await fetchExecutionPlan(projectId);
            renderExecutionPlan(projectId, projectName, executionPlan);
        } catch (error) {
            console.error('[Workspace] Error loading execution plan:', error);
            alert('Ошибка при загрузке плана выполнения: ' + error.message);
        }
    }

    /**
     * Render execution plan table
     */
    function renderExecutionPlan(projectId, projectName, planData) {
        console.log('[Workspace] Rendering execution plan...');

        const container = document.querySelector('.content');
        if (!container) {
            console.error('[Workspace] .content container not found');
            return;
        }

        let html = `
            <div class="workspace-container">
                <button class="btn-back" id="btnBack">← Назад к списку проектов</button>

                <h2>План выполнения проекта</h2>
                <h3>${escapeHtml(projectName)} (ID: ${projectId})</h3>

                <div class="actions-panel">
                    <button class="btn-cleanup" id="btnCleanup" ${isCleanupInProgress ? 'disabled' : ''}>
                        ${isCleanupInProgress ? 'Очистка...' : 'Очистить планирование'}
                    </button>
                    <button class="btn-plan" id="btnPlan">
                        Планировать
                    </button>
                </div>

                <table class="execution-plan-table">
                    <thead>
                        <tr>
                            <th>Проект</th>
                            <th>Задача проекта</th>
                            <th>Операция</th>
                            <th>Захватка</th>
                            <th>Длительность задачи</th>
                            <th>Длительность операции</th>
                            <th>Исполнитель операции</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (planData.length === 0) {
            html += `
                        <tr>
                            <td colspan="7" style="text-align: center; padding: 20px;">
                                Нет данных для отображения
                            </td>
                        </tr>
            `;
        } else {
            planData.forEach(item => {
                html += `
                        <tr>
                            <td>${escapeHtml(item['Проект'] || '-')}</td>
                            <td>${escapeHtml(item['Задача проекта'] || '-')}</td>
                            <td>${escapeHtml(item['Операция'] || '-')}</td>
                            <td>${escapeHtml(item['Захватка (координаты)'] || '-')}</td>
                            <td>${escapeHtml(item['Длительность задачи'] || '-')}</td>
                            <td>${escapeHtml(item['Длительность операции'] || '-')}</td>
                            <td>${escapeHtml(item['Исполнитель операции'] || '-')}</td>
                        </tr>
                `;
            });
        }

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;

        // Add event listeners
        const btnBack = document.getElementById('btnBack');
        if (btnBack) {
            btnBack.addEventListener('click', async () => {
                await showProjectsList();
            });
        }

        const btnCleanup = document.getElementById('btnCleanup');
        if (btnCleanup) {
            btnCleanup.addEventListener('click', async () => {
                await handleCleanup(projectId);
            });
        }

        const btnPlan = document.getElementById('btnPlan');
        if (btnPlan) {
            btnPlan.addEventListener('click', () => {
                navigateToPlanning(projectId);
            });
        }

        console.log('[Workspace] ✓ Execution plan rendered');
    }

    /**
     * Handle cleanup button click
     */
    async function handleCleanup(projectId) {
        if (isCleanupInProgress) {
            console.log('[Workspace] Cleanup already in progress');
            return;
        }

        const confirmed = confirm('Вы уверены, что хотите очистить планирование для этого проекта?');
        if (!confirmed) {
            return;
        }

        isCleanupInProgress = true;

        // Disable button
        const btnCleanup = document.getElementById('btnCleanup');
        if (btnCleanup) {
            btnCleanup.disabled = true;
            btnCleanup.textContent = 'Очистка...';
        }

        try {
            console.log('[Workspace] Starting cleanup...');
            await cleanupProject(projectId);
            console.log('[Workspace] ✓ Cleanup completed successfully');

            alert('Планирование успешно очищено');

            // Reload execution plan
            const executionPlan = await fetchExecutionPlan(projectId);
            renderExecutionPlan(projectId, currentProjectName, executionPlan);

        } catch (error) {
            console.error('[Workspace] Error during cleanup:', error);
            alert('Ошибка при очистке планирования: ' + error.message);

            // Re-enable button
            if (btnCleanup) {
                btnCleanup.disabled = false;
                btnCleanup.textContent = 'Очистить планирование';
            }
        } finally {
            isCleanupInProgress = false;
        }
    }

    /**
     * Show projects list
     */
    async function showProjectsList() {
        console.log('[Workspace] Showing projects list...');

        currentView = 'list';
        currentProjectId = null;
        currentProjectName = null;

        try {
            const projects = await fetchActiveProjects();
            renderProjectsList(projects);
        } catch (error) {
            console.error('[Workspace] Error loading projects:', error);
            alert('Ошибка при загрузке списка проектов: ' + error.message);
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (text == null) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Main entry point
     */
    async function main() {
        console.log('[Workspace] ========================================');
        console.log('[Workspace] Project Workspace Starting...');
        console.log('[Workspace] ========================================');

        try {
            await showProjectsList();
        } catch (error) {
            console.error('[Workspace] Fatal error:', error);
            const container = document.querySelector('.content');
            if (container) {
                container.innerHTML = `
                    <div class="workspace-container">
                        <h2>Ошибка</h2>
                        <p style="color: red;">Не удалось загрузить данные: ${escapeHtml(error.message)}</p>
                        <p>Проверьте консоль браузера для подробной информации.</p>
                    </div>
                `;
            }
        }
    }

    // Execute on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

})();
