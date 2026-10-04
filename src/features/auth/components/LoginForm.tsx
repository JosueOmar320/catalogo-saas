'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Stack } from '@mui/material';
import { useForm } from 'react-hook-form';
import { TextFieldControl } from '@/components/form/fields';
import { useAction } from '@/lib/hooks/use-action';
import { signIn } from '../actions';
import { signInSchema, type SignInValues } from '../schema';

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const { run, pending } = useAction();
  const { control, handleSubmit, setError } = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { username: '', password: '' } });

  return (
    <Stack component="form" spacing={2} onSubmit={handleSubmit((values) => run(() => signIn(values, next), { setError }))} noValidate>
      {notice && <Alert severity="warning">{notice}</Alert>}
      <TextFieldControl control={control} name="username" label="Usuario" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus />
      <TextFieldControl control={control} name="password" label="Contraseña" type="password" autoComplete="current-password" />
      <Button type="submit" variant="contained" size="medium" disabled={pending}>
        {pending ? 'Entrando…' : 'Iniciar sesión'}
      </Button>
    </Stack>
  );
}
