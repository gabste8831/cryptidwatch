import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Mail } from 'lucide-react';

const ToastContext = createContext(() => {});

/** Notificação no estilo de bilhete datilografado vindo do arquivo. */
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const show = useCallback((text, from = 'Nota do arquivo') => {
    clearTimeout(timer.current);
    setToast({ text, from });
    timer.current = setTimeout(() => setToast(null), 4200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div className="toast paper" role="status" aria-live="polite">
          <div className="toast-from"><Mail size={14} /> {toast.from}</div>
          <div>{toast.text}</div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
