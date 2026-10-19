import { Button, Paper, Stack, Typography } from '@mui/material';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { signOut } from '@/features/auth/actions';
import { getT } from '@/i18n/server';
import { getBusinessContext, getProfile, isPlatformAdmin, requireUser } from '@/lib/auth/session';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Sin negocios asignados'), robots: { index: false } };
}

export default async function NoAccessPage() {
  await requireUser();
  const [profile, ctx] = await Promise.all([getProfile(), getBusinessContext()]);
  if (ctx) redirect('/dashboard');
  if (isPlatformAdmin(profile)) redirect('/admin');
  const t = await getT();
  // La frase se traduce completa; {username} se reemplaza por el usuario en negrita.
  const [before, after] = t('Tu cuenta {username} está activa, pero el administrador todavía no te asignó ningún negocio. Contáctalo para que te dé acceso.').split('{username}');
  return (
    <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="h2" sx={{ mb: 1 }}>{t('Aún no tienes negocios asignados')}</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {before}<strong>@{profile?.username}</strong>{after}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
        <Button href="/cuenta" color="inherit">{t('Mi cuenta')}</Button>
        <form action={signOut}>
          <Button type="submit" variant="contained">{t('Cerrar sesión')}</Button>
        </form>
      </Stack>
    </Paper>
  );
}
