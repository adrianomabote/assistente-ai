import { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../socket';
import ContactProfile from './ContactProfile';

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
  const d = new Date((ts || 0) * 1000);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hoje';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function Avatar({ name, size = 'md' }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const colors = ['bg-rose-400','bg-pink-500','bg-purple-500','bg-indigo-500','bg-blue-500','bg-teal-500','bg-emerald-500','bg-orange-400','bg-amber-500'];
  const color = colors[(name || '').charCodeAt(0) % colors.length];
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm';
  return (
    <div className={`${sz} ${color} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

function StatusTick({ status }) {
  // status: received=1, server=2, delivered=3, read=4
  const s = Number(status);
  if (s >= 4) return (
    <svg className="w-4 h-4 text-blue-400" viewBox="0 0 16 11" fill="currentColor">
      <path d="M11.071.653a.75.75 0 0 1 .205 1.04l-5.5 8a.75.75 0 0 1-1.146.114l-3-3a.75.75 0 0 1 1.06-1.06l2.4 2.4 4.94-7.19a.75.75 0 0 1 1.04-.304z"/>
      <path d="M14.571.653a.75.75 0 0 1 .205 1.04l-5.5 8a.75.75 0 0 1-1.245-.09l.805-1.17.44.605 4.255-6.18a.75.75 0 0 1 1.04-.205z"/>
    </svg>
  );
  if (s >= 2) return (
    <svg className="w-4 h-4 text-slate-400" viewBox="0 0 16 11" fill="currentColor">
      <path d="M11.071.653a.75.75 0 0 1 .205 1.04l-5.5 8a.75.75 0 0 1-1.146.114l-3-3a.75.75 0 0 1 1.06-1.06l2.4 2.4 4.94-7.19a.75.75 0 0 1 1.04-.304z"/>
      <path d="M14.571.653a.75.75 0 0 1 .205 1.04l-5.5 8a.75.75 0 0 1-1.245-.09l.805-1.17.44.605 4.255-6.18a.75.75 0 0 1 1.04-.205z"/>
    </svg>
  );
  return (
    <svg className="w-3 h-3 text-slate-400" viewBox="0 0 12 11" fill="currentColor">
      <path d="M10.071.653a.75.75 0 0 1 .205 1.04l-5.5 8a.75.75 0 0 1-1.146.114l-3-3a.75.75 0 0 1 1.06-1.06l2.4 2.4 4.94-7.19a.75.75 0 0 1 1.04-.304z"/>
    </svg>
  );
}

export default function ChatWindow({ conv, status, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showEmojiHint, setShowEmojiHint] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setMessages([]);
    setShowProfile(false);
    fetch(`/api/conversations/${encodeURIComponent(conv.jid)}/messages`)
      .then(r => r.json()).then(setMessages).catch(() => {});
  }, [conv.jid]);

  useEffect(() => {
    const handler = ({ jid, message }) => {
      if (jid !== conv.jid) return;
      setMessages(prev => prev.find(m => m.id === message.id) ? prev : [...prev, message]);
    };
    const statusHandler = ({ jid, id, status: s }) => {
      if (jid !== conv.jid) return;
      setMessages(prev => prev.map(m => m.id === id ? { ...m, status: s } : m));
    };
    socket.on('message', handler);
    socket.on('message_status', statusHandler);
    return () => { socket.off('message', handler); socket.off('message_status', statusHandler); };
  }, [conv.jid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || status !== 'connected') return;
    setSending(true);
    setInput('');
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jid: conv.jid, text }),
      });
      const data = await res.json();
      if (data.message) setMessages(prev => prev.find(m => m.id === data.message.id) ? prev : [...prev, data.message]);
    } catch {}
    setSending(false);
    inputRef.current?.focus();
  }, [input, sending, status, conv.jid]);

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  // Group by date
  const grouped = [];
  let lastDate = null;
  for (const msg of messages) {
    const d = new Date((msg.timestamp || 0) * 1000).toDateString();
    if (d !== lastDate) { grouped.push({ type: 'date', ts: msg.timestamp, d }); lastDate = d; }
    grouped.push({ type: 'msg', ...msg });
  }

  const name = conv.name || conv.phone;
  const phone = conv.phone;

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-700/50 flex-shrink-0 z-10">
        {/* Back button — mobile only */}
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors flex-shrink-0"
          >
            <span className="material-icons-outlined text-xl">arrow_back</span>
          </button>
        )}
        <button onClick={() => setShowProfile(true)} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left">
          <Avatar name={name} />
          <div className="min-w-0">
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {status === 'connected' ? phone : 'offline'}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-0.5">
          <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors">
            <span className="material-icons-outlined text-xl">videocam</span>
          </button>
          <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors">
            <span className="material-icons-outlined text-xl">call</span>
          </button>
          <button className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors">
            <span className="material-icons-outlined text-xl">search</span>
          </button>
          <button
            onClick={() => setShowProfile(true)}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors"
          >
            <span className="material-icons-outlined text-xl">more_vert</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar px-[5%] py-4 space-y-0.5 chat-bg"
      >
        {grouped.map((item, i) => {
          if (item.type === 'date') return (
            <div key={`d${i}`} className="flex justify-center my-3">
              <span className="bg-white/90 dark:bg-[#182229]/90 text-slate-500 dark:text-slate-300 text-xs px-3 py-1 rounded-full shadow-sm backdrop-blur-sm">
                {formatDate(item.ts)}
              </span>
            </div>
          );

          const fromMe = item.fromMe;
          return (
            <div key={item.id || i} className={`flex ${fromMe ? 'justify-end' : 'justify-start'} group`}>
              <div
                className={`relative max-w-[65%] px-3 pt-1.5 pb-1 rounded-lg shadow-sm ${
                  fromMe
                    ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-800 dark:text-slate-100 rounded-tr-none'
                    : 'bg-white dark:bg-[#202c33] text-slate-800 dark:text-slate-100 rounded-tl-none'
                }`}
              >
                {/* Bubble tail */}
                {fromMe ? (
                  <div className="absolute -right-[8px] top-0 w-0 h-0 border-l-[8px] border-l-[#d9fdd3] dark:border-l-[#005c4b] border-b-[8px] border-b-transparent" />
                ) : (
                  <div className="absolute -left-[8px] top-0 w-0 h-0 border-r-[8px] border-r-white dark:border-r-[#202c33] border-b-[8px] border-b-transparent" />
                )}

                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{item.text}</p>
                <div className={`flex items-center gap-1 mt-0.5 ${fromMe ? 'justify-end' : 'justify-end'}`}>
                  <span className="text-[10px] text-slate-400 dark:text-slate-400">{formatTime(item.timestamp)}</span>
                  {fromMe && <StatusTick status={item.status} />}
                </div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="flex justify-center mt-8">
            <span className="bg-white/80 dark:bg-[#182229]/80 text-slate-500 dark:text-slate-400 text-xs px-4 py-2 rounded-full shadow-sm">
              Nenhuma mensagem ainda — diga olá! 👋
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="flex items-end gap-2 px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-slate-200/50 dark:border-slate-700/30 flex-shrink-0">
        <button
          onClick={() => setShowEmojiHint(!showEmojiHint)}
          className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 flex-shrink-0 mb-0.5 transition-colors"
        >
          <span className="material-icons-outlined text-2xl">sentiment_satisfied_alt</span>
        </button>

        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-3xl px-4 py-2.5 flex items-end gap-2 shadow-sm">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
            onKeyDown={onKey}
            placeholder={status !== 'connected' ? 'Conecte o WhatsApp para enviar mensagens' : 'Digite uma mensagem'}
            disabled={status !== 'connected'}
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none resize-none leading-relaxed"
            style={{ minHeight: '24px', maxHeight: '120px' }}
          />
          <button className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0 mb-0.5 transition-colors">
            <span className="material-icons-outlined text-xl">attach_file</span>
          </button>
        </div>

        <button
          onClick={send}
          disabled={status !== 'connected'}
          className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all shadow-sm ${
            input.trim() && status === 'connected'
              ? 'bg-primary hover:bg-primary-dark scale-100'
              : 'bg-primary hover:bg-primary-dark opacity-80'
          }`}
        >
          <span className="material-icons-outlined text-white text-xl">
            {input.trim() ? 'send' : 'mic'}
          </span>
        </button>
      </div>

      {/* Profile panel */}
      {showProfile && (
        <ContactProfile conv={conv} onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
}
