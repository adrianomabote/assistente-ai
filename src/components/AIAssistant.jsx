import { useState, useEffect, useRef } from 'react';

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 shadow-sm">
          <span className="material-icons-outlined text-white text-base">auto_awesome</span>
        </div>
      )}
      <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
        isUser
          ? 'bg-primary text-white rounded-tr-none'
          : 'bg-white dark:bg-[#202c33] text-slate-800 dark:text-slate-100 rounded-tl-none'
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  'Dá-me um resumo de hoje',
  'Quantas conversas não lidas tenho?',
  'Quais os clientes mais activos?',
  'Mostra-me o relatório da semana',
  'Quais as mensagens mais recentes?',
  'Há algum cliente sem resposta?',
];

export default function AIAssistant({ onBack }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Olá! 👋 Sou o assistente do ZapCRM. Posso ajudar-te a analisar as tuas conversas, criar relatórios, identificar clientes sem resposta, resumir interações e muito mais.\n\nO que queres saber?',
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasToken, setHasToken] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      setHasToken(!!s.aiToken);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: q };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Send prior conversation history so the AI has multi-turn memory
      const history = messages.filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0);
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Erro: ${e.message}. Verifica o teu token OpenAI nas Definições.`,
      }]);
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-full bg-chat-light dark:bg-chat-dark">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-700/50 flex-shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden p-1.5 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors flex-shrink-0"
          >
            <span className="material-icons-outlined text-xl">arrow_back</span>
          </button>
        )}
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-sm">
          <span className="material-icons-outlined text-white text-lg">smart_toy</span>
        </div>
        <div>
          <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 leading-none">Assistente</p>
          <p className="text-xs text-slate-400 mt-0.5">Análise e relatórios das tuas conversas</p>
        </div>
        <button
          onClick={() => setMessages([{
            role: 'assistant',
            content: 'Olá! 👋 Sou o assistente do ZapCRM. O que queres saber?',
          }])}
          title="Limpar conversa"
          className="ml-auto p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 transition-colors"
        >
          <span className="material-icons-outlined text-xl">refresh</span>
        </button>
      </div>

      {!hasToken && (
        <div className="mx-4 mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-start gap-2">
          <span className="material-icons-outlined text-amber-500 text-lg flex-shrink-0">warning</span>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Adiciona o teu <strong>Token OpenAI</strong> nas Definições → IA para usar o assistente.
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}

        {/* Suggestions — show after first AI message only */}
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 mt-2 mb-2">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)}
                className="px-3 py-1.5 rounded-full bg-white dark:bg-[#202c33] border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:border-primary hover:text-primary transition-colors shadow-sm">
                {s}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-start gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mr-2 shadow-sm">
              <span className="material-icons-outlined text-white text-base">auto_awesome</span>
            </div>
            <div className="bg-white dark:bg-[#202c33] px-4 py-3 rounded-2xl rounded-tl-none shadow-sm">
              <div className="flex gap-1 items-center h-5">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-slate-200/50 dark:border-slate-700/30 flex-shrink-0">
        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-3xl px-4 py-2.5 flex items-end gap-2 shadow-sm">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
            onKeyDown={onKey}
            placeholder="Pergunta sobre as tuas conversas..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none resize-none leading-relaxed"
            style={{ minHeight: '24px', maxHeight: '120px' }}
          />
        </div>
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="w-11 h-11 rounded-full bg-primary hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center flex-shrink-0 transition-all shadow-sm"
        >
          <span className="material-icons-outlined text-white text-xl">send</span>
        </button>
      </div>
    </div>
  );
}
