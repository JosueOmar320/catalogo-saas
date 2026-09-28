import type { Metadata } from 'next';
import { AuthCard } from '@/features/auth/components/AuthCard';
import { ResetPasswordForm } from '@/features/auth/components/PasswordForms';

export const metadata: Metadata = { title: 'Nueva contraseña' };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Crea una nueva contraseña">
      <ResetPasswordForm />
    </AuthCard>
  );
}
