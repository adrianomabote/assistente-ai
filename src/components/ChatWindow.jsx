import { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../socket';

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function Avatar({ name }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
  const color = colors[(name || '').charCodeAt(0) % colors.length];
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 text-sm ${color}`}>
      {initials}
    </div>
  );
}

function StatusIcon({ status }) {
  if (status >= 3) return <span className="material-icons-outlined text-blue-400 text-xs">done_all</span>;
  if (status >= 2) return <span className="material-icons-outlined text-slate-400 text-xs">done_all</span>;
  return <span className="material-icons-outlined text-slate-400 text-xs">done</span>;
}

export default function ChatWindow({ conv, status }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetch(`/api/conversations/${encodeURIComponent(conv.jid)}/messages`)
      .then(r => r.json()).then(setMessages).catch(() => {});
  }, [conv.jid]);

  useEffect(() => {
    const handler = ({ jid, message }) => {
      if (jid === conv.jid) {
        setMessages(prev => {
          if (prev.find(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
    };
    socket.on('message', handler);
    return () => socket.off('message', handler);
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
      if (data.message) {
        setMessages(prev => {
          if (prev.find(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    } catch {}
    setSending(false);
    inputRef.current?.focus();
  }, [input, sending, status, conv.jid]);

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  // Group messages by date
  const grouped = [];
  let lastDate = null;
  for (const msg of messages) {
    const d = new Date((msg.timestamp || 0) * 1000).toDateString();
    if (d !== lastDate) {
      grouped.push({ type: 'date', date: d, ts: msg.timestamp });
      lastDate = d;
    }
    grouped.push({ type: 'msg', ...msg });
  }

  function formatDate(ts) {
    const d = new Date((ts || 0) * 1000);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Hoje';
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-sidebar-light dark:bg-sidebar-dark border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <Avatar name={conv.name || conv.phone} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{conv.name || conv.phone}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{conv.phone}</p>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
            <span className="material-icons-outlined text-xl">search</span>
          </button>
          <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
            <span className="material-icons-outlined text-xl">more_vert</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar px-4 py-2 space-y-1"
        style={{ background: 'var(--chat-bg)' }}
      >
        <div className="flex flex-col gap-1">
          {grouped.length === 0 && (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
              Nenhuma mensagem ainda
            </div>
          )}
          {grouped.map((item, i) => {
            if (item.type === 'date') {
              return (
                <div key={`date-${i}`} className="flex justify-center my-3">
                  <span className="bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-xs px-3 py-1 rounded-full shadow-sm">
                    {formatDate(item.ts)}
                  </span>
                </div>
              );
            }
            const fromMe = item.fromMe;
            return (
              <div key={item.id || i} className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs lg:max-w-md xl:max-w-lg px-3 py-2 rounded-lg shadow-sm relative group ${
                    fromMe
                      ? 'bg-bubble-out dark:bg-bubble-out-dark text-slate-800 dark:text-slate-100 rounded-tr-none'
                      : 'bg-bubble-in dark:bg-bubble-in-dark text-slate-800 dark:text-slate-100 rounded-tl-none'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{item.text}</p>
                  <div className={`flex items-center gap-1 mt-1 ${fromMe ? 'justify-end' : 'justify-end'}`}>
                    <span className="text-xs text-slate-400">{formatTime(item.timestamp)}</span>
                    {fromMe && <StatusIcon status={item.status} />}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 bg-sidebar-light dark:bg-sidebar-dark border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex-1 flex items-center bg-slate-100 dark:bg-slate-700 rounded-full px-4 py-2 gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={status !== 'connected' ? 'Conecte o WhatsApp para enviar mensagens' : 'Digite uma mensagem...'}
            disabled={status !== 'connected'}
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none resize-none max-h-32"
            style={{ lineHeight: '1.4' }}
          />
        </div>
        <button
          onClick={send}
          disabled={!input.trim() || sending || status !== 'connected'}
          className="w-10 h-10 bg-primary hover:bg-primary-dark disabled:bg-slate-300 dark:disabled:bg-slate-600 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
        >
          <span className="material-icons-outlined text-white text-xl">send</span>
        </button>
      </div>
    </div>
  );
}
