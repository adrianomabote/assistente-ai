function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function Avatar({ name }) {
  const initials = (name || '?').slice(0, 2).toUpperCase();
  const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
  const color = colors[(name || '').charCodeAt(0) % colors.length];
  return (
    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${color}`}>
      {initials}
    </div>
  );
}

export default function ConversationList({ conversations, activeJid, onSelect, search, setSearch }) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-sidebar-light dark:bg-sidebar-dark">
      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2">
          <span className="material-icons-outlined text-slate-400 text-lg">search</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pesquisar conversa..."
            className="bg-transparent flex-1 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <span className="material-icons-outlined text-slate-400 text-lg">close</span>
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm gap-2">
            <span className="material-icons-outlined text-3xl">forum</span>
            <span>Nenhuma conversa ainda</span>
          </div>
        )}
        {conversations.map(conv => (
          <button
            key={conv.jid}
            onClick={() => onSelect(conv.jid)}
            className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left ${activeJid === conv.jid ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
          >
            <Avatar name={conv.name || conv.phone} />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline">
                <span className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{conv.name || conv.phone}</span>
                <span className="text-xs text-slate-400 flex-shrink-0 ml-1">{formatTime(conv.lastTimestamp)}</span>
              </div>
              <div className="flex justify-between items-center mt-0.5">
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{conv.lastMessage}</span>
                {conv.unread > 0 && (
                  <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ml-1 font-medium">
                    {conv.unread > 9 ? '9+' : conv.unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
