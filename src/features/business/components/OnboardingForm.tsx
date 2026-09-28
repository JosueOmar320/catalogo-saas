'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, ButtonBase, Grid, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material';
import { Package, Sparkles, Wrench } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { TextFieldControl } from '@/components/form/fields';
import { applyPreset, getPreset, THEME_PRESETS } from '@/lib/design/presets';
import { DEFAULT_THEME } from '@/lib/design/theme';
import { env } from '@/lib/env';
import { useAction } from '@/lib/hooks/use-action';
import { buildSampleSite } from '@/lib/site/sample-site';
import { slugify, slugifyLive } from '@/lib/utils/slug';
import { SiteView } from '@/site-renderer';
import { createBusiness } from '../actions';
import { onboardingSchema, type OnboardingValues } from '../schema';
import { SLUG_STATUS_TEXT, useSlugAvailability } from '../use-slug-availability';

const OFFERINGS = [
  { value: 'products', label: 'Productos', icon: Package },
  { value: 'services', label: 'Servicios', icon: Wrench },
  { value: 'both', label: 'Ambos', icon: Sparkles },
] as const;

function Choice({ selected, onClick, children, label }: { selected: boolean; onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      sx={{ display: 'block', width: '100%', textAlign: 'left', p: 1.25, borderRadius: 1.5, border: 1, borderColor: selected ? 'primary.main' : 'divider', boxShadow: selected ? (t) => `0 0 0 1px ${t.palette.primary.main}` : 'none' }}
    >
      {children}
    </ButtonBase>
  );
}

/** Crear negocio: nombre, dirección, WhatsApp, estilo y qué ofrece, con preview en vivo. */
export function OnboardingForm() {
  const { run, pending } = useAction();
  const { control, handleSubmit, setError, setValue } = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { name: '', slug: '', whatsapp: '', presetId: 'minimal', offering: 'products' },
  });
  const [name, slug, presetId] = useWatch({ control, name: ['name', 'slug', 'presetId'] });
  const slugEdited = useRef(false);
  const slugState = useSlugAvailability(slug);

  // La dirección se genera desde el nombre hasta que el usuario la edita.
  useEffect(() => {
    if (!slugEdited.current) setValue('slug', slugify(name));
  }, [name, setValue]);

  const site = useMemo(
    () => buildSampleSite({ theme: applyPreset(DEFAULT_THEME, getPreset(presetId)), businessName: name || 'Tu negocio' }),
    [presetId, name],
  );

  return (
    <Grid container spacing={4}>
      <Grid size={{ xs: 12, md: 5 }}>
        <Typography variant="h1">Crea tu sitio</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
          Sólo lo básico. Todo se puede cambiar después desde el editor.
        </Typography>
        <Stack component="form" spacing={3} noValidate onSubmit={handleSubmit((values) => run(() => createBusiness(values), { setError }))}>
          <Stack spacing={2}>
            <TextFieldControl control={control} name="name" label="Nombre de tu negocio" autoFocus placeholder="Ej. Panadería La Espiga" />
            <Controller
              control={control}
              name="slug"
              render={({ field, fieldState }) => (
                <TextField
                  label="Dirección de tu sitio"
                  value={field.value}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  onChange={(e) => {
                    slugEdited.current = true;
                    field.onChange(slugifyLive(e.target.value));
                  }}
                  color={slugState === 'ok' ? 'success' : undefined}
                  error={slugState === 'taken' || Boolean(fieldState.error)}
                  helperText={fieldState.error?.message ?? SLUG_STATUS_TEXT[slugState]}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start">/catalogo/</InputAdornment> } }}
                />
              )}
            />
            <TextFieldControl control={control} name="whatsapp" label="WhatsApp (opcional)" placeholder="+52 55 1234 5678" helperText="Tus clientes podrán escribirte desde cada producto." />
          </Stack>

          <Box>
            <Typography variant="h4" sx={{ mb: 1 }}>¿Qué ofreces?</Typography>
            <Controller
              control={control}
              name="offering"
              render={({ field }) => (
                <Grid container spacing={1}>
                  {OFFERINGS.map(({ value, label, icon: Icon }) => (
                    <Grid key={value} size={4}>
                      <Choice label={label} selected={field.value === value} onClick={() => field.onChange(value)}>
                        <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
                          <Icon size={18} />
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>{label}</Typography>
                        </Stack>
                      </Choice>
                    </Grid>
                  ))}
                </Grid>
              )}
            />
          </Box>

          <Box>
            <Typography variant="h4" sx={{ mb: 1 }}>Elige un estilo inicial</Typography>
            <Controller
              control={control}
              name="presetId"
              render={({ field }) => (
                <Grid container spacing={1}>
                  {THEME_PRESETS.map((p) => (
                    <Grid key={p.id} size={{ xs: 6, sm: 4 }}>
                      <Choice label={p.name} selected={field.value === p.id} onClick={() => field.onChange(p.id)}>
                        <Stack direction="row" spacing={0.5} sx={{ mb: 0.75 }}>
                          {p.swatch.map((c, i) => (
                            <Box key={i} sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: c, border: 1, borderColor: 'rgba(0,0,0,0.12)' }} />
                          ))}
                        </Stack>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                      </Choice>
                    </Grid>
                  ))}
                </Grid>
              )}
            />
          </Box>

          <Button type="submit" variant="contained" size="large" disabled={pending || slugState === 'taken'}>
            {pending ? 'Creando…' : 'Crear mi sitio'}
          </Button>
        </Stack>
      </Grid>

      <Grid size={{ xs: 12, md: 7 }} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Typography variant="overline" color="text.secondary">
          Vista previa · {env.siteUrl.replace(/^https?:\/\//, '')}/catalogo/{slug || 'tu-negocio'}
        </Typography>
        <Paper variant="outlined" sx={{ mt: 1, height: 680, overflowY: 'auto', borderRadius: 2 }} onClickCapture={(e) => e.preventDefault()}>
          <SiteView site={site} env={{ mode: 'preview', basePath: '/demo', currentPageId: null }} />
        </Paper>
      </Grid>
    </Grid>
  );
}
