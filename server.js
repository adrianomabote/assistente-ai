import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import axios from 'axios';
import pkg from 'whatsapp-web.js';
import QRCode from 'qrcode';

const { Client, LocalAuth } = pkg;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Storage ──────────────────────────────────────────────────────────────────
if (!existsSync('./data')) mkdirSync('./data', { recursive: true });

const DATA_FILE = './data/data.json';

const loadData = () => {
  try {
    if (existsSync(DATA_FILE)) return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  } catch {}
  return {
    conversations: {},
    settings: {
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
let client = null;
let connectionStatus = 'disconnected';
let lastQR = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getPhone = (id = '') => id.replace('@c.us', '').replace('@g.us', '');

const upsertConv = (id, patch = {}) => {
  if (!appData.conversations[id]) {
    appData.conversations[id] = {
      jid: id,
      phone: getPhone(id),
      name: getPhone(id),
      isGroup: id.endsWith('@g.us'),
      messages: [],
      unread: 0,
      lastMessage: '',
      lastTimestamp: 0,
    };
  }
  Object.assign(appData.conversations[id], patch);
  return appData.conversations[id];
};

const extractText = (msg) => {
  if (msg.type === 'chat') return msg.body || '';
  if (msg.type === 'image') return msg.body ? `[Imagem 🖼] ${msg.body}` : '[Imagem 🖼]';
  if (msg.type === 'video') return '[Vídeo 🎥]';
  if (msg.type === 'audio' || msg.type === 'ptt') return '[Áudio 🎵]';
  if (msg.type === 'document') return '[Documento 📄]';
  if (msg.type === 'sticker') return '[Sticker]';
  if (msg.type === 'location') return '[Localização 📍]';
  return msg.body || '[Mensagem]';
};

// ─── AI Reply ─────────────────────────────────────────────────────────────────
async function getAIReply(conv, incomingText) {
  const { aiToken, aiModel, aiSystemPrompt } = appData.settings;
  if (!aiToken) throw new Error('Token OpenAI não configurado');

  // Build message history (last 20 messages for context)
  const history = (conv.messages || []).slice(-20).map(m => ({
    role: m.fromMe ? 'assistant' : 'user',
    content: m.text,
  }));

  // Make sure the incoming message is at the end
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
      headers: {
        Authorization: `Bearer ${aiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return response.data.choices[0].message.content.trim();
}

// ─── WhatsApp ─────────────────────────────────────────────────────────────────
async function connectWhatsApp() {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './auth' }),
    puppeteer: {
      headless: true,
      executablePath: (() => { try { return execSync('which chromium').toString().trim(); } catch { return undefined; } })(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    },
  });

  client.on('qr', async (qr) => {
    try {
      const dataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
      lastQR = dataUrl;
      connectionStatus = 'qr';
      io.emit('status', 'qr');
      io.emit('qr', dataUrl);
    } catch {}
  });

  client.on('ready', () => {
    lastQR = null;
    connectionStatus = 'connected';
    io.emit('status', 'connected');
    io.emit('qr', null);
    console.log('WhatsApp connected!');
  });

  client.on('authenticated', () => {
    console.log('WhatsApp authenticated!');
  });

  client.on('auth_failure', (msg) => {
    console.error('Auth failure:', msg);
    connectionStatus = 'disconnected';
    io.emit('status', 'disconnected');
  });

  client.on('disconnected', (reason) => {
    console.log('WhatsApp disconnected:', reason);
    connectionStatus = 'disconnected';
    io.emit('status', 'disconnected');
    io.emit('qr', null);
    setTimeout(connectWhatsApp, 5000);
  });

  client.on('message', async (msg) => {
    if (msg.from === 'status@broadcast') return;

    const id = msg.from;
    const text = extractText(msg);
    const timestamp = Math.floor(msg.timestamp);
    const msgId = msg.id._serialized;

    const conv = upsertConv(id);
    try {
      const contact = await msg.getContact();
      if (contact.pushname && contact.pushname !== getPhone(id)) conv.name = contact.pushname;
      else if (contact.name) conv.name = contact.name;
    } catch {}

    if (conv.messages.find(m => m.id === msgId)) return;

    const message = { id: msgId, text, fromMe: false, timestamp, status: 'received' };
    conv.messages.push(message);
    conv.lastMessage = text;
    conv.lastTimestamp = timestamp;
    conv.unread = (conv.unread || 0) + 1;

    saveData(appData);
    io.emit('message', { jid: id, message });
    io.emit('conversation_update', { ...conv });

    // AI auto-reply (only for individual chats, not groups)
    if (appData.settings.aiEnabled && appData.settings.aiToken && !conv.isGroup) {
      setTimeout(async () => {
        try {
          const reply = await getAIReply(conv, text);
          await client.sendMessage(id, reply);

          const autoId = `ai_${Date.now()}`;
          const autoMsg = { id: autoId, text: reply, fromMe: true, timestamp: Math.floor(Date.now() / 1000), status: 'sent' };
          conv.messages.push(autoMsg);
          conv.lastMessage = reply;
          conv.lastTimestamp = autoMsg.timestamp;
          saveData(appData);
          io.emit('message', { jid: id, message: autoMsg });
          io.emit('conversation_update', { ...conv });
        } catch (e) {
          console.error('AI reply error:', e.message);
        }
      }, 1500);
    }
  });

  client.on('message_create', async (msg) => {
    if (!msg.fromMe) return;
    if (msg.from === 'status@broadcast') return;

    const id = msg.to;
    const text = extractText(msg);
    const timestamp = Math.floor(msg.timestamp);
    const msgId = msg.id._serialized;

    const conv = upsertConv(id);
    if (conv.messages.find(m => m.id === msgId)) return;

    const message = { id: msgId, text, fromMe: true, timestamp, status: 'sent' };
    conv.messages.push(message);
    conv.lastMessage = text;
    conv.lastTimestamp = timestamp;

    saveData(appData);
    io.emit('message', { jid: id, message });
    io.emit('conversation_update', { ...conv });
  });

  await client.initialize();
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
  if (!client || connectionStatus !== 'connected') return res.status(400).json({ error: 'WhatsApp não conectado' });
  try {
    await client.sendMessage(jid, text);
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

// ── Bulk conversation actions ─────────────────────────────────────────────────
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

// ── AI Assistant chat ─────────────────────────────────────────────────────────
app.post('/api/ai/chat', async (req, res) => {
  const { message } = req.body;
  const { aiToken, aiModel } = appData.settings;

  if (!aiToken) return res.status(400).json({ error: 'Token OpenAI não configurado nas Definições.' });
  if (!message?.trim()) return res.status(400).json({ error: 'Mensagem vazia.' });

  try {
    // Build CRM context snapshot for the AI
    const convs = Object.values(appData.conversations);
    const totalConvs = convs.length;
    const unreadConvs = convs.filter(c => c.unread > 0);
    const archivedConvs = convs.filter(c => c.archived);
    const groupConvs = convs.filter(c => c.isGroup);
    const now = Math.floor(Date.now() / 1000);
    const todayStart = now - (now % 86400);

    // Recent messages (last 3 msgs from each of the 10 most active convs)
    const topConvs = [...convs]
      .filter(c => !c.archived)
      .sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0))
      .slice(0, 10);

    const recentSummary = topConvs.map(c => {
      const recentMsgs = (c.messages || []).slice(-3).map(m =>
        `    [${m.fromMe ? 'Eu' : c.name || c.phone}]: ${m.text}`
      ).join('\n');
      return `• ${c.name || c.phone} (${c.unread} não lidas, última: ${new Date((c.lastTimestamp || 0) * 1000).toLocaleString('pt-PT')}):\n${recentMsgs}`;
    }).join('\n\n');

    // Today's messages
    const todayMsgs = convs.flatMap(c =>
      (c.messages || [])
        .filter(m => m.timestamp >= todayStart)
        .map(m => ({ conv: c.name || c.phone, fromMe: m.fromMe, text: m.text, ts: m.timestamp }))
    ).sort((a, b) => b.ts - a.ts).slice(0, 30);

    const todaySummary = todayMsgs.length
      ? todayMsgs.map(m => `  [${m.fromMe ? 'Eu' : m.conv}]: ${m.text}`).join('\n')
      : '  Nenhuma mensagem hoje.';

    const systemPrompt = `És o assistente inteligente do ZapCRM — um CRM de WhatsApp. 
Tens acesso ao resumo completo das conversas do utilizador e deves ajudá-lo a analisar, resumir, identificar padrões e responder perguntas sobre os seus clientes e interações.
Responde sempre em português (de Portugal). Sê direto, útil e profissional.

=== DADOS ACTUAIS DO CRM ===
Data/hora actual: ${new Date().toLocaleString('pt-PT')}

Resumo geral:
- Total de conversas: ${totalConvs}
- Conversas com mensagens não lidas: ${unreadConvs.length} (${unreadConvs.map(c => c.name || c.phone).join(', ') || 'nenhuma'})
- Conversas arquivadas: ${archivedConvs.length}
- Grupos: ${groupConvs.length}
- Conversas individuais: ${convs.filter(c => !c.isGroup && !c.archived).length}

Mensagens de hoje:
${todaySummary}

Conversas mais recentes e últimas mensagens:
${recentSummary || 'Nenhuma conversa ainda.'}
===========================

Responde à pergunta do utilizador com base nestes dados.`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: aiModel || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
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
    const errMsg = e.response?.data?.error?.message || e.message;
    res.status(500).json({ error: errMsg });
  }
});

app.post('/api/disconnect', async (_, res) => {
  try { if (client) await client.destroy(); } catch {}
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
