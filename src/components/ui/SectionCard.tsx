import { Box, Paper, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import type { ReactNode } from 'react';

type Props = {
  /** Ancla para saltar a la tarjeta (deja margen arriba para el encabezado fijo del panel). */
  id?: string;
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** Sin padding interno (para listas que llegan al borde). */
  flush?: boolean;
  sx?: SxProps<Theme>;
};

export function SectionCard({ id, title, description, action, children, flush, sx }: Props) {
  return (
    <Paper id={id} variant="outlined" sx={{ overflow: 'hidden', scrollMarginTop: id ? 80 : undefined, ...sx }}>
      {(title || action) && (
        <Stack direction="row" spacing={2} sx={{ px: 2.5, pt: 2, pb: flush ? 2 : 0, justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: flush ? 1 : 0, borderColor: 'divider' }}>
          <Box>
            {title && <Typography variant="h3">{title}</Typography>}
            {description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {description}
              </Typography>
            )}
          </Box>
          {action}
        </Stack>
      )}
      <Box sx={{ p: flush ? 0 : 2.5 }}>{children}</Box>
    </Paper>
  );
}
