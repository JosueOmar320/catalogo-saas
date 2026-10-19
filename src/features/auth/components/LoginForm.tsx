'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Stack } from '@mui/material';
import { useForm } from 'react-hook-form';
import { TextFieldControl } from '@/components/form/fields';
import { useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import { signIn } from '../actions';
import { signInSchema, type SignInValues } from '../schema';

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const t = useT();
  const { run, pending } = useAction();
  const { control, handleSubmit, setError } = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { username: '', password: '' } });

  return (
    <Stack component="form" spacing={2} onSubmit={handleSubmit((values) => run(() => signIn(values, next), { setError }))} noValidate>
      {notice && <Alert severity="warning">{notice}</Alert>}
      <TextFieldControl control={control} name="username" label={t('Nombre de usuario')} autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus />
      <TextFieldControl control={control} name="password" label={t('Contraseña')} type="password" autoComplete="current-password" />
      <Button type="submit" variant="contained" size="medium" disabled={pending}>
        {pending ? t('Entrando…') : t('Iniciar sesión')}
      </Button>
    </Stack>
  );
}
