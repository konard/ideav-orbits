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
        defaultProjectId: 2614
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
                <h2>Рабочее место управления проектами</h2>
                <p>Проекты в статусе "В работе"</p>

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
                            <th>Норматив задачи</th>
                            <th>Норматив операции</th>
                            <th>Длительность задачи</th>
                            <th>Длительность операции</th>
                            <th>Старт задачи</th>
                            <th>Старт операции</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (planData.length === 0) {
            html += `
                        <tr>
                            <td colspan="10" style="text-align: center; padding: 20px;">
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
                            <td>${escapeHtml(item['Норматив задачи'] || '-')}</td>
                            <td>${escapeHtml(item['Норматив операции'] || '-')}</td>
                            <td>${escapeHtml(item['Длительность задачи'] || '-')}</td>
                            <td>${escapeHtml(item['Длительность операции'] || '-')}</td>
                            <td>${escapeHtml(item['Старт задачи'] || '-')}</td>
                            <td>${escapeHtml(item['Старт операции'] || '-')}</td>
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
