import { Button, Stack } from '@mui/material';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { AccountForms } from '@/features/auth/components/AccountForms';
import { getProfile, isPlatformAdmin, requireUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Mi cuenta', robots: { index: false } };

export default async function AccountPage() {
  await requireUser();
  const profile = await getProfile();
  if (!profile || profile.status !== 'active') redirect('/login?error=disabled');
  const admin = isPlatformAdmin(profile);
  return (
    <>
      <PageHeader
        title="Mi cuenta"
        description="Tu usuario lo administra el equipo de la plataforma. Aquí puedes cambiar tu nombre y tu contraseña."
        actions={
          <Stack direction="row" spacing={1}>
            {admin && <Button href="/admin" color="inherit">Administración</Button>}
            <Button href="/dashboard" variant="outlined">Mis negocios</Button>
          </Stack>
        }
      />
      <AccountForms username={profile.username} fullName={profile.full_name ?? ''} email={profile.email} />
    </>
  );
}
