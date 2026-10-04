'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, InputAdornment, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { TextFieldControl } from '@/components/form/fields';
import { SectionCard } from '@/components/ui/SectionCard';
import { updateBusinessProfile } from '@/features/business/actions';
import { SLUG_STATUS_TEXT, useSlugAvailability } from '@/features/business/use-slug-availability';
import { businessProfileSchema, type BusinessProfileValues } from '@/features/business/schema';
import { updateCatalogSettings } from '@/features/catalog/actions';
import { CURRENCIES, type PriceFormat } from '@/lib/catalog/settings';
import { formatPrice } from '@/lib/utils/format';
import { env } from '@/lib/env';
import { useAction } from '@/lib/hooks/use-action';

type Currency = (typeof CURRENCIES)[number];

export function BusinessProfileForm({ defaultValues, currency, priceFormat }: { defaultValues: BusinessProfileValues; currency: Currency; priceFormat: PriceFormat }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const { control, handleSubmit, setError, reset, formState } = useForm<BusinessProfileValues>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues,
  });
  const slug = useWatch({ control, name: 'slug' });
  const slugState = useSlugAvailability(slug, defaultValues.slug);
  const [currentCurrency, setCurrentCurrency] = useState<Currency>(currency);

  const slugHelper = slugState === 'idle' ? 'Cambiarla rompe los enlaces que ya compartiste.' : SLUG_STATUS_TEXT[slugState];

  return (
    <Stack spacing={2.5}>
      <SectionCard title="Datos del negocio">
        <Stack
          component="form"
          spacing={2}
          onSubmit={handleSubmit((values) => run(() => updateBusinessProfile(values), { setError, onSuccess: () => { reset(values); router.refresh(); } }))}
        >
          <TextFieldControl control={control} name="name" label="Nombre del negocio" />
          <TextFieldControl
            control={control}
            name="slug"
            label="Dirección del catálogo"
            helperText={slugHelper}
            color={slugState === 'ok' ? 'success' : undefined}
            slotProps={{ input: { startAdornment: <InputAdornment position="start">{env.siteUrl.replace(/^https?:\/\//, '')}/catalogo/</InputAdornment> } }}
          />
          <TextFieldControl control={control} name="slogan" label="Slogan" placeholder="Ej. Café recién tostado, pan recién horneado." helperText="Frase corta: aparece en el hero, el pie de página, el PDF y al compartir." />
          <TextFieldControl control={control} name="description" label="Descripción" multiline minRows={3} helperText="Se usa en buscadores y como respaldo del slogan." />
          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" disabled={pending || !formState.isDirty || slugState === 'taken'}>Guardar</Button>
          </Stack>
        </Stack>
      </SectionCard>

      <SectionCard title="Moneda" description="Moneda predeterminada para ítems nuevos.">
        <TextField
          select
          value={currentCurrency}
          sx={{ maxWidth: 200 }}
          onChange={(e) => {
            const value = e.target.value as Currency;
            setCurrentCurrency(value);
            void run(() => updateCatalogSettings({ currency: value }), { onSuccess: () => router.refresh() });
          }}
          slotProps={{ select: { native: true }, htmlInput: { 'aria-label': 'Moneda' } }}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </TextField>
      </SectionCard>

      <PriceFormatCard currency={currentCurrency} initial={priceFormat} />
    </Stack>
  );
}

/** Cómo se escriben los precios en el sitio y el PDF: "VALOR: $30", "365 C$", "$1,200.00". */
function PriceFormatCard({ currency, initial }: { currency: Currency; initial: PriceFormat }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [format, setFormat] = useState<PriceFormat>(initial);
  const dirty = JSON.stringify(format) !== JSON.stringify(initial);
  const set = (patch: Partial<PriceFormat>) => setFormat((f) => ({ ...f, ...patch }));
  return (
    <SectionCard title="Formato de precios" description="Cómo se muestran los precios en el sitio y en el PDF.">
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField label="Texto antes del precio" placeholder="Ej. VALOR:" value={format.prefix} onChange={(e) => set({ prefix: e.target.value })} slotProps={{ htmlInput: { maxLength: 20 } }} sx={{ flex: 1 }} />
          <TextField select label="Moneda" value={format.currencyDisplay} onChange={(e) => set({ currencyDisplay: e.target.value as PriceFormat['currencyDisplay'] })} sx={{ flex: 1 }}>
            <MenuItem value="symbol">Símbolo ($)</MenuItem>
            <MenuItem value="code">Código ({currency})</MenuItem>
            <MenuItem value="none">Sin moneda</MenuItem>
          </TextField>
          <TextField select label="Posición" value={format.position} onChange={(e) => set({ position: e.target.value as PriceFormat['position'] })} sx={{ flex: 1 }} disabled={format.currencyDisplay === 'none'}>
            <MenuItem value="before">Antes (C$ 365)</MenuItem>
            <MenuItem value="after">Después (365 C$)</MenuItem>
          </TextField>
          <TextField select label="Decimales" value={format.decimals} onChange={(e) => set({ decimals: e.target.value as PriceFormat['decimals'] })} sx={{ flex: 1 }}>
            <MenuItem value="auto">Automático</MenuItem>
            <MenuItem value="0">Sin decimales</MenuItem>
            <MenuItem value="2">Siempre 2</MenuItem>
          </TextField>
        </Stack>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            Ejemplo: <strong>{formatPrice(1250, currency, 'es-419', format)}</strong> · <strong>{formatPrice(30, currency, 'es-419', format)}</strong>
          </Typography>
          <Button variant="contained" disabled={!dirty || pending} onClick={() => run(() => updateCatalogSettings({ priceFormat: format }), { onSuccess: () => router.refresh() })}>
            Guardar
          </Button>
        </Stack>
      </Stack>
    </SectionCard>
  );
}
