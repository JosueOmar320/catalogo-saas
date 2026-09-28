import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { ForgotPasswordForm } from '@/features/auth/components/PasswordForms';

export const metadata: Metadata = { title: 'Recuperar contraseña' };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Recupera tu contraseña" description="Te enviaremos un enlace para crear una nueva." footer={<Link href="/login">Volver a entrar</Link>}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
