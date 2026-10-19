'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { TextFieldControl } from '@/components/form/fields';
import { SectionCard } from '@/components/ui/SectionCard';
import { useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import { changePassword, updateAccount, updateNotifications } from '../actions';
import { accountSchema, changePasswordSchema, type AccountValues, type ChangePasswordValues } from '../schema';

/** catalogReview: preferencia del aviso semanal; null = aún no disponible (no se muestra). */
export function AccountForms({ username, fullName, email, catalogReview }: { username: string; fullName: string; email: string | null; catalogReview: boolean | null }) {
  const t = useT();
  const { run, pending } = useAction();
  const account = useForm<AccountValues>({ resolver: zodResolver(accountSchema), defaultValues: { fullName } });
  const [weekly, setWeekly] = useState(catalogReview ?? false);
  const password = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: '', password: '', confirm: '' } });

  return (
    <Stack spacing={2.5}>
      <SectionCard title={t('Datos')}>
        <Stack component="form" spacing={2} sx={{ pb: 2 }} onSubmit={account.handleSubmit((v) => run(() => updateAccount(v), { onSuccess: () => account.reset(v) }))}>
          <TextField label={t('Nombre de usuario')} value={username} disabled helperText={t('Para cambiarlo, contacta al administrador.')} />
          <TextFieldControl control={account.control} name="fullName" label={t('Nombre')} />
          {email && <TextField label={t('Email de contacto')} value={email} disabled />}
          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" disabled={pending || !account.formState.isDirty}>{t('Guardar')}</Button>
          </Stack>
        </Stack>
      </SectionCard>
      {catalogReview !== null && (
        <SectionCard title={t('Avisos por correo')}>
          <Stack spacing={1.5} sx={{ pb: 2 }}>
            <FormControlLabel
              sx={{ alignItems: 'flex-start', m: 0, gap: 1.25, justifyContent: 'space-between' }}
              labelPlacement="start"
              control={
                <Switch
                  checked={weekly}
                  disabled={pending || !email}
                  onChange={(event) => {
                    const value = event.target.checked;
                    setWeekly(value);
                    void run(() => updateNotifications({ catalogReview: value })).then((result) => {
                      if (!result?.ok) setWeekly(!value);
                    });
                  }}
                />
              }
              label={
                <span>
                  <Typography variant="body2" component="span" sx={{ display: 'block', fontWeight: 600 }}>{t('Aviso semanal de mi catálogo')}</Typography>
                  <Typography variant="caption" color="text.secondary" component="span">
                    {t('Los lunes, si tus negocios tienen productos sin foto, sin precio o sin categoría. Si todo está completo, no llega nada.')}
                  </Typography>
                </span>
              }
            />
            {!email && <Alert severity="info">{t('Para recibirlo necesitas un email de contacto. Pídele al administrador que lo agregue a tu usuario.')}</Alert>}
          </Stack>
        </SectionCard>
      )}
      <SectionCard title={t('Contraseña')}>
        <Stack
          component="form"
          spacing={2}
          sx={{ pb: 2 }}
          onSubmit={password.handleSubmit((v) => run(() => changePassword(v), { setError: password.setError, onSuccess: () => password.reset() }))}
        >
          <TextFieldControl control={password.control} name="currentPassword" label={t('Contraseña actual')} type="password" autoComplete="current-password" />
          <TextFieldControl control={password.control} name="password" label={t('Nueva contraseña')} type="password" autoComplete="new-password" />
          <TextFieldControl control={password.control} name="confirm" label={t('Repite la nueva contraseña')} type="password" autoComplete="new-password" />
          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" disabled={pending}>{t('Cambiar contraseña')}</Button>
          </Stack>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
