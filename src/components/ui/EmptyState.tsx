import { Box, Typography } from '@mui/material';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = { icon: LucideIcon; title: string; description?: string; action?: ReactNode };

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
      <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: 2, bgcolor: 'primary.light', color: 'primary.main', mb: 1.5 }}>
        <Icon size={22} />
      </Box>
      <Typography variant="h3">{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 380, mx: 'auto' }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
