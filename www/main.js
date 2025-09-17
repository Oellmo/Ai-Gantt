// resources/js/main.js

// Globale Variablen für den Zustand der App
let tasks = [];
let projectStartDate = dayjs();
let projectEndDate = dayjs();

// Initialisiere DayJS für die Datumsberechnung (Wochen, deutsche Sprache)
dayjs.extend(window.dayjs_plugin_isoWeek);
dayjs.extend(window.dayjs_plugin_localeData);
dayjs.locale('de');

// --- RENDER-FUNKTIONEN ---

/** Haupt-Render-Funktion, die alle Teile der UI neu zeichnet */
function render() {
    if (tasks.length === 0) {
        // Leere die UI, wenn keine Aufgaben vorhanden sind
        document.getElementById('gantt-task-list').innerHTML = '';
        document.getElementById('gantt-header').innerHTML = '';
        document.getElementById('gantt-grid-lines').innerHTML = '';
        document.getElementById('gantt-bars-container').innerHTML = '';
        document.getElementById('todo-list').innerHTML = '';
        return;
    };

    // Finde das Start- und Enddatum des gesamten Projekts
    const allDates = tasks.flatMap(t => [dayjs(t.start), dayjs(t.end)]);
    projectStartDate = dayjs(Math.min.apply(null, allDates));
    projectEndDate = dayjs(Math.max.apply(null, allDates));

    renderGanttChart();
    renderTodoList();
}

/** Zeichnet das Gantt-Diagramm basierend auf den globalen `tasks` */
function renderGanttChart() {
    const taskListEl = document.getElementById('gantt-task-list');
    const headerEl = document.getElementById('gantt-header');
    const gridLinesEl = document.getElementById('gantt-grid-lines');
    const barsEl = document.getElementById('gantt-bars-container');
    const gridEl = document.getElementById('gantt-grid');

    // Leere vorherigen Inhalt
    [taskListEl, headerEl, gridLinesEl, barsEl].forEach(el => el.innerHTML = '');

    // 1. Aufgabenliste links rendern
    tasks.forEach(task => {
        const taskNameEl = document.createElement('div');
        taskNameEl.className = 'h-10 flex items-center px-4 rounded-md hover:bg-opacity-50 hover:bg-[var(--surface-border-color)] transition-colors text-sm text-[var(--text-primary-color)]';
        taskNameEl.textContent = task.name;
        taskListEl.appendChild(taskNameEl);
    });

    // 2. Zeitstrahl-Grenzen berechnen (in Wochen)
    const firstWeek = projectStartDate.startOf('isoWeek');
    const lastWeek = projectEndDate.endOf('isoWeek');
    const totalWeeks = lastWeek.diff(firstWeek, 'week') + 1;

    // 3. Breiten und Grid-Layouts festlegen
    const minWidth = totalWeeks * 100; // 100px pro Woche
    headerEl.style.minWidth = `${minWidth}px`;
    gridEl.style.minWidth = `${minWidth}px`;
    headerEl.style.gridTemplateColumns = `repeat(${totalWeeks}, minmax(0, 1fr))`;
    gridLinesEl.style.gridTemplateColumns = `repeat(${totalWeeks}, minmax(0, 1fr))`;

    // Höhe des Grids an die Anzahl der Aufgaben anpassen
    const gridHeight = tasks.length * (40 + 8); // h-10 (40px) + space-y-2 (8px)
    gridEl.style.height = `${gridHeight}px`;

    // 4. Kopfzeile (Wochen) und Gitterlinien rendern
    let currentWeek = firstWeek;
    for (let i = 0; i < totalWeeks; i++) {
        const weekEl = document.createElement('div');
        weekEl.className = 'flex items-center justify-center p-2 text-xs font-semibold text-[var(--text-secondary-color)] whitespace-nowrap';
        weekEl.textContent = `${currentWeek.format("MMM 'YY")} - KW${currentWeek.isoWeek()}`;
        headerEl.appendChild(weekEl);

        const lineEl = document.createElement('div');
        if (i < totalWeeks -1) { // Die letzte Linie nicht zeichnen
            lineEl.className = 'border-r border-[var(--surface-border-color)]';
        }
        gridLinesEl.appendChild(lineEl);

        currentWeek = currentWeek.add(1, 'week');
    }

    // 5. Aufgaben-Balken rendern
    const totalDaysInScope = lastWeek.diff(firstWeek, 'day');
    tasks.forEach(task => {
        const taskStart = dayjs(task.start);
        const taskEnd = dayjs(task.end);

        const startOffset = taskStart.diff(firstWeek, 'day');
        const duration = taskEnd.diff(taskStart, 'day') + 1;

        const left = (startOffset / totalDaysInScope) * 100;
        const width = (duration / totalDaysInScope) * 100;

        const barWrapper = document.createElement('div');
        barWrapper.className = 'h-10 flex items-center relative';

        const barEl = document.createElement('div');
        barEl.className = 'absolute h-6 bg-[var(--primary-color)] rounded-md cursor-grab active:cursor-grabbing flex items-center px-2 text-white text-xs overflow-hidden';
        barEl.style.left = `${left}%`;
        barEl.style.width = `${width}%`;
        barEl.title = task.name; // Tooltip mit vollem Namen

        barWrapper.appendChild(barEl);
        barsEl.appendChild(barWrapper);
    });
}

