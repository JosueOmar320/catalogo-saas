'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, Chip, Grid, IconButton, InputAdornment, MenuItem, Paper, Stack, Switch, Tab as MuiTab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { SelectControl, TextFieldControl } from '@/components/form/fields';
import { SectionCard } from '@/components/ui/SectionCard';
import { useT } from '@/i18n/client';
import { THEME_PRESETS } from '@/lib/design/presets';
import { env } from '@/lib/env';
import { useAction } from '@/lib/hooks/use-action';
import { slugify } from '@/lib/utils/slug';
import type { MemberRole } from '@/types/database';
import { createBusiness, createCatalog, openBusiness, removeMembership, setBusinessCustomCode, setBusinessFeatures, setBusinessSiteKind, setMembership, updateBusiness, updateCatalog, type CustomCodeMode } from '../actions';
import { BUSINESS_FEATURE_META, BUSINESS_FEATURES, type BusinessFeature, type BusinessFeatures, type FeatureOverrides } from '@/lib/plans/features';
import { SITE_KIND_LABELS, SITE_KINDS, type SiteKind } from '@/lib/business/site-kind';
import { createBusinessSchema, MEMBER_ROLE_LABELS, MEMBER_ROLES, updateBusinessSchema, type CreateBusinessValues, type UpdateBusinessValues } from '../schema';
import { matches, SearchField, StatusChip, useDateFormat } from './common';

