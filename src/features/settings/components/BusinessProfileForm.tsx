'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, InputAdornment, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { WriteWithGarfield } from '@/features/assistant/components/WriteWithGarfield';
import { TextFieldControl } from '@/components/form/fields';
import { SectionCard } from '@/components/ui/SectionCard';
import { updateBusinessProfile } from '@/features/business/actions';
import { SLUG_STATUS_TEXT, useSlugAvailability } from '@/features/business/use-slug-availability';
import { businessProfileSchema, type BusinessProfileValues } from '@/features/business/schema';
import { updateCatalogSettings } from '@/features/catalog/actions';
import { LOCALE_LABELS, LOCALES, type Locale } from '@/i18n/config';
import { useT } from '@/i18n/client';
import { CURRENCIES, type PriceFormat } from '@/lib/catalog/settings';
import { formatPrice } from '@/lib/utils/format';
import { env } from '@/lib/env';
import { useAction } from '@/lib/hooks/use-action';

type Currency = (typeof CURRENCIES)[number];

export function BusinessProfileForm({ defaultValues, currency, language, priceFormat }: { defaultValues: BusinessProfileValues; currency: Currency; language: Locale; priceFormat: PriceFormat }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const { control, handleSubmit, setError, reset, formState, getValues, setValue } = useForm<BusinessProfileValues>({
    resolver: zodResolver(businessProfileSchema),
    defaultValues,
  });
  const slug = useWatch({ control, name: 'slug' });
  const slugState = useSlugAvailability(slug, defaultValues.slug);
  const [currentCurrency, setCurrentCurrency] = useState<Currency>(currency);
  const [siteLanguage, setSiteLanguage] = useState<Locale>(language);

  const slugHelper = slugState === 'idle' ? t('Cambiarla rompe los enlaces que ya compartiste.') : t(SLUG_STATUS_TEXT[slugState]);

  return (
    <Stack spacing={2.5}>
      <SectionCard title={t('Datos del negocio')}>
        <Stack
          component="form"
          spacing={2}
          onSubmit={handleSubmit((values) => run(() => updateBusinessProfile(values), { setError, onSuccess: () => { reset(values); router.refresh(); } }))}
        >
          <TextFieldControl control={control} name="name" label={t('Nombre del negocio')} />
          <TextFieldControl
            control={control}
            name="slug"
            label={t('Dirección del catálogo')}
            helperText={slugHelper}
            color={slugState === 'ok' ? 'success' : undefined}
            slotProps={{ input: { startAdornment: <InputAdornment position="start">{env.siteUrl.replace(/^https?:\/\//, '')}/catalogo/</InputAdornment> } }}
          />
          <TextFieldControl control={control} name="slogan" label={t('Slogan')} placeholder={t('Ej. Café recién tostado, pan recién horneado.')} helperText={t('Frase corta: aparece en el hero, el pie de página, el PDF y al compartir.')} />
          <WriteWithGarfield kind="business_slogan" getInput={() => ({ current: getValues('slogan') ?? '' })} onPick={(text) => setValue('slogan', text, { shouldDirty: true, shouldValidate: true })} />
          <TextFieldControl control={control} name="description" label={t('Descripción')} multiline minRows={3} helperText={t('Se usa en buscadores y como respaldo del slogan.')} />
          <WriteWithGarfield kind="business_description" getInput={() => ({ current: getValues('description') ?? '' })} onPick={(text) => setValue('description', text, { shouldDirty: true, shouldValidate: true })} />
          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" disabled={pending || !formState.isDirty || slugState === 'taken'}>{t('Guardar')}</Button>
          </Stack>
        </Stack>
      </SectionCard>

      <SectionCard title={t('Moneda')} description={t('Moneda predeterminada para ítems nuevos.')}>
        <TextField
          select
          value={currentCurrency}
          sx={{ maxWidth: 200 }}
          onChange={(e) => {
            const value = e.target.value as Currency;
            setCurrentCurrency(value);
            void run(() => updateCatalogSettings({ currency: value }), { onSuccess: () => router.refresh() });
          }}
          slotProps={{ select: { native: true }, htmlInput: { 'aria-label': t('Moneda') } }}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </TextField>
      </SectionCard>

      <SectionCard title={t('Idioma del sitio')} description={t('Idioma de los textos fijos del sitio público y del PDF: botones, filtros y avisos. Tus propios textos (productos, páginas) no se traducen.')}>
        <TextField
          select
          value={siteLanguage}
          sx={{ maxWidth: 200 }}
          onChange={(e) => {
            const value = e.target.value as Locale;
            setSiteLanguage(value);
            void run(() => updateCatalogSettings({ language: value }), { onSuccess: () => router.refresh() });
          }}
          slotProps={{ select: { native: true }, htmlInput: { 'aria-label': t('Idioma del sitio') } }}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
          ))}
        </TextField>
      </SectionCard>

      <PriceFormatCard currency={currentCurrency} initial={priceFormat} />
    </Stack>
  );
}

/** Cómo se escriben los precios en el sitio y el PDF: "VALOR: $30", "365 C$", "$1,200.00". */
function PriceFormatCard({ currency, initial }: { currency: Currency; initial: PriceFormat }) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const [format, setFormat] = useState<PriceFormat>(initial);
  const dirty = JSON.stringify(format) !== JSON.stringify(initial);
  const set = (patch: Partial<PriceFormat>) => setFormat((f) => ({ ...f, ...patch }));
  return (
    <SectionCard title={t('Formato de precios')} description={t('Cómo se muestran los precios en el sitio y en el PDF.')}>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField label={t('Texto antes del precio')} placeholder={t('Ej. VALOR:')} value={format.prefix} onChange={(e) => set({ prefix: e.target.value })} slotProps={{ htmlInput: { maxLength: 20 } }} sx={{ flex: 1 }} />
          <TextField select label={t('Moneda')} value={format.currencyDisplay} onChange={(e) => set({ currencyDisplay: e.target.value as PriceFormat['currencyDisplay'] })} sx={{ flex: 1 }}>
            <MenuItem value="symbol">{t('Símbolo ($)')}</MenuItem>
            <MenuItem value="code">{t('Código ({currency})', { currency })}</MenuItem>
            <MenuItem value="none">{t('Sin moneda')}</MenuItem>
          </TextField>
          <TextField select label={t('Posición')} value={format.position} onChange={(e) => set({ position: e.target.value as PriceFormat['position'] })} sx={{ flex: 1 }} disabled={format.currencyDisplay === 'none'}>
            <MenuItem value="before">{t('Antes (C$ 365)')}</MenuItem>
            <MenuItem value="after">{t('Después (365 C$)')}</MenuItem>
          </TextField>
          <TextField select label={t('Decimales')} value={format.decimals} onChange={(e) => set({ decimals: e.target.value as PriceFormat['decimals'] })} sx={{ flex: 1 }}>
            <MenuItem value="auto">{t('Automático')}</MenuItem>
            <MenuItem value="0">{t('Sin decimales')}</MenuItem>
            <MenuItem value="2">{t('Siempre 2')}</MenuItem>
          </TextField>
        </Stack>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            {t('Ejemplo:')} <strong>{formatPrice(1250, currency, 'es-419', format)}</strong> · <strong>{formatPrice(30, currency, 'es-419', format)}</strong>
          </Typography>
          <Button variant="contained" disabled={!dirty || pending} onClick={() => run(() => updateCatalogSettings({ priceFormat: format }), { onSuccess: () => router.refresh() })}>
            {t('Guardar')}
          </Button>
        </Stack>
      </Stack>
    </SectionCard>
  );
}
