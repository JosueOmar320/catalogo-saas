import { Box } from '@mui/material';
import type { Metadata } from 'next';
import { isDemoEnabled } from '@/features/demo/config';
import { TryDashboardButton } from '@/features/demo/components/TryDashboardButton';
import demoStyles from '@/features/demo/components/demo.module.css';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { getT } from '@/i18n/server';
import { msg } from '@/i18n/translate';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('Iniciar sesión') };
}

const NOTICES: Record<string, string> = {
  disabled: msg('Tu acceso está desactivado. Contacta al administrador.'),
  link: msg('El enlace ya no es válido. Inicia sesión con tu usuario.'),
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next, error } = await searchParams;
  const t = await getT();
  const notice = typeof error === 'string' ? NOTICES[error] : undefined;
  return (
    <AuthCard
      title={t('Iniciar sesión')}
      footer={
        <>
          {t('¿Necesitas acceso? Contacta al administrador.')}
          {isDemoEnabled() && (
            <Box sx={{ mt: 1 }}>
              {t('¿Sólo quieres mirar?')} <TryDashboardButton className={demoStyles.linkButton} errorClassName={demoStyles.error} />
            </Box>
          )}
        </>
      }
    >
      <LoginForm next={typeof next === 'string' ? next : undefined} notice={notice ? t(notice) : undefined} />
    </AuthCard>
  );
}
