export default function Sidebar({ status, dark, setDark, page, setPage, onConnectClick }) {
  const statusColor = status === 'connected' ? 'bg-green-400' : status === 'qr' ? 'bg-yellow-400' : 'bg-slate-400';
  const statusLabel = status === 'connected' ? 'Conectado' : status === 'qr' ? 'Aguardando QR' : 'Desconectado';

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-sidebar-light dark:bg-sidebar-dark border-b border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
          <span className="material-icons-outlined text-white text-xl">smart_toy</span>
        </div>
        <div>
          <p className="font-semibold text-sm text-slate-800 dark:text-slate-100 leading-none">WhatsApp CRM</p>
          <div className="flex items-center gap-1 mt-0.5">
            <div className={`w-2 h-2 rounded-full ${statusColor}`}></div>
            <span className="text-xs text-slate-500 dark:text-slate-400">{statusLabel}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {status !== 'connected' && (
          <button
            onClick={onConnectClick}
            title="Conectar WhatsApp"
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
          >
            <span className="material-icons-outlined text-xl">qr_code_scanner</span>
          </button>
        )}
        <button
          onClick={() => setPage(page === 'chats' ? 'settings' : 'chats')}
          title={page === 'settings' ? 'Conversas' : 'Configurações'}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
        >
          <span className="material-icons-outlined text-xl">{page === 'settings' ? 'chat' : 'settings'}</span>
        </button>
        <button
          onClick={() => setDark(!dark)}
          title="Alternar tema"
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
        >
          <span className="material-icons-outlined text-xl">{dark ? 'light_mode' : 'dark_mode'}</span>
        </button>
      </div>
    </div>
  );
}
