import { Button, Paper, Stack, Typography } from '@mui/material';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signOut } from '@/features/auth/actions';
import { getBusinessContext, getProfile, isPlatformAdmin, requireUser } from '@/lib/auth/session';

export const metadata: Metadata = { title: 'Sin negocios asignados', robots: { index: false } };

export default async function NoAccessPage() {
  await requireUser();
  const [profile, ctx] = await Promise.all([getProfile(), getBusinessContext()]);
  if (ctx) redirect('/dashboard');
  if (isPlatformAdmin(profile)) redirect('/admin');
  return (
    <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>Aún no tienes negocios asignados</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Tu cuenta <strong>@{profile?.username}</strong> está activa, pero el administrador todavía no te asignó ningún negocio. Contáctalo para que te dé acceso.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
        <Button href="/cuenta" color="inherit">Mi cuenta</Button>
        <form action={signOut}>
          <Button type="submit" variant="contained">Cerrar sesión</Button>
        </form>
      </Stack>
    </Paper>
  );
}
