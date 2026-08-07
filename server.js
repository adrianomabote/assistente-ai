import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Storage ──────────────────────────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || './data';
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = join(DATA_DIR, 'data.json');

const loadData = () => {
  try {
    if (existsSync(DATA_FILE)) return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  } catch {}
  return {
    conversations: {},
    settings: {
      evolutionApiUrl: '',
      evolutionApiKey: '',
      instanceName: 'zapcrm',
      aiEnabled: false,
      aiToken: '',
      aiModel: 'gpt-4o-mini',
      aiSystemPrompt: '',
    },
  };
};

const saveData = (d) => {
  try { writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); } catch {}
};

let appData = loadData();
let connectionStatus = 'disconnected';
let statusPollTimer = null;

// ─── Evolution API helpers ────────────────────────────────────────────────────
const evo = () => {
  const { evolutionApiUrl, evolutionApiKey } = appData.settings;
  if (!evolutionApiUrl || !evolutionApiKey) throw new Error('Evolution API não configurada');
  return axios.create({
    baseURL: evolutionApiUrl.replace(/\/$/, ''),
    headers: { apikey: evolutionApiKey, 'Content-Type': 'application/json' },
    timeout: 15000,
  });
};

const getPhone = (id = '') => id.replace('@c.us', '').replace('@g.us', '').replace(/\D/g, '');

const upsertConv = (id, patch = {}) => {
  if (!appData.conversations[id]) {
    appData.conversations[id] = {
      jid: id,
      phone: getPhone(id),
      name: getPhone(id),
      isGroup: id.includes('@g'),
      messages: [],
      unread: 0,
      lastMessage: '',
      lastTimestamp: 0,
    };
  }
  Object.assign(appData.conversations[id], patch);
  return appData.conversations[id];
};

// ─── Status polling ───────────────────────────────────────────────────────────
async function pollStatus() {
  const { instanceName } = appData.settings;
  try {
    const client = evo();
    const res = await client.get(`/instance/connectionState/${instanceName}`);
    const state = res.data?.instance?.state || res.data?.state || 'close';
    const newStatus = state === 'open' ? 'connected' : 'disconnected';
    if (newStatus !== connectionStatus) {
      connectionStatus = newStatus;
      io.emit('status', connectionStatus);
      if (connectionStatus === 'connected') io.emit('qr', null);
    }
  } catch {
    if (connectionStatus === 'connected') {
      connectionStatus = 'disconnected';
      io.emit('status', 'disconnected');
    }
  }
}

function startPolling() {
  if (statusPollTimer) clearInterval(statusPollTimer);
  statusPollTimer = setInterval(pollStatus, 8000);
  pollStatus();
}

// ─── AI Reply ─────────────────────────────────────────────────────────────────
async function getAIReply(conv, incomingText) {
  const { aiToken, aiModel, aiSystemPrompt } = appData.settings;
  if (!aiToken) throw new Error('Token OpenAI não configurado');

  const history = (conv.messages || []).slice(-20).map(m => ({
    role: m.fromMe ? 'assistant' : 'user',
    content: m.text,
  }));
  if (!history.length || history[history.length - 1].content !== incomingText) {
    history.push({ role: 'user', content: incomingText });
  }

  const systemPrompt = aiSystemPrompt?.trim() ||
    'Você é um assistente de atendimento ao cliente. Responda de forma simpática, clara e concisa.';

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: aiModel || 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }, ...history],
      max_tokens: 500,
      temperature: 0.7,
    },
    {
      headers: { Authorization: `Bearer ${aiToken}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    }
  );
  return response.data.choices[0].message.content.trim();
}

// ─── Serve built frontend in production ───────────────────────────────────────
if (IS_PROD) {
  const dist = join(__dirname, 'dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api|\/socket\.io|\/webhook).*$/, (_, res) =>
      res.sendFile(join(dist, 'index.html'))
    );
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/auth', (req, res) => {
  const { password } = req.body;
  const expected = process.env.APP_PASSWORD || (!IS_PROD ? '00220022aA1' : null);
  res.json({ ok: Boolean(expected) && password === expected });
});

// ─── Status ───────────────────────────────────────────────────────────────────
app.get('/api/status', (_, res) => res.json({ status: connectionStatus }));

// ─── Connect (create instance + get QR) ──────────────────────────────────────
app.post('/api/connect', async (_, res) => {
  const { instanceName } = appData.settings;
  try {
    const client = evo();

    // Try to create instance (ignore if already exists)
    try {
      await client.post('/instance/create', {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      });
    } catch (e) {
      // 409 = already exists, that's fine
      if (e.response?.status !== 409) throw e;
    }

    // Get QR code
    const qrRes = await client.get(`/instance/connect/${instanceName}`);
    const qrBase64 = qrRes.data?.base64 || qrRes.data?.qrcode?.base64 || null;

    if (qrBase64) {
      const dataUrl = qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`;
      connectionStatus = 'qr';
      io.emit('status', 'qr');
      io.emit('qr', dataUrl);
      startPolling();
      res.json({ ok: true, qr: dataUrl });
    } else {
      // Already connected
      connectionStatus = 'connected';
      io.emit('status', 'connected');
      startPolling();
      res.json({ ok: true, qr: null });
    }
  } catch (e) {
    const msg = e.response?.data?.message || e.message;
    res.status(500).json({ error: msg });
  }
});

