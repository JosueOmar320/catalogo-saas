import type { Metadata } from 'next';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { LoginForm } from '@/features/auth/components/LoginForm';

export const metadata: Metadata = { title: 'Iniciar sesión' };

const NOTICES: Record<string, string> = {
  disabled: 'Tu acceso está desactivado. Contacta al administrador.',
  link: 'El enlace ya no es válido. Inicia sesión con tu usuario.',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next, error } = await searchParams;
  return (
    <AuthCard title="Iniciar sesión" footer={<>¿Necesitas acceso? Contacta al administrador.</>}>
      <LoginForm next={typeof next === 'string' ? next : undefined} notice={typeof error === 'string' ? NOTICES[error] : undefined} />
    </AuthCard>
  );
}
