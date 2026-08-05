function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function Avatar({ name }) {
  const colors = ['bg-rose-400','bg-pink-500','bg-purple-500','bg-indigo-500','bg-blue-500','bg-teal-500','bg-emerald-500','bg-orange-400','bg-amber-500'];
  const color = colors[(name || '').charCodeAt(0) % colors.length];
  return (
    <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 shadow-sm`}>
      {(name || '?').slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function ConversationList({ conversations, activeJid, onSelect, search, setSearch }) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white dark:bg-[#111b21]">
      {/* Search bar */}
      <div className="px-3 py-2 bg-white dark:bg-[#111b21]">
        <div className="flex items-center gap-2 bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg px-3 py-2">
          <span className="material-icons-outlined text-slate-400 text-lg">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar ou começar nova conversa"
            className="bg-transparent flex-1 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 transition-colors">
              <span className="material-icons-outlined text-lg">close</span>
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
            <span className="material-icons-outlined text-4xl">forum</span>
            <div className="text-center">
              <p className="text-sm font-medium">Nenhuma conversa</p>
              <p className="text-xs mt-1">Conecte o WhatsApp para ver as mensagens</p>
            </div>
          </div>
        )}
        {conversations.map(conv => {
          const name = conv.name || conv.phone;
          const active = activeJid === conv.jid;
          return (
            <button
              key={conv.jid}
              onClick={() => onSelect(conv.jid)}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100/80 dark:border-slate-700/30 transition-colors text-left ${
                active
                  ? 'bg-[#f0f2f5] dark:bg-[#2a3942]'
                  : 'hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'
              }`}
            >
              <Avatar name={name} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline gap-1">
                  <span className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{name}</span>
                  <span className={`text-[11px] flex-shrink-0 ${conv.unread > 0 ? 'text-primary font-medium' : 'text-slate-400'}`}>
                    {formatTime(conv.lastTimestamp)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-0.5 gap-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                    {conv.lastMessage || 'Nenhuma mensagem'}
                  </span>
                  {conv.unread > 0 && (
                    <span className="bg-primary text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">
                      {conv.unread > 99 ? '99+' : conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
