// extensions/generator.js
const { OpenAI } = require('openai');
// Lädt die Umgebungsvariablen aus der .env-Datei im selben Verzeichnis
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Diese Funktion liest Daten, die von der Neutralino-App gesendet werden
process.stdin.on('data', async (data) => {
    const event = JSON.parse(data.toString());

    if (event.event === 'generateTasks') {
        try {
            const prompt = event.data.prompt;
            const systemPrompt = `Du bist ein Projektmanagement-Assistent. Basierend auf der Eingabe des Benutzers, generiere eine Liste von Aufgaben für einen Projektplan.
            Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt, das einen Schlüssel "tasks" enthält, der ein Array von Aufgabenobjekten beinhaltet. Füge keinen anderen Text, Markdown oder Erklärungen hinzu.
            Jedes Aufgabenobjekt muss folgende Struktur haben: { "id": number, "name": string, "start": string (YYYY-MM-DD), "end": string (YYYY-MM-DD), "dependencies": number[] (Array von Task-IDs, von denen es abhängt), "completed": boolean }
            Die erste Aufgabe sollte die ID 1 haben. Die Daten sollten relativ zum heutigen Datum sein, wenn kein Zeitrahmen angegeben ist. Das Projekt sollte heute beginnen.
            Beispiel-Antwort:
            {
              "tasks": [
                { "id": 1, "name": "Task 1", "start": "2024-03-01", "end": "2024-03-05", "dependencies": [], "completed": false },
                { "id": 2, "name": "Task 2", "start": "2024-03-06", "end": "2024-03-10", "dependencies": [1], "completed": false }
              ]
            }`;

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini', // Oder ein anderes passendes Modell
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt },
                ],
                response_format: { type: "json_object" },
            });

            const result = JSON.parse(completion.choices[0].message.content);

            // Sende die generierten Aufgaben zurück an die Neutralino-App
            process.stdout.write(JSON.stringify({
                event: 'tasksGenerated',
                data: result.tasks
            }) + '\n');

        } catch (error) {
            // Sende einen Fehler zurück an die App
            process.stdout.write(JSON.stringify({
                event: 'generationError',
                data: { message: error.message }
            }) + '\n');
        }
    }
});
