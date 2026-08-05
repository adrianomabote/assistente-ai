export default function ContactProfile({ conv, onClose }) {
  const name = conv.name || conv.phone;
  const phone = conv.phone;

  const colors = ['bg-rose-400','bg-pink-500','bg-purple-500','bg-indigo-500','bg-blue-500','bg-teal-500','bg-emerald-500','bg-orange-400','bg-amber-500'];
  const color = colors[(name || '').charCodeAt(0) % colors.length];

  return (
    <div className="absolute inset-0 z-20 flex">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20 dark:bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-[#111b21] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4 bg-[#f0f2f5] dark:bg-[#202c33] flex-shrink-0">
          <button onClick={onClose} className="p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors">
            <span className="material-icons-outlined">close</span>
          </button>
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">Informações do contato</h2>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Avatar & Name */}
          <div className="flex flex-col items-center py-8 bg-white dark:bg-[#111b21]">
            <div className={`w-28 h-28 ${color} rounded-full flex items-center justify-center shadow-lg mb-4`}>
              <span className="text-white font-bold text-4xl">{(name || '?').slice(0, 2).toUpperCase()}</span>
            </div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{conv.isGroup ? 'Grupo' : 'Contato'}</p>
          </div>

          {/* Info cards */}
          <div className="px-4 space-y-3 pb-6">
            {/* Phone */}
            <div className="bg-white dark:bg-[#202c33] rounded-xl px-4 py-3 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="material-icons-outlined text-primary text-2xl mt-0.5">phone</span>
                <div className="flex-1">
                  <p className="text-sm text-slate-800 dark:text-slate-100 font-medium">+{phone}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Celular</p>
                </div>
                <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-primary transition-colors">
                  <span className="material-icons-outlined text-lg">chat</span>
                </a>
              </div>
            </div>

            {/* WhatsApp ID */}
            <div className="bg-white dark:bg-[#202c33] rounded-xl px-4 py-3 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="material-icons-outlined text-primary text-2xl mt-0.5">badge</span>
                <div className="flex-1">
                  <p className="text-sm text-slate-800 dark:text-slate-100 font-medium break-all">{conv.jid}</p>
                  <p className="text-xs text-slate-400 mt-0.5">ID WhatsApp</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white dark:bg-[#202c33] rounded-xl px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Conversa</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{conv.messages?.length || 0}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Mensagens</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">
                    {conv.messages?.filter(m => !m.fromMe).length || 0}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Recebidas</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white dark:bg-[#202c33] rounded-xl overflow-hidden shadow-sm">
              <button className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <span className="material-icons-outlined text-slate-400">notifications_off</span>
                <span className="text-sm text-slate-700 dark:text-slate-200">Silenciar notificações</span>
              </button>
              <div className="border-t border-slate-100 dark:border-slate-700/50" />
              <button className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <span className="material-icons-outlined text-slate-400">block</span>
                <span className="text-sm text-slate-700 dark:text-slate-200">Bloquear contato</span>
              </button>
              <div className="border-t border-slate-100 dark:border-slate-700/50" />
              <button className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors">
                <span className="material-icons-outlined text-red-400">delete</span>
                <span className="text-sm text-red-500">Apagar conversa</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
