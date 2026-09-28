import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { SignupForm } from '@/features/auth/components/SignupForm';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default function SignupPage() {
  return (
    <AuthCard title="Crea tu catálogo digital" description="Tu cuenta es gratis y puedes publicar hoy mismo." footer={<>¿Ya tienes cuenta? <Link href="/login">Entra</Link></>}>
      <SignupForm />
    </AuthCard>
  );
}
