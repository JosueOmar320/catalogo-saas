'use client';

import { useEffect } from 'react';
import { useBrowserT } from '@/lib/hooks/use-browser-t';

/**
 * Último recurso: errores del layout raíz (p. ej. configuración inválida).
 * Reemplaza todo el documento, así que no hay estilos globales: van en línea.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // Fuera de todo provider: el idioma se toma del navegador (cookie de idioma o preferencias).
  const { locale, t } = useBrowserT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', background: '#f7f7f8', color: '#18181b' }}>
        <title>{t('Algo salió mal')}</title>
        <main style={{ maxWidth: 440, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, margin: '0 0 12px' }}>{t('No pudimos cargar la aplicación')}</h1>
          <p style={{ color: '#52525b', lineHeight: 1.5, margin: '0 0 24px' }}>{t('Es un error inesperado. Intenta de nuevo en unos segundos.')}</p>
          <button type="button" onClick={retry} style={{ padding: '10px 16px', borderRadius: 6, border: 0, background: '#18181b', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            {t('Reintentar')}
          </button>
          {error.digest && <p style={{ marginTop: 16, fontSize: 12, color: '#71717a' }}>{t('Código: {code}', { code: error.digest })}</p>}
        </main>
      </body>
    </html>
  );
}
