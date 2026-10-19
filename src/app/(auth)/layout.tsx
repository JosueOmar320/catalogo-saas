import { Box, Typography } from '@mui/material';
import Link from 'next/link';
import { appFont } from '@/components/providers/app-font';
import { AppProviders } from '@/components/providers/AppProviders';
import { ColorModeToggle } from '@/components/ui/ColorModeToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { AppI18n } from '@/i18n/AppI18n';
import { env } from '@/lib/env';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={appFont.variable}>
      <AppI18n>
      <AppProviders>
        <Box sx={{ position: 'fixed', top: 12, right: 12, display: 'flex', gap: 0.5 }}>
          <LanguageSwitcher />
          <ColorModeToggle />
        </Box>
        <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 2, py: 6, bgcolor: 'background.default' }}>
          <Link href="/" style={{ textDecoration: 'none', marginBottom: 24 }}>
            <Typography component="span" sx={{ fontWeight: 750, fontSize: 20, letterSpacing: '-0.02em', color: 'text.primary' }}>
              {env.appName}
            </Typography>
          </Link>
          <Box sx={{ width: '100%', maxWidth: 400 }}>{children}</Box>
        </Box>
      </AppProviders>
      </AppI18n>
    </div>
  );
}