type UserOption = { id: string; username: string; fullName: string | null; status: string };
type PlanOption = { id: string; name: string; customCode?: boolean };
const roleOptions = MEMBER_ROLES.map((r) => ({ value: r, label: MEMBER_ROLE_LABELS[r] }));
const publicHost = env.siteUrl.replace(/^https?:\/\//, '');

/* ------------------------------------------------------------ Lista */

export type BusinessListItem = {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  planId: string;
  createdAt: string;
  owners: { id: string; username: string }[];
  members: number;
  catalogs: { id: string; name: string; status: string; isActive: boolean; isDefault: boolean }[];
  /** Funciones apagadas para este negocio (plan + decisión del administrador). */
  featuresOff: BusinessFeature[];
};

type StatusFilter = 'all' | 'active' | 'suspended' | 'limited';

export function BusinessesTable({ businesses }: { businesses: BusinessListItem[] }) {
  const t = useT();
  const { formatDay } = useDateFormat();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const list = businesses.filter(
    (b) => matches(query, b.name, b.slug, ...b.owners.map((o) => o.username)) && (status === 'all' || (status === 'limited' ? b.featuresOff.length > 0 : b.status === status)),
  );
  const count = (filter: StatusFilter) => businesses.filter((b) => (filter === 'all' ? true : filter === 'limited' ? b.featuresOff.length > 0 : b.status === filter)).length;
  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
        <SearchField value={query} onChange={setQuery} placeholder={t('Buscar negocio, dirección o propietario')} />
        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75 }} role="group" aria-label={t('Filtrar negocios')}>
          {([['all', t('Todos')], ['active', t('Activos')], ['suspended', t('Suspendidos')], ['limited', t('Con funciones apagadas')]] as const).map(([value, label]) => (
            <Chip key={value} label={`${label} · ${count(value)}`} color={status === value ? 'primary' : 'default'} variant={status === value ? 'filled' : 'outlined'} onClick={() => setStatus(value)} aria-pressed={status === value} />
          ))}
        </Stack>
      </Stack>
      <Paper variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow>
              <TableCell>{t('Negocio')}</TableCell>
              <TableCell>{t('Propietario')}</TableCell>
              <TableCell>{t('Catálogos')}</TableCell>
              <TableCell>{t('Plan')}</TableCell>
              <TableCell>{t('Estado')}</TableCell>
              <TableCell>{t('Funciones apagadas')}</TableCell>
              <TableCell>{t('Creado')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((b) => (
              <TableRow key={b.id} hover component={Link} href={`/admin/negocios/${b.id}`} sx={{ textDecoration: 'none', cursor: 'pointer' }}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 650 }}>{b.name}</Typography>
                  <Typography variant="caption" color="text.secondary">/{b.slug} · {b.members === 1 ? t('{count} usuario', { count: b.members }) : t('{count} usuarios', { count: b.members })}</Typography>
                </TableCell>
                <TableCell>{b.owners.length ? b.owners.map((o) => `@${o.username}`).join(', ') : <Typography variant="caption" color="text.secondary">{t('Sin propietario')}</Typography>}</TableCell>
                <TableCell>
                  {b.catalogs.map((c) => (
                    <Chip key={c.id} size="small" variant="outlined" label={c.isActive ? c.name : t('{name} (inactivo)', { name: c.name })} sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </TableCell>
                <TableCell>{b.planId}</TableCell>
                <TableCell><StatusChip status={b.status} /></TableCell>
                <TableCell>
                  {b.featuresOff.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">{t('Ninguna')}</Typography>
                  ) : (
                    b.featuresOff.map((f) => <Chip key={f} size="small" color="warning" variant="outlined" label={t(BUSINESS_FEATURE_META[f].label)} sx={{ mr: 0.5, mb: 0.5 }} />)
                  )}
                </TableCell>
                <TableCell><Typography variant="caption">{formatDay(b.createdAt)}</Typography></TableCell>
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>{t('No hay negocios que coincidan.')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Stack>
  );
}

/* ------------------------------------------------------------ Nuevo negocio */

export function CreateBusinessForm({ users, plans, defaultOwner }: { users: UserOption[]; plans: PlanOption[]; defaultOwner?: string }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const { control, handleSubmit, setError, setValue } = useForm<CreateBusinessValues>({
    resolver: zodResolver(createBusinessSchema),
    defaultValues: { name: '', slug: '', ownerId: defaultOwner ?? '', planId: plans[0]?.id ?? 'free', presetId: 'minimal', siteKind: 'catalog', offering: 'products', whatsapp: '' },
  });
  const name = useWatch({ control, name: 'name' });
  const siteKind = useWatch({ control, name: 'siteKind' });
  const slugEdited = useRef(false);
  useEffect(() => {
    if (!slugEdited.current) setValue('slug', slugify(name ?? ''));
  }, [name, setValue]);

  return (
    <Box component="form" noValidate onSubmit={handleSubmit((values) => run(() => createBusiness(values), { setError, onSuccess: ({ id }) => router.push(`/admin/negocios/${id}`) }))}>
      <Stack spacing={2.5}>
        <SectionCard title={t('Negocio')} description={t('Se crea con un catálogo y un sitio inicial listos para editar.')}>
          <Grid container spacing={2} sx={{ pb: 2 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextFieldControl control={control} name="name" label={t('Nombre')} placeholder={t('Restaurante ABC')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextFieldControl
                control={control}
                name="slug"
                label={t('Dirección')}
                onKeyDown={() => (slugEdited.current = true)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">{publicHost}/catalogo/</InputAdornment> } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <SelectControl control={control} name="ownerId" label={t('Propietario')} options={[{ value: '', label: t('Asignar después') }, ...users.filter((u) => u.status === 'active').map((u) => ({ value: u.id, label: `@${u.username}${u.fullName ? ` · ${u.fullName}` : ''}` }))]} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <SelectControl control={control} name="planId" label={t('Plan')} options={plans.map((p) => ({ value: p.id, label: p.name }))} />
            </Grid>
            <Grid size={12}>
              <SelectControl
                control={control}
                name="siteKind"
                label={t('Tipo de sitio')}
                options={SITE_KINDS.map((kind) => ({ value: kind, label: t(SITE_KIND_LABELS[kind].label) }))}
                helperText={t(SITE_KIND_LABELS[siteKind ?? 'catalog'].description)}
              />
            </Grid>
            {siteKind !== 'website' && (
              <Grid size={{ xs: 12, sm: 4 }}>
                <SelectControl control={control} name="offering" label={t('Ofrece')} options={[{ value: 'products', label: t('Productos') }, { value: 'services', label: t('Servicios') }, { value: 'both', label: t('Ambos') }]} />
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 4 }}>
              <SelectControl control={control} name="presetId" label={t('Estilo inicial')} options={THEME_PRESETS.map((p) => ({ value: p.id, label: t(p.name) }))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextFieldControl control={control} name="whatsapp" label={t('WhatsApp (opcional)')} placeholder="+52 55 1234 5678" />
            </Grid>
          </Grid>
        </SectionCard>
        <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
          <Button type="submit" variant="contained" disabled={pending}>{pending ? t('Creando…') : t('Crear negocio')}</Button>
        </Stack>
      </Stack>
    </Box>
  );
}

/* ------------------------------------------------------------ Editar negocio */

type Detail = {
  id: string;
  name: string;
  slug: string;
  planId: string;
  status: 'active' | 'suspended';
  createdAt: string;
  members: { userId: string; username: string; fullName: string | null; status: string; role: MemberRole }[];
  catalogs: { id: string; name: string; status: string; isActive: boolean; isDefault: boolean; updatedAt: string }[];
  /** null = según el plan. */
  customCode: boolean | null;
  siteKind: SiteKind;
  /** Funciones decididas para este negocio (sin clave = según el plan). */
  featureOverrides: FeatureOverrides;
  totals: { items: number; pages: number };
};

type Tab = 'general' | 'features' | 'activity';

/**
 * Ficha de un negocio: arriba lo esencial (estado, plan, tipo, funciones
 * apagadas y acciones); abajo, en pestañas, los datos y usuarios, las
 * funciones que puede usar y su actividad.
 */
export function EditBusinessPanel({ business, users, plans, planDefaults, activity }: { business: Detail; users: UserOption[]; plans: PlanOption[]; planDefaults: BusinessFeatures; activity: React.ReactNode }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('general');
  const effective = effectiveFrom(business.featureOverrides, planDefaults);
  const off = BUSINESS_FEATURES.filter((f) => !effective[f]);
  const plan = plans.find((p) => p.id === business.planId);
  const published = business.catalogs.some((c) => c.isDefault && c.status === 'published' && c.isActive);
  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'center' } }}>
          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              <StatusChip status={business.status} />
              <Chip size="small" variant="outlined" label={t('Plan {plan}', { plan: plan?.name ?? business.planId })} />
              <Chip size="small" variant="outlined" label={t(SITE_KIND_LABELS[business.siteKind].label)} />
              <Chip size="small" variant="outlined" color={published ? 'success' : 'default'} label={published ? t('Sitio publicado') : t('Sitio sin publicar')} />
              {off.map((f) => <Chip key={f} size="small" color="warning" variant="outlined" label={t('Sin {feature}', { feature: t(BUSINESS_FEATURE_META[f].label) })} />)}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {t('{items} productos y servicios · {pages} páginas', { items: business.totals.items, pages: business.totals.pages })} · {business.members.length === 1 ? t('{count} usuario', { count: 1 }) : t('{count} usuarios', { count: business.members.length })}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button href={`/catalogo/${business.slug}`} target="_blank" variant="outlined" startIcon={<ExternalLink size={15} />}>{t('Ver sitio público')}</Button>
            <form action={openBusiness.bind(null, business.id)}>
              <Button type="submit" variant="contained" startIcon={<Pencil size={15} />} disabled={business.status !== 'active'}>{t('Abrir en el editor')}</Button>
            </form>
          </Stack>
        </Stack>
      </Paper>

      <Tabs value={tab} onChange={(_, value: Tab) => setTab(value)} aria-label={t('Secciones del negocio')} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <MuiTab value="general" label={t('General')} />
        <MuiTab value="features" label={off.length ? t('Funciones ({count} apagadas)', { count: off.length }) : t('Funciones')} />
        <MuiTab value="activity" label={t('Actividad')} />
      </Tabs>

      {tab === 'general' && <GeneralTab business={business} users={users} plans={plans} />}
      {tab === 'features' && (
        <Stack spacing={2.5} sx={{ maxWidth: 900 }}>
          <FeaturesCard business={business} planDefaults={planDefaults} planName={plan?.name ?? business.planId} />
          <SiteKindCard business={business} />
          <CustomCodeCard business={business} plan={plan} />
        </Stack>
      )}
      {tab === 'activity' && activity}
    </Stack>
  );
}

const effectiveFrom = (overrides: FeatureOverrides, defaults: BusinessFeatures): BusinessFeatures =>
  Object.fromEntries(BUSINESS_FEATURES.map((f) => [f, overrides[f] ?? defaults[f]])) as BusinessFeatures;

function GeneralTab({ business, users, plans }: { business: Detail; users: UserOption[]; plans: PlanOption[] }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const form = useForm<UpdateBusinessValues>({ resolver: zodResolver(updateBusinessSchema), defaultValues: { name: business.name, slug: business.slug, planId: business.planId, status: business.status } });
  const [add, setAdd] = useState<{ userId: string; role: MemberRole }>({ userId: '', role: 'editor' });
  const [newCatalog, setNewCatalog] = useState('');
  const candidates = users.filter((u) => u.status === 'active' && !business.members.some((m) => m.userId === u.id));
  const refresh = () => router.refresh();

  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, md: 7 }}>
        <Stack spacing={2.5}>
          <SectionCard title={t('Datos')}>
            <Stack component="form" spacing={2} sx={{ pb: 2 }} onSubmit={form.handleSubmit((v) => run(() => updateBusiness(business.id, v), { setError: form.setError, onSuccess: () => { form.reset(v); refresh(); } }))}>
              <TextFieldControl control={form.control} name="name" label={t('Nombre')} />
              <TextFieldControl control={form.control} name="slug" label={t('Dirección')} slotProps={{ input: { startAdornment: <InputAdornment position="start">{publicHost}/catalogo/</InputAdornment> } }} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <SelectControl control={form.control} name="planId" label={t('Plan')} options={plans.map((p) => ({ value: p.id, label: p.name }))} />
                <SelectControl control={form.control} name="status" label={t('Estado')} options={[{ value: 'active', label: t('Activo') }, { value: 'suspended', label: t('Suspendido (sin acceso ni sitio público)') }]} />
              </Stack>
              <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
                <Button type="submit" variant="contained" disabled={pending || !form.formState.isDirty}>{t('Guardar')}</Button>
              </Stack>
            </Stack>
          </SectionCard>

          <SectionCard title={t('Usuarios con acceso')} description={t('Las funciones apagadas del negocio aplican a todos ellos.')}>
            <Stack spacing={1} sx={{ pb: 2 }}>
              {business.members.length === 0 && <Typography variant="body2" color="text.secondary">{t('Nadie tiene acceso todavía.')}</Typography>}
              {business.members.map((m) => (
                <Stack key={m.userId} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }} component={Link} href={`/admin/usuarios/${m.userId}`}>@{m.username}</Typography>
                    <Typography variant="caption" color="text.secondary" component="p">{m.fullName || ' '}{m.status !== 'active' ? ` · ${t('desactivado')}` : ''}</Typography>
                  </Box>
                  <TextField select size="small" value={m.role} onChange={(e) => run(() => setMembership(business.id, m.userId, e.target.value as MemberRole), { onSuccess: refresh })} sx={{ width: 170 }} slotProps={{ htmlInput: { 'aria-label': t('Rol de {username}', { username: m.username }) } }}>
                    {roleOptions.map((r) => <MenuItem key={r.value} value={r.value}>{t(r.label)}</MenuItem>)}
                  </TextField>
                  <IconButton onClick={() => run(() => removeMembership(business.id, m.userId), { onSuccess: refresh })} aria-label={t('Quitar a {username}', { username: m.username })}><Trash2 size={16} /></IconButton>
                </Stack>
              ))}
              {candidates.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', pt: 1 }}>
                  <TextField select size="small" label={t('Agregar usuario')} value={add.userId} onChange={(e) => setAdd({ ...add, userId: e.target.value })} sx={{ flex: 1 }}>
                    {candidates.map((u) => <MenuItem key={u.id} value={u.id}>@{u.username}{u.fullName ? ` · ${u.fullName}` : ''}</MenuItem>)}
                  </TextField>
                  <TextField select size="small" value={add.role} onChange={(e) => setAdd({ ...add, role: e.target.value as MemberRole })} sx={{ width: 170 }}>
                    {roleOptions.map((r) => <MenuItem key={r.value} value={r.value}>{t(r.label)}</MenuItem>)}
                  </TextField>
                  <Button disabled={!add.userId || pending} onClick={() => run(() => setMembership(business.id, add.userId, add.role), { onSuccess: () => { setAdd({ userId: '', role: 'editor' }); refresh(); } })}>{t('Asignar')}</Button>
                </Stack>
              )}
            </Stack>
          </SectionCard>
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, md: 5 }}>
        <SectionCard title={t('Catálogos')} description={t('El editor y el sitio público usan el catálogo predeterminado.')}>
          <Stack spacing={1} sx={{ pb: 2 }}>
            {business.catalogs.map((c) => (
              <CatalogRow key={c.id} catalog={c} onChange={refresh} />
            ))}
            <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
              <TextField size="small" label={t('Nuevo catálogo')} value={newCatalog} onChange={(e) => setNewCatalog(e.target.value)} sx={{ flex: 1 }} />
              <Button startIcon={<Plus size={15} />} disabled={!newCatalog.trim() || pending} onClick={() => run(() => createCatalog(business.id, newCatalog), { onSuccess: () => { setNewCatalog(''); refresh(); } })}>{t('Crear')}</Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">{t('«Abrir en el editor» te deja operar como dueño; los cambios quedan en la auditoría con tu usuario.')}</Typography>
          </Stack>
        </SectionCard>
      </Grid>
    </Grid>
  );
}

