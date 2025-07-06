const express = require('express');
const cors = require('cors');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 5000;

// --- Database Setup ---
const db = new sqlite3.Database('./chat_sessions.db', (err) => {
  if (err) {
    return console.error('Error opening database', err.message);
  }
  console.log('Connected to the new SQLite database for sessions.');
  db.run('PRAGMA foreign_keys = ON;');

  db.run(`CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
  )`);
});

app.use(cors());
app.use(express.json());

// --- API Endpoints ---

// GET all conversations for the sidebar
app.get('/api/conversations', (req, res) => {
  db.all("SELECT id, title FROM conversations ORDER BY created_at DESC", [], (err, rows) => {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    res.json(rows);
  });
});

// GET all messages for a specific conversation
app.get('/api/conversations/:id', (req, res) => {
  const conversationId = req.params.id;
  db.all("SELECT sender, text, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC", [conversationId], (err, rows) => {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    res.json(rows);
  });
});

// DELETE a conversation and its messages
app.delete('/api/conversations/:id', (req, res) => {
  const conversationId = req.params.id;
  db.run("DELETE FROM conversations WHERE id = ?", [conversationId], function(err) {
    if (err) {
      res.status(500).json({ "error": err.message });
      return;
    }
    if (this.changes > 0) {
      res.json({ message: 'Conversation deleted successfully', id: conversationId });
    } else {
      res.status(404).json({ message: 'Conversation not found' });
    }
  });
});

// POST a new message to a conversation
app.post('/api/chat', async (req, res) => {
  let { message, conversationId } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // If it's a new chat, create a conversation first
    if (!conversationId) {
      const title = message.length > 40 ? message.substring(0, 37) + '...' : message;
      const result = await new Promise((resolve, reject) => {
        db.run(`INSERT INTO conversations (title) VALUES (?)`, [title], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });
      conversationId = result;
    }

    // 1. Save user's message
    db.run(`INSERT INTO messages (conversation_id, sender, text) VALUES (?, ?, ?)`, [conversationId, 'user', message]);

    // 2. Get AI response
    const systemPrompt = "You are a helpful and friendly conversational AI. Please provide direct, concise answers as if you were having a real conversation. Do not include any meta-commentary, thinking processes, summaries, or XML tags like `<think>`.";
    const llmResponse = await axios.post('http://localhost:1234/v1/chat/completions', {
      messages: [
        { "role": "system", "content": systemPrompt },
        { "role": "user", "content": message }
      ],
      temperature: 0.7,
    });
    const aiResponseText = llmResponse.data.choices[0].message.content.trim();

    // 3. Save AI's response
    db.run(`INSERT INTO messages (conversation_id, sender, text) VALUES (?, ?, ?)`, [conversationId, 'ai', aiResponseText]);

    // 4. Send response back to frontend
    res.json({ response: aiResponseText, conversationId: conversationId });

  } catch (error) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});