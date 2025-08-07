const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Basic health endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Inizializza il client Prisma per l'accesso al database
const prisma = new PrismaClient();

// Rotta per creare un nuovo personaggio. Accetta un JSON con i campi
// playerId, name, description, stats e languages_known (stringa separata da virgole o array).
app.post('/characters', async (req, res) => {
  const { playerId, name, description, stats, languages_known, traits, progress } = req.body;
  if (!playerId || !name) {
    return res.status(400).json({ error: 'playerId e name sono obbligatori' });
  }
  try {
    const character = await prisma.character.create({
      data: {
        playerId: Number(playerId),
        name,
        description: description || null,
        stats: stats ? JSON.stringify(stats) : null,
        languages_known: Array.isArray(languages_known) ? languages_known.join(',') : languages_known || null,
        traits: traits || null,
        progress: progress || null,
      },
    });
    res.status(201).json(character);
  } catch (error) {
    console.error('Errore durante la creazione del personaggio:', error);
    res.status(500).json({ error: 'Errore interno durante la creazione del personaggio' });
  }
});

// Rotta per recuperare tutti i personaggi o filtrare per playerId
app.get('/characters', async (req, res) => {
  const { playerId } = req.query;
  try {
    const characters = await prisma.character.findMany({
      where: playerId ? { playerId: Number(playerId) } : {},
    });
    res.json(characters);
  } catch (error) {
    console.error('Errore durante il recupero dei personaggi:', error);
    res.status(500).json({ error: 'Errore interno durante il recupero dei personaggi' });
  }
});

// Rotta per recuperare un personaggio specifico
app.get('/characters/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const character = await prisma.character.findUnique({
      where: { id: Number(id) },
    });
    if (!character) {
      return res.status(404).json({ error: 'Personaggio non trovato' });
    }
    res.json(character);
  } catch (error) {
    console.error('Errore durante il recupero del personaggio:', error);
    res.status(500).json({ error: 'Errore interno durante il recupero del personaggio' });
  }
});

// Create HTTP server and attach Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Socket.io event handlers
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });

  // Gestisce i messaggi inviati dal giocatore. Quando un messaggio arriva,
  // invia una richiesta HTTP al microservizio LLM e inoltra la risposta
  // al client. Utilizza async/await per una gestione più chiara degli errori.
  socket.on('playerMessage', async (data) => {
    console.log('Received player message:', data);
    const message = data && data.text ? String(data.text).trim() : '';
    const playerId = data && data.playerId ? Number(data.playerId) : null;
    if (!message) {
      socket.emit('gmMessage', { text: 'Messaggio vuoto, riprova a digitare qualcosa.' });
      return;
    }
    const llmServiceUrl = process.env.LLM_SERVICE_URL || 'http://localhost:8000/chat';
    try {
      const response = await axios.post(llmServiceUrl, { text: message });
      const gmReply = response.data && response.data.response
        ? response.data.response
        : 'Il Game Master non ha fornito risposta.';
      // Invia la risposta al client
      socket.emit('gmMessage', { text: gmReply });
      // Registra l'evento nel database. Non è bloccante per l'utente.
      try {
        await prisma.event.create({
          data: {
            description: `Player: ${message} | GM: ${gmReply}`,
            type: 'chat',
            actors: playerId ? String(playerId) : null,
            characterId: playerId || null,
            // locationId resta null in questo esempio; può essere valorizzato
            locationId: null,
            consequences: null,
          },
        });
      } catch (dbErr) {
        console.error('Errore durante il salvataggio dell\'evento:', dbErr);
      }
    } catch (error) {
      console.error('Error calling LLM service:', error.message || error);
      socket.emit('gmMessage', { text: 'Errore nel servizio LLM. Riprova più tardi.' });
    }
  });
});

// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});