'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, InputAdornment, Stack, TextField } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { TextFieldControl } from '@/components/form/fields';
import { SectionCard } from '@/components/ui/SectionCard';
import { updateBusinessProfile } from '@/features/business/actions';
import { SLUG_STATUS_TEXT, useSlugAvailability } from '@/features/business/use-slug-availability';
import { businessProfileSchema, type BusinessProfileValues } from '@/features/business/schema';
import { updateCatalogSettings } from '@/features/catalog/actions';
import { CURRENCIES } from '@/lib/catalog/settings';
import { env } from '@/lib/env';
import { useAction } from '@/lib/hooks/use-action';

type Currency = (typeof CURRENCIES)[number];

export function BusinessProfileForm({ defaultValues, currency }: { defaultValues: BusinessProfileValues; currency: Currency }) {
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
    </Stack>
  );
}
