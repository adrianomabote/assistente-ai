import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import axios from 'axios';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Data storage
if (!existsSync('./data')) mkdirSync('./data', { recursive: true });
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
      evolutionApiUrl: '',
      evolutionApiKey: '',
      instanceName: 'meu-whatsapp',
    },
  };
};

const saveData = (data) => {
  try { writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); } catch (e) { console.error('Save error:', e.message); }
};

let appData = loadData();
let connectionStatus = 'disconnected'; // disconnected | connecting | qr | connected

// ─── Helpers ──────────────────────────────────────────────────────────────────

function evoClient() {
  const { evolutionApiUrl, evolutionApiKey } = appData.settings;
  if (!evolutionApiUrl || !evolutionApiKey) return null;
  return axios.create({
    baseURL: evolutionApiUrl.replace(/\/$/, ''),
    headers: { apikey: evolutionApiKey },
    timeout: 15000,
  });
}

function getPhone(remoteJid = '') {
  return remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
}

function extractText(message = {}) {
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    (message.audioMessage ? '[Áudio 🎵]' : '') ||
    (message.documentMessage ? `[Documento 📄] ${message.documentMessage.fileName || ''}`.trim() : '') ||
    (message.stickerMessage ? '[Sticker]' : '') ||
    (message.locationMessage ? '[Localização 📍]' : '') ||
    (message.contactMessage ? `[Contato 👤] ${message.contactMessage.displayName || ''}`.trim() : '') ||
    '[Mensagem]'
  );
}

function upsertConversation(jid, patch = {}) {
  if (!appData.conversations[jid]) {
    appData.conversations[jid] = {
      jid,
      phone: getPhone(jid),
      name: getPhone(jid),
      isGroup: jid.endsWith('@g.us'),
      messages: [],
      unread: 0,
      lastMessage: '',
      lastTimestamp: 0,
    };
  }
  Object.assign(appData.conversations[jid], patch);
  return appData.conversations[jid];
}

// ─── Evolution API ─────────────────────────────────────────────────────────────

async function fetchQR() {
  const client = evoClient();
  const { instanceName } = appData.settings;
  if (!client) return null;
  try {
    // Try to get instance state first
    const stateRes = await client.get(`/instance/connectionState/${instanceName}`);
    const state = stateRes.data?.instance?.state;
    if (state === 'open') {
      connectionStatus = 'connected';
      io.emit('status', connectionStatus);
      return null;
    }
  } catch {}

  try {
    const res = await client.get(`/instance/connect/${instanceName}`);
    const qr = res.data?.base64 || res.data?.qrcode?.base64 || res.data?.qr?.base64;
    if (qr) {
      connectionStatus = 'qr';
      io.emit('status', connectionStatus);
      const dataUrl = qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;
      io.emit('qr', dataUrl);
      return dataUrl;
    }
  } catch (e) {
    console.error('QR error:', e.message);
  }
  return null;
}

async function createInstance() {
  const client = evoClient();
  const { instanceName, evolutionApiUrl } = appData.settings;
  if (!client) return false;

  // Derive a webhook URL that Evolution API will call when messages arrive
  const webhookUrl = `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:3001'}/webhook/evolution`;

  try {
    // Check if instance already exists
    const listRes = await client.get('/instance/fetchInstances');
    const instances = listRes.data || [];
    const exists = Array.isArray(instances) && instances.some(i => (i.instance?.instanceName || i.instanceName) === instanceName);

    if (!exists) {
      await client.post('/instance/create', {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          url: webhookUrl,
          byEvents: true,
          base64: true,
          events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
        },
      });
    } else {
      // Update webhook
      try {
        await client.post(`/webhook/set/${instanceName}`, {
          webhook: {
            enabled: true,
            url: webhookUrl,
            byEvents: true,
            base64: true,
            events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'QRCODE_UPDATED'],
          },
        });
      } catch {}
    }
    return true;
  } catch (e) {
    console.error('Instance error:', e.message);
    return false;
  }
}

async function sendEvolutionMessage(jid, text) {
  const client = evoClient();
  const { instanceName } = appData.settings;
  if (!client) throw new Error('Evolution API não configurado');
  const phone = getPhone(jid);
  const res = await client.post(`/message/sendText/${instanceName}`, {
    number: phone,
    text,
  });
  return res.data;
}

// ─── Webhook (Evolution API → this server) ─────────────────────────────────────

