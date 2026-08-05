import { useState, useEffect, useRef, useCallback } from 'react';

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 shadow-sm">
          <span className="material-icons-outlined text-white text-base">support_agent</span>
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

// ── Voice Call Overlay ──────────────────────────────────────────────────────
function VoiceCall({ messages, onEnd }) {
  const [callState, setCallState] = useState('listening'); // listening | thinking | speaking
  const [transcript, setTranscript] = useState('');
  const [agentText, setAgentText] = useState('');
  const [callMessages, setCallMessages] = useState(messages);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const activeRef = useRef(true);

  const speak = useCallback((text, onDone) => {
    const synth = synthRef.current;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    utter.rate = 1.05;
    utter.pitch = 1;
    // prefer a pt-BR voice if available
    const voices = synth.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith('pt')) || null;
    if (ptVoice) utter.voice = ptVoice;
    utter.onend = () => onDone && onDone();
    setCallState('speaking');
    synth.speak(utter);
  }, []);

  const askAI = useCallback(async (q, history) => {
    setCallState('thinking');
    setAgentText('A pensar…');
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const reply = data.reply;
      setCallMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setAgentText(reply);
      speak(reply, () => {
        if (activeRef.current) startListening();
      });
    } catch (e) {
      const err = 'Ocorreu um erro. Tenta novamente.';
      setAgentText(err);
      speak(err, () => { if (activeRef.current) startListening(); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak]);

  const startListening = useCallback(() => {
    if (!activeRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.continuous = false;
    recognitionRef.current = rec;
    setCallState('listening');
    setTranscript('');

    rec.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setTranscript(final || interim);
      if (final.trim()) {
        rec.stop();
        setCallMessages(prev => {
          const updated = [...prev, { role: 'user', content: final.trim() }];
          askAI(final.trim(), prev);
          return updated;
        });
        setTranscript('');
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech' && activeRef.current) startListening();
    };
    rec.onend = () => {
      // restart if still in listening state and call is active
      if (activeRef.current && callState === 'listening') {
        // small delay to avoid rapid restart
        setTimeout(() => { if (activeRef.current) startListening(); }, 300);
      }
    };

    try { rec.start(); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askAI]);

  useEffect(() => {
    // greet and start listening
    const greeting = 'Olá chefe! Estou a ouvir, pode falar.';
    setAgentText(greeting);
    speak(greeting, () => { if (activeRef.current) startListening(); });
    return () => {
      activeRef.current = false;
      recognitionRef.current?.stop();
      synthRef.current.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnd = () => {
    activeRef.current = false;
    recognitionRef.current?.stop();
    synthRef.current.cancel();
    onEnd(callMessages);
  };

  const stateLabel = {
    listening: 'A ouvir…',
    thinking: 'A pensar…',
    speaking: 'A falar…',
  }[callState];

  const stateColor = {
    listening: 'text-green-400',
    thinking: 'text-amber-400',
    speaking: 'text-blue-400',
  }[callState];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0f14]/95 backdrop-blur-sm">
      {/* Agent avatar */}
      <div className="relative mb-6">
        <div className={`w-28 h-28 rounded-full bg-primary flex items-center justify-center shadow-2xl ${
          callState === 'listening' ? 'ring-4 ring-primary/40 animate-pulse' :
          callState === 'speaking' ? 'ring-4 ring-blue-400/40 animate-pulse' : ''
        }`}>
          <span className="material-icons-outlined text-white" style={{ fontSize: 56 }}>support_agent</span>
        </div>
        {/* State indicator dot */}
        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-lg ${
          callState === 'listening' ? 'bg-green-500' :
          callState === 'thinking' ? 'bg-amber-500' : 'bg-blue-500'
        }`}>
          <span className="material-icons-outlined text-xs">
            {callState === 'listening' ? 'mic' : callState === 'thinking' ? 'hourglass_empty' : 'volume_up'}
          </span>
        </div>
      </div>

      <p className="text-white text-xl font-semibold mb-1">Assistente ZapCRM</p>
      <p className={`text-sm font-medium mb-6 ${stateColor}`}>{stateLabel}</p>

      {/* Live transcript / agent speech */}
      <div className="w-full max-w-sm px-6 mb-8 text-center min-h-[60px]">
        {callState === 'listening' && transcript && (
          <p className="text-slate-300 text-sm italic">"{transcript}"</p>
        )}
        {(callState === 'thinking' || callState === 'speaking') && agentText && (
          <p className="text-slate-200 text-sm leading-relaxed line-clamp-4">{agentText}</p>
        )}
      </div>

      {/* Sound waves animation */}
      <div className="flex items-center gap-1.5 mb-10 h-10">
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className={`w-1.5 rounded-full transition-all ${
              callState === 'listening' ? 'bg-green-400' :
              callState === 'speaking' ? 'bg-blue-400' : 'bg-slate-600'
            }`}
            style={{
              height: callState === 'thinking' ? '8px' :
                `${12 + Math.sin(i * 1.2) * 10 + (callState !== 'thinking' ? 8 : 0)}px`,
              animation: callState !== 'thinking' ? `wave ${0.6 + i * 0.1}s ease-in-out infinite alternate` : 'none',
            }}
          />
        ))}
      </div>

      {/* End call button */}
      <button
        onClick={handleEnd}
        className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl transition-all active:scale-95"
      >
        <span className="material-icons-outlined text-white" style={{ fontSize: 32 }}>call_end</span>
      </button>
      <p className="text-slate-500 text-xs mt-3">Terminar chamada</p>

      <style>{`
        @keyframes wave {
          from { transform: scaleY(0.6); }
          to   { transform: scaleY(1.4); }
        }
      `}</style>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function AIAssistant({ onBack, hideHeader = false }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Olá chefe! 👋 Sou o assistente do ZapCRM. Podes escrever ou iniciar uma chamada de voz comigo.\n\nO que queres saber?',
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasToken, setHasToken] = useState(true);
  const [inCall, setInCall] = useState(false);
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

  const handleCallEnd = (callMessages) => {
    setMessages(callMessages);
    setInCall(false);
  };

  return (
    <div className="flex flex-col h-full bg-chat-light dark:bg-chat-dark">
      {inCall && <VoiceCall messages={messages} onEnd={handleCallEnd} />}

      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center gap-3 px-5 py-3.5 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-700/50 flex-shrink-0">
          {onBack && (
            <button onClick={onBack} className="md:hidden p-1.5 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors flex-shrink-0">
              <span className="material-icons-outlined text-xl">arrow_back</span>
            </button>
          )}
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-sm">
            <span className="material-icons-outlined text-white text-lg">support_agent</span>
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 leading-none">Assistente</p>
            <p className="text-xs text-slate-400 mt-0.5">Análise e relatórios das tuas conversas</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setInCall(true)}
              title="Chamada de voz"
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-primary transition-colors"
            >
              <span className="material-icons-outlined text-xl">call</span>
            </button>
            <button
              onClick={() => setMessages([{ role: 'assistant', content: 'Olá chefe! 👋 O que queres saber?' }])}
              title="Limpar conversa"
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 transition-colors"
            >
              <span className="material-icons-outlined text-xl">refresh</span>
            </button>
          </div>
        </div>
      )}

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
              <span className="material-icons-outlined text-white text-base">support_agent</span>
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
        {/* Call button (mobile — also accessible here) */}
        <button
          onClick={() => setInCall(true)}
          title="Chamada de voz"
          className="w-11 h-11 rounded-full bg-primary hover:bg-primary-dark flex items-center justify-center flex-shrink-0 shadow-sm transition-all"
        >
          <span className="material-icons-outlined text-white text-xl">call</span>
        </button>
        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-3xl px-4 py-2.5 flex items-end gap-2 shadow-sm">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
            onKeyDown={onKey}
            placeholder="Escreve ou usa a chamada de voz…"
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
