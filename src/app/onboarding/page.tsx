import { Box, Typography } from '@mui/material';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { appFont } from '@/components/providers/app-font';
import { AppProviders } from '@/components/providers/AppProviders';
import { OnboardingForm } from '@/features/business/components/OnboardingForm';
import { getBusinessContext, requireUser } from '@/lib/auth/session';
import { env } from '@/lib/env';

export const metadata: Metadata = { title: 'Crea tu catálogo', robots: { index: false } };

export default async function OnboardingPage({ searchParams }: PageProps<'/onboarding'>) {
  await requireUser();
  const [{ new: isNew }, ctx] = await Promise.all([searchParams, getBusinessContext()]);
  if (ctx && !isNew) redirect('/dashboard');

  return (
    <div className={appFont.variable}>
      <AppProviders>
        <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', px: { xs: 2, sm: 4 }, py: 4 }}>
          <Typography sx={{ fontWeight: 750, fontSize: 18, letterSpacing: '-0.02em', mb: 4 }}>{env.appName}</Typography>
          <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
            <OnboardingForm />
          </Box>
        </Box>
      </AppProviders>
    </div>
  );
}
