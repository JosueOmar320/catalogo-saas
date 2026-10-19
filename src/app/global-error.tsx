'use client';

import { useEffect } from 'react';

/**
 * Último recurso: errores del layout raíz (p. ej. configuración inválida).
 * Reemplaza todo el documento, así que no hay estilos globales: van en línea.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', background: '#f7f7f8', color: '#18181b' }}>
        <title>Algo salió mal</title>
        <main style={{ maxWidth: 440, padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, margin: '0 0 12px' }}>No pudimos cargar la aplicación</h1>
          <p style={{ color: '#52525b', lineHeight: 1.5, margin: '0 0 24px' }}>Es un error inesperado. Intenta de nuevo en unos segundos.</p>
          <button type="button" onClick={retry} style={{ padding: '10px 16px', borderRadius: 6, border: 0, background: '#18181b', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            Reintentar
          </button>
          {error.digest && <p style={{ marginTop: 16, fontSize: 12, color: '#71717a' }}>Código: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
