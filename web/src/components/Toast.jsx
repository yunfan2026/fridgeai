import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const ToastCtx = createContext(() => {});

// showToast(message, { actionLabel, onAction, duration })
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, opts = {}) => {
    setToast({ message, ...opts, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.duration || 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastCtx.Provider value={showToast}>
      {children}
      {toast && (
        <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full bg-ink px-4 py-2.5 text-sm text-white shadow-card">
            <span>{toast.message}</span>
            {toast.actionLabel && (
              <button
                className="font-semibold text-warn"
                onClick={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
