document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    // Initial sample tasks. This array will hold all our tasks.
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
    ];

    // --- DOM ELEMENTS ---
    const openModalBtn = document.getElementById('open-modal-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelTaskBtn = document.getElementById('cancel-task-btn');
    const addTaskModal = document.getElementById('add-task-modal');
    const addTaskForm = document.getElementById('add-task-form');
    const taskNameInput = document.getElementById('task-name-input');
    const startDateInput = document.getElementById('start-date-input');
    const endDateInput = document.getElementById('end-date-input');
    const taskColorSelect = document.getElementById('task-color-select');

    const todoListContainer = document.getElementById('todo-list-container');
    const ganttTaskList = document.getElementById('gantt-task-list');
    const ganttTimelineHeader = document.getElementById('gantt-timeline-header');
    const ganttGridContainer = document.getElementById('gantt-grid-container');

    // --- MODAL ---
    const showModal = () => {
        addTaskModal.classList.remove('hidden');
        addTaskModal.classList.add('flex');
    };

    const hideModal = () => {
        addTaskModal.classList.add('hidden');
        addTaskModal.classList.remove('flex');
        addTaskForm.reset();
    };

    openModalBtn.addEventListener('click', showModal);
    closeModalBtn.addEventListener('click', hideModal);
    cancelTaskBtn.addEventListener('click', hideModal);
    addTaskModal.addEventListener('click', (e) => {
        // Close modal if backdrop is clicked
        if (e.target === addTaskModal) {
            hideModal();
        }
    });

    // --- DATE HELPERS ---
    const dayInMillis = 1000 * 60 * 60 * 24;
    // Parse date string as UTC to avoid timezone issues
    const parseDate = (dateString) => new Date(dateString + 'T00:00:00');
    const diffDays = (date1, date2) => Math.round((date2 - date1) / dayInMillis);

    // --- RENDERING ---
    const render = () => {
        // Sort tasks by start date before rendering
        tasks.sort((a, b) => parseDate(a.start) - parseDate(b.start));
        renderTodoList();
        renderGanttChart();
    };

    const renderTodoList = () => {
        todoListContainer.innerHTML = '';
        if (tasks.length === 0) {
            todoListContainer.innerHTML = `<p class="text-[var(--text-secondary-color)]">Noch keine Aufgaben. Fügen Sie eine hinzu!</p>`;
            return;
        }

        tasks.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.className = 'flex items-center gap-4 p-2 rounded-md transition-colors hover:bg-[var(--surface-border-color)]/50';
            taskEl.innerHTML = `
                <input type="checkbox" id="todo-${task.id}" ${task.completed ? 'checked' : ''} class="form-checkbox checkbox-custom h-5 w-5 rounded bg-transparent border-[var(--surface-border-color)] text-[var(--primary-color)] focus:ring-2 focus:ring-offset-0 focus:ring-offset-[var(--surface-color)] focus:ring-[var(--primary-color)] cursor-pointer">
                <label for="todo-${task.id}" class="flex-1 cursor-pointer ${task.completed ? 'line-through text-[var(--text-secondary-color)]' : ''}">${task.name}</label>
            `;
            taskEl.querySelector('input').addEventListener('change', (e) => {
                toggleTaskCompletion(task.id, e.target.checked);
            });
            todoListContainer.appendChild(taskEl);
        });
    };

    const renderGanttChart = () => {
        // Clear containers
        ganttTaskList.innerHTML = '';
        ganttTimelineHeader.innerHTML = '';
        ganttGridContainer.innerHTML = ''; // This also removes the old bars container

        // Re-add the bars container which is absolutely positioned
        const ganttChartBars = document.createElement('div');
        ganttChartBars.id = 'gantt-chart-bars';
        ganttChartBars.className = 'absolute inset-0 space-y-2 mt-2';
        ganttGridContainer.appendChild(ganttChartBars);

        if (tasks.length === 0) {
            ganttTimelineHeader.style.minWidth = '1000px';
            ganttGridContainer.style.minWidth = '1000px';
            ganttGridContainer.style.gridTemplateColumns = '';
            return;
        }

        // Calculate project date range
        const dates = tasks.flatMap(t => [parseDate(t.start), parseDate(t.end)]);
        const projectStartDate = new Date(Math.min(...dates));
        const projectEndDate = new Date(Math.max(...dates));
        const totalDays = diffDays(projectStartDate, projectEndDate) + 1;
        const dayWidth = 50; // width of a day column in pixels
        const chartWidth = totalDays * dayWidth;

        // Set min-width for horizontal scrolling
        ganttTimelineHeader.style.minWidth = `${chartWidth}px`;
        ganttGridContainer.style.minWidth = `${chartWidth}px`;

        // Set grid columns for both header and grid container
        const gridTemplateColumns = `repeat(${totalDays}, minmax(0, 1fr))`;
        ganttTimelineHeader.style.gridTemplateColumns = gridTemplateColumns;
        ganttGridContainer.style.gridTemplateColumns = gridTemplateColumns;

        // --- Render Header ---
        for (let i = 0; i < totalDays; i++) {
            const currentDate = new Date(projectStartDate);
            currentDate.setDate(projectStartDate.getDate() + i);
            const headerCell = document.createElement('div');
            headerCell.className = 'flex items-center justify-center text-xs text-[var(--text-secondary-color)]';
            const day = String(currentDate.getDate()).padStart(2, '0');
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            headerCell.textContent = `${day}.${month}`;
            ganttTimelineHeader.appendChild(headerCell);
        }

        // --- Render Grid Lines ---
        // We add empty divs that will get vertical borders from the `divide-x` utility class on the parent
        for (let i = 0; i < totalDays; i++) {
            const gridCol = document.createElement('div');
            ganttGridContainer.insertBefore(gridCol, ganttChartBars);
        }

        // --- Render Task List & Bars ---
        const colorClasses = {
            blue: 'bg-blue-500',
            green: 'bg-green-500',
            yellow: 'bg-yellow-500',
            red: 'bg-red-500',
        };

        tasks.forEach(task => {
            // Task Label (left side)
            const taskLabel = document.createElement('div');
            taskLabel.className = 'h-12 flex items-center px-4 text-sm truncate';
            taskLabel.textContent = task.name;
            ganttTaskList.appendChild(taskLabel);

            // Task Bar (right side)
            const taskStart = parseDate(task.start);
            const taskEnd = parseDate(task.end);
            const startOffsetDays = diffDays(projectStartDate, taskStart);
            const durationDays = diffDays(taskStart, taskEnd) + 1;

            // This container ensures vertical alignment with the task label via `space-y-2`
            const barRowContainer = document.createElement('div');
            barRowContainer.className = 'h-12 flex items-center relative px-1';
            
            const barInner = document.createElement('div');
            barInner.className = `absolute h-8 top-1/2 -translate-y-1/2 rounded-md flex items-center px-2 text-white text-xs font-medium overflow-hidden ${colorClasses[task.color] || 'bg-gray-500'}`;
            barInner.textContent = task.name;
            barInner.style.left = `${(startOffsetDays / totalDays) * 100}%`;
            barInner.style.width = `${(durationDays / totalDays) * 100}%`;
            
            barRowContainer.appendChild(barInner);
            ganttChartBars.appendChild(barRowContainer);
        });
    };

    // --- TASK MANAGEMENT ---
    const addTask = (e) => {
        e.preventDefault();
        const name = taskNameInput.value.trim();
        const start = startDateInput.value;
        const end = endDateInput.value;
        const color = taskColorSelect.value;

        if (!name || !start || !end) {
            alert('Bitte füllen Sie alle Felder aus.');
            return;
        }

        if (parseDate(start) > parseDate(end)) {
            alert('Das Enddatum darf nicht vor dem Startdatum liegen.');
            return;
        }

        const newTask = {
            id: Date.now(),
            name,
            start,
            end,
            color,
            completed: false,
        };

        tasks.push(newTask);
        hideModal();
        render();
    };

    const toggleTaskCompletion = (taskId, isCompleted) => {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = isCompleted;
            // Only re-render the todo list, as the gantt chart is not affected by completion
            renderTodoList();
        }
    };

    // --- INITIALIZATION ---
    addTaskForm.addEventListener('submit', addTask);
    render(); // Initial render of sample tasks
});