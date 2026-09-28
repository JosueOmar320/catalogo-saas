'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Stack } from '@mui/material';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { TextFieldControl } from '@/components/form/fields';
import { useAction } from '@/lib/hooks/use-action';
import { signIn } from '../actions';
import { signInSchema, type SignInValues } from '../schema';

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const { run, pending } = useAction();
  const { control, handleSubmit, setError } = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });

  return (
    <Stack component="form" spacing={2} onSubmit={handleSubmit((values) => run(() => signIn(values, next), { setError }))} noValidate>
      {linkError && <Alert severity="warning">El enlace expiró o ya fue usado. Inicia sesión o solicita uno nuevo.</Alert>}
      <TextFieldControl control={control} name="email" label="Email" type="email" autoComplete="email" autoFocus />
      <TextFieldControl control={control} name="password" label="Contraseña" type="password" autoComplete="current-password" />
      <Box sx={{ textAlign: 'right', mt: '-4px !important' }}>
        <Box component={Link} href="/forgot-password" sx={{ fontSize: 13, color: 'text.secondary' }}>¿Olvidaste tu contraseña?</Box>
      </Box>
      <Button type="submit" variant="contained" size="medium" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </Stack>
  );
}