// ─── Disconnect ───────────────────────────────────────────────────────────────
app.post('/api/disconnect', async (_, res) => {
  const { instanceName } = appData.settings;
  try {
    const client = evo();
    await client.delete(`/instance/logout/${instanceName}`);
  } catch {}
  if (statusPollTimer) clearInterval(statusPollTimer);
  connectionStatus = 'disconnected';
  io.emit('status', 'disconnected');
  res.json({ ok: true });
});

// ─── Conversations ────────────────────────────────────────────────────────────
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

app.get('/api/conversations/:jid/contact', (req, res) => {
  const jid = decodeURIComponent(req.params.jid);
  const conv = appData.conversations[jid];
  res.json({ ok: !!conv, name: conv?.name || null, number: conv?.phone || null });
});

app.post('/api/conversations/bulk-delete', (req, res) => {
  const { jids = [] } = req.body;
  for (const jid of jids) delete appData.conversations[jid];
  saveData(appData);
  res.json({ ok: true });
});

app.post('/api/conversations/bulk-archive', (req, res) => {
  const { jids = [], archived = true } = req.body;
  for (const jid of jids) {
    if (appData.conversations[jid]) appData.conversations[jid].archived = archived;
  }
  saveData(appData);
  res.json({ ok: true });
});

app.post('/api/conversations/bulk-read', (req, res) => {
  const { jids = [] } = req.body;
  for (const jid of jids) {
    if (appData.conversations[jid]) appData.conversations[jid].unread = 0;
  }
  saveData(appData);
  res.json({ ok: true });
});

app.post('/api/conversations/read-all', (_, res) => {
  for (const jid of Object.keys(appData.conversations)) {
    appData.conversations[jid].unread = 0;
  }
  saveData(appData);
  res.json({ ok: true });
});

// ─── Send message ─────────────────────────────────────────────────────────────
app.post('/api/send', async (req, res) => {
  const { jid, text } = req.body;
  if (connectionStatus !== 'connected') return res.status(400).json({ error: 'WhatsApp não conectado' });
  const { instanceName } = appData.settings;
  try {
    const client = evo();
    await client.post(`/message/sendText/${instanceName}`, {
      number: jid.replace('@c.us', '').replace('@g.us', ''),
      text,
    });
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
    res.status(500).json({ error: e.response?.data?.message || e.message });
  }
});

// ─── Settings ─────────────────────────────────────────────────────────────────
app.get('/api/settings', (_, res) => res.json(appData.settings));

app.post('/api/settings', (req, res) => {
  appData.settings = { ...appData.settings, ...req.body };
  saveData(appData);
  // Restart polling if API config changed
  if (appData.settings.evolutionApiUrl && appData.settings.evolutionApiKey) startPolling();
  res.json({ ok: true });
});