type FeatureMode = 'plan' | 'on' | 'off';

/** Cada función: según el plan, encendida o apagada sólo para este negocio (y todos sus usuarios). */
function FeaturesCard({ business, planDefaults, planName }: { business: Detail; planDefaults: BusinessFeatures; planName: string }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const modeOf = (f: BusinessFeature): FeatureMode => (business.featureOverrides[f] === undefined ? 'plan' : business.featureOverrides[f] ? 'on' : 'off');
  const change = (feature: BusinessFeature, mode: FeatureMode) => {
    const next: FeatureOverrides = { ...business.featureOverrides };
    if (mode === 'plan') delete next[feature];
    else next[feature] = mode === 'on';
    run(() => setBusinessFeatures(business.id, next), { onSuccess: () => router.refresh() });
  };
  return (
    <SectionCard title={t('Funciones')} description={t('Apaga lo que este negocio no debe usar. Aplica a todos sus usuarios: desaparece del menú y del panel, y el servidor lo rechaza.')}>
      <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />} sx={{ pb: 1 }}>
        {BUSINESS_FEATURES.map((feature) => {
          const mode = modeOf(feature);
          const on = mode === 'plan' ? planDefaults[feature] : mode === 'on';
          return (
            <Stack key={feature} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ py: 1.5, alignItems: { sm: 'center' } }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 650 }}>{t(BUSINESS_FEATURE_META[feature].label)}</Typography>
                  <Chip size="small" label={on ? t('Encendida') : t('Apagada')} color={on ? 'success' : 'default'} variant={on ? 'filled' : 'outlined'} />
                </Stack>
                <Typography variant="caption" color="text.secondary">{t(BUSINESS_FEATURE_META[feature].description)}</Typography>
              </Box>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={mode}
                disabled={pending}
                onChange={(_, value: FeatureMode | null) => value && value !== mode && change(feature, value)}
                aria-label={t(BUSINESS_FEATURE_META[feature].label)}
                sx={{ flexShrink: 0 }}
              >
                <ToggleButton value="plan" sx={{ textTransform: 'none', px: 1.25 }}>{t('Plan {plan} ({value})', { plan: planName, value: planDefaults[feature] ? t('sí') : t('no') })}</ToggleButton>
                <ToggleButton value="on" sx={{ textTransform: 'none', px: 1.25 }}>{t('Encender')}</ToggleButton>
                <ToggleButton value="off" sx={{ textTransform: 'none', px: 1.25 }}>{t('Apagar')}</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          );
        })}
      </Stack>
    </SectionCard>
  );
}

