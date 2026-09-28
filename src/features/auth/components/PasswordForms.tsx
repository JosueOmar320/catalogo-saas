'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Stack } from '@mui/material';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { TextFieldControl } from '@/components/form/fields';
import { useAction } from '@/lib/hooks/use-action';
import { requestPasswordReset, updatePassword } from '../actions';
import { forgotPasswordSchema, resetPasswordSchema, type ForgotPasswordValues, type ResetPasswordValues } from '../schema';

export function ForgotPasswordForm() {
  const { run, pending } = useAction();
  const [done, setDone] = useState(false);
  const { control, handleSubmit } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });
  if (done) return <Alert severity="success">Si el email está registrado, recibirás un enlace para crear una nueva contraseña.</Alert>;
  return (
    <Stack component="form" spacing={2} noValidate onSubmit={handleSubmit((v) => run(() => requestPasswordReset(v), { successToast: false, onSuccess: () => setDone(true) }))}>
      <TextFieldControl control={control} name="email" label="Email" type="email" autoFocus />
      <Button type="submit" variant="contained" size="medium" disabled={pending}>Enviar enlace</Button>
    </Stack>
  );
}

export function ResetPasswordForm() {
  const { run, pending } = useAction();
  const { control, handleSubmit, setError } = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '' } });
  return (
    <Stack component="form" spacing={2} noValidate onSubmit={handleSubmit((v) => run(() => updatePassword(v), { setError }))}>
      <TextFieldControl control={control} name="password" label="Nueva contraseña" type="password" autoComplete="new-password" autoFocus />
      <Button type="submit" variant="contained" size="medium" disabled={pending}>Guardar contraseña</Button>
    </Stack>
  );
}
