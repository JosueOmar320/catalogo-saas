'use client';

import { Box, Stack, Typography } from '@mui/material';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
};

export function PageHeader({ title, description, actions, back }: Props) {
  return (
    <Box sx={{ mb: 3 }}>
      {back && (
        <Box
          component={Link}
          href={back.href}
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 1, color: 'text.secondary', fontSize: 13, textDecoration: 'none', '&:hover': { color: 'text.primary' } }}
        >
          <ArrowLeft size={14} /> {back.label}
        </Box>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h1">{title}</Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 640 }}>
              {description}
            </Typography>
          )}
        </Box>
        {actions && <Stack direction="row" spacing={1} sx={{ flexShrink: 0, flexWrap: 'wrap', rowGap: 1 }}>{actions}</Stack>}
      </Stack>
    </Box>
  );
}
