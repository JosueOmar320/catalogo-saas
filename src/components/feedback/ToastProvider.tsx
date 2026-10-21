'use client';

import { Alert, Button, Snackbar } from '@mui/material';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/** Acción opcional del aviso (p. ej. "Deshacer"); el aviso dura más para dar tiempo. */
type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; message: string; severity: 'success' | 'error' | 'info'; action?: ToastAction };
type ToastApi = { success: (message: string, action?: ToastAction) => void; error: (message: string) => void; info: (message: string, action?: ToastAction) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const show = useCallback((message: string, severity: Toast['severity'], action?: ToastAction) => {
    setToast({ id: Date.now(), message, severity, action });
  }, []);
  const api = useMemo<ToastApi>(
    () => ({
      success: (m, action) => show(m, 'success', action),
      error: (m) => show(m, 'error'),
      info: (m, action) => show(m, 'info', action),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        key={toast?.id}
        open={Boolean(toast)}
        autoHideDuration={toast?.severity === 'error' || toast?.action ? 6000 : 3000}
        onClose={(_, reason) => reason !== 'clickaway' && setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            // Los errores interrumpen (alert); los demás avisos se leen sin interrumpir (status).
            role={toast.severity === 'error' ? 'alert' : 'status'}
            variant="filled"
            onClose={() => setToast(null)}
            sx={{ minWidth: 280, alignItems: 'center' }}
            action={
              toast.action ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    setToast(null);
                    toast.action!.onClick();
                  }}
                  sx={{ fontWeight: 700 }}
                >
                  {toast.action.label}
                </Button>
              ) : undefined
            }
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider');
  return context;
}
