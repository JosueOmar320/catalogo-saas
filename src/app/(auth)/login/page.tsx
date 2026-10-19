import type { Metadata } from 'next';
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
    <AuthCard title={t('Iniciar sesión')} footer={<>{t('¿Necesitas acceso? Contacta al administrador.')}</>}>
      <LoginForm next={typeof next === 'string' ? next : undefined} notice={notice ? t(notice) : undefined} />
    </AuthCard>
  );
}
