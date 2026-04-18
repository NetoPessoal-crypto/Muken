import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const FeedbackContext = createContext(null);

const MAX_TOASTS = 4;

function makeToastId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback((type, message, durationMs = 4500) => {
    if (!message) return;
    const id = makeToastId();
    setToasts((prev) => {
      const next = [{ id, type, message }, ...prev];
      return next.slice(0, MAX_TOASTS);
    });

    if (durationMs > 0) {
      window.setTimeout(() => {
        dismissToast(id);
      }, durationMs);
    }
  }, [dismissToast]);

  const value = useMemo(() => ({
    notifyError: (message) => pushToast('error', message, 5500),
    notifySuccess: (message) => pushToast('success', message, 3800),
    notifyInfo: (message) => pushToast('info', message, 3500),
    dismissToast,
  }), [pushToast, dismissToast]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="fixed top-5 right-5 z-[260] w-[min(92vw,380px)] space-y-2">
        {toasts.map((toast) => {
          const styles = toast.type === 'error'
            ? 'border-red-200 bg-red-50 text-red-800'
            : toast.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-blue-200 bg-blue-50 text-blue-800';

          return (
            <div key={toast.id} className={`rounded-xl border px-4 py-3 shadow-sm ${styles}`}>
              <div className="flex items-start gap-3">
                <p className="text-xs font-semibold leading-5 flex-1">{toast.message}</p>
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="text-[10px] font-black uppercase tracking-widest opacity-70 hover:opacity-100"
                >
                  Fechar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
}
