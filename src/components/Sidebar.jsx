const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.47 6.53A7.07 7.07 0 0 0 12 4.5a7.12 7.12 0 0 0-6.16 10.67L4.5 19.5l4.45-1.17A7.12 7.12 0 0 0 19.5 12a7.07 7.07 0 0 0-2.03-5.47zm-5.47 10.95a5.9 5.9 0 0 1-3.01-.82l-.22-.13-2.24.59.6-2.19-.14-.23a5.93 5.93 0 1 1 5 2.78zm3.26-4.44c-.18-.09-1.06-.52-1.22-.58-.17-.06-.29-.09-.41.09-.12.18-.47.58-.57.7-.1.12-.21.13-.39.04a4.87 4.87 0 0 1-1.43-.88 5.35 5.35 0 0 1-.99-1.23c-.1-.18-.01-.28.08-.37.08-.08.18-.21.27-.32.09-.1.12-.18.18-.3.06-.12.03-.22-.01-.31-.05-.09-.41-1-.56-1.37-.15-.36-.3-.31-.41-.32h-.35c-.12 0-.31.04-.47.22-.16.18-.63.62-.63 1.5s.65 1.74.74 1.86c.09.12 1.27 1.95 3.09 2.73.43.19.77.3 1.03.38.43.14.83.12 1.14.07.35-.05 1.06-.43 1.21-.85.15-.42.15-.78.1-.85-.04-.08-.16-.12-.34-.21z"/>
  </svg>
);

export default function Sidebar({ status, dark, setDark, page, setPage, onLogoClick }) {
  const dot = status === 'connected' ? 'bg-green-400' : status === 'qr' ? 'bg-yellow-400 animate-pulse' : 'bg-slate-400';
  const label = status === 'connected' ? 'Conectado' : status === 'qr' ? 'Aguardando QR' : 'Desconectado';

  const navBtn = (id, icon, title) => (
    <button
      key={id}
      onClick={() => setPage(page === id ? 'chats' : id)}
      title={title}
      className={`p-2 rounded-full transition-colors ${
        page === id
          ? 'bg-primary/15 text-primary dark:bg-primary/25'
          : 'hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400'
      }`}
    >
      <span className="material-icons-outlined text-xl">{icon}</span>
    </button>
  );

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200/80 dark:border-slate-700/50 flex-shrink-0">
      {/* Logo — click to go back to chats */}
      <button
        onClick={onLogoClick}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity text-left"
        title="Voltar às conversas"
      >
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-sm">
            <WhatsAppIcon />
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#202c33] ${dot}`} />
        </div>
        <div>
          <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 leading-none">ZapCRM</p>
          <p className="text-xs text-slate-400 mt-0.5">{label}</p>
        </div>
      </button>

      <div className="flex items-center gap-0.5">
        {navBtn('ai', 'smart_toy', 'Assistente')}
        {navBtn('settings', 'settings', 'Definições')}
        <button
          onClick={() => setDark(!dark)}
          title="Alternar tema"
          className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors"
        >
          <span className="material-icons-outlined text-xl">{dark ? 'light_mode' : 'dark_mode'}</span>
        </button>
      </div>
    </div>
  );
}
