import { useEffect, useState } from 'react';
import socket from '../socket';

export default function QRModal({ qr, status, onClose }) {
  const [currentQr, setCurrentQr] = useState(qr);

  useEffect(() => {
    setCurrentQr(qr);
  }, [qr]);

  useEffect(() => {
    const handler = (newQr) => setCurrentQr(newQr);
    socket.on('qr', handler);
    return () => socket.off('qr', handler);
  }, []);

  // Auto-close when connected
  useEffect(() => {
    if (status === 'connected') {
      setTimeout(onClose, 1000);
    }
  }, [status]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-icons-outlined text-primary text-2xl">qr_code_scanner</span>
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Conectar WhatsApp</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo
          </p>

          {status === 'connected' ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <span className="material-icons-outlined text-green-500 text-4xl">check_circle</span>
              </div>
              <p className="text-green-600 dark:text-green-400 font-semibold">WhatsApp Conectado!</p>
            </div>
          ) : currentQr && currentQr !== 'loading' ? (
            <div className="flex justify-center">
              <img src={currentQr} alt="QR Code" className="w-56 h-56 rounded-xl" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Gerando QR Code...</p>
            </div>
          )}

          <button
            onClick={onClose}
            className="mt-6 w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