export function CatalogRow({ catalog, onChange, businessName }: { catalog: { id: string; name: string; status: string; isActive: boolean; isDefault: boolean }; onChange: () => void; businessName?: string }) {
  const t = useT();
  const { run, pending } = useAction();
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{catalog.name}{businessName ? ` · ${businessName}` : ''}</Typography>
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
          <StatusChip status={catalog.status as 'draft' | 'published' | 'unpublished'} />
          {catalog.isDefault ? <Chip size="small" label={t('Predeterminado')} color="primary" variant="outlined" /> : (
            <Chip size="small" label={t('Hacer predeterminado')} onClick={() => run(() => updateCatalog(catalog.id, { name: catalog.name, isActive: catalog.isActive, makeDefault: true }), { onSuccess: onChange })} disabled={pending} />
          )}
        </Stack>
      </Box>
      <Stack sx={{ alignItems: 'center' }}>
        <Switch checked={catalog.isActive} disabled={pending} onChange={(e) => run(() => updateCatalog(catalog.id, { name: catalog.name, isActive: e.target.checked }), { onSuccess: onChange })} slotProps={{ input: { 'aria-label': t('Activo') } }} />
        <Typography variant="caption" color="text.secondary">{catalog.isActive ? t('Activo') : t('Inactivo')}</Typography>
      </Stack>
    </Stack>
  );
}

