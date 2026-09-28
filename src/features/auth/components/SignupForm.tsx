'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { TextFieldControl } from '@/components/form/fields';
import { useAction } from '@/lib/hooks/use-action';
import { signUp } from '../actions';
import { signUpSchema, type SignUpValues } from '../schema';

export function SignupForm() {
  const { run, pending } = useAction();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { control, handleSubmit, setError, getValues } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  if (sentTo) {
    return (
      <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center', py: 2 }}>
        <MailCheck size={32} />
        <Typography variant="h3">Revisa tu correo</Typography>
        <Typography variant="body2" color="text.secondary">
          Enviamos un enlace de confirmación a <strong>{sentTo}</strong>. Ábrelo para activar tu cuenta y crear tu catálogo.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack
      component="form"
      spacing={2}
      noValidate
      onSubmit={handleSubmit((values) => run(() => signUp(values), { setError, onSuccess: ({ needsConfirmation }) => needsConfirmation && setSentTo(getValues('email')) }))}
    >
      <TextFieldControl control={control} name="fullName" label="Tu nombre" autoComplete="name" autoFocus />
      <TextFieldControl control={control} name="email" label="Email" type="email" autoComplete="email" />
      <TextFieldControl control={control} name="password" label="Contraseña" type="password" autoComplete="new-password" helperText="Mínimo 8 caracteres." />
      <Button type="submit" variant="contained" size="medium" disabled={pending}>
        {pending ? 'Creando cuenta…' : 'Crear cuenta gratis'}
      </Button>
      <Alert severity="info" icon={false} sx={{ fontSize: 13 }}>Sin tarjeta de crédito. Crea tu catálogo en minutos.</Alert>
    </Stack>
  );
}
