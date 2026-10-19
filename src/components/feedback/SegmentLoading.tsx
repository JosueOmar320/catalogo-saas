import { Box, LinearProgress } from '@mui/material';

/** Indicador mientras el servidor prepara una sección del panel (las páginas son dinámicas). */
export function SegmentLoading() {
  return (
    <Box role="status" aria-live="polite" sx={{ py: 2 }}>
      <LinearProgress aria-label="Cargando" />
    </Box>
  );
}
