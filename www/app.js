document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const addTaskModal = document.getElementById('add-task-modal');
    const openModalBtn = document.getElementById('open-modal-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelTaskBtn = document.getElementById('cancel-task-btn');
    const addTaskForm = document.getElementById('add-task-form');
    const todoListContainer = document.getElementById('todo-list-container');
    const ganttTaskList = document.getElementById('gantt-task-list');
    const ganttChartBars = document.getElementById('gantt-chart-bars');
    const ganttGridContainer = document.getElementById('gantt-grid-container');
    const ganttTimelineHeader = document.getElementById('gantt-timeline-header');

    const generateBtn = document.getElementById('generate-btn');
    const aiPromptInput = document.getElementById('ai-prompt-input');
    const zoomToFitBtn = document.getElementById('zoom-to-fit-btn');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    // --- Form Inputs ---
    const taskNameInput = document.getElementById('task-name-input');
    const startDateInput = document.getElementById('start-date-input');
    const endDateInput = document.getElementById('end-date-input');
    const taskColorSelect = document.getElementById('task-color-select');
    const modalTitle = addTaskModal.querySelector('h3');
    const saveTaskBtn = document.getElementById('save-task-btn');

    // --- State ---
    let tasks = [
        {
            id: 1,
            name: 'Kick-off Meeting',
            start: '2024-07-01',
            end: '2024-07-01',
            color: 'blue',
            completed: true,
        },
        {
            id: 2,
            name: 'Designphase',
            start: '2024-07-02',
            end: '2024-07-10',
            color: 'green',
            completed: false,
        },
        {
            id: 3,
            name: 'Entwicklung Prototyp',
            start: '2024-07-11',
            end: '2024-07-25',
            color: 'yellow',
            completed: false,
        },
    ]; // Central state for all tasks
    let currentlyEditingTaskId = null;
    let isZoomedToFit = false;
    let dayWidth = 50; // Default width for a day in pixels
    let dataFilePath = 'data.json'; // Default for browser, will be updated by Neutralino
    const ZOOM_STEP = 10;
    const MIN_DAY_WIDTH = 20;

    // --- Configuration ---
    const colorMap = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        yellow: 'bg-yellow-500',
        red: 'bg-red-500',
    };

    // --- Helper Functions ---
    const parseDate = (dateString) => {
        if (!dateString) return null;
        const date = new Date(dateString + 'T00:00:00');
        return isNaN(date.getTime()) ? null : date;
    };
    const diffDays = (date1, date2) => Math.round((date2 - date1) / (1000 * 60 * 60 * 24));

    /* For a given date, get the ISO week number */
    const getWeekNumber = (d) => {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        // Set to nearest Thursday: current date + 4 - current day number
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        // Get first day of year
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        // Calculate full weeks to nearest Thursday
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    };

    // --- Modal Control Functions ---
    const openModal = (taskId = null) => {
        addTaskForm.reset();
        if (taskId) {
            // --- EDIT MODE ---
            currentlyEditingTaskId = taskId;
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                modalTitle.textContent = 'Aufgabe bearbeiten';
                saveTaskBtn.querySelector('span:last-child').textContent = 'Änderungen speichern';
                taskNameInput.value = task.name;
                startDateInput.value = task.start;
                endDateInput.value = task.end;
                taskColorSelect.value = task.color;
            }
        } else {
            // --- ADD MODE ---
            currentlyEditingTaskId = null;
            modalTitle.textContent = 'Neue Aufgabe erstellen';
            saveTaskBtn.querySelector('span:last-child').textContent = 'Speichern';
        }
        addTaskModal.classList.remove('hidden');
        addTaskModal.classList.add('flex');
    };

    const closeModal = () => {
        addTaskModal.classList.add('hidden');
        addTaskModal.classList.remove('flex');
        currentlyEditingTaskId = null; // Always reset editing state
    };

    // --- Main Rendering Orchestrator ---
    const rerenderAll = () => {
        // Sort tasks by start date before rendering
        // Disable zoom out button if at minimum zoom and not in 'fit' mode
        zoomOutBtn.disabled = dayWidth <= MIN_DAY_WIDTH && !isZoomedToFit;

        tasks.sort((a, b) => parseDate(a.start) - parseDate(b.start));

        // 1. Clear all dynamic content
        todoListContainer.innerHTML = '';
        ganttTaskList.innerHTML = '';
        ganttChartBars.innerHTML = '';
        ganttTimelineHeader.innerHTML = '';

        if (tasks.length === 0) {
            todoListContainer.innerHTML = `<p class="text-[var(--text-secondary-color)]">Noch keine Aufgaben. Fügen Sie eine hinzu!</p>`;
            ganttTimelineHeader.style.minWidth = '1000px';
            ganttGridContainer.style.minWidth = '1000px';
            ganttGridContainer.style.gridTemplateColumns = '';
            ganttTimelineHeader.style.gridTemplateColumns = '';
            ganttGridContainer.style.backgroundImage = '';
            return;
        }

        const dates = tasks.flatMap(t => {
            const start = parseDate(t.start);
            const end = parseDate(t.end);
            return [start, end].filter(d => d !== null); // Filter out any invalid dates
        });

        if (dates.length === 0) {
            // If all tasks have invalid dates, or no valid dates could be parsed
            todoListContainer.innerHTML = `<p class="text-[var(--text-secondary-color)]">Keine gültigen Aufgaben zum Anzeigen oder Datumsfehler.</p>`;
            ganttTimelineHeader.style.minWidth = '1000px';
            ganttGridContainer.style.minWidth = '1000px';
            ganttGridContainer.style.gridTemplateColumns = '';
            ganttTimelineHeader.style.gridTemplateColumns = '';
            ganttGridContainer.style.backgroundImage = '';
            return;
        }

        const projectStartDate = new Date(Math.min(...dates));
        const projectEndDate = new Date(Math.max(...dates));
        const totalDays = diffDays(projectStartDate, projectEndDate) + 1;

        // --- Determine Timeline Granularity ---
        let timelineUnit = 'day';
        if (isZoomedToFit) {
            if (totalDays > 120) { // ~4 months
                timelineUnit = 'month';
            } else if (totalDays > 30) { // ~1 month
                timelineUnit = 'week';
            }
        }

        // Set min-width for horizontal scrolling or zoom to fit
        if (isZoomedToFit) {
            ganttTimelineHeader.style.minWidth = '100%';
            ganttGridContainer.style.minWidth = '100%';
        } else {
            const chartWidth = totalDays * dayWidth;
            ganttTimelineHeader.style.minWidth = `${chartWidth}px`;
            ganttGridContainer.style.minWidth = `${chartWidth}px`;
        }

        // Set the height of the containers that hold the rows.
        // h-12 corresponds to 3rem. This is crucial because gantt-chart-bars is absolutely positioned
        // and therefore does not contribute to the height of its parent, gantt-grid-container.
        ganttGridContainer.style.height = `${tasks.length * 3}rem`;

        if (isNaN(totalDays) || totalDays <= 0) {
            console.error('Gantt-Diagramm: Ungültige Gesamttage berechnet. Möglicherweise Datumsfehler in Aufgaben.');
            todoListContainer.innerHTML = `<p class="text-[var(--text-secondary-color)]">Problem bei der Datumsberechnung für das Gantt-Diagramm.</p>`;
            ganttTimelineHeader.style.minWidth = '1000px';
            ganttGridContainer.style.minWidth = '1000px';
            ganttGridContainer.style.gridTemplateColumns = '';
            ganttTimelineHeader.style.gridTemplateColumns = '';
            ganttGridContainer.style.backgroundImage = '';
            return;
        }

        // --- Render Header and Grid based on timelineUnit ---
        let timelineStartDate = projectStartDate;
        let timelineEndDate = projectEndDate;
        let totalTimelineUnits = totalDays;

        if (timelineUnit === 'day') {
            totalTimelineUnits = totalDays;
            for (let i = 0; i < totalTimelineUnits; i++) {
                const currentDate = new Date(timelineStartDate);
                currentDate.setDate(timelineStartDate.getDate() + i);
                const headerEl = document.createElement('div');
                headerEl.className = 'flex items-center justify-center text-xs text-[var(--text-secondary-color)]';
                const day = String(currentDate.getDate()).padStart(2, '0');
                const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                headerEl.textContent = `${day}.${month}`;
                ganttTimelineHeader.appendChild(headerEl);
            }
        } else if (timelineUnit === 'week') {
            const firstDay = new Date(projectStartDate);
            timelineStartDate = new Date(firstDay);
            timelineStartDate.setDate(firstDay.getDate() - (firstDay.getDay() + 6) % 7); // Monday of start week

            const lastDay = new Date(projectEndDate);
            timelineEndDate = new Date(lastDay);
            timelineEndDate.setDate(lastDay.getDate() + (6 - (lastDay.getDay() + 6) % 7)); // Sunday of end week

            totalTimelineUnits = Math.ceil((diffDays(timelineStartDate, timelineEndDate) + 1) / 7);

            let currentWeekStart = new Date(timelineStartDate);
            for (let i = 0; i < totalTimelineUnits; i++) {
                const headerEl = document.createElement('div');
                headerEl.className = 'flex items-center justify-center text-xs text-[var(--text-secondary-color)] whitespace-nowrap px-1';
                headerEl.textContent = `KW ${getWeekNumber(currentWeekStart)}`;
                ganttTimelineHeader.appendChild(headerEl);
                currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            }
        } else if (timelineUnit === 'month') {
            timelineStartDate = new Date(projectStartDate.getFullYear(), projectStartDate.getMonth(), 1);
            timelineEndDate = new Date(projectEndDate.getFullYear(), projectEndDate.getMonth() + 1, 0); // End of the month

            totalTimelineUnits = (timelineEndDate.getFullYear() - timelineStartDate.getFullYear()) * 12 + (timelineEndDate.getMonth() - timelineStartDate.getMonth()) + 1;

            let currentMonth = new Date(timelineStartDate);
            for (let i = 0; i < totalTimelineUnits; i++) {
                const headerEl = document.createElement('div');
                headerEl.className = 'flex items-center justify-center text-xs text-[var(--text-secondary-color)]';
                headerEl.textContent = currentMonth.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
                ganttTimelineHeader.appendChild(headerEl);
                currentMonth.setMonth(currentMonth.getMonth() + 1);
            }
        }

        const gridTemplateColumns = `repeat(${totalTimelineUnits}, minmax(0, 1fr))`;
        ganttTimelineHeader.style.gridTemplateColumns = gridTemplateColumns;
        ganttGridContainer.style.gridTemplateColumns = gridTemplateColumns;

        // Use CSS background for vertical grid lines instead of DOM elements
        ganttGridContainer.style.backgroundImage = `repeating-linear-gradient(to right, var(--surface-border-color) 0, var(--surface-border-color) 1px, transparent 1px, transparent 100%)`;
        ganttGridContainer.style.backgroundSize = `${100 / totalTimelineUnits}% 100%`;

        // 4. Render each task
        tasks.forEach(task => {
            // To-Do item
            const todoItem = document.createElement('label');
            todoItem.className = 'flex items-center gap-x-3 py-2 border-b border-[var(--surface-border-color)] last:border-b-0 cursor-pointer';
            todoItem.innerHTML = `
                <input type="checkbox" data-id="${task.id}" class="checkbox-custom h-5 w-5 rounded border-[var(--surface-border-color)] border-2 bg-transparent text-[var(--primary-color)] checked:bg-[var(--primary-color)] checked:border-[var(--primary-color)] focus:ring-2 focus:ring-offset-0 focus:ring-offset-[var(--surface-color)] focus:ring-[var(--primary-color)]" ${task.completed ? 'checked' : ''}>
                <p class="flex-1 text-base ${task.completed ? 'line-through text-[var(--text-secondary-color)]' : 'text-[var(--text-primary-color)]'}">${task.name}</p>
                <div class="flex items-center">
                    <button class="edit-btn text-[var(--text-secondary-color)] hover:text-[var(--text-primary-color)] transition-colors p-1 rounded-full hover:bg-[var(--surface-border-color)]" data-id="${task.id}">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button class="delete-btn text-[var(--text-secondary-color)] hover:text-red-500 transition-colors p-1 rounded-full hover:bg-[var(--surface-border-color)]" data-id="${task.id}">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            `;
            const checkbox = todoItem.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                const taskId = Number(e.target.dataset.id);
                const isCompleted = e.target.checked;
                toggleTaskCompletion(taskId, isCompleted);
            });
            todoListContainer.appendChild(todoItem);

            // Gantt task list item
            const ganttTaskItem = document.createElement('div');
            ganttTaskItem.className = 'h-12 flex items-center justify-between px-4 text-sm truncate';
            ganttTaskItem.innerHTML = `
                <span>${task.name}</span>
                <div class="flex items-center">
                    <button class="edit-btn text-[var(--text-secondary-color)] hover:text-[var(--text-primary-color)] transition-colors p-1 rounded-full hover:bg-[var(--surface-border-color)]" data-id="${task.id}">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button class="delete-btn text-[var(--text-secondary-color)] hover:text-red-500 transition-colors p-1 rounded-full hover:bg-[var(--surface-border-color)]" data-id="${task.id}">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            `;
            ganttTaskList.appendChild(ganttTaskItem);

            // Gantt chart bar
            const taskStart = parseDate(task.start); // Use the robust parseDate
            const taskEnd = parseDate(task.end);     // Use the robust parseDate

            if (!taskStart || !taskEnd || taskStart > taskEnd) {
                console.warn(`Aufgabe "${task.name}" hat ungültige Start/Enddaten und wird im Gantt-Diagramm übersprungen.`);
                return; // Skip rendering this bar if dates are invalid
            }

            const totalTimelineDurationInDays = diffDays(timelineStartDate, timelineEndDate) + 1;
            const startOffsetDays = diffDays(timelineStartDate, taskStart);
            const durationDays = diffDays(taskStart, taskEnd) + 1;

            const barRowContainer = document.createElement('div');
            barRowContainer.className = 'h-12 flex items-center relative px-1';

            if (durationDays > 0 && startOffsetDays >= 0 && totalTimelineDurationInDays > 0) {
                const barInner = document.createElement('div');
                barInner.className = `absolute h-8 top-1/2 -translate-y-1/2 rounded-md flex items-center px-2 text-white text-xs font-medium overflow-hidden ${colorMap[task.color] || 'bg-gray-500'}`;
                barInner.textContent = task.name;
                barInner.style.left = `${(startOffsetDays / totalTimelineDurationInDays) * 100}%`;
                barInner.style.width = `${(durationDays / totalTimelineDurationInDays) * 100}%`;
                barRowContainer.appendChild(barInner);
            }
            ganttChartBars.appendChild(barRowContainer);
        });
    };

    // --- Event Handlers ---
    const toggleTaskCompletion = async (taskId, isCompleted) => {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = isCompleted;
            await saveTasks();
            rerenderAll();
        }
    };

    const deleteTask = async (taskId) => {
        tasks = tasks.filter(t => t.id !== taskId);
        await saveTasks();
        rerenderAll();
    };

    const handleSaveTask = async (event) => {
        event.preventDefault();

        const taskName = taskNameInput.value.trim();
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        const color = taskColorSelect.value;

        if (!taskName || !startDate || !endDate) {
            alert('Bitte füllen Sie alle Felder aus.');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            alert('Das Enddatum darf nicht vor dem Startdatum liegen.');
            return;
        }

        if (currentlyEditingTaskId) {
            // Edit existing task
            const taskIndex = tasks.findIndex(t => t.id === currentlyEditingTaskId);
            if (taskIndex > -1) {
                tasks[taskIndex] = {
                    ...tasks[taskIndex], // keep id and completed status
                    name: taskName,
                    start: startDate,
                    end: endDate,
                    color: color,
                };
            }
        } else {
            // Add new task
            tasks.push({
                id: Date.now(),
                name: taskName,
                start: startDate,
                end: endDate,
                color: color,
                completed: false
            });
        }

        await saveTasks();
        // Trigger a full re-render of the UI from the updated state
        rerenderAll();
        closeModal();
    };

    const saveTasks = async () => {
        if (typeof Neutralino !== 'undefined' && Neutralino.filesystem?.writeFile) {
            // Neutralino mode: Save to file
            try {
                console.log(`Saving ${tasks.length} tasks to file...`);
                await Neutralino.filesystem.writeFile({
                    path: dataFilePath,
                    data: JSON.stringify(tasks, null, 2)
                });
            } catch (err) {
                console.error(`Error saving tasks to ${dataFilePath}:`, err);
                Neutralino.os.showMessageBox('Speicherfehler', `Konnte die Aufgaben nicht speichern: ${err.message}`, 'OK', 'ERROR');
            }
        } else {
            // Browser mode: Save to localStorage
            try {
                console.log(`Saving ${tasks.length} tasks to localStorage...`);
                localStorage.setItem('ai-gantt-tasks', JSON.stringify(tasks));
            } catch (e) {
                console.error('Error saving tasks to localStorage:', e);
                alert('Aufgaben konnten nicht im Browser gespeichert werden.');
            }
        }
    };

    const loadTasks = async () => {
        if (typeof Neutralino !== 'undefined' && Neutralino.filesystem?.readFile) {
            // Neutralino mode: Load from file
            try {
                const fileContent = await Neutralino.filesystem.readFile({ path: dataFilePath });
                const loadedTasks = JSON.parse(fileContent);
                if (Array.isArray(loadedTasks)) {
                    console.log(`Loaded ${loadedTasks.length} tasks from file.`);
                    tasks = loadedTasks;
                }
            } catch (err) {
                if (err.code === 'NE_FS_FILRDER') { // File not found, expected on first run
                    console.log(`${dataFilePath} not found, starting with sample data and creating file.`);
                    await saveTasks(); // Create the file with initial data
                } else {
                    console.error(`Error loading tasks from ${dataFilePath}:`, err);
                    Neutralino.os.showMessageBox('Ladefehler', `Konnte die Aufgaben nicht laden: ${err.message}`, 'OK', 'ERROR');
                }
            }
        } else {
            // Browser mode: Load from localStorage
            try {
                const storedTasks = localStorage.getItem('ai-gantt-tasks');
                if (storedTasks) {
                    const loadedTasks = JSON.parse(storedTasks);
                    if (Array.isArray(loadedTasks)) {
                        console.log(`Loaded ${loadedTasks.length} tasks from localStorage.`);
                        tasks = loadedTasks;
                    }
                } else {
                    // Nothing in storage, so we'll use the initial sample data.
                    console.log('Keine Aufgaben im localStorage gefunden. Verwende Beispieldaten. Deine Daten werden bei der ersten Änderung gespeichert.');
                }
            } catch (e) {
                console.error("Error loading tasks from localStorage:", e);
            }
        }

        rerenderAll(); // Render with loaded or initial tasks
    };

    // --- Event Listeners for Modal ---
    // Wrap in function to avoid passing the event object as the taskId
    openModalBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);
    cancelTaskBtn.addEventListener('click', closeModal);

    // Helper function to reset the 'Anpassen' button to its default state
    const resetZoomToFitButton = () => {
        const icon = zoomToFitBtn.querySelector('span.material-symbols-outlined');
        const text = zoomToFitBtn.querySelector('span:last-child');
        icon.textContent = 'zoom_out_map';
        text.textContent = 'Anpassen';
        zoomToFitBtn.title = 'Alle Aufgaben anzeigen';
    };

    zoomInBtn.addEventListener('click', () => {
        dayWidth += ZOOM_STEP;
        if (isZoomedToFit) {
            isZoomedToFit = false;
            resetZoomToFitButton();
        }
        rerenderAll();
    });

    zoomOutBtn.addEventListener('click', () => {
        dayWidth = Math.max(MIN_DAY_WIDTH, dayWidth - ZOOM_STEP);
        if (isZoomedToFit) {
            isZoomedToFit = false;
            resetZoomToFitButton();
        }
        rerenderAll();
    });

    zoomToFitBtn.addEventListener('click', () => {
        isZoomedToFit = !isZoomedToFit;
        const icon = zoomToFitBtn.querySelector('span.material-symbols-outlined');
        const text = zoomToFitBtn.querySelector('span:last-child');

        if (isZoomedToFit) {
            icon.textContent = 'fullscreen_exit';
            text.textContent = 'Scrollen';
            zoomToFitBtn.title = 'Zur scrollbaren Ansicht wechseln';
        } else {
            dayWidth = 50; // Reset to default zoom when exiting fit-to-view
            resetZoomToFitButton();
        }
        rerenderAll();
    });

    // Close modal when clicking on the background overlay
    addTaskModal.addEventListener('click', (event) => {
        if (event.target === addTaskModal) {
            closeModal();
        }
    });

    // Close modal with the "Escape" key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !addTaskModal.classList.contains('hidden')) {
            closeModal();
        }
    });

    const handleListClick = (event) => {
        const editButton = event.target.closest('.edit-btn');
        if (editButton) {
            event.preventDefault(); // Prevent label from triggering checkbox
            const taskId = Number(editButton.dataset.id);
            openModal(taskId);
        }

        const deleteButton = event.target.closest('.delete-btn');
        if (deleteButton) {
            event.preventDefault(); // Prevent label from triggering checkbox
            const taskId = Number(deleteButton.dataset.id);
            const taskToDelete = tasks.find(t => t.id === taskId);
            if (taskToDelete && confirm(`Sind Sie sicher, dass Sie die Aufgabe "${taskToDelete.name}" löschen möchten?`)) {
                deleteTask(taskId);
            }
        }
    };

    todoListContainer.addEventListener('click', handleListClick);
    ganttTaskList.addEventListener('click', handleListClick);

    addTaskForm.addEventListener('submit', handleSaveTask);

    const handleGenerateTasks = async () => {
        const prompt = aiPromptInput.value.trim();
        if (!prompt) {
            alert('Bitte geben Sie eine Beschreibung für die KI ein.');
            return;
        }

        // Visuelles Feedback für den Benutzer, während die KI arbeitet
        generateBtn.disabled = true;
        generateBtn.querySelector('span:last-child').textContent = 'Generiere...';

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: prompt }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP-Fehler: ${response.status}`);
            }

            const newTasks = await response.json();
            // Ersetze die bestehenden Aufgaben durch die von der KI generierten
            tasks = newTasks;
            await saveTasks();
            rerenderAll();

        } catch (error) {
            console.error('Fehler bei der KI-Generierung:', error);
            alert(`Ein Fehler ist aufgetreten: ${error.message}`);
        } finally {
            // Visuelles Feedback zurücksetzen, egal ob erfolgreich oder nicht
            generateBtn.disabled = false;
            generateBtn.querySelector('span:last-child').textContent = 'Generieren';
        }
    };

    generateBtn.addEventListener('click', handleGenerateTasks);

    // --- INITIALIZATION ---
    const initApp = async () => {
        // Check if running in Neutralino environment
        if (typeof Neutralino !== 'undefined') {
            Neutralino.init();
            try {
                // Get the recommended directory for app data, which is writable.
                const dataDir = await Neutralino.os.getPath('data');
                // Create the full, absolute path for our data file.
                dataFilePath = await Neutralino.filesystem.getJoinedPath(dataDir, 'data.json');
                console.log(`Data will be stored at: ${dataFilePath}`);
            } catch (err) {
                console.error("Could not determine data path:", err);
                Neutralino.os.showMessageBox('Kritischer Fehler', 'Der Speicherpfad für die Daten konnte nicht ermittelt werden. Die App kann keine Daten speichern.', 'OK', 'ERROR');
                rerenderAll(); // Render with sample data, but saving will fail.
                return;
            }
            Neutralino.events.on('windowClose', () => Neutralino.app.exit());
            await loadTasks(); // Load tasks (will use file system)
        } else {
            // Fallback for running in a regular browser for development
            console.log("Running in browser mode. Data will be saved to localStorage.");
            await loadTasks(); // Load tasks (will use localStorage)
        }
    };

    initApp();
});