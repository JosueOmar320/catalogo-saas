'use client';

import { Paper, type SxProps, type Theme } from '@mui/material';
import Link from 'next/link';
import type { ReactNode } from 'react';

/** Tarjeta entera clicable (navegación del lado del cliente); usable desde Server Components. */
export function LinkCard({ href, children, sx, 'aria-label': ariaLabel }: { href: string; children: ReactNode; sx?: SxProps<Theme>; 'aria-label'?: string }) {
  return (
    <Paper
      variant="outlined"
      component={Link}
      href={href}
      aria-label={ariaLabel}
      sx={[
        {
          display: 'block',
          p: 2,
          color: 'inherit',
          textDecoration: 'none',
          transition: 'border-color 0.15s, background-color 0.15s',
          '&:hover': { borderColor: 'text.secondary', bgcolor: 'action.hover' },
          '&:focus-visible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Paper>
  );
}
