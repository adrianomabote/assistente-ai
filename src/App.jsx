import { useState, useEffect, useCallback } from 'react';
import socket from './socket';
import Sidebar from './components/Sidebar';
import ConversationList from './components/ConversationList';
import ChatWindow from './components/ChatWindow';
import Settings from './components/Settings';
import QRModal from './components/QRModal';
import LoginScreen from './components/LoginScreen';
import AIAssistant from './components/AIAssistant';

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('zapcrm_auth') === '1');
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light');
  const [status, setStatus] = useState('disconnected');
  const [qr, setQr] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeJid, setActiveJid] = useState(null);
  const [page, setPage] = useState('chats'); // 'chats' | 'settings' | 'ai'
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    if (!authed) return;
    fetch('/api/conversations').then(r => r.json()).then(setConversations).catch(() => {});
    fetch('/api/status').then(r => r.json()).then(d => setStatus(d.status)).catch(() => {});

    socket.on('status', (s) => {
      setStatus(s);
      if (s === 'connected') setShowQR(false);
    });
    socket.on('qr', (q) => { setQr(q || null); });
    socket.on('conversation_update', (conv) => {
      setConversations(prev => {
        const idx = prev.findIndex(c => c.jid === conv.jid);
        const next = idx >= 0 ? [...prev] : [conv, ...prev];
        if (idx >= 0) next[idx] = conv;
        return [...next].sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
      });
    });

    return () => { socket.off('status'); socket.off('qr'); socket.off('conversation_update'); };
  }, [authed]);

  // Keyboard + browser back navigation
  useEffect(() => {
    if (!authed) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (showQR) { setShowQR(false); return; }
        if (activeJid) { setActiveJid(null); return; }
        if (page !== 'chats') { setPage('chats'); return; }
      }
    };
    const onPop = () => {
      if (showQR) { setShowQR(false); history.pushState(null, ''); return; }
      if (activeJid) { setActiveJid(null); history.pushState(null, ''); return; }
      if (page !== 'chats') { setPage('chats'); history.pushState(null, ''); return; }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onPop);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('popstate', onPop); };
  }, [authed, showQR, page, activeJid]);

  useEffect(() => {
    if (!authed) return;
    history.pushState(null, '');
  }, [page, activeJid, authed]);

  const handleConnect = useCallback(() => { setShowQR(true); setQr(null); }, []);
  const handleDisconnect = useCallback(() => {
    fetch('/api/disconnect', { method: 'POST' });
    setStatus('disconnected'); setShowQR(false); setQr(null);
  }, []);

  const selectConv = useCallback((jid) => {
    setActiveJid(jid);
    setPage('chats');
    fetch(`/api/conversations/${encodeURIComponent(jid)}/read`, { method: 'POST' });
    setConversations(prev => prev.map(c => c.jid === jid ? { ...c, unread: 0 } : c));
  }, []);

  const goToChats = useCallback(() => { setPage('chats'); setActiveJid(null); }, []);
  const goBack = useCallback(() => { setActiveJid(null); }, []);

  // ── Conversation bulk actions ──────────────────────────────────────────────
  const handleDeleteConvs = useCallback(async (jids) => {
    await fetch('/api/conversations/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jids }),
    });
    setConversations(prev => prev.filter(c => !jids.includes(c.jid)));
    if (jids.includes(activeJid)) setActiveJid(null);
  }, [activeJid]);

  const handleArchiveConvs = useCallback(async (jids, archive) => {
    await fetch('/api/conversations/bulk-archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jids, archived: archive }),
    });
    setConversations(prev => prev.map(c => jids.includes(c.jid) ? { ...c, archived: archive } : c));
    if (archive && jids.includes(activeJid)) setActiveJid(null);
  }, [activeJid]);

  const handleMarkReadConvs = useCallback(async (jids) => {
    await fetch('/api/conversations/bulk-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jids }),
    });
    setConversations(prev => prev.map(c => jids.includes(c.jid) ? { ...c, unread: 0 } : c));
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    await fetch('/api/conversations/read-all', { method: 'POST' });
    setConversations(prev => prev.map(c => ({ ...c, unread: 0 })));
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = conversations.filter(c => {
    const matchesSearch = (c.name || c.phone || '').toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'archived') return !!c.archived;
    if (c.archived) return false;
    if (filter === 'unread') return c.unread > 0;
    if (filter === 'groups') return c.isGroup;
    return true;
  });

  const activeConv = conversations.find(c => c.jid === activeJid);

  // On mobile: right panel is active when a chat or the AI assistant is open
  const mobileRightActive = !!activeConv || page === 'ai';

  if (!authed) return <LoginScreen onAuth={() => setAuthed(true)} />;

  return (
    <div className="h-screen w-screen flex bg-bg-light dark:bg-bg-dark overflow-hidden">

      {/* ── LEFT PANEL ──────────────────────────────────────────────────────────
          Desktop: fixed 360px width, always visible
          Mobile:  full width, hidden when chat or AI is open              */}
      <div className={`flex flex-col h-full border-r border-slate-200 dark:border-slate-700/60 shadow-sm
        md:w-[360px] md:flex-shrink-0 md:flex
        ${mobileRightActive ? 'hidden' : 'flex w-full'}`}>

        <Sidebar
          status={status}
          dark={dark}
          setDark={setDark}
          page={page}
          setPage={setPage}
          onLogoClick={goToChats}
        />

        {page === 'chats' && (
          <ConversationList
            conversations={filtered}
            allConversations={conversations}
            activeJid={activeJid}
            onSelect={selectConv}
            search={search}
            setSearch={setSearch}
            filter={filter}
            setFilter={setFilter}
            onDeleteConvs={handleDeleteConvs}
            onArchiveConvs={handleArchiveConvs}
            onMarkReadConvs={handleMarkReadConvs}
            onMarkAllRead={handleMarkAllRead}
          />
        )}

        {page === 'settings' && (
          <Settings status={status} onDisconnect={handleDisconnect} onConnect={handleConnect} />
        )}

        {/* Desktop: when AI is open, show placeholder pointing to right panel */}
        {page === 'ai' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-icons-outlined text-primary text-3xl">support_agent</span>
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Assistente aberto</p>
            <p className="text-xs text-slate-400">O assistente está no painel principal →</p>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────────────
          Desktop: flex-1, always visible
          Mobile:  full width, only visible when chat or AI is open         */}
      <div className={`flex flex-col h-full flex-1 bg-chat-light dark:bg-chat-dark
        md:flex
        ${mobileRightActive ? 'flex' : 'hidden'}`}>

        {page === 'ai' ? (
          <AIAssistant onBack={() => setPage('chats')} />
        ) : activeConv ? (
          <ChatWindow conv={activeConv} status={status} onBack={goBack} />
        ) : (
          /* Desktop empty state */
          <div className="flex-1 flex flex-col items-center justify-center select-none gap-4">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-icons-outlined text-primary" style={{ fontSize: 48 }}>chat</span>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-slate-600 dark:text-slate-300">ZapCRM</p>
              <p className="text-sm text-slate-400 mt-1 max-w-xs">
                {status === 'connected'
                  ? 'Selecione uma conversa para começar a responder'
                  : 'Conecte o WhatsApp via QR Code nas Definições'}
              </p>
            </div>
          </div>
        )}
      </div>

      {showQR && <QRModal qr={qr} status={status} onClose={() => setShowQR(false)} />}
    </div>
  );
}
