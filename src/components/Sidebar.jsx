export default function Sidebar({ status, dark, setDark, page, setPage, onConnectClick }) {
  const dot = status === 'connected' ? 'bg-green-400' : status === 'qr' ? 'bg-yellow-400 animate-pulse' : 'bg-slate-400';
  const label = status === 'connected' ? 'Conectado' : status === 'qr' ? 'Aguardando QR' : 'Desconectado';

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-slate-200/80 dark:border-slate-700/50 flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-sm">
            <span className="material-icons-outlined text-white text-xl">smart_toy</span>
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#202c33] ${dot}`} />
        </div>
        <div>
          <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 leading-none">WhatsApp CRM</p>
          <p className="text-xs text-slate-400 mt-0.5">{label}</p>
        </div>
      </div>

      <div className="flex items-center">
        {status !== 'connected' && (
          <button onClick={onConnectClick} title="Conectar WhatsApp"
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors">
            <span className="material-icons-outlined text-xl">qr_code_scanner</span>
          </button>
        )}
        <button onClick={() => setPage(page === 'settings' ? 'chats' : 'settings')} title={page === 'settings' ? 'Conversas' : 'Configurações'}
          className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors">
          <span className="material-icons-outlined text-xl">{page === 'settings' ? 'forum' : 'settings'}</span>
        </button>
        <button onClick={() => setDark(!dark)} title="Alternar tema"
          className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors">
          <span className="material-icons-outlined text-xl">{dark ? 'light_mode' : 'dark_mode'}</span>
        </button>
      </div>
    </div>
  );
}