app.post('/webhook/evolution', (req, res) => {
  res.sendStatus(200);
  const body = req.body;
  const event = body.event;

  // QR Code updated
  if (event === 'qrcode.updated' || body.data?.qrcode) {
    const qr = body.data?.qrcode?.base64 || body.qrcode;
    if (qr) {
      connectionStatus = 'qr';
      io.emit('status', connectionStatus);
      const dataUrl = qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;
      io.emit('qr', dataUrl);
    }
    return;
  }

  // Connection updated
  if (event === 'connection.update' || body.data?.state) {
    const state = body.data?.state || body.state;
    if (state === 'open' || state === 'CONNECTED') {
      connectionStatus = 'connected';
      io.emit('status', 'connected');
      io.emit('qr', null);
    } else if (state === 'close' || state === 'DISCONNECTED') {
      connectionStatus = 'disconnected';
      io.emit('status', 'disconnected');
    }
    return;
  }

  // Messages
  if (event === 'messages.upsert' || body.data?.messages) {
    const messages = body.data?.messages || [];
    for (const msg of messages) {
      processIncomingMessage(msg);
    }
  }
});

function processIncomingMessage(msg) {
  if (!msg?.key?.remoteJid) return;
  const jid = msg.key.remoteJid;
  if (jid === 'status@broadcast') return;

  const fromMe = msg.key.fromMe || false;
  const msgId = msg.key.id || `msg_${Date.now()}`;
  const timestamp = msg.messageTimestamp || Math.floor(Date.now() / 1000);
  const text = extractText(msg.message || {});
  const pushName = msg.pushName;

  const conv = upsertConversation(jid);
  if (pushName && !conv.isGroup) conv.name = pushName;

  // Avoid duplicates
  if (conv.messages.find(m => m.id === msgId)) return;

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
    const replyText = appData.settings.botMessage || 'Olá!';
    setTimeout(async () => {
      try {
        await sendEvolutionMessage(jid, replyText);
        const autoId = `auto_${Date.now()}`;
        const autoMsg = { id: autoId, text: replyText, fromMe: true, timestamp: Math.floor(Date.now() / 1000), status: 'sent' };
        conv.messages.push(autoMsg);
        conv.lastMessage = replyText;
        conv.lastTimestamp = autoMsg.timestamp;
        saveData(appData);
        io.emit('message', { jid, message: autoMsg });
        io.emit('conversation_update', { ...conv });
      } catch (e) { console.error('Auto-reply error:', e.message); }
    }, 1200);
  }
}

// ─── REST API ─────────────────────────────────────────────────────────────────

app.get('/api/status', (req, res) => res.json({ status: connectionStatus }));

app.get('/api/conversations', (req, res) => {
  const list = Object.values(appData.conversations)
    .sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
  res.json(list);
});

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
  if (!jid || !text) return res.status(400).json({ error: 'jid e text são obrigatórios' });
  try {
    await sendEvolutionMessage(jid, text);
    const msgId = `manual_${Date.now()}`;
    const message = { id: msgId, text, fromMe: true, timestamp: Math.floor(Date.now() / 1000), status: 'sent' };
    const conv = upsertConversation(jid);
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

app.get('/api/settings', (req, res) => res.json({
  ...appData.settings,
  evolutionApiKey: appData.settings.evolutionApiKey ? '***' : '',
}));

app.post('/api/settings', (req, res) => {
  const incoming = req.body;
  // Don't overwrite key if masked
  if (incoming.evolutionApiKey === '***') delete incoming.evolutionApiKey;
  appData.settings = { ...appData.settings, ...incoming };
  saveData(appData);
  res.json({ ok: true });
});

app.get('/api/settings/raw-key', (req, res) => {
  res.json({ hasKey: !!appData.settings.evolutionApiKey });
});

app.post('/api/connect', async (req, res) => {
  if (!appData.settings.evolutionApiUrl || !appData.settings.evolutionApiKey) {
    return res.status(400).json({ error: 'Configure a Evolution API primeiro nas Configurações' });
  }
  connectionStatus = 'connecting';
  io.emit('status', connectionStatus);
  try {
    const ok = await createInstance();
    if (!ok) throw new Error('Falha ao criar instância');
    await new Promise(r => setTimeout(r, 1000));
    const qr = await fetchQR();
    res.json({ ok: true, qr });
  } catch (e) {
    connectionStatus = 'disconnected';
    io.emit('status', connectionStatus);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/disconnect', async (req, res) => {
  const client = evoClient();
  const { instanceName } = appData.settings;
  if (client) {
    try { await client.delete(`/instance/logout/${instanceName}`); } catch {}
  }
  connectionStatus = 'disconnected';
  io.emit('status', connectionStatus);
  res.json({ ok: true });
});

// Check connection state periodically
async function pollConnectionState() {
  const client = evoClient();
  const { instanceName } = appData.settings;
  if (!client || !instanceName || connectionStatus === 'qr') return;
  try {
    const res = await client.get(`/instance/connectionState/${instanceName}`);
    const state = res.data?.instance?.state;
    const newStatus = state === 'open' ? 'connected' : 'disconnected';
    if (newStatus !== connectionStatus) {
      connectionStatus = newStatus;
      io.emit('status', connectionStatus);
    }
  } catch {}
}
setInterval(pollConnectionState, 10000);

// ─── Socket.io ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  socket.emit('status', connectionStatus);
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`WhatsApp CRM server running on port ${PORT}`);
});
