const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const { parseCommand } = require('./commandParser');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function broadcast(payload) {
  const message = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(message);
  });
}

app.use('/api/items', require('./routes/items')(broadcast));

// POST /api/command  { text: "add note: buy milk" }
app.post('/api/command', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }

  const result = parseCommand(text);
  if (result.event) broadcast(result.event);
  res.json({ reply: result.reply });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ event: 'connected' }));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`NoticeBoard server running on http://localhost:${PORT}`);
});
