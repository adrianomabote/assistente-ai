import { useState } from 'react';

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

const FILTERS = [
  { id: 'all',      label: 'Todas' },
  { id: 'unread',   label: 'Não lidas' },
  { id: 'groups',   label: 'Grupos' },
  { id: 'archived', label: 'Arquivadas' },
];

export default function ConversationList({
  conversations, allConversations = [], activeJid, onSelect,
  search, setSearch, filter, setFilter,
  onDeleteConvs, onArchiveConvs, onMarkReadConvs, onMarkAllRead,
}) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const unreadCount   = allConversations.filter(c => !c.archived && c.unread > 0).length;
  const groupCount    = allConversations.filter(c => !c.archived && c.isGroup).length;
  const archivedCount = allConversations.filter(c => c.archived).length;
  const counts = { all: null, unread: unreadCount || null, groups: groupCount || null, archived: archivedCount || null };

  const toggleSelect = (jid) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(jid) ? next.delete(jid) : next.add(jid);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === conversations.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(conversations.map(c => c.jid)));
    }
  };

  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); };

  const handleDelete = () => {
    if (selected.size === 0) return;
    if (window.confirm(`Eliminar ${selected.size} conversa(s)? Esta ação não pode ser revertida.`)) {
      onDeleteConvs([...selected]);
      exitSelect();
    }
  };

  const handleArchive = () => {
    if (selected.size === 0) return;
    const archiving = filter !== 'archived';
    onArchiveConvs([...selected], archiving);
    exitSelect();
  };

  const handleMarkRead = () => {
    if (selected.size === 0) return;
    onMarkReadConvs([...selected]);
    exitSelect();
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white dark:bg-[#111b21]">

      {/* Search bar */}
      {!selectMode && (
        <div className="px-3 pt-2 pb-1 bg-white dark:bg-[#111b21]">
          <div className="flex items-center gap-2 bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg px-3 py-2">
            <span className="material-icons-outlined text-slate-400 text-lg">search</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar conversas"
              className="bg-transparent flex-1 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none"
            />
            {search
              ? <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 transition-colors"><span className="material-icons-outlined text-lg">close</span></button>
              : <button onClick={() => setSelectMode(true)} title="Selecionar conversas" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><span className="material-icons-outlined text-lg">checklist</span></button>
            }
          </div>
        </div>
      )}

      {/* Selection action bar */}
      {selectMode && (
        <div className="flex items-center gap-1 px-2 py-2 bg-white dark:bg-[#111b21] border-b border-slate-100 dark:border-slate-700/40">
          <button onClick={exitSelect} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#202c33] text-slate-500 transition-colors">
            <span className="material-icons-outlined text-xl">close</span>
          </button>
          <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200 pl-1">
            {selected.size > 0 ? `${selected.size} selecionada${selected.size > 1 ? 's' : ''}` : 'Selecionar'}
          </span>
          <button onClick={toggleAll} title={selected.size === conversations.length ? 'Desselecionar todas' : 'Selecionar todas'}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#202c33] text-slate-500 transition-colors">
            <span className="material-icons-outlined text-xl">{selected.size === conversations.length ? 'deselect' : 'select_all'}</span>
          </button>
          {selected.size > 0 && <>
            <button onClick={handleMarkRead} title="Marcar como lida"
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#202c33] text-slate-500 transition-colors">
              <span className="material-icons-outlined text-xl">mark_chat_read</span>
            </button>
            <button onClick={handleArchive} title={filter === 'archived' ? 'Desarquivar' : 'Arquivar'}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-[#202c33] text-slate-500 transition-colors">
              <span className="material-icons-outlined text-xl">{filter === 'archived' ? 'unarchive' : 'archive'}</span>
            </button>
            <button onClick={handleDelete} title="Eliminar"
              className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors">
              <span className="material-icons-outlined text-xl">delete</span>
            </button>
          </>}
        </div>
      )}

      {/* Filter tabs */}
      {!selectMode && (
        <div className="flex gap-1.5 px-3 py-2 bg-white dark:bg-[#111b21] border-b border-slate-100 dark:border-slate-700/40 overflow-x-auto no-scrollbar">
          {FILTERS.map(f => {
            const active = filter === f.id;
            const count = counts[f.id];
            return (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  active ? 'bg-primary text-white shadow-sm' : 'bg-[#f0f2f5] dark:bg-[#202c33] text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#2a3942]'
                }`}
              >
                {f.label}
                {count != null && (
                  <span className={`text-[10px] font-semibold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 ${
                    active ? 'bg-white/30 text-white' : 'bg-primary text-white'
                  }`}>{count > 99 ? '99+' : count}</span>
                )}
              </button>
            );
          })}
          {/* Mark all read shortcut */}
          <button onClick={onMarkAllRead} title="Marcar todas como lidas"
            className="flex-shrink-0 ml-auto flex items-center gap-1 px-2 py-1 rounded-full text-xs text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors">
            <span className="material-icons-outlined text-base">done_all</span>
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
            <span className="material-icons-outlined text-4xl">{filter === 'archived' ? 'archive' : 'forum'}</span>
            <div className="text-center">
              <p className="text-sm font-medium">
                {filter === 'archived' ? 'Nenhuma conversa arquivada' : 'Nenhuma conversa'}
              </p>
              <p className="text-xs mt-1">
                {filter === 'archived' ? 'Arquive conversas para as ver aqui' : 'Conecte o WhatsApp para ver as mensagens'}
              </p>
            </div>
          </div>
        )}

        {conversations.map(conv => {
          const name = conv.name || conv.phone;
          const active = activeJid === conv.jid;
          const isSelected = selected.has(conv.jid);

          return (
            <div
              key={conv.jid}
              onClick={() => selectMode ? toggleSelect(conv.jid) : onSelect(conv.jid)}
              className={`w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100/80 dark:border-slate-700/30 transition-colors cursor-pointer ${
                isSelected ? 'bg-primary/10 dark:bg-primary/20' :
                active ? 'bg-[#f0f2f5] dark:bg-[#2a3942]' :
                'hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'
              }`}
            >
              {selectMode ? (
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSelected ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {isSelected && <span className="material-icons-outlined text-white text-sm">check</span>}
                </div>
              ) : (
                <Avatar name={name} />
              )}

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
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {conv.archived && (
                      <span className="material-icons-outlined text-slate-400 text-sm">archive</span>
                    )}
                    {conv.unread > 0 && (
                      <span className="bg-primary text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {conv.unread > 99 ? '99+' : conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
