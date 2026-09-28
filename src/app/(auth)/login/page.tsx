import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { LoginForm } from '@/features/auth/components/LoginForm';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next, error } = await searchParams;
  return (
    <AuthCard title="Entra a tu cuenta" footer={<>¿No tienes cuenta? <Link href="/signup">Crea una gratis</Link></>}>
      <LoginForm next={typeof next === 'string' ? next : undefined} linkError={error === 'link'} />
    </AuthCard>
  );
}
