import { useState, useEffect } from 'react';

const defaultKeywords = [
  { id: 1, keywords: 'preço, valor, quanto custa', reply: 'Para saber os preços, acesse nosso site ou fale com um atendente.' },
  { id: 2, keywords: 'horário, funcionamento, aberto', reply: 'Funcionamos de segunda a sexta das 8h às 18h e aos sábados das 8h às 13h.' },
  { id: 3, keywords: 'endereço, localização, onde fica', reply: 'Estamos localizados na Rua Exemplo, 123 - Centro.' },
];

export default function Settings({ status, onDisconnect, onConnect }) {
  const [settings, setSettings] = useState({
    botEnabled: false,
    botName: 'Assistente',
    botMessage: 'Olá! 👋 Obrigado por entrar em contato. Em breve um atendente irá te responder.',
    keywordsEnabled: false,
    keywords: [],
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('bot');
  const [newKw, setNewKw] = useState({ keywords: '', reply: '' });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      setSettings({ ...s, keywords: s.keywords || [] });
    }).catch(() => {});
  }, []);

  const save = async () => {
    setLoading(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setLoading(false);
  };

  const addKeyword = () => {
    if (!newKw.keywords.trim() || !newKw.reply.trim()) return;
    const id = Date.now();
    setSettings(s => ({ ...s, keywords: [...(s.keywords || []), { id, ...newKw }] }));
    setNewKw({ keywords: '', reply: '' });
  };

  const removeKeyword = (id) => {
    setSettings(s => ({ ...s, keywords: s.keywords.filter(k => k.id !== id) }));
  };

  const tabs = [
    { id: 'bot', label: 'Bot', icon: 'smart_toy' },
    { id: 'keywords', label: 'Palavras-chave', icon: 'key' },
    { id: 'connection', label: 'Conexão', icon: 'wifi' },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white dark:bg-[#111b21]">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700/50 bg-[#f0f2f5] dark:bg-[#202c33]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors border-b-2 ${
              activeTab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-icons-outlined text-lg">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* ── Bot tab ─────────────────────────────── */}
        {activeTab === 'bot' && (
          <div className="p-4 space-y-4">
            <div className="bg-white dark:bg-[#202c33] rounded-xl p-4 shadow-sm space-y-4">
              {/* Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Resposta automática</p>
                  <p className="text-xs text-slate-400 mt-0.5">Responde automaticamente novas mensagens</p>
                </div>
                <button
                  onClick={() => setSettings(s => ({ ...s, botEnabled: !s.botEnabled }))}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${settings.botEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${settings.botEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Nome do assistente</label>
                <input
                  value={settings.botName}
                  onChange={e => setSettings(s => ({ ...s, botName: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-[#2a3942] text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Ex: Suporte da Loja"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Mensagem padrão</label>
                <textarea
                  value={settings.botMessage}
                  onChange={e => setSettings(s => ({ ...s, botMessage: e.target.value }))}
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-[#2a3942] text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="Olá! Como posso ajudar você hoje?"
                />
                <p className="text-xs text-slate-400 mt-1">Enviada quando nenhuma palavra-chave for detectada.</p>
              </div>
            </div>

            <button onClick={save} disabled={loading}
              className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm">
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span className="material-icons-outlined text-lg">save</span>}
              {saved ? '✓ Configurações salvas!' : 'Salvar configurações'}
            </button>
          </div>
        )}

        {/* ── Keywords tab ─────────────────────────── */}
        {activeTab === 'keywords' && (
          <div className="p-4 space-y-4">
            {/* Toggle */}
            <div className="bg-white dark:bg-[#202c33] rounded-xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Respostas por palavra-chave</p>
                <p className="text-xs text-slate-400 mt-0.5">Responde diferente conforme o que o cliente escreve</p>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, keywordsEnabled: !s.keywordsEnabled }))}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${settings.keywordsEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${settings.keywordsEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Existing keywords */}
            {(settings.keywords || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Regras configuradas</p>
                {settings.keywords.map(kw => (
                  <div key={kw.id} className="bg-white dark:bg-[#202c33] rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1 mb-2">
                          {kw.keywords.split(',').map((k, i) => (
                            <span key={i} className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                              {k.trim()}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 italic">"{kw.reply}"</p>
                      </div>
                      <button onClick={() => removeKeyword(kw.id)}
                        className="p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                        <span className="material-icons-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add new */}
            <div className="bg-white dark:bg-[#202c33] rounded-xl p-4 shadow-sm space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nova regra</p>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Palavras-chave (separadas por vírgula)</label>
                <input
                  value={newKw.keywords}
                  onChange={e => setNewKw(n => ({ ...n, keywords: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-[#2a3942] text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="preço, valor, quanto custa"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Resposta automática</label>
                <textarea
                  value={newKw.reply}
                  onChange={e => setNewKw(n => ({ ...n, reply: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-[#2a3942] text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="Nossos preços estão disponíveis em..."
                />
              </div>
              <button onClick={addKeyword} disabled={!newKw.keywords.trim() || !newKw.reply.trim()}
                className="w-full py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors text-sm">
                <span className="material-icons-outlined text-lg">add</span>
                Adicionar regra
              </button>
            </div>

            <button onClick={save} disabled={loading}
              className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm">
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span className="material-icons-outlined text-lg">save</span>}
              {saved ? '✓ Salvo!' : 'Salvar'}
            </button>
          </div>
        )}

        {/* ── Connection tab ───────────────────────── */}
        {activeTab === 'connection' && (
          <div className="p-4 space-y-4">
            <div className="bg-white dark:bg-[#202c33] rounded-xl p-4 shadow-sm space-y-4">
              {/* Status */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#2a3942] rounded-lg">
                <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
                  status === 'connected' ? 'bg-green-400' :
                  status === 'qr' ? 'bg-yellow-400 animate-pulse' :
                  'bg-slate-400'
                }`} />
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {status === 'connected' ? 'WhatsApp Conectado ✅' :
                     status === 'qr' ? 'Aguardando leitura do QR Code...' :
                     'WhatsApp Desconectado'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {status === 'connected' ? 'Recebendo e enviando mensagens normalmente' :
                     status === 'qr' ? 'Escaneie o QR Code com seu celular' :
                     'Conecte para começar a usar o CRM'}
                  </p>
                </div>
              </div>

              {status !== 'connected' ? (
                <button onClick={onConnect}
                  className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm">
                  <span className="material-icons-outlined">qr_code_scanner</span>
                  Conectar via QR Code
                </button>
              ) : (
                <button onClick={onDisconnect}
                  className="w-full py-3 text-red-500 font-semibold rounded-xl border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-2 transition-colors">
                  <span className="material-icons-outlined">logout</span>
                  Desconectar WhatsApp
                </button>
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-xs text-blue-600 dark:text-blue-300 space-y-2">
              <p className="font-semibold">📱 Como conectar</p>
              <p>1. Clique em <strong>Conectar via QR Code</strong></p>
              <p>2. Abra o WhatsApp no celular</p>
              <p>3. Toque nos três pontos → <strong>Dispositivos conectados</strong></p>
              <p>4. Toque em <strong>Conectar dispositivo</strong></p>
              <p>5. Escaneie o QR Code que aparecer</p>
              <p className="text-blue-400 pt-1">⚡ A sessão fica salva — você só precisa escanear uma vez.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
