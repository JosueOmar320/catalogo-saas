'use client';

import { Box, LinearProgress } from '@mui/material';
import { useT } from '@/i18n/client';

/** Indicador mientras el servidor prepara una sección del panel (las páginas son dinámicas). */
export function SegmentLoading() {
  const t = useT();
  return (
    <Box role="status" aria-live="polite" sx={{ py: 2 }}>
      <LinearProgress aria-label={t('Cargando')} />
    </Box>
  );
}
