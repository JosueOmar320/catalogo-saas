'use client';

import { Box, Grid, Paper, Skeleton, Stack } from '@mui/material';
import { useT } from '@/i18n/client';

type Variant = 'home' | 'list' | 'grid' | 'form';

/**
 * Esqueleto de una página del panel mientras el servidor la prepara: la misma
 * silueta que el contenido (encabezado + tarjetas, filas o cuadrícula) para
 * que la página no "salte" al cargar. Anunciado a lectores de pantalla.
 */
export function PageSkeleton({ variant = 'form' }: { variant?: Variant }) {
  const t = useT();
  return (
    <Box role="status" aria-busy="true" aria-label={t('Cargando')}>
      <Skeleton variant="text" width={240} sx={{ fontSize: 28 }} />
      <Skeleton variant="text" width="min(480px, 80%)" sx={{ mb: 3 }} />
      {variant === 'home' && <HomeSkeleton />}
      {variant === 'list' && <ListSkeleton />}
      {variant === 'grid' && <GridSkeleton />}
      {variant === 'form' && <FormSkeleton />}
    </Box>
  );
}

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Skeleton variant="text" width="40%" sx={{ fontSize: 18 }} />
      <Skeleton variant="text" width="65%" sx={{ mb: 1.5 }} />
      <Stack spacing={1.25}>
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={22} width={`${90 - i * 12}%`} />
        ))}
      </Stack>
    </Paper>
  );
}

function HomeSkeleton() {
  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Stack spacing={2.5}>
          <CardSkeleton lines={5} />
          <CardSkeleton lines={4} />
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, lg: 4 }}>
        <Stack spacing={2.5}>
          <CardSkeleton lines={2} />
          <Grid container spacing={1.5}>
            {Array.from({ length: 4 }, (_, i) => (
              <Grid key={i} size={6}>
                <Skeleton variant="rounded" height={96} />
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Grid>
    </Grid>
  );
}

function ListSkeleton() {
  return (
    <Paper variant="outlined">
      <Stack direction="row" spacing={1.5} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Skeleton variant="rounded" height={38} sx={{ flex: 1, maxWidth: 320 }} />
        <Skeleton variant="rounded" height={38} width={180} sx={{ display: { xs: 'none', sm: 'block' } }} />
      </Stack>
      {Array.from({ length: 6 }, (_, i) => (
        <Stack key={i} direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
          <Skeleton variant="rounded" width={44} height={44} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width={`${55 - (i % 3) * 10}%`} />
            <Skeleton variant="text" width="30%" />
          </Box>
          <Skeleton variant="text" width={64} sx={{ display: { xs: 'none', sm: 'block' } }} />
        </Stack>
      ))}
    </Paper>
  );
}

function GridSkeleton() {
  return (
    <Grid container spacing={1.5}>
      {Array.from({ length: 12 }, (_, i) => (
        <Grid key={i} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
          <Skeleton variant="rounded" sx={{ aspectRatio: '1', height: 'auto' }} />
        </Grid>
      ))}
    </Grid>
  );
}

function FormSkeleton() {
  return (
    <Stack spacing={2.5} sx={{ maxWidth: 880 }}>
      <CardSkeleton lines={4} />
      <CardSkeleton lines={3} />
    </Stack>
  );
}
