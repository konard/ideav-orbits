/**
 * Project Scheduler - JS for scheduling project tasks and operations
 *
 * This script:
 * 1. Fetches project and template data from API
 * 2. Calculates durations based on template normatives × quantity
 * 3. Saves calculated durations to the system
 * 4. Schedules tasks/operations considering working hours, lunch breaks, and dependencies
 * 5. Saves scheduled start times to the system
 * 6. Displays the schedule in a table
 */

(function() {
    'use strict';

    // Global variables (expected to be available on the page)
    // db - database name
    // xsrf - XSRF token for POST requests

    const CONFIG = {
        // API endpoints
        projectReportId: 2681,
        workHoursReportId: 3283,

        // Field codes for saving data
        taskDurationCode: 't3094',
        operationDurationCode: 't704',
        taskStartCode: 't798',
        operationStartCode: 't2665',

        // Default values
        defaultDuration: 60, // 60 minutes if no normative found
        lunchDuration: 60, // 1 hour lunch break in minutes
    };

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
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching data:', error);
            throw error;
        }
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
            console.error(`Error saving data for item ${itemId}:`, error);
            throw error;
        }
    }

    /**
     * Parse quantity value - handle empty, non-numeric, or zero values
     */
    function parseQuantity(quantityStr) {
        if (!quantityStr || quantityStr.trim() === '') {
            return 1;
        }
        const parsed = parseFloat(quantityStr);
        if (isNaN(parsed) || parsed === 0) {
            return 1;
        }
        return parsed;
    }

    /**
     * Parse duration value
     */
    function parseDuration(durationStr) {
        if (!durationStr || durationStr.trim() === '') {
            return 0;
        }
        const parsed = parseFloat(durationStr);
        return isNaN(parsed) ? 0 : parsed;
    }

    /**
     * Build template lookup map for quick access
     */
    function buildTemplateLookup(projectData) {
        const templateMap = {
            tasks: new Map(),
            operations: new Map()
        };

        projectData.forEach(item => {
            const isTemplate = !item['Статус проекта'] || item['Статус проекта'] !== 'В работе';

            if (isTemplate) {
                const taskName = item['Задача проекта'];
                const operationName = item['Операция'];
                const taskNormative = parseDuration(item['Норматив задачи']);
                const operationNormative = parseDuration(item['Норматив операции']);

                if (taskName && taskNormative > 0) {
                    if (!templateMap.tasks.has(taskName)) {
                        templateMap.tasks.set(taskName, taskNormative);
                    }
                }

                if (operationName && operationNormative > 0) {
                    if (!templateMap.operations.has(operationName)) {
                        templateMap.operations.set(operationName, operationNormative);
                    }
                }
            }
        });

        return templateMap;
    }

    /**
     * Calculate duration for an item (task or operation)
     * Priority: 1) Existing duration > 0, 2) Template × quantity, 3) Default
     */
    function calculateDuration(item, templateLookup, isOperation) {
        const existingDuration = isOperation
            ? parseDuration(item['Длительность операции'])
            : parseDuration(item['Длительность задачи']);

        // Priority 1: Use existing duration if present and > 0
        if (existingDuration > 0) {
            return { duration: existingDuration, source: 'existing' };
        }

        // Get quantity
        const quantity = parseQuantity(item['Кол-во']);

        // Priority 2: Use template normative × quantity
        if (isOperation) {
            const operationName = item['Операция'];
            if (operationName && templateLookup.operations.has(operationName)) {
                const normative = templateLookup.operations.get(operationName);
                return { duration: normative * quantity, source: 'template' };
            }
        } else {
            const taskName = item['Задача проекта'];
            if (taskName && templateLookup.tasks.has(taskName)) {
                const normative = templateLookup.tasks.get(taskName);
                return { duration: normative * quantity, source: 'template' };
            }
        }

        // Priority 3: Use default
        return { duration: CONFIG.defaultDuration, source: 'default' };
    }

    /**
     * Parse date string in format dd.mm.yyyy
     */
    function parseDate(dateStr) {
        if (!dateStr || dateStr.trim() === '') {
            return null;
        }
        const parts = dateStr.split('.');
        if (parts.length !== 3) {
            return null;
        }
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // months are 0-indexed
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
    }

    /**
     * Format date to dd.mm.yyyy HH:MM:SS
     */
    function formatDateTime(date) {
        const pad = (n) => n.toString().padStart(2, '0');
        const day = pad(date.getDate());
        const month = pad(date.getMonth() + 1);
        const year = date.getFullYear();
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());
        return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
    }

    /**
     * Format date to dd.mm.yyyy
     */
    function formatDate(date) {
        const pad = (n) => n.toString().padStart(2, '0');
        const day = pad(date.getDate());
        const month = pad(date.getMonth() + 1);
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }

    /**
     * Add working time to a date, considering working hours and lunch breaks
     */
    function addWorkingTime(startDate, durationMinutes, workHours) {
        let current = new Date(startDate);
        let remainingMinutes = durationMinutes;

        while (remainingMinutes > 0) {
            const currentHour = current.getHours();
            const currentMinute = current.getMinutes();

            // If before work hours, jump to start of work day
            if (currentHour < workHours.dayStart) {
                current.setHours(workHours.dayStart, 0, 0, 0);
                continue;
            }

            // If after work hours, jump to next day start
            if (currentHour >= workHours.dayEnd) {
                current.setDate(current.getDate() + 1);
                current.setHours(workHours.dayStart, 0, 0, 0);
                continue;
            }

            // Check if we're at lunch time
            if (currentHour === workHours.lunchStart && currentMinute === 0) {
                // Skip lunch hour
                current.setHours(workHours.lunchStart + 1, 0, 0, 0);
                continue;
            }

            // Calculate time until next break
            let minutesUntilBreak;
            if (currentHour < workHours.lunchStart) {
                // Time until lunch
                minutesUntilBreak = (workHours.lunchStart - currentHour) * 60 - currentMinute;
            } else if (currentHour < workHours.dayEnd) {
                // Time until end of day
                minutesUntilBreak = (workHours.dayEnd - currentHour) * 60 - currentMinute;
            } else {
                // Should not reach here due to earlier checks
                minutesUntilBreak = 0;
            }

            // Work on the task
            const minutesToWork = Math.min(remainingMinutes, minutesUntilBreak);
            current.setMinutes(current.getMinutes() + minutesToWork);
            remainingMinutes -= minutesToWork;

            // If we hit lunch, skip it
            if (current.getHours() === workHours.lunchStart && current.getMinutes() === 0 && remainingMinutes > 0) {
                current.setHours(workHours.lunchStart + 1, 0, 0, 0);
            }
        }

        return current;
    }

    /**
     * Check if a task/operation cannot span multiple days (duration <= 4 hours)
     */
    function cannotSpanDays(durationMinutes) {
        return durationMinutes <= 240; // 4 hours = 240 minutes
    }

    /**
     * Check if task fits in remaining work time today
     */
    function fitsInRemainingTime(startDate, durationMinutes, workHours) {
        const currentHour = startDate.getHours();
        const currentMinute = startDate.getMinutes();

        let availableMinutes = 0;

        // Time until lunch (if before lunch)
        if (currentHour < workHours.lunchStart) {
            availableMinutes += (workHours.lunchStart - currentHour) * 60 - currentMinute;
        }

        // Time after lunch (if before end of day)
        if (currentHour < workHours.lunchStart) {
            // If we're before lunch, add time after lunch
            availableMinutes += (workHours.dayEnd - workHours.lunchStart - 1) * 60;
        } else if (currentHour >= workHours.lunchStart + 1 && currentHour < workHours.dayEnd) {
            // If we're after lunch, add remaining time
            availableMinutes += (workHours.dayEnd - currentHour) * 60 - currentMinute;
        }

        return durationMinutes <= availableMinutes;
    }

    /**
     * Schedule tasks and operations
     */
    function scheduleTasks(projectData, templateLookup, workHours, projectStartDate) {
        const scheduled = [];
        const completionTimes = new Map(); // Track when each task/operation completes

        // Filter only "В работе" (In progress) items
        const workItems = projectData.filter(item => item['Статус проекта'] === 'В работе');

        let currentTime = new Date(projectStartDate);
        currentTime.setHours(workHours.dayStart, 0, 0, 0);

        workItems.forEach(item => {
            const isOperation = item['ОперацияID'] && item['ОперацияID'] !== '';
            const itemId = isOperation ? item['ОперацияID'] : item['Задача проектаID'];
            const itemName = isOperation ? item['Операция'] : item['Задача проекта'];

            // Skip if no name
            if (!itemName || itemName.trim() === '') {
                return;
            }

            // Calculate duration
            const durationInfo = calculateDuration(item, templateLookup, isOperation);
            const durationMinutes = durationInfo.duration;

            // Check for dependencies
            let dependencyTime = null;
            if (isOperation) {
                const prevOperation = item['Предыдущая Операция'];
                if (prevOperation && prevOperation !== '') {
                    dependencyTime = completionTimes.get(`op:${prevOperation}`);
                }
            } else {
                const prevTask = item['Предыдущая Задача'];
                if (prevTask && prevTask !== '') {
                    dependencyTime = completionTimes.get(`task:${prevTask}`);
                }
            }

            // Determine start time
            let startTime = new Date(currentTime);
            if (dependencyTime && dependencyTime > currentTime) {
                startTime = new Date(dependencyTime);
            }

            // For tasks <= 4 hours, ensure they fit in one day
            if (cannotSpanDays(durationMinutes) && !fitsInRemainingTime(startTime, durationMinutes, workHours)) {
                // Move to next day
                startTime.setDate(startTime.getDate() + 1);
                startTime.setHours(workHours.dayStart, 0, 0, 0);
            }

            // Calculate end time
            const endTime = addWorkingTime(startTime, durationMinutes, workHours);

            // Store completion time for dependencies
            const key = isOperation ? `op:${itemName}` : `task:${itemName}`;
            completionTimes.set(key, endTime);

            // Update current time for next item (sequential by default)
            currentTime = new Date(endTime);

            // Store scheduled item
            scheduled.push({
                id: itemId,
                name: itemName,
                isOperation: isOperation,
                taskName: item['Задача проекта'],
                duration: durationMinutes,
                durationSource: durationInfo.source,
                startTime: startTime,
                endTime: endTime,
                needsDurationSave: durationInfo.source !== 'existing',
                quantity: parseQuantity(item['Кол-во']),
                previousDependency: isOperation ? item['Предыдущая Операция'] : item['Предыдущая Задача']
            });
        });

        return scheduled;
    }

    /**
     * Save durations to API
     */
    async function saveDurations(scheduled) {
        const savePromises = [];

        for (const item of scheduled) {
            if (item.needsDurationSave) {
                const fieldCode = item.isOperation ? CONFIG.operationDurationCode : CONFIG.taskDurationCode;
                savePromises.push(
                    saveData(item.id, fieldCode, item.duration.toString())
                        .then(() => ({ success: true, id: item.id, name: item.name }))
                        .catch(error => ({ success: false, id: item.id, name: item.name, error }))
                );
            }
        }

        return await Promise.all(savePromises);
    }

    /**
     * Save start times to API
     */
    async function saveStartTimes(scheduled) {
        const savePromises = [];

        for (const item of scheduled) {
            const fieldCode = item.isOperation ? CONFIG.operationStartCode : CONFIG.taskStartCode;
            const startTimeStr = formatDateTime(item.startTime);

            savePromises.push(
                saveData(item.id, fieldCode, startTimeStr)
                    .then(() => ({ success: true, id: item.id, name: item.name }))
                    .catch(error => ({ success: false, id: item.id, name: item.name, error }))
            );
        }

        return await Promise.all(savePromises);
    }

    /**
     * Display schedule in a table
     */
    function displaySchedule(scheduled, projectName, projectStartDate) {
        const contentDiv = document.querySelector('.content');
        if (!contentDiv) {
            console.error('Content div not found');
            return;
        }

        let html = `
            <h2>График выполнения проекта: ${projectName}</h2>
            <p><strong>Дата старта проекта:</strong> ${formatDate(projectStartDate)}</p>
            <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                <thead>
                    <tr style="background-color: #f0f0f0;">
                        <th>№</th>
                        <th>Задача</th>
                        <th>Операция</th>
                        <th>Длительность (мин)</th>
                        <th>Источник норматива</th>
                        <th>Количество</th>
                        <th>Время начала</th>
                        <th>Время окончания</th>
                        <th>Зависимость от</th>
                    </tr>
                </thead>
                <tbody>
        `;

        scheduled.forEach((item, index) => {
            const sourceLabel = {
                'existing': 'Существующий',
                'template': 'Шаблон',
                'default': 'По умолчанию'
            }[item.durationSource] || item.durationSource;

            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.taskName || ''}</td>
                    <td>${item.isOperation ? item.name : ''}</td>
                    <td>${item.duration}</td>
                    <td>${sourceLabel}</td>
                    <td>${item.quantity}</td>
                    <td>${formatDateTime(item.startTime)}</td>
                    <td>${formatDateTime(item.endTime)}</td>
                    <td>${item.previousDependency || '-'}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
            <p style="margin-top: 20px;"><em>График рассчитан с учетом рабочего времени и обеденного перерыва.</em></p>
        `;

        contentDiv.innerHTML = html;
    }

    /**
     * Main execution function
     */
    async function main() {
        try {
            console.log('Starting project scheduler...');

            // Show loading message
            const contentDiv = document.querySelector('.content');
            if (contentDiv) {
                contentDiv.innerHTML = '<p>Загрузка данных и расчет графика...</p>';
            }

            // Fetch project data
            console.log('Fetching project data...');
            const projectUrl = buildApiUrl(`/report/${CONFIG.projectReportId}?JSON_KV`);
            const projectData = await fetchJson(projectUrl);
            console.log(`Fetched ${projectData.length} items`);

            // Fetch work hours configuration
            console.log('Fetching work hours configuration...');
            const workHoursUrl = buildApiUrl(`/report/${CONFIG.workHoursReportId}?JSON_KV`);
            const workHoursData = await fetchJson(workHoursUrl);

            // Parse work hours
            const workHours = {
                dayStart: 9,
                dayEnd: 18,
                lunchStart: 13
            };

            workHoursData.forEach(item => {
                const code = item['Код'];
                const value = parseInt(item['Значение'], 10);
                if (code === 'day_start') workHours.dayStart = value;
                else if (code === 'day_end') workHours.dayEnd = value;
                else if (code === 'lunch_start') workHours.lunchStart = value;
            });

            console.log('Work hours:', workHours);

            // Find project start date
            let projectStartDate = null;
            let projectName = '';
            for (const item of projectData) {
                if (item['Статус проекта'] === 'В работе' && item['Старт']) {
                    projectStartDate = parseDate(item['Старт']);
                    projectName = item['Проект'];
                    break;
                }
            }

            if (!projectStartDate) {
                throw new Error('Не найдена дата старта проекта "В работе"');
            }

            console.log(`Project: ${projectName}, Start date: ${formatDate(projectStartDate)}`);

            // Build template lookup
            console.log('Building template lookup...');
            const templateLookup = buildTemplateLookup(projectData);
            console.log(`Template tasks: ${templateLookup.tasks.size}, operations: ${templateLookup.operations.size}`);

            // Schedule tasks
            console.log('Scheduling tasks...');
            const scheduled = scheduleTasks(projectData, templateLookup, workHours, projectStartDate);
            console.log(`Scheduled ${scheduled.length} items`);

            // Save durations
            console.log('Saving durations...');
            const durationResults = await saveDurations(scheduled);
            const durationSuccessCount = durationResults.filter(r => r.success).length;
            console.log(`Saved ${durationSuccessCount}/${durationResults.length} durations`);

            // Save start times
            console.log('Saving start times...');
            const startTimeResults = await saveStartTimes(scheduled);
            const startTimeSuccessCount = startTimeResults.filter(r => r.success).length;
            console.log(`Saved ${startTimeSuccessCount}/${startTimeResults.length} start times`);

            // Display schedule
            console.log('Displaying schedule...');
            displaySchedule(scheduled, projectName, projectStartDate);

            console.log('Project scheduler completed successfully!');

        } catch (error) {
            console.error('Error in main execution:', error);
            const contentDiv = document.querySelector('.content');
            if (contentDiv) {
                contentDiv.innerHTML = `<p style="color: red;">Ошибка: ${error.message}</p>`;
            }
        }
    }

    // Execute when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

})();
