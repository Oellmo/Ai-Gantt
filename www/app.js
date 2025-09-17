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

    // --- Configuration ---
    const colorMap = {
        blue: 'bg-blue-500',
        green: 'bg-green-500',
        yellow: 'bg-yellow-500',
        red: 'bg-red-500',
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
        tasks.sort((a, b) => new Date(a.start) - new Date(b.start));

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

        // 2. Determine date range & helpers (more robust date parsing)
        const parseDate = (dateString) => {
            if (!dateString) return null;
            const date = new Date(dateString + 'T00:00:00');
            return isNaN(date.getTime()) ? null : date;
        };
        const diffDays = (date1, date2) => Math.round((date2 - date1) / (1000 * 60 * 60 * 24));

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
        const dayWidth = 50;
        const chartWidth = totalDays * dayWidth;

        // Set min-width for horizontal scrolling
        ganttTimelineHeader.style.minWidth = `${chartWidth}px`;
        ganttGridContainer.style.minWidth = `${chartWidth}px`;

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


        // Set grid columns for both header and grid container
        const gridTemplateColumns = `repeat(${totalDays}, minmax(0, 1fr))`;
        ganttTimelineHeader.style.gridTemplateColumns = gridTemplateColumns;
        ganttGridContainer.style.gridTemplateColumns = gridTemplateColumns;

        // Use CSS background for vertical grid lines instead of DOM elements
        ganttGridContainer.style.backgroundImage = `repeating-linear-gradient(to right, var(--surface-border-color) 0, var(--surface-border-color) 1px, transparent 1px, transparent 100%)`;
        ganttGridContainer.style.backgroundSize = `${100 / totalDays}% 100%`;

        // 3. Render timeline header and grid lines
        for (let i = 0; i < totalDays; i++) {
            const currentDate = new Date(projectStartDate);
            currentDate.setDate(projectStartDate.getDate() + i);
            const headerEl = document.createElement('div');
            headerEl.className = 'flex items-center justify-center text-xs text-[var(--text-secondary-color)]';
            const day = String(currentDate.getDate()).padStart(2, '0');
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            headerEl.textContent = `${day}.${month}`;
            ganttTimelineHeader.appendChild(headerEl);

        }

        // 4. Render each task
        tasks.forEach(task => {
            // To-Do item
            const todoItem = document.createElement('label');
            todoItem.className = 'flex items-center gap-x-3 py-2 border-b border-[var(--surface-border-color)] last:border-b-0 cursor-pointer';
            todoItem.innerHTML = `
                <input type="checkbox" data-id="${task.id}" class="checkbox-custom h-5 w-5 rounded border-[var(--surface-border-color)] border-2 bg-transparent text-[var(--primary-color)] checked:bg-[var(--primary-color)] checked:border-[var(--primary-color)] focus:ring-2 focus:ring-offset-0 focus:ring-offset-[var(--surface-color)] focus:ring-[var(--primary-color)]" ${task.completed ? 'checked' : ''}>
                <p class="flex-1 text-base ${task.completed ? 'line-through text-[var(--text-secondary-color)]' : 'text-[var(--text-primary-color)]'}">${task.name}</p>
                <button class="edit-btn text-[var(--text-secondary-color)] hover:text-[var(--text-primary-color)] transition-colors p-1 rounded-full hover:bg-[var(--surface-border-color)]" data-id="${task.id}">
                    <span class="material-symbols-outlined text-lg">edit</span>
                </button>
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
                <button class="edit-btn text-[var(--text-secondary-color)] hover:text-[var(--text-primary-color)] transition-colors p-1 rounded-full hover:bg-[var(--surface-border-color)]" data-id="${task.id}">
                    <span class="material-symbols-outlined text-lg">edit</span>
                </button>
            `;
            ganttTaskList.appendChild(ganttTaskItem);

            // Gantt chart bar
            const taskStart = parseDate(task.start); // Use the robust parseDate
            const taskEnd = parseDate(task.end);     // Use the robust parseDate

            if (!taskStart || !taskEnd || taskStart > taskEnd) {
                console.warn(`Aufgabe "${task.name}" hat ungültige Start/Enddaten und wird im Gantt-Diagramm übersprungen.`);
                return; // Skip rendering this bar if dates are invalid
            }

            const startOffsetDays = diffDays(projectStartDate, taskStart);
            const durationDays = diffDays(taskStart, taskEnd) + 1;

            const barRowContainer = document.createElement('div');
            barRowContainer.className = 'h-12 flex items-center relative px-1';

            if (durationDays > 0 && startOffsetDays >= 0) {
                const barInner = document.createElement('div');
                barInner.className = `absolute h-8 top-1/2 -translate-y-1/2 rounded-md flex items-center px-2 text-white text-xs font-medium overflow-hidden ${colorMap[task.color] || 'bg-gray-500'}`;
                barInner.textContent = task.name;
                barInner.style.left = `${(startOffsetDays / totalDays) * 100}%`;
                barInner.style.width = `${(durationDays / totalDays) * 100}%`;
                barRowContainer.appendChild(barInner);
            }
            ganttChartBars.appendChild(barRowContainer);
        });
    };

    // --- Event Handlers ---
    const toggleTaskCompletion = (taskId, isCompleted) => {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = isCompleted;
            rerenderAll();
        }
    };

    const handleSaveTask = (event) => {
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

        // Trigger a full re-render of the UI from the updated state
        rerenderAll();
        closeModal();
    };

    // --- Event Listeners for Modal ---
    // Wrap in function to avoid passing the event object as the taskId
    openModalBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);
    cancelTaskBtn.addEventListener('click', closeModal);

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
    };

    todoListContainer.addEventListener('click', handleListClick);
    ganttTaskList.addEventListener('click', handleListClick);

    addTaskForm.addEventListener('submit', handleSaveTask);

    // Initial render on page load
    rerenderAll();
});