/** Código propio (HTML, widgets y CSS): según el plan, o una decisión sólo para este negocio. */
function CustomCodeCard({ business, plan }: { business: Detail; plan?: PlanOption }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const mode: CustomCodeMode = business.customCode === null ? 'plan' : business.customCode ? 'on' : 'off';
  const planLabel = plan?.customCode ? t('Según el plan ({plan}: activado)', { plan: plan.name }) : t('Según el plan ({plan}: desactivado)', { plan: plan?.name ?? business.planId });
  return (
    <SectionCard title={t('Código propio')} description={t('Sección HTML, widgets con código y CSS propio en el editor del sitio. El HTML se limpia y los widgets corren aislados, pero el contenido lo decide el negocio: actívalo sólo para quien lo necesite.')}>
      <Stack sx={{ pb: 2 }}>
        <TextField
          select
          label={t('Código propio')}
          value={mode}
          disabled={pending}
          onChange={(e) => run(() => setBusinessCustomCode(business.id, e.target.value as CustomCodeMode), { onSuccess: () => router.refresh() })}
        >
          <MenuItem value="plan">{planLabel}</MenuItem>
          <MenuItem value="on">{t('Activado para este negocio')}</MenuItem>
          <MenuItem value="off">{t('Desactivado para este negocio')}</MenuItem>
        </TextField>
      </Stack>
    </SectionCard>
  );
}

/** Negocio con catálogo o sitio web (lo que muestran el panel y el editor; no borra datos). */
function SiteKindCard({ business }: { business: Detail }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  return (
    <SectionCard title={t('Tipo de sitio')} description={t('Un sitio web oculta productos, servicios, pedidos, reseñas y el PDF del panel y del editor. Cambiarlo no borra nada.')}>
      <Stack sx={{ pb: 2 }}>
        <TextField
          select
          label={t('Tipo de sitio')}
          value={business.siteKind}
          disabled={pending}
          onChange={(e) => run(() => setBusinessSiteKind(business.id, e.target.value as SiteKind), { onSuccess: () => router.refresh() })}
          helperText={t(SITE_KIND_LABELS[business.siteKind].description)}
        >
          {SITE_KINDS.map((kind) => <MenuItem key={kind} value={kind}>{t(SITE_KIND_LABELS[kind].label)}</MenuItem>)}
        </TextField>
      </Stack>
    </SectionCard>
  );
}
