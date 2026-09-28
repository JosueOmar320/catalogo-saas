import { Box, Paper, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export function AuthCard({ title, description, children, footer }: { title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
        <Typography variant="h2" component="h1">{title}</Typography>
        {description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{description}</Typography>}
        <Box sx={{ mt: 3 }}>{children}</Box>
      </Paper>
      {footer && <Box sx={{ mt: 2, textAlign: 'center', fontSize: 14, color: 'text.secondary', '& a': { color: 'primary.main', fontWeight: 600 } }}>{footer}</Box>}
    </>
  );
}
