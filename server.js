import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import {
  makeWASocket, DisconnectReason, useMultiFileAuthState,
  fetchLatestBaileysVersion, makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Storage ──────────────────────────────────────────────────────────────────
if (!existsSync('./data')) mkdirSync('./data', { recursive: true });
if (!existsSync('./auth')) mkdirSync('./auth', { recursive: true });

const DATA_FILE = './data/data.json';

const loadData = () => {
  try {
    if (existsSync(DATA_FILE)) return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  } catch {}
  return {
    conversations: {},
    settings: {
      botEnabled: false,
      botName: 'Assistente',
      botMessage: 'Olá! Como posso ajudar você hoje?',
    },
  };
};

const saveData = (d) => {
  try { writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); } catch {}
};

let appData = loadData();
let sock = null;
let connectionStatus = 'disconnected';
let lastQR = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getPhone = (jid = '') => jid.replace('@s.whatsapp.net', '').replace('@g.us', '');

const extractText = (msg = {}) =>
  msg.conversation ||
  msg.extendedTextMessage?.text ||
  msg.imageMessage?.caption ||
  msg.videoMessage?.caption ||
  (msg.audioMessage ? '[Áudio 🎵]' : '') ||
  (msg.documentMessage ? `[Documento 📄] ${msg.documentMessage.fileName || ''}`.trim() : '') ||
  (msg.stickerMessage ? '[Sticker]' : '') ||
  (msg.locationMessage ? '[Localização 📍]' : '') ||
  '[Mensagem]';

const upsertConv = (jid, patch = {}) => {
  if (!appData.conversations[jid]) {
    appData.conversations[jid] = {
      jid, phone: getPhone(jid), name: getPhone(jid),
      isGroup: jid.endsWith('@g.us'),
      messages: [], unread: 0, lastMessage: '', lastTimestamp: 0,
    };
  }
  Object.assign(appData.conversations[jid], patch);
  return appData.conversations[jid];
};

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();
  const logger = pino({ level: 'silent' });

  sock = makeWASocket({
    version,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    logger,
    printQRInTerminal: false,
    browser: ['WhatsApp CRM', 'Chrome', '10.0'],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      try {
        const dataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
        lastQR = dataUrl;
        connectionStatus = 'qr';
        io.emit('status', 'qr');
        io.emit('qr', dataUrl);
      } catch {}
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      connectionStatus = 'disconnected';
      io.emit('status', 'disconnected');
      io.emit('qr', null);
      if (!loggedOut) {
        console.log('Reconnecting in 3s...');
        setTimeout(connectWhatsApp, 3000);
      }
    }

    if (connection === 'open') {
      lastQR = null;
      connectionStatus = 'connected';
      io.emit('status', 'connected');
      io.emit('qr', null);
      console.log('WhatsApp connected!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.remoteJid === 'status@broadcast') continue;

      const jid = msg.key.remoteJid;
      const fromMe = !!msg.key.fromMe;
      const msgId = msg.key.id;
      const timestamp = Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000);
      const text = extractText(msg.message);
      const pushName = msg.pushName;

      const conv = upsertConv(jid);
      if (pushName && !conv.isGroup && pushName !== getPhone(jid)) conv.name = pushName;
      if (conv.messages.find(m => m.id === msgId)) continue;

      const message = { id: msgId, text, fromMe, timestamp, status: 'received' };
      conv.messages.push(message);
      conv.lastMessage = text;
      conv.lastTimestamp = timestamp;
      if (!fromMe) conv.unread = (conv.unread || 0) + 1;

      saveData(appData);
      io.emit('message', { jid, message });
      io.emit('conversation_update', { ...conv });

      // Auto-reply
      if (!fromMe && appData.settings.botEnabled && !conv.isGroup) {
        const reply = appData.settings.botMessage || 'Olá!';
        setTimeout(async () => {
          try {
            await sock.sendMessage(jid, { text: reply });
            const autoId = `auto_${Date.now()}`;
            const autoMsg = { id: autoId, text: reply, fromMe: true, timestamp: Math.floor(Date.now() / 1000), status: 'sent' };
            conv.messages.push(autoMsg);
            conv.lastMessage = reply;
            conv.lastTimestamp = autoMsg.timestamp;
            saveData(appData);
            io.emit('message', { jid, message: autoMsg });
            io.emit('conversation_update', { ...conv });
          } catch (e) { console.error('Auto-reply error:', e.message); }
        }, 1200);
      }
    }
  });

  sock.ev.on('messages.update', (updates) => {
    for (const { key, update } of updates) {
      const conv = appData.conversations[key.remoteJid];
      if (!conv) continue;
      const msg = conv.messages.find(m => m.id === key.id);
      if (msg && update.status) {
        msg.status = update.status;
        io.emit('message_status', { jid: key.remoteJid, id: key.id, status: update.status });
      }
    }
    saveData(appData);
  });
}

// ─── REST API ─────────────────────────────────────────────────────────────────
app.get('/api/status', (_, res) => res.json({ status: connectionStatus }));

app.get('/api/conversations', (_, res) =>
  res.json(Object.values(appData.conversations).sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0)))
);

app.get('/api/conversations/:jid/messages', (req, res) => {
  const conv = appData.conversations[decodeURIComponent(req.params.jid)];
  res.json(conv?.messages || []);
});

app.post('/api/conversations/:jid/read', (req, res) => {
  const conv = appData.conversations[decodeURIComponent(req.params.jid)];
  if (conv) { conv.unread = 0; saveData(appData); }
  res.json({ ok: true });
});

app.post('/api/send', async (req, res) => {
  const { jid, text } = req.body;
  if (!sock || connectionStatus !== 'connected') return res.status(400).json({ error: 'WhatsApp não conectado' });
  try {
    await sock.sendMessage(jid, { text });
    const msgId = `manual_${Date.now()}`;
    const message = { id: msgId, text, fromMe: true, timestamp: Math.floor(Date.now() / 1000), status: 'sent' };
    const conv = upsertConv(jid);
    conv.messages.push(message);
    conv.lastMessage = text;
    conv.lastTimestamp = message.timestamp;
    conv.unread = 0;
    saveData(appData);
    io.emit('message', { jid, message });
    io.emit('conversation_update', { ...conv });
    res.json({ ok: true, message });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/settings', (_, res) => res.json(appData.settings));

app.post('/api/settings', (req, res) => {
  appData.settings = { ...appData.settings, ...req.body };
  saveData(appData);
  res.json({ ok: true });
});

app.post('/api/disconnect', async (_, res) => {
  try { if (sock) await sock.logout(); } catch {}
  connectionStatus = 'disconnected';
  io.emit('status', 'disconnected');
  res.json({ ok: true });
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.emit('status', connectionStatus);
  if (lastQR) socket.emit('qr', lastQR);
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = 3001;
httpServer.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  await connectWhatsApp();
});
