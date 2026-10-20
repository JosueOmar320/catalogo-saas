'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Chip,
  Grid,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { ChevronDown, Package, Wrench } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { GalleryField } from '@/components/form/GalleryField';
import { SelectControl, SwitchControl, TextFieldControl } from '@/components/form/fields';
import { PageHeader } from '@/components/ui/PageHeader';
import { SaveBar } from '@/components/ui/SaveBar';
import { SectionCard } from '@/components/ui/SectionCard';
import { WriteWithGarfield } from '@/features/assistant/components/WriteWithGarfield';
import { useT } from '@/i18n/client';
import { DIET_TAGS, type DietTag } from '@/lib/catalog/item-attributes';
import { marginOf } from '@/lib/catalog/margin';
import { CURRENCIES } from '@/lib/catalog/settings';
import { formatPrice } from '@/lib/utils/format';
import { priceToNumber } from '@/lib/utils/validation';
import { msg } from '@/i18n/translate';
import type { SiteViewModel } from '@/lib/site/view-model';
import type { CatalogItemView } from '@/lib/catalog/view-model';
import { ColorField } from '@/components/form/ColorField';
import { useAction } from '@/lib/hooks/use-action';
import { useUnsavedChangesWarning } from '@/lib/hooks/use-unsaved-changes';
import { saveItem } from '../actions';
import { ITEM_TYPE_LABELS, itemFormSchema, type ItemFormValues } from '../schema';
import { ItemAttributesFields } from './ItemAttributesFields';
import { ItemCardPreview } from './ItemCardPreview';
import { ExtrasField, OrderHoursField } from './ExtrasField';
import { TiersField } from './TiersField';
import { VariantsField } from './VariantsField';
import { CopyFromProduct } from './CopyFromProduct';

type Props = {
  itemId: string | null;
  defaultValues: ItemFormValues;
  categories: { id: string; name: string }[];
  previewSite: SiteViewModel;
};

const FORM_ID = 'item-form';

const DIET_OPTION_LABELS: Record<DietTag, string> = {
  vegan: msg('Vegano'),
  vegetarian: msg('Vegetariano'),
  'gluten-free': msg('Sin gluten'),
  'lactose-free': msg('Sin lactosa'),
  'sugar-free': msg('Sin azúcar'),
  spicy: msg('Picante'),
  organic: msg('Orgánico'),
};

