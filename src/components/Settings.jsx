import { useState, useEffect } from 'react';

export default function Settings({ status, onDisconnect, onConnect }) {
  const [settings, setSettings] = useState({
    botEnabled: false,
    botName: 'Assistente',
    botMessage: 'Olá! Como posso ajudar você hoje?',
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings).catch(() => {});
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

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-bg-dark">
      <div className="p-4 space-y-5">

        {/* Bot Config */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
            <span className="material-icons-outlined text-sm">smart_toy</span>
            Resposta Automática
          </h3>
          <div className="bg-white dark:bg-sidebar-dark rounded-xl p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Bot Ativo</p>
                <p className="text-xs text-slate-400 mt-0.5">Responde automaticamente cada mensagem recebida</p>
              </div>
              <button
                onClick={() => setSettings(s => ({ ...s, botEnabled: !s.botEnabled }))}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${settings.botEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${settings.botEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Nome do Assistente</label>
              <input
                value={settings.botName}
                onChange={e => setSettings(s => ({ ...s, botName: e.target.value }))}
                className="input-field"
                placeholder="Ex: Assistente da Loja"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Mensagem de Resposta</label>
              <textarea
                value={settings.botMessage}
                onChange={e => setSettings(s => ({ ...s, botMessage: e.target.value }))}
                rows={6}
                className="input-field resize-none"
                placeholder="Olá! Como posso ajudar você hoje?"
              />
              <p className="text-xs text-slate-400 mt-1">
                Esta mensagem é enviada automaticamente para cada nova mensagem recebida.
              </p>
            </div>
          </div>
        </section>

        {/* Save */}
        <button
          onClick={save}
          disabled={loading}
          className="w-full btn-primary flex items-center justify-center gap-2 py-3"
        >
          {loading
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <span className="material-icons-outlined text-lg">save</span>}
          {saved ? '✓ Salvo!' : 'Salvar configurações'}
        </button>

        {/* WhatsApp connection */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1">
            <span className="material-icons-outlined text-sm">wifi</span>
            Conexão WhatsApp
          </h3>
          <div className="bg-white dark:bg-sidebar-dark rounded-xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                status === 'connected' ? 'bg-green-400' :
                status === 'qr' ? 'bg-yellow-400 animate-pulse' :
                'bg-slate-400'
              }`} />
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {status === 'connected' ? 'WhatsApp Conectado ✅' :
                 status === 'qr' ? 'Escaneie o QR Code no celular...' :
                 'WhatsApp Desconectado'}
              </span>
            </div>

            {status !== 'connected' && (
              <button
                onClick={onConnect}
                className="w-full py-2.5 text-sm font-medium bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-icons-outlined text-lg">qr_code_scanner</span>
                Conectar via QR Code
              </button>
            )}
            {status === 'connected' && (
              <button
                onClick={onDisconnect}
                className="w-full py-2.5 text-sm font-medium text-red-500 hover:text-red-600 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Desconectar WhatsApp
              </button>
            )}
          </div>
        </section>

        {/* How it works */}
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-xs text-emerald-700 dark:text-emerald-300 space-y-1.5">
          <p className="font-semibold text-sm">🚀 Como usar</p>
          <p>1. Clique em <strong>Conectar via QR Code</strong></p>
          <p>2. Abra o WhatsApp no celular</p>
          <p>3. Vá em <strong>Dispositivos conectados → Conectar dispositivo</strong></p>
          <p>4. Escaneie o QR Code que aparecer</p>
          <p>5. Pronto! As conversas aparecem aqui em tempo real</p>
        </div>
      </div>
    </div>
  );
}
