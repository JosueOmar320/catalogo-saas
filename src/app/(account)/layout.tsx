import { Box, Typography } from '@mui/material';
import Link from 'next/link';
import { appFont } from '@/components/providers/app-font';
import { AppProviders } from '@/components/providers/AppProviders';
import { env } from '@/lib/env';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={appFont.variable}>
      <AppProviders>
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', px: 2, py: 6, bgcolor: 'background.default' }}>
          <Link href="/" style={{ textDecoration: 'none', marginBottom: 24 }}>
            <Typography component="span" sx={{ fontWeight: 750, fontSize: 20, letterSpacing: '-0.02em', color: 'text.primary' }}>{env.appName}</Typography>
          </Link>
          <Box sx={{ width: '100%', maxWidth: 560 }}>{children}</Box>
        </Box>
      </AppProviders>
    </div>
  );
}
