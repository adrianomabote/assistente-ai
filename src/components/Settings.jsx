import { useState, useEffect } from 'react';

export default function Settings({ status, onDisconnect, onConnect }) {
  const [settings, setSettings] = useState({
    aiEnabled: false,
    aiToken: '',
    aiModel: 'gpt-4o-mini',
    aiSystemPrompt: '',
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('ia');
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      setSettings(prev => ({ ...prev, ...s }));
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

  const tabs = [
    { id: 'ia',         label: 'IA',       icon: 'android' },
    { id: 'connection', label: 'Conexão',  icon: 'wifi' },
  ];

  const models = [
    { value: 'gpt-4o-mini',  label: 'GPT-4o Mini (rápido e económico)' },
    { value: 'gpt-4o',       label: 'GPT-4o (mais inteligente)' },
    { value: 'gpt-3.5-turbo',label: 'GPT-3.5 Turbo (legado)' },
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

        {/* ── IA tab ─────────────────────────────────── */}
        {activeTab === 'ia' && (
          <div className="p-4 space-y-4">

            {/* Enable toggle */}
            <div className="bg-white dark:bg-[#202c33] rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Ativar respostas com IA</p>
                  <p className="text-xs text-slate-400 mt-0.5">A IA responde automaticamente às mensagens dos clientes</p>
                </div>
                <button
                  onClick={() => setSettings(s => ({ ...s, aiEnabled: !s.aiEnabled }))}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${settings.aiEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${settings.aiEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
                </button>
              </div>

              {settings.aiEnabled && !settings.aiToken && (
                <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <span className="material-icons-outlined text-amber-500 text-lg flex-shrink-0">warning</span>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Adicione o seu token OpenAI abaixo para a IA funcionar.</p>
                </div>
              )}
            </div>

            {/* API Token */}
            <div className="bg-white dark:bg-[#202c33] rounded-xl p-4 shadow-sm space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Token OpenAI</label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={settings.aiToken}
                    onChange={e => setSettings(s => ({ ...s, aiToken: e.target.value }))}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-[#2a3942] text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <span className="material-icons-outlined text-lg">{showToken ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  Obtenha em{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                    className="text-primary hover:underline">platform.openai.com/api-keys</a>
                </p>
              </div>

              {/* Model */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Modelo</label>
                <select
                  value={settings.aiModel}
                  onChange={e => setSettings(s => ({ ...s, aiModel: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-[#2a3942] text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            {/* System prompt */}
            <div className="bg-white dark:bg-[#202c33] rounded-xl p-4 shadow-sm space-y-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5 uppercase tracking-wider">Instruções para a IA</label>
                <p className="text-xs text-slate-400 mb-2">Descreva como a IA deve se comportar, o tom, o que pode e não pode dizer, os produtos/serviços, etc.</p>
                <textarea
                  value={settings.aiSystemPrompt}
                  onChange={e => setSettings(s => ({ ...s, aiSystemPrompt: e.target.value }))}
                  rows={10}
                  placeholder={`Exemplo:\nVocê é um assistente de atendimento da Loja XYZ.\nResponda sempre em português de Portugal.\nSeja simpático, profissional e conciso.\nNão discuta preços — diga que um agente irá entrar em contacto.\nProdutos: camisas, calças, sapatos (ver site: loja.pt)`}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-[#2a3942] text-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none leading-relaxed"
                />
              </div>
            </div>

            <button onClick={save} disabled={loading}
              className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm">
              {loading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <span className="material-icons-outlined text-lg">save</span>}
              {saved ? '✓ Configurações salvas!' : 'Guardar configurações'}
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
                    {status === 'connected' ? 'A sessão fica guardada — não precisa de voltar a ligar' :
                     status === 'qr' ? 'Escaneie o QR Code com o seu telemóvel' :
                     'Ligue para começar a usar o ZapCRM'}
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

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-xs text-blue-600 dark:text-blue-300 space-y-1.5">
              <p className="font-semibold">📱 Como conectar</p>
              <p>1. Clique em <strong>Conectar via QR Code</strong></p>
              <p>2. Abra o WhatsApp no telemóvel</p>
              <p>3. Toque nos três pontos → <strong>Dispositivos conectados</strong></p>
              <p>4. Toque em <strong>Conectar dispositivo</strong> e escaneie o código</p>
              <p className="text-blue-400 pt-1">⚡ A sessão fica guardada automaticamente. Só precisa de escanear uma vez — mesmo que abra noutro dispositivo.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