export function ItemForm({ itemId, defaultValues, categories, previewSite }: Props) {
  const t = useT();
  const router = useRouter();
  const { run, pending } = useAction();
  const form = useForm<ItemFormValues>({ resolver: zodResolver(itemFormSchema), defaultValues });
  const { control, handleSubmit, reset, setError, setValue, formState } = form;
  const others = previewSite.items.filter((item) => item.id !== itemId);
  const newId = () => crypto.randomUUID().slice(0, 8);
  const dirty = { shouldDirty: true, shouldValidate: formState.isSubmitted };
  const copyVariants = (source: CatalogItemView) => {
    if (!source.variants) return;
    setValue('variantsEnabled', true, dirty);
    setValue('variantsLabel', source.variants.label, dirty);
    setValue('variants', source.variants.options.map((o) => ({ id: newId(), name: o.name, price: o.price === null ? '' : String(o.price), sku: '', available: o.available })), dirty);
  };
  const copyExtras = (source: CatalogItemView) => {
    if (!source.extras) return;
    setValue('extrasEnabled', true, dirty);
    setValue('extrasLabel', source.extras.label, dirty);
    setValue('extrasMax', source.extras.max === null ? '' : String(source.extras.max), dirty);
    setValue('extras', source.extras.options.map((o) => ({ id: newId(), name: o.name, price: o.price ? String(o.price) : '', available: o.available })), dirty);
  };
  const values = useWatch({ control }) as ItemFormValues;
  /** Lo que Garfield necesita para redactar (el formulario aún sin guardar). */
  const garfieldInput = (current: string) => ({
    current,
    item: {
      name: values.name ?? '',
      type: values.type === 'service' ? ('service' as const) : ('product' as const),
      category: categories.find((c) => c.id === values.categoryId)?.name ?? '',
      price: values.price ? `${values.price} ${values.currency ?? ''}`.trim() : '',
      details: [values.shortDescription, values.description, values.tags?.length ? values.tags.join(', ') : ''].filter(Boolean).join('\n').slice(0, 1000),
    },
  });
  // Margen con el costo privado (no se publica).
  const margin = marginOf(priceToNumber(values.price ?? ''), priceToNumber(values.cost ?? ''));
  const marginText = margin
    ? margin.amount < 0
      ? t('Vendes por debajo del costo: pierdes {amount} por pieza.', { amount: formatPrice(-margin.amount, values.currency, previewSite.settings.locale) })
      : t('Margen: {percent} % ({amount} por pieza). No se publica.', { percent: margin.percent, amount: formatPrice(margin.amount, values.currency, previewSite.settings.locale) })
    : t('Opcional, para ver tu margen. No se publica.');
  const labels = ITEM_TYPE_LABELS[values.type];
  const isNew = itemId === null;
  useUnsavedChangesWarning(formState.isDirty);

  const submit = (addAnother: boolean) =>
    handleSubmit((data) =>
      // La fecha de fin de la oferta se entiende en la zona horaria de quien la programa.
      run(() => saveItem(itemId, { ...data, saleTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }), {
        setError,
        onSuccess: ({ id }) => {
          if (addAnother) {
            reset({ ...defaultValues, type: data.type, categoryId: data.categoryId, currency: data.currency });
            return;
          }
          reset(data);
          if (isNew) router.replace(`/dashboard/catalog/items/${id}`);
          router.refresh();
        },
      }),
    );

  const listHref = values.type === 'service' ? '/dashboard/catalog/services' : '/dashboard/catalog/products';
  const [attributesHintBefore, attributesHintAfter] = t('Define atributos como Marca, Material, Tamaño o Duración en {link} para completarlos aquí, filtrar por ellos y compararlos en el PDF.').split('{link}');

  return (
    <Box component="form" id={FORM_ID} onSubmit={submit(false)} noValidate>
      <PageHeader
        title={isNew ? t(labels.newLabel) : values.name || t(labels.singular)}
        back={{ href: listHref, label: t(labels.plural) }}
        actions={
          <>
            {isNew && (
              <Button variant="outlined" color="inherit" onClick={submit(true)} disabled={pending}>
                {t('Guardar y agregar otro')}
              </Button>
            )}
            <Button type="submit" variant="contained" disabled={pending || (!isNew && !formState.isDirty)}>
              {pending ? t('Guardando…') : isNew ? t('Crear') : t('Guardar')}
            </Button>
          </>
        }
      />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={2.5}>
            <SectionCard>
              <Stack spacing={2}>
                <Controller
                  control={control}
                  name="type"
                  render={({ field }) => (
                    <ToggleButtonGroup exclusive size="small" value={field.value} onChange={(_, v) => v && field.onChange(v)} aria-label={t('Tipo')}>
                      <ToggleButton value="product" sx={{ gap: 0.75, px: 1.5, textTransform: 'none' }}>
                        <Package size={15} /> {t('Producto')}
                      </ToggleButton>
                      <ToggleButton value="service" sx={{ gap: 0.75, px: 1.5, textTransform: 'none' }}>
                        <Wrench size={15} /> {t('Servicio')}
                      </ToggleButton>
                    </ToggleButtonGroup>
                  )}
                />
                <TextFieldControl control={control} name="name" label={t('Nombre')} required autoFocus={isNew} />
                <TextFieldControl
                  control={control}
                  name="shortDescription"
                  label={t('Descripción corta')}
                  multiline
                  minRows={2}
                  helperText={t('Se muestra en la tarjeta. {count}/300', { count: values.shortDescription?.length ?? 0 })}
                />
                <WriteWithGarfield kind="item_short" getInput={() => garfieldInput(values.shortDescription ?? '')} onPick={(text) => setValue('shortDescription', text, { shouldDirty: true, shouldValidate: true })} />
              </Stack>
            </SectionCard>

            <SectionCard title={t('Imágenes')} description={t('La primera es la imagen principal.')}>
              <Controller control={control} name="images" render={({ field }) => <GalleryField value={field.value} onChange={field.onChange} />} />
            </SectionCard>

            <SectionCard title={t('Precio')} description={values.type === 'service' ? t('Déjalo vacío si el precio es a cotizar.') : undefined}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextFieldControl
                    control={control}
                    name="price"
                    label={t('Precio')}
                    inputMode="decimal"
                    slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextFieldControl
                    control={control}
                    name="compareAtPrice"
                    label={t('Precio anterior')}
                    inputMode="decimal"
                    helperText={t('Opcional. Muestra una oferta.')}
                    slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <SelectControl control={control} name="currency" label={t('Moneda')} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
                </Grid>
                {values.compareAtPrice?.trim() && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextFieldControl
                      control={control}
                      name="saleEndsOn"
                      type="date"
                      label={t('Oferta hasta (opcional)')}
                      helperText={t('Después de ese día se quita el precio anterior y vuelve el precio normal.')}
                      slotProps={{ inputLabel: { shrink: true } }}
                    />
                  </Grid>
                )}
                {values.type === 'product' && !values.variantsEnabled && (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextFieldControl
                        control={control}
                        name="nextPrice"
                        label={t('Nuevo precio (programado)')}
                        inputMode="decimal"
                        helperText={t('Opcional: desde la fecha, tu sitio y los pedidos usan este precio.')}
                        slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextFieldControl control={control} name="nextPriceOn" type="date" label={t('A partir del')} slotProps={{ inputLabel: { shrink: true } }} />
                    </Grid>
                  </>
                )}
                {values.type === 'product' && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextFieldControl
                      control={control}
                      name="cost"
                      label={t('Costo (sólo tú lo ves)')}
                      inputMode="decimal"
                      helperText={marginText}
                      slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                    />
                  </Grid>
                )}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextFieldControl
                    control={control}
                    name="priceNote"
                    label={t('Nota del precio')}
                    placeholder={values.type === 'service' ? t('desde, por hora, por sesión…') : t('por kg, c/u, paquete…')}
                  />
                </Grid>
              </Grid>
            </SectionCard>

            {values.type === 'product' && !values.variantsEnabled && (
              <SectionCard title={t('Precio por mayoreo')}>
                <TiersField control={control} />
              </SectionCard>
            )}

            {values.type === 'product' && (
              <SectionCard
                title={t('Opciones')}
                action={
                  <CopyFromProduct
                    label={t('Copiar las opciones de otro producto')}
                    sources={others.filter((item) => item.variants)}
                    detail={(item) => item.variants!.options.map((o) => o.name).join(', ')}
                    onPick={copyVariants}
                  />
                }
              >
                <VariantsField control={control} basePrice={values.price ?? ''} />
              </SectionCard>
            )}

            {values.type === 'product' && (
              <SectionCard
                title={t('Extras y horario')}
                action={
                  <CopyFromProduct
                    label={t('Copiar los extras de otro producto')}
                    sources={others.filter((item) => item.extras)}
                    detail={(item) => item.extras!.options.map((o) => o.name).join(', ')}
                    onPick={copyExtras}
                  />
                }
              >
                <Stack spacing={3}>
                  <ExtrasField control={control} />
                  <OrderHoursField control={control} />
                </Stack>
              </SectionCard>
            )}

            <SectionCard
              title={t('Atributos')}
              description={previewSite.attributeDefs.length ? t('Datos propios de tu catálogo. Se muestran en tarjetas, ficha y PDF según cada atributo.') : undefined}
            >
              {previewSite.attributeDefs.length ? (
                <Controller control={control} name="attributeValues" render={({ field }) => <ItemAttributesFields defs={previewSite.attributeDefs} value={field.value} onChange={field.onChange} />} />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {attributesHintBefore}
                  <Link href="/dashboard/catalog/attributes">{t('Catálogo › Atributos')}</Link>
                  {attributesHintAfter}
                </Typography>
              )}
            </SectionCard>

            <Accordion variant="outlined" disableGutters defaultExpanded={Boolean(defaultValues.description || defaultValues.sku || defaultValues.tags.length)} sx={{ '&:before': { display: 'none' }, borderRadius: 1.5 }}>
              <AccordionSummary expandIcon={<ChevronDown size={16} />} sx={{ px: 2.5 }}>
                <Box>
                  <Typography variant="h3">{t('Más detalles')}</Typography>
                  <Typography variant="body2" color="text.secondary">{t('Descripción completa, código y etiquetas.')}</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2.5, pb: 2.5 }}>
                <Stack spacing={2}>
                  <TextFieldControl control={control} name="description" label={t('Descripción completa')} multiline minRows={4} helperText={t('Se muestra en la página del ítem.')} />
                  <WriteWithGarfield kind="item_description" getInput={() => garfieldInput(values.description ?? '')} onPick={(text) => setValue('description', text, { shouldDirty: true, shouldValidate: true })} />
                  <TextFieldControl control={control} name="sku" label={t('Código / SKU')} sx={{ maxWidth: 280 }} />
                  <Controller
                    control={control}
                    name="tags"
                    render={({ field, fieldState }) => (
                      <Autocomplete
                        multiple
                        freeSolo
                        options={[]}
                        value={field.value}
                        onChange={(_, v) => field.onChange((v as string[]).map((tag) => tag.trim()).filter(Boolean))}
                        renderValue={(value, getItemProps) =>
                          value.map((option, index) => {
                            const { key, ...itemProps } = getItemProps({ index });
                            return <Chip key={key} label={option} {...itemProps} />;
                          })
                        }
                        renderInput={(params) => (
                          <TextField {...params} label={t('Etiquetas')} placeholder={t('Escribe y presiona Enter')} error={Boolean(fieldState.error)} helperText={fieldState.error?.message ? t(fieldState.error.message) : t('Ayudan a encontrar el ítem con el buscador.')} />
                        )}
                      />
                    )}
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2.5} sx={{ position: { md: 'sticky' }, top: { md: 80 } }}>
            <SectionCard title={t('Estado')}>
              <Stack spacing={0.5}>
                <SwitchControl control={control} name="isVisible" label={t('Visible en el catálogo')} description={t('Si lo apagas, sólo tú lo ves.')} />
                <SwitchControl control={control} name="isAvailable" label={t('Disponible')} description={t('Si no, se muestra como agotado.')} />
                <SwitchControl control={control} name="isFeatured" label={t('Destacado')} description={t('Aparece en la sección Destacados.')} />
                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                  <TextFieldControl control={control} name="seasonFrom" type="date" label={t('Visible desde')} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextFieldControl control={control} name="seasonUntil" type="date" label={t('Visible hasta')} slotProps={{ inputLabel: { shrink: true } }} />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {t('Opcional, para productos de temporada: fuera de esas fechas no se ve en tu sitio (aquí sí).')}
                </Typography>
                {values.type === 'product' && (
                  <TextFieldControl
                    control={control}
                    name="stock"
                    label={t('Existencias (opcional)')}
                    inputMode="numeric"
                    helperText={t('Vacío: no se controlan. Con pocas se muestra «¡Quedan 3!» y en 0 queda agotado. Los pedidos no las descuentan: actualízalas tú.')}
                    sx={{ mt: 1.5 }}
                  />
                )}
              </Stack>
            </SectionCard>
            <SectionCard title={t('Dieta y alérgenos')} description={t('Se muestran en la ficha y tus clientes pueden filtrar por ellas.')}>
              <Controller
                control={control}
                name="diet"
                render={({ field }) => (
                  <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                    {DIET_TAGS.map((tag) => {
                      const active = field.value.includes(tag);
                      return (
                        <Chip
                          key={tag}
                          label={t(DIET_OPTION_LABELS[tag])}
                          color={active ? 'success' : 'default'}
                          variant={active ? 'filled' : 'outlined'}
                          aria-pressed={active}
                          onClick={() => field.onChange(active ? field.value.filter((d) => d !== tag) : DIET_TAGS.filter((d) => d === tag || field.value.includes(d)))}
                        />
                      );
                    })}
                  </Stack>
                )}
              />
            </SectionCard>
            <SectionCard title={t('Badges')} description={t('Etiquetas sobre la foto. Oferta y Agotado son automáticos.')}>
              <Controller
                control={control}
                name="badges"
                render={({ field }) => (
                  <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                    {(['new', 'popular', 'featured'] as const).map((key) => {
                      const active = field.value.includes(key);
                      const label = previewSite.theme.badges[key].label;
                      return (
                        <Chip
                          key={key}
                          label={label}
                          color={active ? 'primary' : 'default'}
                          variant={active ? 'filled' : 'outlined'}
                          onClick={() => field.onChange(active ? field.value.filter((b) => b !== key) : [...field.value, key])}
                        />
                      );
                    })}
                  </Stack>
                )}
              />
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                <TextFieldControl control={control} name="customBadgeLabel" label={t('Badge personalizado')} placeholder={t('Ej. Sin gluten')} helperText={t('Opcional. Máximo 20 caracteres.')} />
                {values.customBadgeLabel && (
                  <Controller control={control} name="customBadgeColor" render={({ field }) => <ColorField label={t('Color del badge')} value={field.value} onChange={field.onChange} />} />
                )}
              </Stack>
            </SectionCard>
            <SectionCard title={t('Combínalo con')} description={t('Hasta 4 productos o servicios que se sugieren en la ficha. Sin elegir, se sugieren solos.')}>
              <Controller
                control={control}
                name="pairings"
                render={({ field, fieldState }) => (
                  <Autocomplete
                    multiple
                    options={others.map((item) => item.id)}
                    value={field.value}
                    onChange={(_, ids) => field.onChange(ids.slice(0, 4))}
                    getOptionLabel={(id) => others.find((item) => item.id === id)?.name ?? t('Ítem eliminado')}
                    getOptionDisabled={(id) => field.value.length >= 4 && !field.value.includes(id)}
                    renderInput={(params) => <TextField {...params} label={t('Productos sugeridos')} error={Boolean(fieldState.error)} helperText={fieldState.error?.message ? t(fieldState.error.message) : undefined} />}
                  />
                )}
              />
            </SectionCard>
            <SectionCard title={t('Categoría')}>
              <SelectControl
                control={control}
                name="categoryId"
                label={t('Categoría')}
                options={[{ value: '', label: t('Sin categoría') }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              />
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                <Box component={Link} href="/dashboard/catalog/categories" sx={{ color: 'primary.main' }}>
                  {t('Administrar categorías')}
                </Box>
              </Typography>
            </SectionCard>
            <ItemCardPreview site={previewSite} values={values} categoryName={categories.find((c) => c.id === values.categoryId)?.name} />
          </Stack>
        </Grid>
      </Grid>

      {!isNew && <SaveBar visible={formState.isDirty} saving={pending} onDiscard={() => reset()} formId={FORM_ID} />}
    </Box>
  );
}