/** Zeichnet die To-Do-Liste basierend auf den globalen `tasks` */
function renderTodoList() {
    const todoListContainer = document.getElementById('todo-list');
    todoListContainer.innerHTML = '';

    tasks.forEach((task, index) => {
        const label = document.createElement('label');
        label.className = 'flex items-center gap-x-3 py-2 border-b border-[var(--surface-border-color)] last:border-b-0 cursor-pointer';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.className = 'checkbox-custom h-5 w-5 rounded border-[var(--surface-border-color)] border-2 bg-transparent text-[var(--primary-color)] checked:bg-[var(--primary-color)] checked:border-[var(--primary-color)] focus:ring-2 focus:ring-offset-0 focus:ring-offset-[var(--surface-color)] focus:ring-[var(--primary-color)]';
        checkbox.onchange = () => {
            tasks[index].completed = checkbox.checked;
            render(); // Neu rendern, um den Stil (z.B. durchgestrichen) zu aktualisieren
        };

        const p = document.createElement('p');
        p.className = `text-base ${task.completed ? 'line-through text-[var(--text-secondary-color)]' : 'text-[var(--text-primary-color)]'}`;
        p.textContent = task.name;

        label.appendChild(checkbox);
        label.appendChild(p);
        todoListContainer.appendChild(label);
    });
}


// --- EVENT-HANDLER ---

/** Wird aufgerufen, wenn der "Generieren"-Button geklickt wird */
function handleGenerateClick() {
    const promptInput = document.getElementById('ai-prompt-input');
    const prompt = promptInput.value;
    if (!prompt) {
        Neutralino.os.showMessageBox('Fehler', 'Bitte beschreibe zuerst dein Projekt.');
        return;
    }

    // Ladezustand anzeigen
    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = true;
    generateBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Generiere...</span>`;

    // Sende den Prompt an die Backend-Erweiterung
    Neutralino.extensions.dispatch('js.neutralino.planify.generator', 'generateTasks', { prompt });
}

/** Fügt eine neue, leere Aufgabe hinzu */
function handleAddTask() {
    const newTaskName = prompt("Geben Sie den Namen der neuen Aufgabe ein:");
    if (newTaskName && newTaskName.trim() !== '') {
        const newId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
        const today = dayjs().format('YYYY-MM-DD');
        
        tasks.push({
            id: newId,
            name: newTaskName,
            start: today,
            end: today,
            dependencies: [],
            completed: false
        });
        // Nach Startdatum sortieren und neu rendern
        tasks.sort((a, b) => dayjs(a.start).diff(dayjs(b.start)));
        render();
    }
}

/** Verarbeitet Nachrichten, die von der Backend-Erweiterung kommen */
function onExtensionMessage(evt) {
    // Button wiederherstellen
    const generateBtn = document.getElementById('generate-btn');
    generateBtn.disabled = false;
    generateBtn.innerHTML = `
        <span class="material-symbols-outlined">auto_awesome</span>
        <span>Generieren</span>`;

    switch (evt.detail.event) {
        case 'tasksGenerated':
            tasks = evt.detail.data;
            // Aufgaben nach Startdatum sortieren
            tasks.sort((a, b) => dayjs(a.start).diff(dayjs(b.start)));
            render();
            break;
        case 'generationError':
            Neutralino.os.showMessageBox('Fehler bei der Generierung', `Fehler: ${evt.detail.data.message}`);
            break;
    }
}

/** Hauptfunktion der Anwendung */
function main() {
    Neutralino.init();
    Neutralino.events.on('windowClose', () => Neutralino.app.exit());
    Neutralino.events.on('extensionMessage', onExtensionMessage);

    document.getElementById('generate-btn').addEventListener('click', handleGenerateClick);
    document.getElementById('add-task-btn').addEventListener('click', handleAddTask);
    
    // Initiales Rendern (falls du mit Beispieldaten starten willst)
    render();
}

main();
