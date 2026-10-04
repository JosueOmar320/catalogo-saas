'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Stack, TextField } from '@mui/material';
import { useForm } from 'react-hook-form';
import { TextFieldControl } from '@/components/form/fields';
import { SectionCard } from '@/components/ui/SectionCard';
import { useAction } from '@/lib/hooks/use-action';
import { changePassword, updateAccount } from '../actions';
import { accountSchema, changePasswordSchema, type AccountValues, type ChangePasswordValues } from '../schema';

export function AccountForms({ username, fullName, email }: { username: string; fullName: string; email: string | null }) {
  const { run, pending } = useAction();
  const account = useForm<AccountValues>({ resolver: zodResolver(accountSchema), defaultValues: { fullName } });
  const password = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: '', password: '', confirm: '' } });

  return (
    <Stack spacing={2.5}>
      <SectionCard title="Datos">
        <Stack component="form" spacing={2} sx={{ pb: 2 }} onSubmit={account.handleSubmit((v) => run(() => updateAccount(v), { onSuccess: () => account.reset(v) }))}>
          <TextField label="Usuario" value={username} disabled helperText="Para cambiarlo, contacta al administrador." />
          <TextFieldControl control={account.control} name="fullName" label="Nombre" />
          {email && <TextField label="Email de contacto" value={email} disabled />}
          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" disabled={pending || !account.formState.isDirty}>Guardar</Button>
          </Stack>
        </Stack>
      </SectionCard>
      <SectionCard title="Contraseña">
        <Stack
          component="form"
          spacing={2}
          sx={{ pb: 2 }}
          onSubmit={password.handleSubmit((v) => run(() => changePassword(v), { setError: password.setError, onSuccess: () => password.reset() }))}
        >
          <TextFieldControl control={password.control} name="currentPassword" label="Contraseña actual" type="password" autoComplete="current-password" />
          <TextFieldControl control={password.control} name="password" label="Nueva contraseña" type="password" autoComplete="new-password" />
          <TextFieldControl control={password.control} name="confirm" label="Repite la nueva contraseña" type="password" autoComplete="new-password" />
          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" disabled={pending}>Cambiar contraseña</Button>
          </Stack>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
