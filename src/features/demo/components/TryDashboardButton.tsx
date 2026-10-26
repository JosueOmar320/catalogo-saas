'use client';

import { LayoutDashboard, LoaderCircle } from 'lucide-react';
import { useState, useTransition } from 'react';
import { startDemo } from '@/features/demo/actions';
import { useT } from '@/i18n/client';

/**
 * «Probar el panel»: crea la cuenta de prueba y entra al panel. Preparar el
 * negocio tarda unos segundos (copia el café de ejemplo), así que el botón
 * lo dice mientras tanto.
 */
export function TryDashboardButton({ className, errorClassName }: { className?: string; errorClassName?: string }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await startDemo();
            // Si todo sale bien, la acción redirige al panel y no vuelve.
            if (result && !result.ok) setError(t(result.error));
          })
        }
      >
        {pending ? <LoaderCircle size={16} aria-hidden style={{ animation: 'vitrina-spin 1s linear infinite' }} /> : <LayoutDashboard size={16} aria-hidden />}
        {pending ? t('Preparando tu negocio de prueba…') : t('Probar el panel')}
      </button>
      {error && (
        <p role="alert" className={errorClassName}>
          {error}
        </p>
      )}
    </>
  );
}
