'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Grid, IconButton, InputAdornment, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { SelectControl, TextFieldControl } from '@/components/form/fields';
import { SectionCard } from '@/components/ui/SectionCard';
import { useT } from '@/i18n/client';
import { useAction } from '@/lib/hooks/use-action';
import type { MemberRole } from '@/types/database';
import { createUser, removeMembership, resetUserPassword, setMembership, updateUser } from '../actions';
import { createUserSchema, MEMBER_ROLE_LABELS, MEMBER_ROLES, updateUserSchema, type CreateUserValues, type UpdateUserValues } from '../schema';
import { StatusChip, useDateFormat } from './common';

type BusinessOption = { id: string; name: string };

const roleOptions = MEMBER_ROLES.map((r) => ({ value: r, label: MEMBER_ROLE_LABELS[r] }));

/** Contraseña aleatoria legible (el admin la comparte con el usuario). */
function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

/* ------------------------------------------------------------ Nuevo usuario */

export function CreateUserForm({ businesses, serviceRoleReady }: { businesses: BusinessOption[]; serviceRoleReady: boolean }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const { control, handleSubmit, setError, setValue } = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { username: '', fullName: '', email: '', password: '', role: 'user', maxBusinesses: '', assignments: [] },
  });
  const assignments = useFieldArray({ control, name: 'assignments' });
  // {key} se reemplaza por el nombre de la variable en <code>.
  const [keyBefore, keyAfter] = t('Para crear usuarios configura {key} en el servidor.').split('{key}');

  return (
    <Box component="form" noValidate onSubmit={handleSubmit((values) => run(() => createUser(values), { setError, onSuccess: ({ id }) => router.push(`/admin/usuarios/${id}`) }))}>
      {!serviceRoleReady && <Alert severity="warning" sx={{ mb: 2 }}>{keyBefore}<code>SUPABASE_SERVICE_ROLE_KEY</code>{keyAfter}</Alert>}
      <Stack spacing={2.5}>
        <SectionCard title={t('Acceso')} description={t('El usuario entra con su nombre de usuario y contraseña. El email es opcional.')}>
          <Grid container spacing={2} sx={{ pb: 2 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextFieldControl control={control} name="username" label={t('Usuario')} placeholder="juan" autoCapitalize="none" slotProps={{ input: { startAdornment: <InputAdornment position="start">@</InputAdornment> } }} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextFieldControl
                control={control}
                name="password"
                label={t('Contraseña inicial')}
                helperText={t('Compártela con el usuario; podrá cambiarla en «Mi cuenta».')}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setValue('password', generatePassword(), { shouldValidate: true })} aria-label={t('Generar contraseña')} title={t('Generar contraseña')}>
                          <KeyRound size={15} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextFieldControl control={control} name="fullName" label={t('Nombre')} placeholder="Juan Pérez" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextFieldControl control={control} name="email" label={t('Email (opcional)')} type="email" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <SelectControl control={control} name="role" label={t('Rol')} options={[{ value: 'user', label: t('Usuario') }, { value: 'admin', label: t('Administrador de la plataforma') }]} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextFieldControl control={control} name="maxBusinesses" label={t('Máximo de negocios')} type="number" placeholder={t('Sin límite')} helperText={t('Vacío = sin límite.')} />
            </Grid>
          </Grid>
        </SectionCard>

        <SectionCard title={t('Negocios')} description={t('A qué negocios tendrá acceso y con qué rol.')}>
          <Stack spacing={1.25} sx={{ pb: 2 }}>
            {assignments.fields.map((field, index) => (
              <Stack key={field.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Controller
                  control={control}
                  name={`assignments.${index}.businessId`}
                  render={({ field: f }) => (
                    <TextField select size="small" label={t('Negocio')} value={f.value} onChange={f.onChange} sx={{ flex: 1 }}>
                      {businesses.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                    </TextField>
                  )}
                />
                <Controller
                  control={control}
                  name={`assignments.${index}.role`}
                  render={({ field: f }) => (
                    <TextField select size="small" label={t('Rol')} value={f.value} onChange={f.onChange} sx={{ width: 170 }}>
                      {roleOptions.map((r) => <MenuItem key={r.value} value={r.value}>{t(r.label)}</MenuItem>)}
                    </TextField>
                  )}
                />
                <IconButton onClick={() => assignments.remove(index)} aria-label={t('Quitar')}><Trash2 size={16} /></IconButton>
              </Stack>
            ))}
            {businesses.length === 0 ? (
              <Typography variant="body2" color="text.secondary">{t('Aún no hay negocios. Crea uno y asígnalo después.')}</Typography>
            ) : (
              <Button startIcon={<Plus size={15} />} sx={{ alignSelf: 'flex-start' }} onClick={() => assignments.append({ businessId: businesses[0].id, role: 'owner' })}>
                {t('Asignar negocio')}
              </Button>
            )}
          </Stack>
        </SectionCard>
        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
          <Button type="submit" variant="contained" disabled={pending || !serviceRoleReady}>{pending ? t('Creando…') : t('Crear usuario')}</Button>
        </Stack>
      </Stack>
    </Box>
  );
}

/* ------------------------------------------------------------ Editar usuario */

type UserDetail = {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
  maxBusinesses: number | null;
  createdAt: string;
  lastLoginAt: string | null;
  businesses: { id: string; name: string; role: MemberRole }[];
};

export function EditUserPanel({ user, businesses, isSelf, serviceRoleReady }: { user: UserDetail; businesses: BusinessOption[]; isSelf: boolean; serviceRoleReady: boolean }) {
  const t = useT();
  const { formatDay, formatMoment } = useDateFormat();
  const router = useRouter();
  const { run, pending } = useAction();
  const form = useForm<UpdateUserValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { fullName: user.fullName, email: user.email, role: user.role, status: user.status, maxBusinesses: user.maxBusinesses ?? '' },
  });
  const [password, setPassword] = useState('');
  const [assign, setAssign] = useState<{ businessId: string; role: MemberRole }>({ businessId: '', role: 'editor' });
  const available = businesses.filter((b) => !user.businesses.some((x) => x.id === b.id));

  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, md: 7 }}>
        <Stack spacing={2.5}>
          <SectionCard title={t('Perfil y acceso')}>
            <Stack component="form" spacing={2} sx={{ pb: 2 }} onSubmit={form.handleSubmit((v) => run(() => updateUser(user.id, v), { setError: form.setError, onSuccess: () => { form.reset(v); router.refresh(); } }))}>
              <TextField label={t('Usuario')} value={`@${user.username}`} disabled />
              <TextFieldControl control={form.control} name="fullName" label={t('Nombre')} />
              <TextFieldControl control={form.control} name="email" label={t('Email (opcional)')} type="email" />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <SelectControl control={form.control} name="role" label={t('Rol')} disabled={isSelf} options={[{ value: 'user', label: t('Usuario') }, { value: 'admin', label: t('Administrador') }]} />
                <SelectControl control={form.control} name="status" label={t('Estado')} disabled={isSelf} options={[{ value: 'active', label: t('Activo') }, { value: 'disabled', label: t('Desactivado') }]} />
                <TextFieldControl control={form.control} name="maxBusinesses" label={t('Máx. negocios')} type="number" placeholder={t('Sin límite')} />
              </Stack>
              {isSelf && <Typography variant="caption" color="text.secondary">{t('No puedes cambiar tu propio rol ni desactivarte.')}</Typography>}
              <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                <Button type="submit" variant="contained" disabled={pending || !form.formState.isDirty}>{t('Guardar')}</Button>
              </Stack>
            </Stack>
          </SectionCard>

          <SectionCard title={t('Negocios asignados')}>
            <Stack spacing={1} sx={{ pb: 2 }}>
              {user.businesses.length === 0 && <Typography variant="body2" color="text.secondary">{t('Sin negocios: al entrar verá «Contacta al administrador».')}</Typography>}
              {user.businesses.map((b) => (
                <Stack key={b.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }} component="a" href={`/admin/negocios/${b.id}`}>{b.name}</Typography>
                  <TextField select size="small" value={b.role} onChange={(e) => run(() => setMembership(b.id, user.id, e.target.value as MemberRole), { onSuccess: () => router.refresh() })} sx={{ width: 170 }}>
                    {roleOptions.map((r) => <MenuItem key={r.value} value={r.value}>{t(r.label)}</MenuItem>)}
                  </TextField>
                  <IconButton onClick={() => run(() => removeMembership(b.id, user.id), { onSuccess: () => router.refresh() })} aria-label={t('Quitar {name}', { name: b.name })}><Trash2 size={16} /></IconButton>
                </Stack>
              ))}
              {available.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', pt: 1 }}>
                  <TextField select size="small" label={t('Agregar negocio')} value={assign.businessId} onChange={(e) => setAssign({ ...assign, businessId: e.target.value })} sx={{ flex: 1 }}>
                    {available.map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
                  </TextField>
                  <TextField select size="small" value={assign.role} onChange={(e) => setAssign({ ...assign, role: e.target.value as MemberRole })} sx={{ width: 170 }}>
                    {roleOptions.map((r) => <MenuItem key={r.value} value={r.value}>{t(r.label)}</MenuItem>)}
                  </TextField>
                  <Button disabled={!assign.businessId || pending} onClick={() => run(() => setMembership(assign.businessId, user.id, assign.role), { onSuccess: () => { setAssign({ businessId: '', role: 'editor' }); router.refresh(); } })}>{t('Asignar')}</Button>
                </Stack>
              )}
            </Stack>
          </SectionCard>
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, md: 5 }}>
        <Stack spacing={2.5}>
          <SectionCard title={t('Resumen')}>
            <Stack spacing={1} sx={{ pb: 2 }}>
              <Row label={t('Estado')}><StatusChip status={user.status} /></Row>
              <Row label={t('Rol')}>{user.role === 'admin' ? t('Administrador') : t('Usuario')}</Row>
              <Row label={t('Creado')}>{formatDay(user.createdAt)}</Row>
              <Row label={t('Último acceso')}>{formatMoment(user.lastLoginAt)}</Row>
            </Stack>
          </SectionCard>
          <SectionCard title={t('Restablecer contraseña')} description={t('Define una nueva contraseña y compártela con el usuario.')}>
            <Stack spacing={1.5} sx={{ pb: 2 }}>
              <TextField
                size="small"
                label={t('Nueva contraseña')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton size="small" onClick={() => setPassword(generatePassword())} aria-label={t('Generar')}><KeyRound size={15} /></IconButton></InputAdornment> } }}
              />
              <Button variant="outlined" disabled={password.length < 8 || pending || !serviceRoleReady} onClick={() => run(() => resetUserPassword(user.id, { password }), { onSuccess: () => setPassword('') })}>
                {t('Cambiar contraseña')}
              </Button>
            </Stack>
          </SectionCard>
        </Stack>
      </Grid>
    </Grid>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Box sx={{ fontSize: 14 }}>{children}</Box>
    </Stack>
  );
}