// ─── AI chat ──────────────────────────────────────────────────────────────────
app.post('/api/ai/chat', async (req, res) => {
  const { message, history = [] } = req.body;
  const { aiToken, aiModel } = appData.settings;

  if (!aiToken) return res.status(400).json({ error: 'Token OpenAI não configurado nas Definições.' });
  if (!message?.trim()) return res.status(400).json({ error: 'Mensagem vazia.' });

  try {
    const convs = Object.values(appData.conversations);
    const now = Math.floor(Date.now() / 1000);
    const todayStart = now - (now % 86400);

    const topConvs = [...convs]
      .filter(c => !c.archived)
      .sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0))
      .slice(0, 10);

    const recentSummary = topConvs.map(c => {
      const msgs = (c.messages || []).slice(-3).map(m =>
        `    [${m.fromMe ? 'Eu' : c.name || c.phone}]: ${m.text}`
      ).join('\n');
      return `• ${c.name || c.phone} (${c.unread} não lidas):\n${msgs}`;
    }).join('\n\n');

    const todayMsgs = convs.flatMap(c =>
      (c.messages || [])
        .filter(m => m.timestamp >= todayStart)
        .map(m => ({ conv: c.name || c.phone, fromMe: m.fromMe, text: m.text, ts: m.timestamp }))
    ).sort((a, b) => b.ts - a.ts).slice(0, 30);

    const todaySummary = todayMsgs.length
      ? todayMsgs.map(m => `  [${m.fromMe ? 'Eu' : m.conv}]: ${m.text}`).join('\n')
      : '  Nenhuma mensagem hoje.';

    const customInstructions = appData.settings.aiSystemPrompt?.trim();
    const systemPrompt = `És o assistente inteligente do ZapCRM — um CRM de WhatsApp.
Responde sempre em português. Sê direto, útil e profissional.
${customInstructions ? `\nInstruções personalizadas:\n${customInstructions}\n` : ''}
=== DADOS DO CRM ===
Total de conversas: ${convs.length}
Não lidas: ${convs.filter(c => c.unread > 0).length}
Arquivadas: ${convs.filter(c => c.archived).length}

Mensagens de hoje:
${todaySummary}

Conversas recentes:
${recentSummary || 'Nenhuma conversa ainda.'}
====================`;

    const priorHistory = (history || []).slice(-20).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: aiModel || 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...priorHistory, { role: 'user', content: message }],
        max_tokens: 800,
        temperature: 0.6,
      },
      {
        headers: { Authorization: `Bearer ${aiToken}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );
    res.json({ reply: response.data.choices[0].message.content.trim() });
  } catch (e) {
    res.status(500).json({ error: e.response?.data?.error?.message || e.message });
  }
});

// ─── Webhook (receive messages from Evolution API) ────────────────────────────
app.post('/webhook/evolution', async (req, res) => {
  res.json({ ok: true }); // respond immediately

  const body = req.body;
  const event = body?.event || body?.type;

  // Connection state change
  if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
    const state = body?.data?.state || body?.state;
    if (state === 'open') {
      connectionStatus = 'connected';
      io.emit('status', 'connected');
      io.emit('qr', null);
    } else if (state === 'close') {
      connectionStatus = 'disconnected';
      io.emit('status', 'disconnected');
    }
    return;
  }

  // New message received
  if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
    const msgData = body?.data || body;
    const msgs = Array.isArray(msgData?.messages) ? msgData.messages : [msgData];

    for (const msg of msgs) {
      if (!msg) continue;
      const fromMe = msg.key?.fromMe || msg.fromMe || false;
      const remoteJid = msg.key?.remoteJid || msg.remoteJid || '';
      if (!remoteJid || remoteJid === 'status@broadcast') continue;

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        (msg.message?.audioMessage ? '[Áudio 🎵]' : null) ||
        (msg.message?.documentMessage ? '[Documento 📄]' : null) ||
        (msg.message?.stickerMessage ? '[Sticker]' : null) ||
        (msg.message?.locationMessage ? '[Localização 📍]' : null) ||
        msg.body || '[Mensagem]';

      const timestamp = msg.messageTimestamp || Math.floor(Date.now() / 1000);
      const msgId = msg.key?.id || `${Date.now()}`;
      const pushName = msg.pushName || msg.notifyName || null;

      const conv = upsertConv(remoteJid);
      if (pushName && pushName !== getPhone(remoteJid)) conv.name = pushName;
      if (conv.messages.find(m => m.id === msgId)) continue;

      const message = { id: msgId, text, fromMe, timestamp, status: fromMe ? 'sent' : 'received' };
      conv.messages.push(message);
      conv.lastMessage = text;
      conv.lastTimestamp = Number(timestamp);
      if (!fromMe) conv.unread = (conv.unread || 0) + 1;

      saveData(appData);
      io.emit('message', { jid: remoteJid, message });
      io.emit('conversation_update', { ...conv });

      // AI auto-reply for incoming messages on individual chats
      if (!fromMe && appData.settings.aiEnabled && appData.settings.aiToken && !conv.isGroup) {
        setTimeout(async () => {
          try {
            const reply = await getAIReply(conv, text);
            const { instanceName } = appData.settings;
            const client = evo();
            await client.post(`/message/sendText/${instanceName}`, {
              number: getPhone(remoteJid),
              text: reply,
            });
            const autoId = `ai_${Date.now()}`;
            const autoMsg = { id: autoId, text: reply, fromMe: true, timestamp: Math.floor(Date.now() / 1000), status: 'sent' };
            conv.messages.push(autoMsg);
            conv.lastMessage = reply;
            conv.lastTimestamp = autoMsg.timestamp;
            saveData(appData);
            io.emit('message', { jid: remoteJid, message: autoMsg });
            io.emit('conversation_update', { ...conv });
          } catch (e) {
            console.error('AI reply error:', e.message);
          }
        }, 1500);
      }
    }
  }
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.emit('status', connectionStatus);
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  // Start polling if already configured
  if (appData.settings.evolutionApiUrl && appData.settings.evolutionApiKey) {
    startPolling();
  }
});
