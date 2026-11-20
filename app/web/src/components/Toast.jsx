import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Radio } from 'lucide-react';

const ToastContext = createContext(() => {});

/** Notificação no estilo "mensagem no celular" vinda da central. */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const show = useCallback((text, from = 'Central CryptidWatch') => {
    clearTimeout(timer.current);
    setToast({ text, from });
    timer.current = setTimeout(() => setToast(null), 4200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <div className="toast-from hud"><Radio size={14} /> {toast.from}</div>
          <div>{toast.text}</div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
