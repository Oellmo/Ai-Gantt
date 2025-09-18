// server.js
const express = require('express');
const path = require('path');
const { OpenAI } = require('openai');

// Lädt Umgebungsvariablen aus der .env-Datei im Hauptverzeichnis
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Überprüfen, ob der API-Schlüssel vorhanden ist
if (!process.env.OPENAI_API_KEY) {
    console.error("FATAL ERROR: OPENAI_API_KEY ist nicht in der .env-Datei gesetzt.");
    process.exit(1); // Beendet den Prozess, wenn der Schlüssel fehlt
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Middleware, um JSON-Anfragen zu verarbeiten und statische Dateien auszuliefern
app.use(express.json());
app.use(express.static(path.join(__dirname, 'www')));

// API-Endpunkt, den das Frontend aufrufen wird
app.post('/api/generate', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            return res.status(400).json({ error: 'Ein Prompt wird benötigt.' });
        }

        const systemPrompt = `Du bist ein Projektmanagement-Assistent. Basierend auf der Eingabe des Benutzers, generiere eine Liste von Aufgaben für einen Projektplan.
        Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt, das einen Schlüssel "tasks" enthält, der ein Array von Aufgabenobjekten beinhaltet. Füge keinen anderen Text, Markdown oder Erklärungen hinzu.
        Jedes Aufgabenobjekt muss folgende Struktur haben: { "id": number, "name": string, "start": string (YYYY-MM-DD), "end": string (YYYY-MM-DD), "color": string (blue, green, yellow, or red), "completed": boolean }
        Die erste Aufgabe sollte die ID 1 haben. Die Daten sollten relativ zum heutigen Datum sein, wenn kein Zeitrahmen angegeben ist. Das Projekt sollte heute beginnen.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(completion.choices[0].message.content);
        // Sende nur das Array der Aufgaben zurück
        res.json(result.tasks || []);

    } catch (error) {
        console.error('Fehler bei der OpenAI-Anfrage:', error);
        res.status(500).json({ error: 'Aufgaben konnten nicht generiert werden.', details: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server läuft und ist erreichbar unter http://localhost:${port}`);
});