import { useState } from 'react';

const PASSWORD = '00220022aA1';

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-10 h-10" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.47 6.53A7.07 7.07 0 0 0 12 4.5a7.12 7.12 0 0 0-6.16 10.67L4.5 19.5l4.45-1.17A7.12 7.12 0 0 0 19.5 12a7.07 7.07 0 0 0-2.03-5.47zm-5.47 10.95a5.9 5.9 0 0 1-3.01-.82l-.22-.13-2.24.59.6-2.19-.14-.23a5.93 5.93 0 1 1 5 2.78zm3.26-4.44c-.18-.09-1.06-.52-1.22-.58-.17-.06-.29-.09-.41.09-.12.18-.47.58-.57.7-.1.12-.21.13-.39.04a4.87 4.87 0 0 1-1.43-.88 5.35 5.35 0 0 1-.99-1.23c-.1-.18-.01-.28.08-.37.08-.08.18-.21.27-.32.09-.1.12-.18.18-.3.06-.12.03-.22-.01-.31-.05-.09-.41-1-.56-1.37-.15-.36-.3-.31-.41-.32h-.35c-.12 0-.31.04-.47.22-.16.18-.63.62-.63 1.5s.65 1.74.74 1.86c.09.12 1.27 1.95 3.09 2.73.43.19.77.3 1.03.38.43.14.83.12 1.14.07.35-.05 1.06-.43 1.21-.85.15-.42.15-.78.1-.85-.04-.08-.16-.12-.34-.21z"/>
  </svg>
);

export default function LoginScreen({ onAuth }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);

  const submit = () => {
    if (pw === PASSWORD) {
      sessionStorage.setItem('zapcrm_auth', '1');
      onAuth();
    } else {
      setError(true);
      setPw('');
      setTimeout(() => setError(false), 2000);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter') submit();
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#f0f2f5] dark:bg-[#111b21]">
      <div className="bg-white dark:bg-[#202c33] rounded-2xl shadow-2xl p-10 w-full max-w-sm flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-lg">
          <WhatsAppIcon />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">ZapCRM</h1>
          <p className="text-sm text-slate-400 mt-1">Introduza a sua senha para continuar</p>
        </div>

        {/* Input */}
        <div className="w-full space-y-3">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={onKey}
              placeholder="Senha"
              autoFocus
              className={`w-full px-4 py-3 pr-11 rounded-xl border text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-[#2a3942] text-sm outline-none transition-all ${
                error
                  ? 'border-red-400 ring-2 ring-red-200 dark:ring-red-800 animate-shake'
                  : 'border-slate-200 dark:border-slate-600 focus:ring-2 focus:ring-primary/40 focus:border-primary'
              }`}
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <span className="material-icons-outlined text-xl">{show ? 'visibility_off' : 'visibility'}</span>
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-500 text-center font-medium">Senha incorreta. Tente novamente.</p>
          )}
          <button
            onClick={submit}
            className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl transition-colors shadow-sm"
          >
            Entrar
          </button>
        </div>
      </div>
    </div>
  );
}
