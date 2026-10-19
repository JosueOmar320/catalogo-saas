'use client';

import { Alert, AlertTitle, Box, Button } from '@mui/material';
import { useEffect } from 'react';
import { useT } from '@/i18n/client';

type Props = { error: Error & { digest?: string }; retry: () => void; title?: string };

/**
 * Error dentro del panel o la administración: se muestra en el área de
 * contenido, conservando la navegación. `retry` vuelve a pedir la sección al
 * servidor (a diferencia de `reset`, que sólo re-renderiza).
 * En producción el mensaje real no llega al navegador; `digest` permite
 * encontrar el error en los logs del servidor.
 */
export function SegmentError({ error, retry, title }: Props) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', my: 6 }}>
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={retry}>
            {t('Reintentar')}
          </Button>
        }
      >
        <AlertTitle>{title ?? t('No pudimos cargar esta sección')}</AlertTitle>
        {t('Puede ser un problema temporal. Si se repite, comparte este código con soporte:')} <code>{error.digest ?? t('sin código')}</code>
      </Alert>
    </Box>
  );
}
