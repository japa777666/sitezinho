require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Caminhos dos arquivos (agora todos na raiz)
const usersPath = path.join(__dirname, 'users.json');
const groupsPath = path.join(__dirname, 'groups.json');
const messagesPath = path.join(__dirname, 'messages.json');

// Funções de leitura e escrita
const readFile = (filePath) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
};

const writeFile = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

// Middlewares
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());
app.use(express.static(__dirname));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readFile(usersPath);
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

  const redirectTo = user.isAdmin ? 'painel.html' : 'chat.html';
  res.json({ id: user.id, username: user.username, isAdmin: user.isAdmin, redirectTo });
});

// Usuários
app.get('/api/users', (req, res) => res.json(readFile(usersPath)));

app.post('/api/users', (req, res) => {
  const { username, password, isAdmin } = req.body;
  const users = readFile(usersPath);

  if (users.some(u => u.username === username)) {
    return res.status(409).json({ error: 'Usuário já existe' });
  }

  const newUser = {
    id: users.length + 1,
    username,
    password,
    isAdmin: !!isAdmin
  };

  users.push(newUser);
  writeFile(usersPath, users);
  res.json(newUser);
});

app.delete('/api/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  let users = readFile(usersPath);
  users = users.filter(u => u.id !== id);
  writeFile(usersPath, users);
  res.json({ success: true });
});

// Grupos
app.get('/api/groups', (req, res) => res.json(readFile(groupsPath)));

app.get('/api/groups/:username', (req, res) => {
  const username = req.params.username;
  const groups = readFile(groupsPath);
  const visibleGroups = groups.filter(g =>
    g.id === 1 || (g.members && g.members.includes(username))
  );
  res.json(visibleGroups);
});

app.post('/api/pm', (req, res) => {
  const { user1, user2 } = req.body;
  const groups = readFile(groupsPath);

  const existing = groups.find(g =>
    g.name.startsWith("PM:") &&
    g.members &&
    ((g.members.includes(user1) && g.members.includes(user2)) ||
     (g.name.includes(user1) && g.name.includes(user2)))
  );

  if (existing) return res.status(409).json({ error: "PM já existe", group: existing });

  const newGroup = {
    id: groups.length + 1,
    name: `PM: ${user1} ⇄ ${user2}`,
    members: [user1, user2]
  };

  groups.push(newGroup);
  writeFile(groupsPath, groups);
  res.json(newGroup);
});

// Mensagens
app.get('/api/messages/:groupId', (req, res) => {
  const messages = readFile(messagesPath);
  const groupMessages = messages.filter(msg => msg.groupId === parseInt(req.params.groupId));
  res.json(groupMessages);
});

app.delete('/api/messages/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const messages = readFile(messagesPath);
  const updated = messages.filter(m => m.id !== id);
  writeFile(messagesPath, updated);
  io.emit('deleteMessage', { id });
  res.json({ success: true });
});

// WebSocket
io.on('connection', (socket) => {
  console.log('🟢 Usuário conectado');

  socket.on('sendMessage', (msg) => {
    const messages = readFile(messagesPath);
    const newMessage = {
      id: messages.length + 1,
      groupId: msg.groupId,
      nickname: msg.nickname,
      content: msg.content,
      timestamp: new Date().toISOString()
    };
    messages.push(newMessage);
    writeFile(messagesPath, messages);
    io.emit('newMessage', newMessage);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Usuário desconectado');
  });
});

// Inicia o servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
