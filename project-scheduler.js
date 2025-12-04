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
        parametersReportId: 3248,
        executorsReportId: 2777,

        // Field codes for saving data
        taskDurationCode: 't3758',
        operationDurationCode: 't3757',
        taskStartCode: 't798',
        operationStartCode: 't2665',
        taskExecutorCode: 't690',
        operationExecutorCode: 't2399',

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
            console.log(`  Fetching from URL: ${url}`);
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`  HTTP error! status: ${response.status}`);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log(`  ✓ Received ${Array.isArray(data) ? data.length + ' items' : 'data'}`);
            return data;
        } catch (error) {
            console.error('  ✗ Error fetching data:', error);
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
        console.log('  Building template lookup map...');
        const templateMap = {
            tasks: new Map(),
            operations: new Map(),
            taskExecutors: new Map(),
            operationExecutors: new Map(),
            taskParameters: new Map(),
            operationParameters: new Map()
        };

        let processedCount = 0;
        let taskNormativesAdded = 0;
        let operationNormativesAdded = 0;
        let taskExecutorsAdded = 0;
        let operationExecutorsAdded = 0;
        let taskParametersAdded = 0;
        let operationParametersAdded = 0;

        projectData.forEach(item => {
            const isTemplate = !item['Статус проекта'] || item['Статус проекта'] !== 'В работе';

            if (isTemplate) {
                processedCount++;
                const taskName = item['Задача проекта'];
                const operationName = item['Операция'];
                const taskNormative = parseDuration(item['Норматив задачи']);
                const operationNormative = parseDuration(item['Норматив операции']);
                const executorsNeeded = item['Исполнителей'];
                const taskParameters = item['Параметры задачи'];
                const operationParameters = item['Параметры операции'];

                if (taskName && taskNormative > 0) {
                    if (!templateMap.tasks.has(taskName)) {
                        templateMap.tasks.set(taskName, taskNormative);
                        taskNormativesAdded++;
                        console.log(`    Added task normative: "${taskName}" = ${taskNormative} min`);
                    }
                }

                if (operationName && operationNormative > 0) {
                    if (!templateMap.operations.has(operationName)) {
                        templateMap.operations.set(operationName, operationNormative);
                        operationNormativesAdded++;
                        console.log(`    Added operation normative: "${operationName}" = ${operationNormative} min`);
                    }
                }

                // Store executors count for both tasks and operations
                if (taskName && executorsNeeded && executorsNeeded !== '') {
                    if (!templateMap.taskExecutors.has(taskName)) {
                        templateMap.taskExecutors.set(taskName, executorsNeeded);
                        taskExecutorsAdded++;
                        console.log(`    Added task executors: "${taskName}" needs ${executorsNeeded} executors`);
                    }
                }

                if (operationName && executorsNeeded && executorsNeeded !== '') {
                    if (!templateMap.operationExecutors.has(operationName)) {
                        templateMap.operationExecutors.set(operationName, executorsNeeded);
                        operationExecutorsAdded++;
                        console.log(`    Added operation executors: "${operationName}" needs ${executorsNeeded} executors`);
                    }
                }

                // Store parameters for both tasks and operations
                if (taskName && taskParameters && taskParameters.trim() !== '') {
                    if (!templateMap.taskParameters.has(taskName)) {
                        templateMap.taskParameters.set(taskName, taskParameters);
                        taskParametersAdded++;
                        console.log(`    Added task parameters: "${taskName}" = "${taskParameters}"`);
                    }
                }

                if (operationName && operationParameters && operationParameters.trim() !== '') {
                    if (!templateMap.operationParameters.has(operationName)) {
                        templateMap.operationParameters.set(operationName, operationParameters);
                        operationParametersAdded++;
                        console.log(`    Added operation parameters: "${operationName}" = "${operationParameters}"`);
                    }
                }
            }
        });

        console.log(`  Processed ${processedCount} template items`);
        console.log(`  Summary: ${taskNormativesAdded} task normatives, ${operationNormativesAdded} operation normatives, ${taskExecutorsAdded} task executor specs, ${operationExecutorsAdded} operation executor specs, ${taskParametersAdded} task parameters, ${operationParametersAdded} operation parameters`);

        return templateMap;
    }

    /**
     * Get executors count for an item (task or operation)
     * Priority: 1) Template value, 2) Default (1)
     */
    function getExecutorsCount(item, templateLookup, isOperation) {
        if (isOperation) {
            const operationName = item['Операция'];
            if (operationName && templateLookup.operationExecutors.has(operationName)) {
                const count = templateLookup.operationExecutors.get(operationName);
                return parseInt(count, 10) || 1;
            }
        } else {
            const taskName = item['Задача проекта'];
            if (taskName && templateLookup.taskExecutors.has(taskName)) {
                const count = templateLookup.taskExecutors.get(taskName);
                return parseInt(count, 10) || 1;
            }
        }

        // Default: 1 executor
        return 1;
    }

    /**
     * Merge task and operation parameters
     * Operation parameters have priority when codes match
     * Order: non-overridden task params first, then all operation params
     */
    function mergeParameters(taskParams, operationParams) {
        if (!taskParams && !operationParams) {
            return '';
        }
        if (!taskParams) return operationParams;
        if (!operationParams) return taskParams;

        const taskParamsParsed = parseParameterString(taskParams);
        const operationParamsParsed = parseParameterString(operationParams);

        // Create a set of operation parameter IDs
        const operationParamIds = new Set(operationParamsParsed.map(p => p.paramId));

        // Collect non-overridden task parameters
        const nonOverriddenTaskParams = [];
        for (const param of taskParamsParsed) {
            if (!operationParamIds.has(param.paramId)) {
                nonOverriddenTaskParams.push(param.paramId + ':' + param.valueStr);
            }
        }

        // Collect all operation parameters
        const allOperationParams = operationParamsParsed.map(p => p.paramId + ':' + p.valueStr);

        // Merge: non-overridden task params first, then operation params
        const merged = [...nonOverriddenTaskParams, ...allOperationParams].join(',');
        return merged;
    }

    /**
     * Get parameters for an item (task or operation)
     * For operations: merges task and operation parameters, with operation having priority when codes match
     * For tasks: uses task parameters only
     * Priority for both:
     *   1) Template parameters (by task/operation name)
     *   2) Current parameters (if filled)
     */
    function getItemParameters(item, templateLookup, isOperation) {
        const taskName = item['Задача проекта'];
        const operationName = item['Операция'];
        const currentTaskParams = item['Параметры задачи'];
        const currentOperationParams = item['Параметры операции'];

        if (isOperation) {
            // Get task parameters (template or current)
            let taskParams = '';
            if (taskName && templateLookup.taskParameters.has(taskName)) {
                taskParams = templateLookup.taskParameters.get(taskName);
                console.log(`      Parameters: got template task parameters "${taskParams}" for "${taskName}"`);
            } else if (currentTaskParams && currentTaskParams.trim() !== '') {
                taskParams = currentTaskParams;
                console.log(`      Parameters: got current task parameters "${taskParams}"`);
            }

            // Get operation parameters (template or current)
            let operationParams = '';
            if (operationName && templateLookup.operationParameters.has(operationName)) {
                operationParams = templateLookup.operationParameters.get(operationName);
                console.log(`      Parameters: got template operation parameters "${operationParams}" for "${operationName}"`);
            } else if (currentOperationParams && currentOperationParams.trim() !== '') {
                operationParams = currentOperationParams;
                console.log(`      Parameters: got current operation parameters "${operationParams}"`);
            }

            // Merge parameters (operation has priority on matching codes)
            const merged = mergeParameters(taskParams, operationParams);
            if (merged !== '') {
                console.log(`      Parameters: merged result "${merged}"`);
            } else {
                console.log(`      Parameters: no parameters found (all sources empty)`);
            }
            return merged;
        } else {
            // For tasks:
            // Priority 1: Template task parameters
            if (taskName && templateLookup.taskParameters.has(taskName)) {
                const templateParams = templateLookup.taskParameters.get(taskName);
                console.log(`      Parameters: using template task parameters "${templateParams}" for "${taskName}"`);
                return templateParams;
            }

            // Priority 2: Current task parameters
            if (currentTaskParams && currentTaskParams.trim() !== '') {
                console.log(`      Parameters: no template parameters found, using current task parameters "${currentTaskParams}"`);
                return currentTaskParams;
            }

            console.log(`      Parameters: task parameters are empty`);
            return '';
        }
    }

    /**
     * Calculate duration for an item (task or operation)
     * Priority: 1) Existing duration > 0, 2) Template × quantity, 3) Default
     */
    function calculateDuration(item, templateLookup, isOperation) {
        const itemName = isOperation ? item['Операция'] : item['Задача проекта'];
        const itemId = isOperation ? item['ОперацияID'] : item['Задача проектаID'];

        const existingDuration = isOperation
            ? parseDuration(item['Длительность операции'])
            : parseDuration(item['Длительность задачи']);

        // Priority 1: Use existing duration if present and > 0
        if (existingDuration > 0) {
            console.log(`      Duration for "${itemName}" (${itemId}): ${existingDuration} min [existing]`);
            return { duration: existingDuration, source: 'existing' };
        }

        // Get quantity
        const quantity = parseQuantity(item['Кол-во']);

        // Priority 2: Use template normative × quantity
        if (isOperation) {
            const operationName = item['Операция'];
            if (operationName && templateLookup.operations.has(operationName)) {
                const normative = templateLookup.operations.get(operationName);
                const calculatedDuration = normative * quantity;
                console.log(`      Duration for "${itemName}" (${itemId}): ${normative} min × ${quantity} = ${calculatedDuration} min [template]`);
                return { duration: calculatedDuration, source: 'template' };
            }
        } else {
            const taskName = item['Задача проекта'];
            if (taskName && templateLookup.tasks.has(taskName)) {
                const normative = templateLookup.tasks.get(taskName);
                const calculatedDuration = normative * quantity;
                console.log(`      Duration for "${itemName}" (${itemId}): ${normative} min × ${quantity} = ${calculatedDuration} min [template]`);
                return { duration: calculatedDuration, source: 'template' };
            }
        }

        // Priority 3: Use default
        console.log(`      Duration for "${itemName}" (${itemId}): ${CONFIG.defaultDuration} min [default - no template found]`);
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
     * Parse parameter string in format: ParamID:Value(MIN-MAX) or ParamID:%(-)
     * Examples:
     * - "115:849(-)" -> {paramId: "115", valueStr: "849(-)", value: "849", min: null, max: null, required: false}
     * - "2673:(4-)" -> {paramId: "2673", valueStr: "(4-)", value: null, min: 4, max: null, required: false}
     * - "740:%(-)" -> {paramId: "740", valueStr: "%(-)`, value: null, min: null, max: null, required: true}
     * - "2673:(1-2)" -> {paramId: "2673", valueStr: "(1-2)", value: null, min: 1, max: 2, required: false}
     */
    function parseParameterString(paramStr) {
        const params = [];
        if (!paramStr || paramStr.trim() === '') {
            return params;
        }

        const parts = paramStr.split(',');
        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) continue;

            const colonIndex = trimmed.indexOf(':');
            if (colonIndex === -1) continue;

            const paramId = trimmed.substring(0, colonIndex);
            const valueStr = trimmed.substring(colonIndex + 1);

            const param = {
                paramId: paramId,
                valueStr: valueStr,
                value: null,
                min: null,
                max: null,
                required: false
            };

            // Check for required field marker (%)
            if (valueStr.includes('%')) {
                param.required = true;
            } else {
                // Check for range in parentheses
                const rangeMatch = valueStr.match(/\(([^)]+)\)/);
                if (rangeMatch) {
                    const rangeStr = rangeMatch[1];
                    const rangeParts = rangeStr.split('-');

                    if (rangeParts.length === 2) {
                        const minStr = rangeParts[0].trim();
                        const maxStr = rangeParts[1].trim();

                        if (minStr !== '') {
                            const minVal = parseFloat(minStr);
                            if (!isNaN(minVal)) {
                                param.min = minVal;
                            }
                        }

                        if (maxStr !== '') {
                            const maxVal = parseFloat(maxStr);
                            if (!isNaN(maxVal)) {
                                param.max = maxVal;
                            }
                        }
                    }
                }

                // Extract value before parentheses
                const valueBeforeParens = valueStr.split('(')[0].trim();
                if (valueBeforeParens !== '' && valueBeforeParens !== '%') {
                    param.value = valueBeforeParens;
                }
            }

            params.push(param);
        }

        return params;
    }

    /**
     * Parse busy time string in format: YYYYMMDD:H-H,YYYYMMDD:H-H
     * Example: "20251124:9-13,20251121:8-12"
     * Returns array of {date: Date, startHour: number, endHour: number}
     */
    function parseBusyTime(busyTimeStr) {
        const busySlots = [];
        if (!busyTimeStr || busyTimeStr.trim() === '') {
            return busySlots;
        }

        const slots = busyTimeStr.split(',');
        for (const slot of slots) {
            const trimmed = slot.trim();
            if (!trimmed) continue;

            const colonIndex = trimmed.indexOf(':');
            if (colonIndex === -1) continue;

            const dateStr = trimmed.substring(0, colonIndex); // YYYYMMDD
            const timeRange = trimmed.substring(colonIndex + 1); // H-H

            // Parse date
            if (dateStr.length !== 8) continue;
            const year = parseInt(dateStr.substring(0, 4), 10);
            const month = parseInt(dateStr.substring(4, 6), 10) - 1; // 0-indexed
            const day = parseInt(dateStr.substring(6, 8), 10);
            const date = new Date(year, month, day);

            // Parse time range
            const timeParts = timeRange.split('-');
            if (timeParts.length !== 2) continue;

            const startHour = parseInt(timeParts[0], 10);
            const endHour = parseInt(timeParts[1], 10);

            if (!isNaN(startHour) && !isNaN(endHour)) {
                busySlots.push({
                    date: date,
                    startHour: startHour,
                    endHour: endHour
                });
            }
        }

        return busySlots;
    }

    /**
     * Parse coordinates string in format: "latitude,longitude" or "lat, lon"
     * Example: "55.7558, 37.6173" or "55.7558,37.6173"
     * Returns {lat: number, lon: number} or null if invalid
     */
    function parseCoordinates(coordStr) {
        if (!coordStr || coordStr.trim() === '') {
            return null;
        }

        const parts = coordStr.split(',');
        if (parts.length !== 2) {
            return null;
        }

        const lat = parseFloat(parts[0].trim());
        const lon = parseFloat(parts[1].trim());

        if (isNaN(lat) || isNaN(lon)) {
            return null;
        }

        return { lat, lon };
    }

    /**
     * Calculate distance between two points using Haversine formula
     * Returns distance in kilometers
     */
    function calculateDistance(coord1, coord2) {
        if (!coord1 || !coord2) {
            return Infinity; // If coordinates are missing, treat as infinitely far
        }

        const R = 6371; // Earth's radius in kilometers
        const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
        const dLon = (coord2.lon - coord1.lon) * Math.PI / 180;

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance;
    }

    /**
     * Check if executor is available during the given time slot
     */
    function isExecutorAvailable(executor, startTime, endTime, executorAssignments) {
        // Check pre-existing busy time
        const busySlots = parseBusyTime(executor['Занятое время']);

        for (const slot of busySlots) {
            const slotStart = new Date(slot.date);
            slotStart.setHours(slot.startHour, 0, 0, 0);
            const slotEnd = new Date(slot.date);
            slotEnd.setHours(slot.endHour, 0, 0, 0);

            // Check for overlap
            if (startTime < slotEnd && endTime > slotStart) {
                return false;
            }
        }

        // Check current assignments
        const executorId = executor['ПользовательID'];
        const assignments = executorAssignments.get(executorId) || [];

        for (const assignment of assignments) {
            // Check for overlap
            if (startTime < assignment.endTime && endTime > assignment.startTime) {
                return false;
            }
        }

        return true;
    }

    /**
     * Validate executor against task/operation parameters
     */
    function validateExecutorParameters(executor, parameterConstraints) {
        if (!parameterConstraints || parameterConstraints.length === 0) {
            return true;
        }

        for (const constraint of parameterConstraints) {
            const paramId = constraint.paramId;

            // Map parameter IDs to executor fields
            let executorValue = null;
            if (paramId === '2673') {
                // Квалификация -> Уровень
                executorValue = parseFloat(executor['Квалификация -> Уровень']);
            } else if (paramId === '115') {
                // Пользователь -> Роль
                executorValue = executor['Роль'];
            } else if (paramId === '728') {
                // Пользователь -> Квалификация
                executorValue = executor['Квалификация'];
            } else if (paramId === '740') {
                // Операция -> Дата подтверждения (field must be filled)
                // This is checked on operation level, not executor level
                continue;
            } else if (paramId === '1015') {
                // Задача проекта -> Подтверждено заказчиком
                // This is checked on task level, not executor level
                continue;
            }

            // Check if required field is filled
            if (constraint.required) {
                if (executorValue === null || executorValue === undefined || executorValue === '') {
                    return false;
                }
            }

            // Check exact value match
            if (constraint.value !== null) {
                if (executorValue !== constraint.value && executorValue != constraint.value) {
                    return false;
                }
            }

            // Check range
            if (constraint.min !== null || constraint.max !== null) {
                const numValue = parseFloat(executorValue);
                if (isNaN(numValue)) {
                    return false;
                }

                if (constraint.min !== null && numValue < constraint.min) {
                    return false;
                }

                if (constraint.max !== null && numValue > constraint.max) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Schedule tasks and operations with support for parallel execution on different grips
     */
    function scheduleTasks(projectData, templateLookup, workHours, projectStartDate) {
        console.log('  Scheduling work items...');
        const scheduled = [];
        const completionTimes = new Map(); // Track when each task/operation completes
        const gripCompletionTimes = new Map(); // Track completion time per grip: Map<grip, Map<taskName, endTime>>

        // Filter only "В работе" (In progress) items
        const workItems = projectData.filter(item => item['Статус проекта'] === 'В работе');
        console.log(`  Found ${workItems.length} work items to schedule`);

        let currentTime = new Date(projectStartDate);
        currentTime.setHours(workHours.dayStart, 0, 0, 0);
        console.log(`  Initial scheduling time: ${formatDateTime(currentTime)}`);

        let itemNumber = 0;
        workItems.forEach(item => {
            const isOperation = item['ОперацияID'] && item['ОперацияID'] !== '';
            const itemId = isOperation ? item['ОперацияID'] : item['Задача проектаID'];
            const itemName = isOperation ? item['Операция'] : item['Задача проекта'];
            const itemType = isOperation ? 'Operation' : 'Task';
            const gripId = item['ЗахваткаID'] || '';
            const gripCoordinates = item['Захватка (координаты)'] || '';

            // Skip if no name
            if (!itemName || itemName.trim() === '') {
                console.log(`    Skipping ${itemType} with no name (ID: ${itemId})`);
                return;
            }

            itemNumber++;
            console.log(`  --- Scheduling item ${itemNumber}/${workItems.length}: ${itemType} "${itemName}" (${itemId}) ---`);
            if (gripId || gripCoordinates) {
                console.log(`      Grip ID: "${gripId}"${gripCoordinates ? `, Coordinates: ${gripCoordinates}` : ''}`);
            }

            // Calculate duration
            const durationInfo = calculateDuration(item, templateLookup, isOperation);
            const durationMinutes = durationInfo.duration;

            // Check for dependencies
            let dependencyTime = null;
            if (isOperation) {
                const prevOperation = item['Предыдущая Операция'];
                if (prevOperation && prevOperation !== '') {
                    // Check grip-specific completion time first if grip is specified
                    if (gripId && gripCompletionTimes.has(gripId)) {
                        const gripTimes = gripCompletionTimes.get(gripId);
                        dependencyTime = gripTimes.get(`op:${prevOperation}`);
                        if (dependencyTime) {
                            console.log(`      Dependency (grip-specific): waiting for operation "${prevOperation}" on grip "${gripId}" (completes at ${formatDateTime(dependencyTime)})`);
                        }
                    }
                    // Fallback to global completion time
                    if (!dependencyTime) {
                        dependencyTime = completionTimes.get(`op:${prevOperation}`);
                        if (dependencyTime) {
                            console.log(`      Dependency (global): waiting for operation "${prevOperation}" (completes at ${formatDateTime(dependencyTime)})`);
                        } else {
                            console.log(`      Dependency: operation "${prevOperation}" not found in completion times`);
                        }
                    }
                }
            } else {
                const prevTask = item['Предыдущая Задача'];
                if (prevTask && prevTask !== '') {
                    // Check grip-specific completion time first if grip is specified
                    if (gripId && gripCompletionTimes.has(gripId)) {
                        const gripTimes = gripCompletionTimes.get(gripId);
                        dependencyTime = gripTimes.get(`task:${prevTask}`);
                        if (dependencyTime) {
                            console.log(`      Dependency (grip-specific): waiting for task "${prevTask}" on grip "${gripId}" (completes at ${formatDateTime(dependencyTime)})`);
                        }
                    }
                    // Fallback to global completion time
                    if (!dependencyTime) {
                        dependencyTime = completionTimes.get(`task:${prevTask}`);
                        if (dependencyTime) {
                            console.log(`      Dependency (global): waiting for task "${prevTask}" (completes at ${formatDateTime(dependencyTime)})`);
                        } else {
                            console.log(`      Dependency: task "${prevTask}" not found in completion times`);
                        }
                    }
                }
            }

            // Determine start time
            // For items with a grip, use grip-specific timeline if no dependencies
            // For items without grip or with dependencies, use dependency time or current time
            let startTime;
            if (dependencyTime) {
                startTime = new Date(dependencyTime);
                console.log(`      Starting after dependency: ${formatDateTime(startTime)}`);
            } else if (gripId) {
                // For grip-based items without dependencies, they can start at project start time (parallel execution)
                startTime = new Date(projectStartDate);
                startTime.setHours(workHours.dayStart, 0, 0, 0);
                console.log(`      Starting at project start (grip "${gripId}" allows parallel execution): ${formatDateTime(startTime)}`);
            } else {
                // For items without grip, use sequential scheduling
                startTime = new Date(currentTime);
                console.log(`      Starting at current time: ${formatDateTime(startTime)}`);
            }

            // For tasks <= 4 hours, ensure they fit in one day
            if (cannotSpanDays(durationMinutes) && !fitsInRemainingTime(startTime, durationMinutes, workHours)) {
                // Move to next day
                const oldStartTime = new Date(startTime);
                startTime.setDate(startTime.getDate() + 1);
                startTime.setHours(workHours.dayStart, 0, 0, 0);
                console.log(`      Task ≤ 4h doesn't fit today, moving from ${formatDateTime(oldStartTime)} to ${formatDateTime(startTime)}`);
            }

            // Calculate end time
            console.log(`      Calculating end time: adding ${durationMinutes} minutes to ${formatDateTime(startTime)}`);
            const endTime = addWorkingTime(startTime, durationMinutes, workHours);
            console.log(`      End time: ${formatDateTime(endTime)}`);

            // Store completion time for dependencies
            const key = isOperation ? `op:${itemName}` : `task:${itemName}`;
            completionTimes.set(key, endTime);

            // Store grip-specific completion time if grip is specified
            if (gripId) {
                if (!gripCompletionTimes.has(gripId)) {
                    gripCompletionTimes.set(gripId, new Map());
                }
                const gripTimes = gripCompletionTimes.get(gripId);
                gripTimes.set(key, endTime);
                console.log(`      Stored grip-specific completion time for "${gripId}"`);
            }

            // Update current time for next item (only for non-grip items or sequential logic)
            if (!gripId) {
                currentTime = new Date(endTime);
                console.log(`      Next item will start after: ${formatDateTime(currentTime)}`);
            }

            // Determine parameters (with template lookup and fallback)
            const itemParameters = getItemParameters(item, templateLookup, isOperation);

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
                previousDependency: isOperation ? item['Предыдущая Операция'] : item['Предыдущая Задача'],
                parameters: itemParameters,
                executorsNeeded: getExecutorsCount(item, templateLookup, isOperation),
                executors: [],
                gripId: gripId,
                gripCoordinates: gripCoordinates
            });
        });

        return scheduled;
    }

    /**
     * Assign executors to scheduled tasks and operations
     * Prioritizes executors based on proximity to grip coordinates
     */
    function assignExecutors(scheduled, executors) {
        console.log('  Assigning executors to scheduled items...');
        // Track executor assignments: Map<executorId, [{startTime, endTime, taskName}]>
        const executorAssignments = new Map();

        let itemNumber = 0;
        for (const item of scheduled) {
            itemNumber++;
            const itemType = item.isOperation ? 'Operation' : 'Task';
            console.log(`  --- Assigning executors for item ${itemNumber}/${scheduled.length}: ${itemType} "${item.name}" ---`);

            const parameterConstraints = parseParameterString(item.parameters);
            const executorsNeeded = item.executorsNeeded;
            const assignedExecutors = [];

            console.log(`      Executors needed: ${executorsNeeded}`);
            if (parameterConstraints.length > 0) {
                console.log(`      Parameter constraints: ${JSON.stringify(parameterConstraints)}`);
            } else {
                console.log(`      No parameter constraints`);
            }
            console.log(`      Time slot: ${formatDateTime(item.startTime)} - ${formatDateTime(item.endTime)}`);

            // Parse grip coordinates if available
            const gripCoords = parseCoordinates(item.gripCoordinates);
            if (gripCoords) {
                console.log(`      Grip coordinates: ${gripCoords.lat}, ${gripCoords.lon}`);
            }

            // Build list of eligible executors with distances
            const eligibleExecutors = [];
            let checkedExecutors = 0;
            let failedParameterCheck = 0;
            let failedAvailabilityCheck = 0;

            for (const executor of executors) {
                checkedExecutors++;
                const executorId = executor['ПользовательID'];
                const executorName = executor['Исполнитель'];

                // Check parameter constraints
                if (!validateExecutorParameters(executor, parameterConstraints)) {
                    failedParameterCheck++;
                    console.log(`      ✗ Executor "${executorName}" (${executorId}) - failed parameter validation`);
                    continue;
                }

                // Check availability
                if (!isExecutorAvailable(executor, item.startTime, item.endTime, executorAssignments)) {
                    failedAvailabilityCheck++;
                    console.log(`      ✗ Executor "${executorName}" (${executorId}) - not available during time slot`);
                    continue;
                }

                // Calculate distance to grip if coordinates are available
                let distance = Infinity;
                const executorCoords = parseCoordinates(executor['Координаты']);
                if (gripCoords && executorCoords) {
                    distance = calculateDistance(executorCoords, gripCoords);
                    console.log(`      ✓ Executor "${executorName}" (${executorId}) - distance: ${distance.toFixed(2)} km`);
                } else {
                    console.log(`      ✓ Executor "${executorName}" (${executorId}) - no distance calculation (missing coordinates)`);
                }

                eligibleExecutors.push({
                    executor: executor,
                    distance: distance
                });
            }

            // Sort eligible executors by distance (nearest first)
            eligibleExecutors.sort((a, b) => a.distance - b.distance);

            // Assign the nearest executors
            for (let i = 0; i < Math.min(executorsNeeded, eligibleExecutors.length); i++) {
                const {executor, distance} = eligibleExecutors[i];
                const executorId = executor['ПользовательID'];
                const executorName = executor['Исполнитель'];

                assignedExecutors.push({
                    id: executorId,
                    name: executorName,
                    qualificationLevel: executor['Квалификация -> Уровень'],
                    distance: distance !== Infinity ? distance : null
                });

                const distanceStr = distance !== Infinity ? ` (distance: ${distance.toFixed(2)} km)` : '';
                console.log(`      ✓ Assigned executor "${executorName}" (${executorId}) with qualification level ${executor['Квалификация -> Уровень']}${distanceStr}`);

                // Record assignment
                if (!executorAssignments.has(executorId)) {
                    executorAssignments.set(executorId, []);
                }
                executorAssignments.get(executorId).push({
                    startTime: item.startTime,
                    endTime: item.endTime,
                    taskName: item.taskName,
                    operationName: item.isOperation ? item.name : null,
                    gripId: item.gripId,
                    gripCoordinates: item.gripCoordinates
                });
            }

            // Store assigned executors in item
            item.executors = assignedExecutors;

            console.log(`      Summary: checked ${checkedExecutors} executors, assigned ${assignedExecutors.length}/${executorsNeeded}`);
            if (failedParameterCheck > 0) {
                console.log(`        - Failed parameter checks: ${failedParameterCheck}`);
            }
            if (failedAvailabilityCheck > 0) {
                console.log(`        - Failed availability checks: ${failedAvailabilityCheck}`);
            }

            // Log warning if not enough executors found
            if (assignedExecutors.length < executorsNeeded) {
                console.warn(`      ⚠ Недостаточно исполнителей для "${item.name}": нужно ${executorsNeeded}, найдено ${assignedExecutors.length}`);
            }
        }

        return scheduled;
    }

    /**
     * Save durations to API
     */
    async function saveDurations(scheduled) {
        console.log('  Saving calculated durations to API...');
        const savePromises = [];

        for (const item of scheduled) {
            if (item.needsDurationSave) {
                const fieldCode = item.isOperation ? CONFIG.operationDurationCode : CONFIG.taskDurationCode;
                const itemType = item.isOperation ? 'Operation' : 'Task';
                console.log(`    Saving duration for ${itemType} "${item.name}" (${item.id}): ${item.duration} min to field ${fieldCode}`);

                savePromises.push(
                    saveData(item.id, fieldCode, item.duration.toString())
                        .then(() => {
                            console.log(`      ✓ Successfully saved duration for "${item.name}"`);
                            return { success: true, id: item.id, name: item.name };
                        })
                        .catch(error => {
                            console.error(`      ✗ Failed to save duration for "${item.name}":`, error);
                            return { success: false, id: item.id, name: item.name, error };
                        })
                );
            }
        }

        if (savePromises.length === 0) {
            console.log('    No durations to save (all items have existing durations)');
        }

        return await Promise.all(savePromises);
    }

    /**
     * Save start times to API
     */
    async function saveStartTimes(scheduled) {
        console.log('  Saving scheduled start times to API...');
        const savePromises = [];

        for (const item of scheduled) {
            const fieldCode = item.isOperation ? CONFIG.operationStartCode : CONFIG.taskStartCode;
            const startTimeStr = formatDateTime(item.startTime);
            const itemType = item.isOperation ? 'Operation' : 'Task';

            console.log(`    Saving start time for ${itemType} "${item.name}" (${item.id}): ${startTimeStr} to field ${fieldCode}`);

            savePromises.push(
                saveData(item.id, fieldCode, startTimeStr)
                    .then(() => {
                        console.log(`      ✓ Successfully saved start time for "${item.name}"`);
                        return { success: true, id: item.id, name: item.name };
                    })
                    .catch(error => {
                        console.error(`      ✗ Failed to save start time for "${item.name}":`, error);
                        return { success: false, id: item.id, name: item.name, error };
                    })
            );
        }

        return await Promise.all(savePromises);
    }

    /**
     * Save executor assignments to API
     */
    async function saveExecutorAssignments(scheduled) {
        console.log('  Saving executor assignments to API...');
        const savePromises = [];

        for (const item of scheduled) {
            if (item.executors.length === 0) {
                console.log(`    Skipping "${item.name}" (no executors assigned)`);
                continue;
            }

            const fieldCode = item.isOperation ? CONFIG.operationExecutorCode : CONFIG.taskExecutorCode;
            // Join executor IDs with comma
            const executorIds = item.executors.map(e => e.id).join(',');
            const executorNames = item.executors.map(e => e.name).join(', ');
            const itemType = item.isOperation ? 'Operation' : 'Task';

            console.log(`    Saving executors for ${itemType} "${item.name}" (${item.id}): [${executorNames}] (IDs: ${executorIds}) to field ${fieldCode}`);

            savePromises.push(
                saveData(item.id, fieldCode, executorIds)
                    .then(() => {
                        console.log(`      ✓ Successfully saved executors for "${item.name}"`);
                        return { success: true, id: item.id, name: item.name, executors: item.executors };
                    })
                    .catch(error => {
                        console.error(`      ✗ Failed to save executors for "${item.name}":`, error);
                        return { success: false, id: item.id, name: item.name, error };
                    })
            );
        }

        if (savePromises.length === 0) {
            console.log('    No executor assignments to save');
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
                        <th>Захватка</th>
                        <th>Длительность (мин)</th>
                        <th>Источник норматива</th>
                        <th>Количество</th>
                        <th>Время начала</th>
                        <th>Время окончания</th>
                        <th>Исполнители</th>
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

            // Format executors
            let executorsHtml = '';
            if (item.executors.length > 0) {
                executorsHtml = item.executors.map(e => {
                    let str = `${e.name} (ур.${e.qualificationLevel})`;
                    if (e.distance !== null && e.distance !== undefined) {
                        str += ` [${e.distance.toFixed(1)} км]`;
                    }
                    return str;
                }).join('<br>');
            } else if (item.executorsNeeded > 0) {
                executorsHtml = '<span style="color: red;">Не назначен</span>';
            } else {
                executorsHtml = '-';
            }

            // Highlight rows with missing executors
            const rowStyle = (item.executorsNeeded > 0 && item.executors.length < item.executorsNeeded)
                ? 'background-color: #fff3cd;'
                : '';

            // Format grip display
            let gripDisplay = '-';
            if (item.gripId || item.gripCoordinates) {
                if (item.gripId && item.gripCoordinates) {
                    gripDisplay = `${item.gripId}<br><small>${item.gripCoordinates}</small>`;
                } else if (item.gripId) {
                    gripDisplay = item.gripId;
                } else {
                    gripDisplay = item.gripCoordinates;
                }
            }

            html += `
                <tr style="${rowStyle}">
                    <td>${index + 1}</td>
                    <td>${item.taskName || ''}</td>
                    <td>${item.isOperation ? item.name : ''}</td>
                    <td>${gripDisplay}</td>
                    <td>${item.duration}</td>
                    <td>${sourceLabel}</td>
                    <td>${item.quantity}</td>
                    <td>${formatDateTime(item.startTime)}</td>
                    <td>${formatDateTime(item.endTime)}</td>
                    <td>${executorsHtml}</td>
                    <td>${item.previousDependency || '-'}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
            <p style="margin-top: 20px;"><em>График рассчитан с учетом рабочего времени, обеденного перерыва, доступности и квалификации исполнителей. Одинаковые задачи на разных захватках выполняются параллельно. Исполнители назначаются на ближайшие захватки по координатам.</em></p>
        `;

        contentDiv.innerHTML = html;
    }

    /**
     * Main execution function
     */
    async function main() {
        try {
            console.log('=== Starting project scheduler ===');
            console.log('Configuration:', CONFIG);

            // Show loading message
            const contentDiv = document.querySelector('.content');
            if (contentDiv) {
                contentDiv.innerHTML = '<p>Загрузка данных и расчет графика...</p>';
                console.log('Loading message displayed to user');
            } else {
                console.warn('Content div not found, schedule display may fail');
            }

            // Fetch project data
            console.log('--- Step 1: Fetching project data ---');
            const projectUrl = buildApiUrl(`/report/${CONFIG.projectReportId}?JSON_KV`);
            console.log('Project data URL:', projectUrl);
            const projectData = await fetchJson(projectUrl);
            console.log(`✓ Fetched ${projectData.length} items from project report`);

            // Log template vs work items breakdown
            const templateItems = projectData.filter(item => !item['Статус проекта'] || item['Статус проекта'] !== 'В работе');
            const workItems = projectData.filter(item => item['Статус проекта'] === 'В работе');
            console.log(`  - Template items: ${templateItems.length}`);
            console.log(`  - Work items (В работе): ${workItems.length}`);

            // Fetch work hours configuration
            console.log('--- Step 2: Fetching work hours configuration ---');
            const workHoursUrl = buildApiUrl(`/report/${CONFIG.workHoursReportId}?JSON_KV`);
            console.log('Work hours URL:', workHoursUrl);
            const workHoursData = await fetchJson(workHoursUrl);
            console.log(`✓ Fetched ${workHoursData.length} work hours settings`);

            // Fetch executors data
            console.log('--- Step 3: Fetching executors data ---');
            const executorsUrl = buildApiUrl(`/report/${CONFIG.executorsReportId}?JSON_KV`);
            console.log('Executors URL:', executorsUrl);
            const executorsData = await fetchJson(executorsUrl);
            console.log(`✓ Fetched ${executorsData.length} executors`);

            // Parse work hours
            console.log('--- Step 4: Parsing work hours configuration ---');
            const workHours = {
                dayStart: 9,
                dayEnd: 18,
                lunchStart: 13
            };
            console.log('Default work hours:', workHours);

            workHoursData.forEach(item => {
                const code = item['Код'];
                const value = parseInt(item['Значение'], 10);
                console.log(`  Processing setting: ${code} = ${value}`);
                if (code === 'day_start') workHours.dayStart = value;
                else if (code === 'day_end') workHours.dayEnd = value;
                else if (code === 'lunch_start') workHours.lunchStart = value;
            });

            console.log('✓ Final work hours:', workHours);
            console.log(`  Work day: ${workHours.dayStart}:00 - ${workHours.dayEnd}:00`);
            console.log(`  Lunch break: ${workHours.lunchStart}:00 - ${workHours.lunchStart + 1}:00`);

            // Find project start date
            console.log('--- Step 5: Finding project start date ---');
            let projectStartDate = null;
            let projectName = '';
            console.log('Looking for "В работе" project with start date...');
            for (const item of projectData) {
                if (item['Статус проекта'] === 'В работе' && item['Старт']) {
                    projectStartDate = parseDate(item['Старт']);
                    projectName = item['Проект'];
                    console.log(`  Found project: "${projectName}"`);
                    console.log(`  Start date string: "${item['Старт']}"`);
                    break;
                }
            }

            if (!projectStartDate) {
                console.error('Failed to find project start date');
                throw new Error('Не найдена дата старта проекта "В работе"');
            }

            console.log(`✓ Project: ${projectName}`);
            console.log(`✓ Start date: ${formatDate(projectStartDate)}`);

            // Build template lookup
            console.log('--- Step 6: Building template lookup ---');
            const templateLookup = buildTemplateLookup(projectData);
            console.log(`✓ Template lookup built:`);
            console.log(`  - Tasks: ${templateLookup.tasks.size}`);
            console.log(`  - Operations: ${templateLookup.operations.size}`);
            console.log(`  - Task executors: ${templateLookup.taskExecutors.size}`);
            console.log(`  - Operation executors: ${templateLookup.operationExecutors.size}`);
            console.log(`  - Task parameters: ${templateLookup.taskParameters.size}`);
            console.log(`  - Operation parameters: ${templateLookup.operationParameters.size}`);

            // Schedule tasks
            console.log('--- Step 7: Scheduling tasks and operations ---');
            const scheduled = scheduleTasks(projectData, templateLookup, workHours, projectStartDate);
            console.log(`✓ Scheduled ${scheduled.length} items`);

            // Log scheduling summary
            const tasksCount = scheduled.filter(item => !item.isOperation).length;
            const operationsCount = scheduled.filter(item => item.isOperation).length;
            console.log(`  - Tasks: ${tasksCount}`);
            console.log(`  - Operations: ${operationsCount}`);

            // Assign executors
            console.log('--- Step 8: Assigning executors ---');
            assignExecutors(scheduled, executorsData);
            const assignedCount = scheduled.filter(item => item.executors.length > 0).length;
            const itemsNeedingExecutors = scheduled.filter(item => item.executorsNeeded > 0).length;
            console.log(`✓ Assigned executors to ${assignedCount}/${itemsNeedingExecutors} items needing executors`);

            // Save durations
            console.log('--- Step 9: Saving durations to system ---');
            const itemsNeedingDurationSave = scheduled.filter(item => item.needsDurationSave).length;
            console.log(`Items requiring duration save: ${itemsNeedingDurationSave}`);
            const durationResults = await saveDurations(scheduled);
            const durationSuccessCount = durationResults.filter(r => r.success).length;
            const durationFailCount = durationResults.filter(r => !r.success).length;
            console.log(`✓ Saved ${durationSuccessCount}/${durationResults.length} durations`);
            if (durationFailCount > 0) {
                console.warn(`  ⚠ ${durationFailCount} duration saves failed`);
                durationResults.filter(r => !r.success).forEach(r => {
                    console.error(`    Failed: ${r.name} (${r.id})`, r.error);
                });
            }

            // Save start times
            console.log('--- Step 10: Saving start times to system ---');
            console.log(`Items to save: ${scheduled.length}`);
            const startTimeResults = await saveStartTimes(scheduled);
            const startTimeSuccessCount = startTimeResults.filter(r => r.success).length;
            const startTimeFailCount = startTimeResults.filter(r => !r.success).length;
            console.log(`✓ Saved ${startTimeSuccessCount}/${startTimeResults.length} start times`);
            if (startTimeFailCount > 0) {
                console.warn(`  ⚠ ${startTimeFailCount} start time saves failed`);
                startTimeResults.filter(r => !r.success).forEach(r => {
                    console.error(`    Failed: ${r.name} (${r.id})`, r.error);
                });
            }

            // Save executor assignments
            console.log('--- Step 11: Saving executor assignments to system ---');
            const itemsWithExecutors = scheduled.filter(item => item.executors.length > 0).length;
            console.log(`Items with executors to save: ${itemsWithExecutors}`);
            const executorResults = await saveExecutorAssignments(scheduled);
            const executorSuccessCount = executorResults.filter(r => r.success).length;
            const executorFailCount = executorResults.filter(r => !r.success).length;
            console.log(`✓ Saved ${executorSuccessCount}/${executorResults.length} executor assignments`);
            if (executorFailCount > 0) {
                console.warn(`  ⚠ ${executorFailCount} executor assignment saves failed`);
                executorResults.filter(r => !r.success).forEach(r => {
                    console.error(`    Failed: ${r.name} (${r.id})`, r.error);
                });
            }

            // Display schedule
            console.log('--- Step 12: Displaying schedule ---');
            displaySchedule(scheduled, projectName, projectStartDate);
            console.log('✓ Schedule table rendered');

            console.log('=== Project scheduler completed successfully! ===');

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
