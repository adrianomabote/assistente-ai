import { useState, useEffect, useCallback } from 'react';
import socket from './socket';
import Sidebar from './components/Sidebar';
import ConversationList from './components/ConversationList';
import ChatWindow from './components/ChatWindow';
import Settings from './components/Settings';
import QRModal from './components/QRModal';

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [status, setStatus] = useState('disconnected');
  const [qr, setQr] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeJid, setActiveJid] = useState(null);
  const [page, setPage] = useState('chats');
  const [search, setSearch] = useState('');
  const [connectError, setConnectError] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    fetch('/api/conversations').then(r => r.json()).then(setConversations).catch(() => {});
    fetch('/api/status').then(r => r.json()).then(d => setStatus(d.status)).catch(() => {});

    socket.on('status', (s) => { setStatus(s); if (s === 'connected') { setShowQR(false); } });
    socket.on('qr', (q) => { if (q) { setQr(q); setShowQR(true); } });
    socket.on('conversation_update', (conv) => {
      setConversations(prev => {
        const idx = prev.findIndex(c => c.jid === conv.jid);
        const next = idx >= 0 ? [...prev] : [conv, ...prev];
        if (idx >= 0) next[idx] = conv;
        return [...next].sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
      });
    });

    return () => {
      socket.off('status');
      socket.off('qr');
      socket.off('conversation_update');
    };
  }, []);

  const handleConnect = useCallback(async () => {
    setConnectError('');
    setShowQR(true);
    setQr(null);
    try {
      const res = await fetch('/api/connect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setConnectError(data.error || 'Erro ao conectar');
        setShowQR(false);
      } else if (data.qr) {
        setQr(data.qr);
      }
    } catch (e) {
      setConnectError('Erro de rede ao tentar conectar');
      setShowQR(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    fetch('/api/disconnect', { method: 'POST' });
    setStatus('disconnected');
    setShowQR(false);
    setQr(null);
  }, []);

  const selectConv = useCallback((jid) => {
    setActiveJid(jid);
    setPage('chats');
    fetch(`/api/conversations/${encodeURIComponent(jid)}/read`, { method: 'POST' });
    setConversations(prev => prev.map(c => c.jid === jid ? { ...c, unread: 0 } : c));
  }, []);

  const filtered = conversations.filter(c =>
    (c.name || c.phone || '').toLowerCase().includes(search.toLowerCase())
  );
  const activeConv = conversations.find(c => c.jid === activeJid);

  return (
    <div className="h-screen w-screen flex bg-bg-light dark:bg-bg-dark overflow-hidden">
      {/* Left panel */}
      <div className="flex h-full w-[360px] flex-shrink-0 flex-col border-r border-slate-200 dark:border-slate-700/60 shadow-sm">
        <Sidebar
          status={status}
          dark={dark}
          setDark={setDark}
          page={page}
          setPage={setPage}
          onConnectClick={handleConnect}
        />
        {page === 'chats' && (
          <ConversationList
            conversations={filtered}
            activeJid={activeJid}
            onSelect={selectConv}
            search={search}
            setSearch={setSearch}
          />
        )}
        {page === 'settings' && (
          <Settings
            status={status}
            onDisconnect={handleDisconnect}
            onConnect={handleConnect}
          />
        )}
      </div>

      {/* Right panel: Chat */}
      <div className="flex-1 flex flex-col h-full bg-chat-light dark:bg-chat-dark">
        {activeConv ? (
          <ChatWindow conv={activeConv} status={status} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center select-none gap-4">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-icons-outlined text-primary" style={{ fontSize: 48 }}>chat</span>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-slate-600 dark:text-slate-300">WhatsApp CRM</p>
              <p className="text-sm text-slate-400 mt-1 max-w-xs">
                {status === 'connected'
                  ? 'Selecione uma conversa para começar a responder'
                  : 'Conecte o WhatsApp via QR Code para ver as conversas'}
              </p>
            </div>
            {status !== 'connected' && (
              <button onClick={() => setPage('settings')} className="btn-primary flex items-center gap-2 mt-2">
                <span className="material-icons-outlined text-lg">settings</span>
                Ir para Configurações
              </button>
            )}
            {connectError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">{connectError}</p>
            )}
          </div>
        )}
      </div>

      {/* QR Modal */}
      {showQR && (
        <QRModal qr={qr} status={status} onClose={() => setShowQR(false)} />
      )}
    </div>
  );
}
