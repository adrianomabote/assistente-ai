import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'zapcrm_ai_messages';
const INITIAL_MSG = {
  role: 'assistant',
  content: 'Olá chefe! 👋 Sou o assistente do ZapCRM. Podes escrever ou iniciar uma chamada de voz comigo.\n\nO que queres saber?',
};

function loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [INITIAL_MSG];
}

function saveMessages(msgs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs)); } catch {}
}

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

// ── Wave bars component ──────────────────────────────────────────────────────
const BAR_HEIGHTS = [14, 26, 38, 22, 44, 18, 34, 28, 16];

// active=true only when user is actually speaking or AI is speaking
function WaveBars({ active, color = 'bg-slate-600' }) {
  return (
    <div className="flex items-center gap-1.5 h-12">
      {BAR_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-full ${color}`}
          style={{
            height: active ? `${h}px` : '6px',
            animation: active
              ? `wave ${0.45 + i * 0.07}s ease-in-out infinite alternate`
              : 'none',
            animationDelay: `${i * 0.06}s`,
            transition: 'height 0.25s ease, background-color 0.3s',
          }}
        />
      ))}
      <style>{`@keyframes wave{0%{transform:scaleY(0.3)}50%{transform:scaleY(1.0)}100%{transform:scaleY(1.7)}}`}</style>
    </div>
  );
}

// ── Voice Call Overlay ──────────────────────────────────────────────────────
function VoiceCall({ messages, hasToken, onEnd }) {
  const [callState, setCallState] = useState('greeting');
  const [transcript, setTranscript] = useState('');
  const [agentText, setAgentText] = useState('A iniciar chamada…');
  // true only when interim speech results are arriving (user actually speaking)
  const [voiceDetected, setVoiceDetected] = useState(false);

  const callStateRef   = useRef('greeting');
  const callMsgsRef    = useRef([...messages]);
  const activeRef      = useRef(true);
  const recognitionRef = useRef(null);
  const synthRef       = useRef(window.speechSynthesis);
  const voiceTimerRef  = useRef(null);

  const setState = (s) => { callStateRef.current = s; setCallState(s); };

  // ── Speak text then call onDone ─────────────────────────────────────────
  const speak = useCallback((text, onDone) => {
    synthRef.current.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'pt-BR';
    utter.rate = 1.05;

    const applyVoice = () => {
      const voices = synthRef.current.getVoices();
      const pt = voices.find(v => v.lang.startsWith('pt'));
      if (pt) utter.voice = pt;
    };
    applyVoice();
    if (!synthRef.current.getVoices().length) {
      window.speechSynthesis.addEventListener('voiceschanged', applyVoice, { once: true });
    }

    utter.onend   = () => { if (activeRef.current) onDone?.(); };
    utter.onerror = (e) => {
      // 'interrupted' is normal when we cancel — just call onDone
      if (activeRef.current) onDone?.();
    };
    setState('speaking');
    setAgentText(text);
    synthRef.current.speak(utter);

    // iOS Safari sometimes stalls speech synthesis — nudge it
    const nudge = setTimeout(() => {
      if (synthRef.current.speaking) synthRef.current.resume();
    }, 200);
    utter.onend = () => { clearTimeout(nudge); if (activeRef.current) onDone?.(); };
    utter.onerror = () => { clearTimeout(nudge); if (activeRef.current) onDone?.(); };
  }, []);

  // ── Start listening ─────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!activeRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setState('error');
      setAgentText('O teu browser não suporta reconhecimento de voz. Usa Chrome.');
      return;
    }
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.continuous = false;
    recognitionRef.current = rec;
    setState('listening');
    setTranscript('');

    rec.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setTranscript(final || interim);

      // Show wave animation only while voice is actively coming in
      setVoiceDetected(true);
      clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = setTimeout(() => setVoiceDetected(false), 600);

      if (final.trim()) {
        rec.abort();
        const q = final.trim();
        setTranscript('');
        setVoiceDetected(false);
        callMsgsRef.current = [...callMsgsRef.current, { role: 'user', content: q }];
        askAI(q);
      }
    };

    rec.onerror = (e) => {
      if (!activeRef.current) return;
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      setState('error');
      setAgentText(`Erro de microfone: ${e.error}. Tenta novamente.`);
    };

    rec.onend = () => {
      if (!activeRef.current) return;
      if (callStateRef.current === 'listening') {
        setTimeout(() => {
          if (activeRef.current && callStateRef.current === 'listening') startListening();
        }, 300);
      }
    };

    try { rec.start(); } catch { /* already started */ }
  }, []); // eslint-disable-line

  // ── Call AI endpoint ────────────────────────────────────────────────────
  const askAI = useCallback(async (q) => {
    setState('thinking');
    setAgentText('A pensar…');
    try {
      const history = callMsgsRef.current.slice(0, -1);
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const reply = data.reply;
      callMsgsRef.current = [...callMsgsRef.current, { role: 'assistant', content: reply }];
      speak(reply, () => { if (activeRef.current) startListening(); });
    } catch (e) {
      const errMsg =
        e.message.includes('Token') || e.message.includes('401') || e.message.includes('não configurado')
          ? 'Token OpenAI não configurado. Vai às Definições e adiciona a tua API Key.'
          : `Ocorreu um erro: ${e.message}`;
      setState('error');
      setAgentText(errMsg);
      speak(errMsg, () => { if (activeRef.current) startListening(); });
    }
  }, [speak, startListening]);

  // ── Greet on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasToken) {
      setState('error');
      const msg = 'Token OpenAI não configurado. Vai às Definições e adiciona a tua API Key.';
      setAgentText(msg);
      speak(msg, () => {});
      return;
    }
    const greeting = 'Olá chefe! Pode falar, estou a ouvir.';
    speak(greeting, () => { if (activeRef.current) startListening(); });
    return () => {
      activeRef.current = false;
      recognitionRef.current?.abort();
      synthRef.current.cancel();
    };
  }, []); // eslint-disable-line

  const handleEnd = () => {
    activeRef.current = false;
    recognitionRef.current?.abort();
    synthRef.current.cancel();
    clearTimeout(voiceTimerRef.current);
    onEnd(callMsgsRef.current);
  };

  const stateLabel = {
    greeting:  'A iniciar…',
    listening: 'A ouvir…',
    thinking:  'A pensar…',
    speaking:  'A falar…',
    error:     'Erro',
  }[callState] || '';

  const stateColor = {
    greeting:  'text-slate-400',
    listening: 'text-green-400',
    thinking:  'text-amber-400',
    speaking:  'text-blue-400',
    error:     'text-red-400',
  }[callState];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0f14]/96 backdrop-blur-sm px-4">
      {/* Avatar */}
      <div className="relative mb-6">
        <div className={`w-28 h-28 rounded-full bg-primary flex items-center justify-center shadow-2xl ${
          callState === 'listening' ? 'ring-4 ring-green-400/50 animate-pulse' :
          callState === 'speaking'  ? 'ring-4 ring-blue-400/50 animate-pulse' : ''
        }`}>
          <span className="material-icons-outlined text-white" style={{ fontSize: 56 }}>support_agent</span>
        </div>
        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-lg ${
          callState === 'listening' ? 'bg-green-500' :
          callState === 'thinking'  ? 'bg-amber-500' :
          callState === 'speaking'  ? 'bg-blue-500'  :
          callState === 'error'     ? 'bg-red-500'   : 'bg-slate-500'
        }`}>
          <span className="material-icons-outlined" style={{ fontSize: 14 }}>
            {callState === 'listening' ? 'mic' :
             callState === 'thinking'  ? 'hourglass_empty' :
             callState === 'speaking'  ? 'volume_up' : 'priority_high'}
          </span>
        </div>
      </div>

      <p className="text-white text-xl font-semibold mb-1">Assistente ZapCRM</p>
      <p className={`text-sm font-medium mb-6 ${stateColor}`}>{stateLabel}</p>

      {/* Live text */}
      <div className="w-full max-w-sm mb-8 text-center min-h-[64px] flex items-center justify-center">
        {callState === 'listening' && transcript ? (
          <p className="text-slate-300 text-sm italic">"{transcript}"</p>
        ) : callState === 'listening' ? (
          <p className="text-slate-500 text-sm">Fala agora…</p>
        ) : (
          <p className="text-slate-200 text-sm leading-relaxed line-clamp-4">{agentText}</p>
        )}
      </div>

      {/* Animated wave bars — active only when AI speaks or voice detected */}
      <div className="mb-10">
        <WaveBars
          active={callState === 'speaking' || (callState === 'listening' && voiceDetected)}
          color={callState === 'speaking' ? 'bg-blue-400' : voiceDetected ? 'bg-green-400' : 'bg-slate-600'}
        />
      </div>

      {/* End call */}
      <button onClick={handleEnd}
        className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl transition-all active:scale-95">
        <span className="material-icons-outlined text-white" style={{ fontSize: 32 }}>call_end</span>
      </button>
      <p className="text-slate-500 text-xs mt-3">Terminar chamada</p>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function AIAssistant({ onBack }) {
  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const messagesRef = useRef(null);
  const inputRef    = useRef(null);

  // Load token status
  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      setHasToken(!!s.aiToken);
    }).catch(() => {});
  }, []);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // Scroll to bottom — use scrollTop directly so only the messages div scrolls,
  // never the browser window (which would hide the header).
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');
    const userMsg = { role: 'user', content: q };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);
    try {
      // Send full history for memory continuity
      const history = newMessages.slice(0, -1);
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
        content: `❌ ${e.message}\n\nVerifica o teu token OpenAI nas Definições.`,
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

  const clearMessages = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    const fresh = [INITIAL_MSG];
    setMessages(fresh);
    saveMessages(fresh);
    setConfirmClear(false);
  };

  return (
    <div className="flex flex-col h-full bg-chat-light dark:bg-chat-dark">
      {inCall && <VoiceCall messages={messages} hasToken={hasToken} onEnd={handleCallEnd} />}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200 dark:border-slate-700/50 flex-shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            className="md:hidden p-1.5 -ml-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors flex-shrink-0"
          >
            <span className="material-icons-outlined text-xl">arrow_back</span>
          </button>
        )}
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-sm flex-shrink-0">
          <span className="material-icons-outlined text-white text-lg">support_agent</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 leading-none">Assistente</p>
          <p className="text-xs text-slate-400 mt-0.5 truncate">Análise e relatórios das tuas conversas</p>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={() => setInCall(true)}
            title="Chamada de voz"
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-primary transition-colors"
          >
            <span className="material-icons-outlined text-xl">call</span>
          </button>
          <button
            onClick={clearMessages}
            title={confirmClear ? 'Confirmar limpeza' : 'Limpar conversa'}
            className={`p-2 rounded-full transition-colors ${
              confirmClear
                ? 'text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40'
                : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-400'
            }`}
          >
            <span className="material-icons-outlined text-xl">
              {confirmClear ? 'warning' : 'refresh'}
            </span>
          </button>
        </div>
      </div>

      {/* Token warning */}
      {!hasToken && (
        <div className="mx-4 mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-start gap-2">
          <span className="material-icons-outlined text-amber-500 text-lg flex-shrink-0">warning</span>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Adiciona o teu <strong>Token OpenAI</strong> nas Definições → IA para usar o assistente.
          </p>
        </div>
      )}

      {/* Confirm clear banner */}
      {confirmClear && (
        <div className="mx-4 mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-2">
          <span className="material-icons-outlined text-red-500 text-lg flex-shrink-0">delete_forever</span>
          <p className="text-xs text-red-600 dark:text-red-400 flex-1">
            Clica novamente em <strong>limpar</strong> para apagar o histórico.
          </p>
        </div>
      )}

      {/* Messages — ref used for scrollTop, never scrollIntoView */}
      <div ref={messagesRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 min-h-0">
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
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2 px-3 py-3 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-slate-200/50 dark:border-slate-700/30 flex-shrink-0">
        <button
          onClick={() => setInCall(true)}
          title="Chamada de voz"
          className="w-11 h-11 rounded-full bg-primary hover:bg-primary-dark flex items-center justify-center flex-shrink-0 shadow-sm transition-all active:scale-95"
        >
          <span className="material-icons-outlined text-white text-xl">call</span>
        </button>
        <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-3xl px-4 py-2.5 flex items-end gap-2 shadow-sm">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
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
          className="w-11 h-11 rounded-full bg-primary hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center flex-shrink-0 transition-all shadow-sm active:scale-95"
        >
          <span className="material-icons-outlined text-white text-xl">send</span>
        </button>
      </div>
    </div>
  );
}
